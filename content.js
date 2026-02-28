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