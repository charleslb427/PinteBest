// --- NUCLÉARISATION DES PUBS AU NIVEAU RÉSEAU (INTERCEPTEUR API) ---
(function () {
    function removeAdsFromData(obj) {
        if (Array.isArray(obj)) {
            return obj.filter(item => {
                if (item && (item.is_ad || item.is_promoted || item.is_promoted_pin || (item.pin && (item.pin.is_ad || item.pin.is_promoted)))) {
                    return false; // On supprime purement et simplement la pub des données !
                }
                return true;
            }).map(removeAdsFromData);
        } else if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            for (const key in obj) {
                newObj[key] = removeAdsFromData(obj[key]);
            }
            return newObj;
        }
        return obj;
    }

    // Intercepter fetch (GraphQL / API modernes)
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
        if (url && url.includes('/resource/')) {
            const response = await originalFetch.apply(this, args);
            return response.text().then(text => {
                try {
                    let json = JSON.parse(text);
                    json = removeAdsFromData(json);
                    return new Response(JSON.stringify(json), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } catch (e) {
                    return new Response(text, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            });
        }
        return originalFetch.apply(this, args);
    };

    // Intercepter XMLHttpRequest (Ancienne API)
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
        this._url = typeof url === 'string' ? url : url.href;
        return open.apply(this, arguments);
    };

    XHR.send = function () {
        if (this._url && this._url.includes('/resource/')) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && (this.responseType === '' || this.responseType === 'text')) {
                    try {
                        let text = this.responseText;
                        if (text && text.includes('"is_ad"')) {
                            let json = JSON.parse(text);
                            json = removeAdsFromData(json);
                            Object.defineProperty(this, 'responseText', {
                                get: function () { return JSON.stringify(json); }
                            });
                            Object.defineProperty(this, 'response', {
                                get: function () { return JSON.stringify(json); }
                            });
                        }
                    } catch (e) { }
                }
            }, false);
        }
        return send.apply(this, arguments);
    };
})();

// CSS INJECTÉ DE FORCE (Contre les pubs récalcitrantes sur Safari Mobile)
const cssIntervention = document.createElement('style');
cssIntervention.innerHTML = `
    /* Hiding elements forcefully */
    div[data-test-id="pinWrapper"]:has([data-test-id="pin-ad-indicator"]),
    div[data-test-id="pinWrapper"]:has([data-test-id="ad-badge"]),
    div[data-test-id="pin"]:has(svg[aria-label*="Sponsor"]),
    div[data-test-id="pin"]:has(svg[aria-label*="Promot"]),
    .PinCard:has(svg[aria-label*="Sponsor"]),
    .pinWrapper:has([aria-label*="Annonce"]) {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0px !important;
        margin: 0px !important;
        padding: 0px !important;
    }
`;
document.head.appendChild(cssIntervention);

// --- CONFIGURATION PAR DÉFAUT ---
let settings = {
    blockAds: true,
    blockFastFashion: true,
    blockAI: true,
    hidePopups: true,
    keyboardNav: true
};

// Liste noire de la fast-fashion
const fastFashionDomains = ['temu.com', 'shein.', 'aliexpress.com', 'wish.com', 'romwe.com', 'cider.com'];

// Mots-clés indiquant du contenu sponsorisé dans différentes langues
const adKeywords = ['Sponsorisé', 'Promoted', 'Annonce', 'Ad', 'Sponsor', 'Promu'];

// --- INITIALISATION ---
chrome.storage.sync.get(settings, (loadedSettings) => {
    settings = loadedSettings;
    initObserver();
    if (settings.keyboardNav) initKeyboardNav();
    if (settings.hidePopups) forceUnlockScroll();
});

// --- MUTATION OBSERVER (Analyse le DOM en temps réel) ---
// Pinterest charge le contenu dynamiquement (Infinite Scroll). 
// On doit surveiller les nouveaux éléments ajoutés.
function initObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Si c'est un élément HTML
                        processNode(node);
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Traiter les éléments déjà présents au chargement
    document.querySelectorAll('[data-test-id="pinWrapper"]').forEach(processNode);
}

