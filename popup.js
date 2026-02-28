const options = [
    { id: 'blockAds', label: 'Bloquer les Posts Sponsorisés' },
    { id: 'blockFastFashion', label: 'Filtre Anti Fast-Fashion (Shein, Temu...)' },
    { id: 'hidePopups', label: 'Masquer les popups d\'inscription' },
    { id: 'keyboardNav', label: 'Navigation clavier (Flèches G/D)' }
];

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('settings-container');

    // Récupérer les paramètres sauvegardés ou utiliser les défauts
    chrome.storage.sync.get(options.map(o => o.id), (settings) => {
        options.forEach(opt => {
            // Création de l'élément HTML pour chaque option (Toggle)
            const row = document.createElement('div');
            row.className = "setting-row";
            
            // Initialisation de la valeur par défaut à true si non définie
            const isChecked = settings[opt.id] !== false; 

            row.innerHTML = `
                <span class="setting-label">${opt.label}</span>
                <div class="toggle-wrapper">
                    <input type="checkbox" id="${opt.id}" ${isChecked ? 'checked' : ''} class="toggle-checkbox" />
                    <label for="${opt.id}" class="toggle-label"></label>
                </div>
            `;
            container.appendChild(row);

            // Écouteur d'événement pour sauvegarder les changements
            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                const update = {};
                update[opt.id] = e.target.checked;
                chrome.storage.sync.set(update);
            });
        });
    });
});