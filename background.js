// Gérer le téléchargement de l'image pour contourner les restrictions de sécurité (CORS) de la page web
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadImage") {
        const filename = "pinterest_" + request.url.split('/').pop();
        
        chrome.downloads.download({
            url: request.url,
            filename: filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Erreur de téléchargement :", chrome.runtime.lastError);
            }
        });
        
        sendResponse({status: "Download started"});
    }
});

// À l'installation, on peut définir des réglages par défaut
chrome.runtime.onInstalled.addListener(() => {
    console.log("Pinterest Purifier installé !");
});