// --- TRAITEMENT DES PINS ---
function processNode(node) {
    // 1. Suppression des Popups de connexion
    if (settings.hidePopups) {
        if (node.querySelector && node.querySelector('[data-test-id="giftWrap"], .UnauthBanner, [data-test-id="login-modal-default"]')) {
            const popup = node.querySelector('[data-test-id="giftWrap"], .UnauthBanner, [data-test-id="login-modal-default"]');
            if (popup) popup.style.display = 'none !important';
        }
    }

    // Chercher tous les conteneurs de Pin dans ce noeud
    const pinSelectors = '[data-test-id="pin"], [data-test-id="pinWrapper"], [role="listitem"], .PinCard, .pinWrapper';
    const pins = node.matches && node.matches(pinSelectors) ? [node] : (node.querySelectorAll ? Array.from(node.querySelectorAll(pinSelectors)) : []);

    pins.forEach(pin => {
        const textContent = pin.innerText || "";
        const htmlContent = pin.innerHTML || "";
        const allText = pin.textContent || "";
        const contentHash = String(htmlContent.length);

        if (pin.dataset.purified === contentHash && pin.style.display !== 'none') return;
        pin.dataset.purified = contentHash;

        let shouldHide = false;

        // 2. Filtrage des Publicités (Adapté pour Mobile Web)
        if (settings.blockAds) {
            // Regex pour rechercher des mots avec des espaces insécables ou invisibles
            const isAdText = adKeywords.some(keyword => textContent.includes(keyword));

            // Sélecteurs d'icônes ou de badges cachés
            const hasAdIndicator = pin.querySelector && pin.querySelector('[data-test-id="pin-ad-indicator"], [data-test-id="ad-badge"], svg[aria-label*="Sponsor"], svg[aria-label*="Promot"], [aria-label*="Annonce"]');

            // Liens sortants suspects ou traceurs de clics
            const hasAdLink = Array.from(pin.querySelectorAll('a')).some(link => link.href.includes('/ad/') || link.href.includes('out.pinterest.com') || link.href.includes('trk.pinterest.com'));

            if (isAdText || hasAdIndicator || hasAdLink) {
                shouldHide = true;
            }
        }

        // 3. Filtrage de la Fast Fashion
        if (!shouldHide && settings.blockFastFashion) {
            const links = pin.querySelectorAll('a');
            links.forEach(link => {
                const href = link.href.toLowerCase();
                if (fastFashionDomains.some(domain => href.includes(domain))) {
                    shouldHide = true;
                }
            });
        }

        // 4. Masquer le Pin si nécessaire
        if (shouldHide) {
            pin.style.display = 'none';
            pin.style.opacity = '0';
            return; // On arrête le traitement pour ce pin
        }
    });

    // 5. Cacher "More Ideas" et "Suggested Boards"
    const sectionTitles = node.querySelectorAll ? node.querySelectorAll('h2') : [];
    sectionTitles.forEach(title => {
        const text = title.innerText.toLowerCase();
        if (text.includes('idées') || text.includes('more ideas') || text.includes('suggested')) {
            const section = title.closest('div'); // Remonter au conteneur parent
            if (section) section.style.display = 'none';
        }
    });
}

// --- NAVIGATION CLAVIER ---
function initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        // Uniquement si on est sur la vue détaillée d'un pin (/pin/12345...)
        if (!window.location.pathname.startsWith('/pin/')) return;

        // Ne rien faire si on tape dans un champ de recherche ou de commentaire
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            const prevBtn = document.querySelector('[data-test-id="canonical-navigation-prev"]');
            if (prevBtn) prevBtn.click();
        } else if (e.key === 'ArrowRight') {
            const nextBtn = document.querySelector('[data-test-id="canonical-navigation-next"]');
            if (nextBtn) nextBtn.click();
        }
    });
}

// --- FORCER LE DÉBLOCAGE DU SCROLL (Dark pattern) ---
function forceUnlockScroll() {
    setInterval(() => {
        if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }
    }, 1000);
}

// --- SCANNER DOM BRUTAL (Pour Mobile Web persistant) ---
// Pinterest mobile utilise des techniques très agressives pour cacher les pubs au code
function startAggressiveScanner() {
    setInterval(() => {
        if (!settings.blockAds) return;

        // 1. Chercher par texte de force dans tous les petits noeuds
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue.toLowerCase().trim();
            if (text === 'sponsorisé' || text === 'promoted' || text === 'annonce' || text === 'sponsor' || text === 'promu') {
                let parent = node.parentNode;
                // Remonter jusqu'au conteneur majeur le plus proche (limite 8 niveaux)
                let depth = 0;
                while (parent && parent !== document.body && depth < 8) {
                    if (parent.getAttribute && (parent.getAttribute('data-test-id') === 'pin' || parent.getAttribute('role') === 'listitem' || parent.className.includes('pinWrapper') || parent.className.includes('PinCard'))) {
                        parent.style.display = 'none';
                        parent.style.opacity = '0';
                        parent.style.pointerEvents = 'none';
                        parent.innerHTML = ''; // Destruction nucléaire du contenu HTML pour éviter les re-chargements React
                        break;
                    }
                    parent = parent.parentNode;
                    depth++;
                }
            }
        }

        // 2. Chercher les liens publicitaires directs
        const adLinks = document.querySelectorAll('a[href*="/ad/"], a[href*="trk.pinterest.com"], a[href*="out.pinterest.com"]');
        adLinks.forEach(link => {
            let parent = link.parentNode;
            let depth = 0;
            while (parent && parent !== document.body && depth < 8) {
                if (parent.getAttribute && (parent.getAttribute('data-test-id') === 'pin' || parent.getAttribute('role') === 'listitem' || parent.className.includes('pinWrapper'))) {
                    parent.style.display = 'none';
                    parent.style.opacity = '0';
                    parent.innerHTML = '';
                    break;
                }
                parent = parent.parentNode;
                depth++;
            }
        });
    }, 500);
}

// Lancer le scanner brutal au démarrage
startAggressiveScanner();