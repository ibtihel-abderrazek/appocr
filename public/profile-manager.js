// profile-manager.js - Gestionnaire principal des profils de scanner avec support OCR

class ProfileManager {
    constructor() {
        this.profiles = [];
        this.scanners = [];
        this.selectedProfile = null;
        this.apiService = null;
        this.popupManager = null;
        this.ocrConfigManager = null;
        this.isLoading = false;
        
        // Configuration des champs par onglet
        this.fieldsByTab = {
            general: {
                required: ['DisplayName'],
                fields: {
                    'DisplayName': { label: 'Nom du profil ', type: 'text', required: true },
                    'Version': { label: 'Version', type: 'number', default: '5' },
                    'IconID': { label: 'Icône ID', type: 'number', default: '0' },
                    'IsDefault': { label: 'Profil par défaut', type: 'checkbox' },
                    'MaxQuality': { 
                        label: 'Qualité maximale', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'UseNativeUI': { 
                        label: 'Interface native', 
                        type: 'checkbox',
                        toggles: ['MaxQuality', 'Resolution', 'BitDepth', 'Quality', 'PaperSource', 'PageSize', 'PageAlign', 'AutoDeskew', 'Brightness', 'Contrast', 'RotateDegrees', 'TwainProgress', 'BrightnessContrastAfterScan']
                    }
                }
            },
            device: {
                fields: {
                    'Device.ID': { label: 'ID de l\'appareil', type: 'select', source: 'scanners' },
                    'Device.Name': { label: 'Nom de l\'appareil', type: 'select', source: 'scanners' },
                    'DriverName': { label: 'Driver', type: 'select', options: ['twain', 'wia'], default: 'twain' },
                    'TwainImpl': { label: 'Implémentation TWAIN', type: 'select', options: ['Default', 'OldDsm', 'Legacy'], default: 'Default' }
                }
            },
            scan: {
                fields: {
                    'Resolution': { 
                        label: 'Résolution', 
                        type: 'select', 
                        options: ['Dpi50', 'Dpi100', 'Dpi150', 'Dpi200', 'Dpi300', 'Dpi400', 'Dpi600'], 
                        default: 'Dpi200',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BitDepth': { 
                        label: 'Profondeur de couleur', 
                        type: 'select', 
                        options: ['C24Bit', 'C8Bit'], 
                        default: 'C24Bit',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'Quality': { 
                        label: 'Qualité JPEG (%)', 
                        type: 'number', 
                        min: 1, 
                        max: 100, 
                        default: 75,
                        dependsOn: 'MaxQuality',
                        hideWhen: true
                    },
                    'PaperSource': { 
                        label: 'Source papier', 
                        type: 'select', 
                        options: ['Glass', 'Feeder'], 
                        default: 'Glass',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'PageSize': { 
                        label: 'Taille de page', 
                        type: 'select', 
                        options: ['Letter', 'A4', 'Legal', 'Custom'], 
                        default: 'Letter',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'PageAlign': { 
                        label: 'Alignement', 
                        type: 'select', 
                        options: ['Left', 'Center', 'Right'], 
                        default: 'Center',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'AutoDeskew': { 
                        label: 'Redressement automatique', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'ExcludeBlankPages': { 
                        label: 'Exclure pages vides', 
                        type: 'checkbox',
                        toggles: ['BlankPageWhiteThreshold', 'BlankPageCoverageThreshold']
                    },
                    'ForcePageSize': { label: 'Forcer taille de page', type: 'checkbox' }
                }
            },
            advanced: {
                fields: {
                    'Brightness': { 
                        label: 'Luminosité', 
                        type: 'number', 
                        min: -100, 
                        max: 100, 
                        default: 0,
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'Contrast': { 
                        label: 'Contraste', 
                        type: 'number', 
                        min: -100, 
                        max: 100, 
                        default: 0,
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'RotateDegrees': { 
                        label: 'Rotation (degrés)', 
                        type: 'select', 
                        options: ['0', '90', '180', '270'], 
                        default: '0',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BlankPageWhiteThreshold': { 
                        label: 'Seuil blanc (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 70,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'BlankPageCoverageThreshold': { 
                        label: 'Seuil couverture (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 25,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'TwainProgress': { 
                        label: 'Afficher progression TWAIN', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BrightnessContrastAfterScan': { 
                        label: 'Appliquer corrections après scan', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'EnableAutoSave': { label: 'Sauvegarde automatique', type: 'checkbox' }
                }
            },
            // ONGLET OCR avec dépendances
            ocr: {
                fields: {
                    'OcrMode': { 
                        label: 'Activer OCR', 
                        type: 'checkbox', 
                        default: false,
                        toggles: ['OcrLang'] // ✅ Seulement la langue
                    },
                    'OcrLang': { 
                        label: 'Langue de reconnaissance', 
                        type: 'select', 
                        options: [
                            { value: '', label: '🌐 Détection automatique' },
                            { value: 'ara', label: '🇸🇦 العربية (Arabe)' },
                            { value: 'fra', label: '🇫🇷 Français' },
                            { value: 'eng', label: '🇺🇸 English (Anglais)' }
                        ],
                        default: 'fra',
                        dependsOn: 'OcrMode',
                        hideWhen: false
                    },
                    'OcrPatchMode': {
                        label: 'Mode traitement par lots (Patch)',
                        type: 'checkbox',
                        default: false,
                        toggles: ['OcrPatchNaming', 'PatchMode'] // ✅ patch toggle ses enfants
                    },
                    'OcrPatchNaming': {
                        label: 'Stratégie de nommage des fichiers',
                        type: 'select',
                        options: [
                            { value: 'barcode_ocr_generic', label: '🎯 Code-barres → OCR → Générique (Recommandé)' },
                            { value: 'barcode', label: '📊 Code-barres uniquement' },
                            { value: 'ocr', label: '🔤 OCR de texte uniquement' },
                            { value: 'generic', label: '📝 Nommage générique simple' }
                        ],
                        default: 'barcode_ocr_generic',
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false
                    },
                    'PatchMode': {
                        label: 'Mode Patch',
                        type: 'select',
                        options: [
                            { value: 'T_classique', label: '⚡ Traitement classique (Standard)' },
                            { value: 'T_with_bookmarks', label: '🔖 Traitement avec signets automatiques' }
                        ],
                        default: 'T_classique',
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false
                    },
                    'OcrNamingPattern': {
                        label: 'Modèle de nommage automatique',
                        type: 'naming-pattern',
                        default: '$(DD)-$(MM)-$(YYYY)-$(n)',
                        // ✅ plus de dependsOn → indépendant
                    },
                    'OcrPdfMode': { 
                        label: 'Format de sortie', 
                        type: 'select', 
                        options: [
                            { value: 'pdfa', label: '📚 PDF/A (Recommandé - Archivage long terme)' },
                            { value: 'pdf', label: '📄 PDF Standard' }
                        ],
                        default: 'pdfa',
                        // ✅ plus de dependsOn → indépendant
                    }
                }
            }

        };
    }

    async init() {
        console.log('Initialisation du ProfileManager...');
        this.setupEventHandlers();
        await this.loadInitialData();
        console.log('ProfileManager initialisé avec succès');
    }

    setupEventHandlers() {
        // Boutons principaux
        const btnRefresh = document.getElementById('btnRefresh');
        const btnAddProfile = document.getElementById('btnAddProfile');
        const btnDetails = document.getElementById('btnDetails');
        const btnEdit = document.getElementById('btnEdit');
        const btnDelete = document.getElementById('btnDelete');
        const btnScan = document.getElementById('btnScan');

        if (btnRefresh) btnRefresh.onclick = () => this.loadProfiles();
        if (btnAddProfile) btnAddProfile.onclick = () => this.showAddPopup();
        if (btnDetails) btnDetails.onclick = () => this.showDetails();
        if (btnEdit) btnEdit.onclick = () => this.showEditPopup();
        if (btnDelete) btnDelete.onclick = () => this.deleteProfile();
        if (btnScan) btnScan.onclick = () => this.scanWithProfile();

        // Formulaires
        const addForm = document.getElementById('profileAddForm');
        const editForm = document.getElementById('profileEditForm');

        if (addForm) {
            addForm.onsubmit = (e) => {
                e.preventDefault();
                this.createProfile();
            };
        }

        if (editForm) {
            editForm.onsubmit = (e) => {
                e.preventDefault();
                this.updateProfile();
            };
        }

        // Gestion du clic sur les cartes
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.scanner-card');
            if (card) {
                this.selectProfile(card.dataset.profileName);
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadProfiles(),
                this.loadScanners()
            ]);
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
            this.showNotification('Erreur lors du chargement initial: ' + error.message, 'error');
        }
    }

    async loadProfiles() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const grid = document.getElementById('scannersGrid');
        
        try {
            grid.innerHTML = '<p class="loading-message">Chargement des profils...</p>';
            
            if (!this.apiService) {
                throw new Error('Service API non disponible');
            }
            
            const response = await this.apiService.getProfiles();
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors du chargement des profils');
            }
            
            this.profiles = response.profiles || [];
            this.renderProfiles();
            
        } catch (error) {
            console.error('Erreur chargement profils:', error);
            grid.innerHTML = `<p class="error-message">❌ Erreur: ${error.message}</p>`;
            this.showNotification('Impossible de charger les profils: ' + error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async loadScanners() {
        try {
            const response = await fetch('/scanners');
            if (response.ok) {
                const data = await response.json();
                this.scanners = data.scanners || [];
            } else {
                console.warn('Impossible de charger la liste des scanners');
                
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des scanners:', error);
            
        }
    }

    renderProfiles() {
        const grid = document.getElementById('scannersGrid');
        
        if (!this.profiles || this.profiles.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <h3>Aucun profil trouvé</h3>
                </div>
            `;
            return;
        }

        const profileCards = this.profiles.map(profileName => this.createProfileCard(profileName)).join('');
        grid.innerHTML = profileCards;
        
        if (this.selectedProfile) {
            const card = grid.querySelector(`[data-profile-name="${this.selectedProfile}"]`);
            if (card) {
                card.classList.add('selected');
            } else {
                this.selectedProfile = null;
                this.updateButtonStates();
            }
        }
    }

    createProfileCard(profileName) {
        const isSelected = this.selectedProfile === profileName;
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <div class="scanner-card ${selectedClass}" 
                 data-profile-name="${profileName}" 
                 role="button" 
                 tabindex="0"
                 aria-label="Profil ${profileName}">
                 <img src="images.jpg" width="100"><p class="scanner-name">${profileName}</p>
            </div>
        `;
    }

    selectProfile(profileName) {
        const oldSelected = document.querySelector('.scanner-card.selected');
        if (oldSelected) {
            oldSelected.classList.remove('selected');
        }

        const newSelected = document.querySelector(`[data-profile-name="${profileName}"]`);
        if (newSelected) {
            newSelected.classList.add('selected');
            this.selectedProfile = profileName;
        } else {
            this.selectedProfile = null;
        }

        this.updateButtonStates();
        this.showNotification(`Profil "${profileName}" sélectionné`, 'info');
    }

    updateButtonStates() {
        const hasSelection = !!this.selectedProfile;
        
        const buttonsToToggle = ['btnDetails', 'btnEdit', 'btnDelete', 'btnScan'];
        buttonsToToggle.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !hasSelection;
                btn.classList.toggle('disabled', !hasSelection);
            }
        });
    }

    async showAddPopup() {
        try {
            this.popupManager.show('addPopup', true);

            // Générer dynamiquement tous les onglets
            this.renderFormTab('general-tab', this.fieldsByTab.general.fields);
            this.renderFormTab('device-tab', this.fieldsByTab.device.fields);
            this.renderFormTab('scan-tab', this.fieldsByTab.scan.fields);
            this.renderFormTab('advanced-tab', this.fieldsByTab.advanced.fields);
            this.renderFormTab('ocr-tab', this.fieldsByTab.ocr.fields);

            // Configurer les dépendances après le rendu
            this.setupFieldDependencies('profileAddForm');

            setTimeout(() => {
                const firstInput = document.querySelector('#addPopup input[type="text"]');
                if (firstInput) firstInput.focus();
            }, 100);

        } catch (error) {
            console.error("Erreur lors de l'ouverture du popup:", error);
            this.showNotification("Erreur: " + error.message, "error");
        }
    }

    renderFormTab(tabId, fields, data = {}) {
        const tab = document.getElementById(tabId);
        if (!tab) return;

        let html = '<div class="form-grid">';
        
        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            html += this.createFormField(fieldName, fieldConfig, data);
        });
        
        html += '</div>';
        tab.innerHTML = html;
    }

createFormField(fieldName, fieldConfig, data = {}) {
    const fieldId = fieldName.replace(/\./g, '_');
    const rawValue = this.getFieldValue(data, fieldName);
    
    let value;
    if (rawValue !== undefined && rawValue !== null) {
        value = rawValue;
    } else {
        value = fieldConfig.default || '';
    }
    
    let inputHtml = '';
    let fieldClass = 'form-group';
    
    // Ajouter les classes de dépendance
    if (fieldConfig.dependsOn) {
        fieldClass += ` depends-on-${fieldConfig.dependsOn}`;
        if (fieldConfig.hideWhen) {
            fieldClass += ' hide-when-active';
        } else {
            fieldClass += ' show-when-active';
        }
    }
    
    console.log(`createFormField: ${fieldName} = ${value} (type: ${typeof value})`);
    
    switch (fieldConfig.type) {
        case 'text':
        case 'number':
            const attrs = fieldConfig.type === 'number' ? 
                `min="${fieldConfig.min || ''}" max="${fieldConfig.max || ''}"` : '';
            inputHtml = `<input type="${fieldConfig.type}" id="${fieldId}" name="${fieldName}" value="${value || ''}" ${attrs}>`;
            break;
            
        case 'select':
            let options = '';
            if (fieldConfig.source === 'scanners') {
                options = this.scanners.map(scanner => 
                    `<option value="${scanner.id}" ${value === scanner.id ? 'selected' : ''}>${scanner.name}</option>`
                ).join('');
            } else if (fieldConfig.options) {
                if (Array.isArray(fieldConfig.options) && typeof fieldConfig.options[0] === 'object') {
                    options = fieldConfig.options.map(option => 
                        `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>`
                    ).join('');
                } else {
                    options = fieldConfig.options.map(option => 
                        `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`
                    ).join('');
                }
            }
            inputHtml = `<select id="${fieldId}" name="${fieldName}">${options}</select>`;
            break;
            
        // ✅ NOUVEAU: Gestion du type 'naming-pattern'
        case 'naming-pattern':
            inputHtml = this.createNamingPatternBuilder(fieldId, fieldName, value);
            break;
            
        case 'checkbox':
            const isChecked = (
                value === true || 
                value === 'true' || 
                (typeof value === 'string' && value.toLowerCase() === 'true')
            );
            
            console.log(`Checkbox ${fieldName}: value=${value}, isChecked=${isChecked}`);
            
            const checked = isChecked ? 'checked' : '';
            const togglesAttr = fieldConfig.toggles ? `data-toggles="${fieldConfig.toggles.join(',')}"` : '';
            
            return `
                <div class="${fieldClass} checkbox-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="${fieldId}" name="${fieldName}" ${checked} ${togglesAttr}>
                        <label for="${fieldId}">${fieldConfig.label}</label>
                        ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
                    </div>
                </div>
            `;
    }

    return `
        <div class="${fieldClass}">
            <label for="${fieldId}">${fieldConfig.label}</label>
            ${inputHtml}
            ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
        </div>
    `;
}
createNamingPatternBuilder(fieldId, fieldName, value) {
    return `
        <div class="naming-pattern-builder">
            <div class="pattern-input-container">
                <input type="text" name="${fieldName}" id="${fieldId}" class="pattern-input" 
                       value="${value || ''}" 
                       placeholder="Cliquez sur les éléments ci-dessous pour construire votre modèle..."
                       onkeyup="updatePreview('${fieldId}')">
                <button type="button" class="clear-pattern-btn" onclick="clearPattern('${fieldId}')" title="Effacer tout">🗑</button>
            </div>
            
            <div class="pattern-preview">
                <strong>Aperçu :</strong> <span id="${fieldId}_preview">${this.generatePreview(value || '')}</span>
            </div>
            
            <div class="substitutions-section">
                <div class="section-title">📅 Date et Heure</div>
                <div class="substitution-grid">
                    <div class="substitution-item" onclick="addToPattern('$(YYYY)', '${fieldId}')">
                        <div class="substitution-code">$(YYYY)</div>
                        <div class="substitution-desc">Année complète</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(YY)', '${fieldId}')">
                        <div class="substitution-code">$(YY)</div>
                        <div class="substitution-desc">Année (00-99)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(MM)', '${fieldId}')">
                        <div class="substitution-code">$(MM)</div>
                        <div class="substitution-desc">Mois (01-12)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(DD)', '${fieldId}')">
                        <div class="substitution-code">$(DD)</div>
                        <div class="substitution-desc">Jour (01-31)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(HH)', '${fieldId}')">
                        <div class="substitution-code">$(HH)</div>
                        <div class="substitution-desc">Heure (00-23)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(mm)', '${fieldId}')">
                        <div class="substitution-code">$(mm)</div>
                        <div class="substitution-desc">Minute (00-59)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(ss)', '${fieldId}')">
                        <div class="substitution-code">$(ss)</div>
                        <div class="substitution-desc">Seconde (00-59)</div>
                    </div>
                </div>
                
                <div class="section-title">🔢 Numéros</div>
                <div class="substitution-grid">
                    <div class="substitution-item" onclick="addToPattern('$(nnn)', '${fieldId}')">
                        <div class="substitution-code">$(nnn)</div>
                        <div class="substitution-desc">Numéro 3 chiffres (ex: 001)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(nn)', '${fieldId}')">
                        <div class="substitution-code">$(nn)</div>
                        <div class="substitution-desc">Numéro 2 chiffres (ex: 01)</div>
                    </div>
                    <div class="substitution-item" onclick="addToPattern('$(n)', '${fieldId}')">
                        <div class="substitution-code">$(n)</div>
                        <div class="substitution-desc">Numéro 1 chiffre (ex: 1)</div>
                    </div>
                </div>
            </div>
            
            <div class="examples-section">
                <div class="examples-title">💡 Modèles couramment utilisés :</div>
                
                <div class="example-item" onclick="setPattern('$(YYYY)-$(MM)-$(DD)', '${fieldId}')">
                    <span class="example-pattern">$(YYYY)-$(MM)-$(DD)</span>
                    <span class="example-result">→ 2025-09-14</span>
                </div>
                
                <div class="example-item" onclick="setPattern('$(DD)-$(MM)-$(YYYY)', '${fieldId}')">
                    <span class="example-pattern">$(DD)-$(MM)-$(YYYY)</span>
                    <span class="example-result">→ 14-09-2025</span>
                </div>
                
                <div class="example-item" onclick="setPattern('$(YYYY)$(MM)$(DD)_$(nnn)', '${fieldId}')">
                    <span class="example-pattern">$(YYYY)$(MM)$(DD)_$(nnn)</span>
                    <span class="example-result">→ 20250914_001</span>
                </div>
            </div>
        </div>
        
        <small>Le fichier sera automatiquement nommé selon le modèle construit ci-dessus.</small>
    `;
}

generatePreview(pattern) {
    if (!pattern) return '';
    
    const now = new Date();
    const replacements = {
        '$(YYYY)': now.getFullYear().toString(),
        '$(YY)': now.getFullYear().toString().slice(-2),
        '$(MM)': (now.getMonth() + 1).toString().padStart(2, '0'),
        '$(DD)': now.getDate().toString().padStart(2, '0'),
        '$(HH)': now.getHours().toString().padStart(2, '0'),
        '$(mm)': now.getMinutes().toString().padStart(2, '0'),
        '$(ss)': now.getSeconds().toString().padStart(2, '0'),
        '$(nnn)': '001',
        '$(nn)': '01',
        '$(n)': '1'
    };
    
    let preview = pattern;
    Object.entries(replacements).forEach(([token, value]) => {
        preview = preview.replace(new RegExp('\\$\\(' + token.slice(2, -1) + '\\)', 'g'), value);
    });
    
    return preview;
}

setupFieldDependencies(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    console.log(`Setting up field dependencies for form: ${formId}`);

    form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
        const toggledFields = checkbox.getAttribute('data-toggles').split(',').map(f => f.trim());
        
        console.log(`Setup dependencies for ${checkbox.name}: toggles [${toggledFields.join(', ')}], currently ${checkbox.checked ? 'checked' : 'unchecked'}`);
        
        const updateDependentFields = () => {
            const isChecked = checkbox.checked;
            console.log(`Updating dependencies for ${checkbox.name}: ${isChecked}`);
            
            toggledFields.forEach(fieldName => {
                // ⚡ Ignorer les champs Patch (OcrPatchNaming, PatchMode)
                if (['OcrPatchNaming', 'PatchMode'].includes(fieldName)) return;

                // ----- reste du code générique pour trouver et afficher/masquer -----
                const dependentSelectors = [
                    `.depends-on-${fieldName}`,
                    `[data-depends-on="${fieldName}"]`,
                    `.form-group:has([name*="${fieldName}"])`
                ];
                
                let dependentElements = [];
                dependentSelectors.forEach(selector => {
                    try {
                        const elements = form.querySelectorAll(selector);
                        dependentElements.push(...elements);
                    } catch (e) {}
                });

                if (dependentElements.length === 0) {
                    const fieldElement = form.querySelector(`[name="${fieldName}"], [name*="${fieldName}"]`);
                    if (fieldElement) {
                        const container = fieldElement.closest('.form-group');
                        if (container) dependentElements.push(container);
                    }
                }

                dependentElements.forEach(element => {
                    const input = element.querySelector('input, select, textarea');
                    
                    if (element.classList.contains('hide-when-active')) {
                        element.style.display = isChecked ? 'none' : 'block';
                        if (input) {
                            input.disabled = isChecked;
                            if (isChecked && input.type !== 'checkbox') input.value = '';
                        }
                    } else {
                        element.style.display = isChecked ? 'block' : 'none';
                        if (input) {
                            input.disabled = !isChecked;
                            if (!isChecked && input.type !== 'checkbox') input.value = '';
                        }
                    }
                });
            });
        };

        updateDependentFields();
        checkbox.removeEventListener('change', updateDependentFields);
        checkbox.addEventListener('change', updateDependentFields);
    });

    // Traitement spécial OCR (OcrLang, OcrPatchNaming, PatchMode)
    this.setupOcrFieldDependencies(form);
}



setupOcrFieldDependencies(form) {
    console.log('Setting up OCR-specific field dependencies');

    // ----- OCR Mode (langue) -----
    const ocrModeCheckbox = form.querySelector('input[name="OcrMode"]');
    if (ocrModeCheckbox) {
        const updateOcrLanguageField = () => {
            const isOcrEnabled = ocrModeCheckbox.checked;
            const languageFieldContainer = form.querySelector(`[name="OcrLang"]`)?.closest('.form-group');
            if (languageFieldContainer) {
                languageFieldContainer.style.display = isOcrEnabled ? 'block' : 'none';
                const languageInput = languageFieldContainer.querySelector('select');
                if (languageInput) languageInput.disabled = !isOcrEnabled;
            }
        };
        updateOcrLanguageField();
        ocrModeCheckbox.removeEventListener('change', updateOcrLanguageField);
        ocrModeCheckbox.addEventListener('change', updateOcrLanguageField);
    }

    // ----- Patch Mode -----
    const ocrPatchModeCheckbox = form.querySelector('input[name="OcrPatchMode"]');
    if (ocrPatchModeCheckbox) {

        const updatePatchFields = () => {
            const isPatchEnabled = ocrPatchModeCheckbox.checked;
            const patchDependentFields = ['OcrPatchNaming', 'PatchMode'];

            patchDependentFields.forEach(fieldName => {
                const fieldContainer = form.querySelector(`[name="${fieldName}"]`)?.closest('.form-group');
                if (fieldContainer) {
                    // Toujours forcer visible quand checkbox activée, sinon masqué
                    fieldContainer.style.display = isPatchEnabled ? 'block' : 'none';
                    const input = fieldContainer.querySelector('input, select');
                    if (input) input.disabled = !isPatchEnabled;

                    // Si désactivé, réinitialiser la valeur
                    if (!isPatchEnabled && input && input.type !== 'checkbox') input.value = '';
                }
            });
        };


        updatePatchFields();
        ocrPatchModeCheckbox.removeEventListener('change', updatePatchFields);
        ocrPatchModeCheckbox.addEventListener('change', updatePatchFields);
    }
}


renderEditTab(containerId, fields, data) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
    }

    console.log(`Rendering edit tab: ${containerId} with data:`, data);

    let html = '';
    
    Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
        // Chaque champ dans son propre .form-group pour éviter les toggle qui cachent le parent
        html += `<div class="form-group">${this.createFormField(fieldName, fieldConfig, data)}</div>`;
    });
    
    container.innerHTML = html;

    // ✅ Setup des dépendances après que le DOM soit mis à jour
    setTimeout(() => {
        console.log(`Setting up dependencies for form: profileEditForm`);
        this.setupFieldDependencies('profileEditForm');
    }, 50);
}



debugFieldStates(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    console.log('=== DEBUG FIELD STATES ===');
    
    // Déboguer tous les champs OCR
    const ocrFields = [
        'OcrMode', 'OcrLang', 'OcrNamingPattern', 'OcrPdfMode',
        'OcrPatchMode', 'OcrPatchNaming', 'PatchMode'
    ];
    
    ocrFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        const container = field?.closest('.form-group');
        
        if (field) {
            console.log(`${fieldName}:`, {
                value: field.type === 'checkbox' ? field.checked : field.value,
                disabled: field.disabled,
                visible: container ? getComputedStyle(container).display !== 'none' : 'unknown',
                type: field.type
            });
        } else {
            console.log(`${fieldName}: NOT FOUND`);
        }
    });
    
    console.log('========================');
}

debugFormState(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    console.log('=== Debug Form State ===');
    
    // Vérifier les champs OCR spécifiquement
    const ocrFields = ['OcrMode', 'OcrPatchMode', 'PatchMode'];
    ocrFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) {
            if (field.type === 'checkbox') {
                console.log(`${fieldName}: checked=${field.checked}, value=${field.value}`);
            } else {
                console.log(`${fieldName}: value="${field.value}"`);
            }
        } else {
            console.warn(`Champ ${fieldName} non trouvé`);
        }
    });
    console.log('========================');
}

// 4. Modifier showEditPopup pour mieux gérer le chargement
async showEditPopup(profileName = null) {
    const target = profileName || this.selectedProfile;
    if (!target) {
        this.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    try {
        console.log(`Ouverture édition pour: ${target}`);
        
        const response = await this.apiService.getProfile(target);
        if (!response.success) {
            throw new Error(response.error || 'Profil non trouvé');
        }

        // Charger la configuration OCR
        const ocrConfig = await this.loadOcrConfig(target);
        const completeProfile = { ...response.profile, ...ocrConfig };
        
        console.log('Profil complet pour édition:', completeProfile);

        this.popupManager.show('editPopup', true);
        
        // Attendre que la popup soit visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Rendre le formulaire
        this.renderEditForm(completeProfile);
        
        // ✅ Attendre encore un peu puis forcer la mise à jour
        setTimeout(() => {
            this.setupFieldDependencies('profileEditForm');
            this.debugFieldStates('profileEditForm');
            
            // ✅ Forcer un événement change sur tous les checkboxes pour s'assurer que les dépendances sont correctes
            const form = document.getElementById('profileEditForm');
            if (form) {
                form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    const event = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(event);
                });
            }
        }, 300);
        
    } catch (error) {
        console.error('Erreur ouverture édition:', error);
        this.showNotification('Erreur: ' + error.message, 'error');
    }
}

// 5. Ajouter une méthode pour forcer la mise à jour d'un champ spécifique
forceFieldUpdate(formId, fieldName, value) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    
    if (field.type === 'checkbox') {
        const shouldCheck = value === true || value === 'true';
        field.checked = shouldCheck;
        console.log(`Force update ${fieldName}: ${shouldCheck}`); // Debug
        
        // Déclencher l'événement change pour mettre à jour les dépendances
        const event = new Event('change', { bubbles: true });
        field.dispatchEvent(event);
    } else {
        field.value = value || '';
        console.log(`Force update ${fieldName}: "${field.value}"`); // Debug
    }
}

// 6. Modifier updateProfile pour rafraîchir l'interface après la sauvegarde
async updateProfile() {
    if (!this.selectedProfile) {
        this.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    try {
        console.log('Début mise à jour profil...');
        
        const formData = this.collectFormData('profileEditForm');
        console.log('Données formulaire mise à jour:', formData);
        
        const { ocrData, profileData } = this.separateOcrData(formData);
        console.log('Données séparées - Profil:', profileData, 'OCR:', ocrData);

        const response = await this.apiService.updateProfile(this.selectedProfile, profileData);
        console.log('Réponse mise à jour profil:', response);
        
        if (!response.success) {
            throw new Error(response.error || 'Erreur lors de la mise à jour');
        }

        if (this.hasOcrConfigFromSeparatedData(ocrData)) {
            try {
                console.log('Configuration OCR détectée pour mise à jour...');
                await this.saveOcrConfigSeparately(this.selectedProfile, ocrData);
                console.log('Configuration OCR mise à jour avec succès');
            } catch (ocrError) {
                console.error('Erreur mise à jour OCR:', ocrError);
                this.showNotification(`Profil mis à jour mais erreur OCR: ${ocrError.message}`, 'warning');
            }
        }

        this.popupManager.hide('editPopup', true);
        this.showNotification('Profil mis à jour avec succès', 'success');
        
        // ✅ CORRECTION 6: Rafraîchir les profils et maintenir la sélection
        await this.loadProfiles();
        
        // Maintenir la sélection après le rechargement
        if (this.selectedProfile) {
            const card = document.querySelector(`[data-profile-name="${this.selectedProfile}"]`);
            if (card) {
                card.classList.add('selected');
            }
        }
        
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        this.showNotification(`Erreur lors de la mise à jour: ${error.message}`, 'error');
    }
}

    getFieldValue(data, fieldPath) {
        return fieldPath.split('.').reduce((obj, key) => obj && obj[key], data);
    }
    
    async createProfile() {
        try {
            console.log('Début création profil...');
            
            const formData = this.collectFormData('profileAddForm');
            console.log('Données formulaire collectées:', formData);
            
            if (!formData.DisplayName) {
                throw new Error('Le nom du profil est obligatoire');
            }

            const { ocrData, profileData } = this.separateOcrData(formData);
            console.log('Données séparées - Profil:', profileData, 'OCR:', ocrData);

            const response = await this.apiService.createProfile(profileData);
            console.log('Réponse création profil:', response);
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la création');
            }

            if (this.hasOcrConfigFromSeparatedData(ocrData)) {
                try {
                    console.log('Configuration OCR détectée, sauvegarde...');
                    await this.saveOcrConfigSeparately(formData.DisplayName, ocrData);
                    console.log('Configuration OCR sauvegardée avec succès');
                } catch (ocrError) {
                    console.error('Erreur sauvegarde OCR:', ocrError);
                    this.showNotification(`Profil créé mais erreur OCR: ${ocrError.message}`, 'warning');
                }
            } else {
                console.log('Aucune configuration OCR active détectée');
            }

            this.popupManager.hide('addPopup', true);
            this.showNotification('Profil créé avec succès', 'success');
            await this.loadProfiles();
            
        } catch (error) {
            console.error('Erreur création profil:', error);
            this.showNotification(`Erreur lors de la création: ${error.message}`, 'error');
        }
    }

  separateOcrData(formData) {
    const ocrFields = [
        'OcrMode', 'OcrLang', 'OcrNamingPattern', 'OcrPdfMode',
        'OcrPatchMode', 'OcrPatchNaming', 'PatchMode'
    ];
    const ocrData = {};
    const profileData = { ...formData };
    
    ocrFields.forEach(field => {
        if (formData.hasOwnProperty(field)) {
            let value = formData[field];
            
            // ✅ CORRECTION: Normaliser les valeurs booléennes
            if (field === 'OcrMode' || field === 'OcrPatchMode') {
                value = (value === true || value === 'true' || value === 'on');
            }
            
            ocrData[field] = value;
            delete profileData[field];
        }
    });
    
    console.log('Séparation données - OCR extrait:', ocrData);
    console.log('Séparation données - Profil restant:', profileData);
    
    return { ocrData, profileData };
}

    hasOcrConfigFromSeparatedData(ocrData) {
    const hasConfig = (
        ocrData.OcrMode === true || 
        ocrData.OcrMode === 'true' ||
        ocrData.OcrPatchMode === true ||
        ocrData.OcrPatchMode === 'true' ||
        (ocrData.OcrLang && ocrData.OcrLang !== 'fra') ||  // Différent de la valeur par défaut
        (ocrData.OcrNamingPattern && ocrData.OcrNamingPattern !== '$(DD)-$(MM)-$(YYYY)-$(n)') ||
        (ocrData.OcrPdfMode && ocrData.OcrPdfMode !== 'pdfa') ||
        (ocrData.OcrPatchNaming && ocrData.OcrPatchNaming !== 'barcode_ocr_generic') ||
        (ocrData.PatchMode && ocrData.PatchMode !== 'T_classique')
    );
    
    console.log('Vérification OCR séparée:', {
        ocrData: ocrData,
        hasConfig: hasConfig,
        breakdown: {
            ocrMode: ocrData.OcrMode === true || ocrData.OcrMode === 'true',
            ocrPatchMode: ocrData.OcrPatchMode === true || ocrData.OcrPatchMode === 'true',
            customLang: ocrData.OcrLang && ocrData.OcrLang !== 'fra',
            customNaming: ocrData.OcrNamingPattern && ocrData.OcrNamingPattern !== '$(DD)-$(MM)-$(YYYY)-$(n)',
            customPdfMode: ocrData.OcrPdfMode && ocrData.OcrPdfMode !== 'pdfa',
            customPatchNaming: ocrData.OcrPatchNaming && ocrData.OcrPatchNaming !== 'barcode_ocr_generic',
            customPatchMode: ocrData.PatchMode && ocrData.PatchMode !== 'T_classique'
        }
    });
    
    return hasConfig;
}

    async saveOcrConfigSeparately(profileName, ocrData) {
    try {
        const ocrConfig = {
            profileName: profileName,
            ocrMode: ocrData.OcrMode === true || ocrData.OcrMode === 'true',
            lang: ocrData.OcrLang || 'fra',
            namingPattern: ocrData.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: ocrData.OcrPdfMode || 'pdfa',
            patchEnabled: ocrData.OcrPatchMode === true || ocrData.OcrPatchMode === 'true', // ✅ OcrPatchMode -> patchEnabled
            patchNaming: ocrData.OcrPatchNaming || 'barcode_ocr_generic',
            patchType: ocrData.PatchMode || 'T_classique'  // ✅ PatchMode -> patchType
        };

        console.log('Configuration OCR séparée à sauvegarder:', ocrConfig);

        if (this.ocrConfigManager) {
            await this.ocrConfigManager.saveConfig(profileName, ocrConfig);
        } else {
            const response = await fetch('/api/profile/ocr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ocrConfig)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('Réponse serveur OCR:', result);
        }
        
    } catch (error) {
        console.error('Erreur sauvegarde OCR séparée:', error);
        throw error;
    }
}

    async updateProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            console.log('Début mise à jour profil...');
            
            const formData = this.collectFormData('profileEditForm');
            console.log('Données formulaire mise à jour:', formData);
            
            const { ocrData, profileData } = this.separateOcrData(formData);
            console.log('Données séparées - Profil:', profileData, 'OCR:', ocrData);

            const response = await this.apiService.updateProfile(this.selectedProfile, profileData);
            console.log('Réponse mise à jour profil:', response);
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la mise à jour');
            }

            if (this.hasOcrConfigFromSeparatedData(ocrData)) {
                try {
                    console.log('Configuration OCR détectée pour mise à jour...');
                    await this.saveOcrConfigSeparately(this.selectedProfile, ocrData);
                    console.log('Configuration OCR mise à jour avec succès');
                } catch (ocrError) {
                    console.error('Erreur mise à jour OCR:', ocrError);
                    this.showNotification(`Profil mis à jour mais erreur OCR: ${ocrError.message}`, 'warning');
                }
            }

            this.popupManager.hide('editPopup', true);
            this.showNotification('Profil mis à jour avec succès', 'success');
            await this.loadProfiles();
            
        } catch (error) {
            console.error('Erreur mise à jour profil:', error);
            this.showNotification(`Erreur lors de la mise à jour: ${error.message}`, 'error');
        }
    }

    async showDetails(profileName = null) {
        const target = profileName || this.selectedProfile;
        if (!target) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            const response = await this.apiService.getProfile(target);
            if (!response.success) {
                throw new Error(response.error || 'Profil non trouvé');
            }

            // Charger la configuration OCR
            const ocrConfig = await this.loadOcrConfig(target);
            const completeProfile = { ...response.profile, ...ocrConfig };

            this.renderViewPopup(completeProfile);
            this.popupManager.show('viewPopup');
            
        } catch (error) {
            console.error('Erreur affichage détails:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async showEditPopup(profileName = null) {
        const target = profileName || this.selectedProfile;
        if (!target) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            const response = await this.apiService.getProfile(target);
            if (!response.success) {
                throw new Error(response.error || 'Profil non trouvé');
            }

            // Charger la configuration OCR
            const ocrConfig = await this.loadOcrConfig(target);
            const completeProfile = { ...response.profile, ...ocrConfig };

            this.renderEditForm(completeProfile);
            this.popupManager.show('editPopup', true);

            // Configurer les dépendances après le rendu
            this.setupFieldDependencies('profileEditForm');
            
        } catch (error) {
            console.error('Erreur ouverture édition:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async loadOcrConfig(profileName) {
    try {
        console.log(`Chargement config OCR pour: ${profileName}`); // Debug
        
        // ✅ Ajouter cache busting pour forcer le rechargement
        const timestamp = Date.now();
        const response = await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}?_t=${timestamp}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Données OCR reçues du serveur:', data); // Debug
            
            // ✅ Mapping correct des champs
            const config = {
                OcrMode: data.ocrMode,
                OcrLang: data.lang,
                OcrNamingPattern: data.namingPattern,
                OcrPdfMode: data.pdfMode,
                OcrPatchMode: data.patchEnabled, // ✅ patchEnabled du serveur -> OcrPatchMode frontend
                OcrPatchNaming: data.patchNaming,
                PatchMode: data.patchType || data.patchMode || 'T_classique' // ✅ patchType du serveur -> PatchMode frontend
            };
            
            console.log('Config OCR mappée pour le frontend:', config); // Debug
            return config;
        } else {
            console.warn(`Pas de config OCR trouvée pour ${profileName} (${response.status})`);
        }
    } catch (error) {
        console.warn('Aucune configuration OCR trouvée pour', profileName, error);
    }
    
    // Retourner une config par défaut si aucune trouvée
    return {
        OcrMode: false,
        OcrLang: 'fra',
        OcrNamingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
        OcrPdfMode: 'pdfa',
        OcrPatchMode: false,
        OcrPatchNaming: 'barcode_ocr_generic',
        PatchMode: 'T_classique'
    };
}

    renderViewPopup(profileData) {
        // Rendre chaque onglet en mode lecture seule
        this.renderViewTab('viewGeneralContent', this.fieldsByTab.general.fields, profileData);
        this.renderViewTab('viewDeviceContent', this.fieldsByTab.device.fields, profileData);
        this.renderViewTab('viewScanContent', this.fieldsByTab.scan.fields, profileData);
        this.renderViewTab('viewAdvancedContent', this.fieldsByTab.advanced.fields, profileData);
        this.renderViewTab('viewOcrContent', this.fieldsByTab.ocr.fields, profileData);
    }

    renderEditForm(profileData) {
        // Rendre chaque onglet en mode édition
        this.renderEditTab('editGeneralContent', this.fieldsByTab.general.fields, profileData);
        this.renderEditTab('editDeviceContent', this.fieldsByTab.device.fields, profileData);
        this.renderEditTab('editScanContent', this.fieldsByTab.scan.fields, profileData);
        this.renderEditTab('editAdvancedContent', this.fieldsByTab.advanced.fields, profileData);
        this.renderEditTab('editOcrContent', this.fieldsByTab.ocr.fields, profileData);
    }

    renderViewTab(containerId, fields, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = '<div class="profile-details">';
        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            const value = this.getFieldValue(data, fieldName);
            const displayValue = this.formatDisplayValue(value, fieldConfig);
            html += `
                <div class="detail-item">
                    <span class="detail-label">${fieldConfig.label}:</span>
                    <span class="detail-value">${displayValue}</span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }
    renderEditTab(containerId, fields, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = '<div class="form-grid">';
        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            html += this.createFormField(fieldName, fieldConfig, data);
        });
        html += '</div>';
        container.innerHTML = html;
    }
    formatDisplayValue(value, fieldConfig) {
        if (value === null || value === undefined || value === '') {
            return '<em>Non défini</em>';
        }
        if (fieldConfig.type === 'checkbox') {
            return (value === 'true' || value === true) ? '✅ Activé' : '❌ Désactivé';
        }
        // Pour les select avec options complexes, afficher le label
        if (fieldConfig.type === 'select' && fieldConfig.options && Array.isArray(fieldConfig.options) && typeof fieldConfig.options[0] === 'object') {
            const option = fieldConfig.options.find(opt => opt.value === value);
            return option ? this.escapeHtml(option.label) : this.escapeHtml(String(value));
        }
        return this.escapeHtml(String(value));
    }
    async deleteProfile(profileName = null) {
        const target = profileName || this.selectedProfile;
        if (!target) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }
        if (!confirm(`Voulez-vous vraiment supprimer le profil "${target}" ?\n\nCette action est irréversible.`)) {
            return;
        }
        try {
            const response = await this.apiService.deleteProfile(target);
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la suppression');
            }
            // Supprimer aussi la configuration OCR et le fichier patch
            await this.deleteOcrConfig(target);
            await this.deleteOcrPatchConfig(target);
            if (this.selectedProfile === target) {
                this.selectedProfile = null;
                this.updateButtonStates();
            }
            this.showNotification('Profil supprimé avec succès', 'success');
            await this.loadProfiles();  
        } catch (error) {
            console.error('Erreur suppression profil:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }
    async deleteOcrConfig(profileName) {
        try {
            await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}`, {
                method: 'DELETE'
            });
            console.log('Configuration OCR supprimée pour:', profileName);
        } catch (error) {
            console.warn('Erreur suppression config OCR:', error);
        }
    }
    async deleteOcrPatchConfig(profileName) {
        try {
            await fetch(`/api/profile/ocr/patch/${encodeURIComponent(profileName)}`, {
                method: 'DELETE'
            });
            console.log('Configuration OCR Patch supprimée pour:', profileName);
        } catch (error) {
            console.warn('Erreur suppression config OCR Patch:', error);
        }
    }
    scanWithProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }
        this.showNotification(`Démarrage du scan avec le profil "${this.selectedProfile}"...`, 'info');
        setTimeout(() => {
            this.showNotification('Fonctionnalité de scan en cours de développement', 'info');
        }, 1000);
    }
    collectFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            throw new Error(`Formulaire ${formId} non trouvé`);
        }
        const formData = new FormData(form);
        const profileData = {};
        console.log('FormData brute:', [...formData.entries()]);
        // Collecter les données du formulaire
        for (let [key, value] of formData.entries()) {
            this.setNestedValue(profileData, key.split('.'), this.processValue(value));
        }
        // Gérer les checkboxes non cochées
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!formData.has(checkbox.name)) {
                console.log(`Checkbox non cochée: ${checkbox.name} = false`);
                this.setNestedValue(profileData, checkbox.name.split('.'), false);
            } else {
                console.log(`Checkbox cochée: ${checkbox.name} = true`);
                this.setNestedValue(profileData, checkbox.name.split('.'), true);
            }
        });
        console.log('Données finales collectées:', profileData);
        return profileData;
    }
    setNestedValue(obj, keys, value) {
        keys.reduce((curr, key, i) => {
            if (i === keys.length - 1) {
                curr[key] = value;
            } else {
                curr[key] = curr[key] || {};
            }
            return curr[key];
        }, obj);
    }
    processValue(value) {
        if (value === 'true' || value === 'false') return value === 'true';
        if (value === 'on') return true;
        if (!isNaN(value) && value !== '') return Number(value);
        return value;
    }
    showNotification(message, type = 'info') {
        if (window.Utils && window.Utils.showNotification) {
            window.Utils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    getDebugInfo() {
        return {
            profiles: this.profiles,
            selectedProfile: this.selectedProfile,
            scanners: this.scanners,
            isLoading: this.isLoading,
            ocrConfigManager: !!this.ocrConfigManager,
            apiService: !!this.apiService,
            popupManager: !!this.popupManager
        };
    }    
}
window.addToPattern = function(token, fieldId = 'OcrNamingPattern') {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value += token;
        updatePreview(fieldId);
        input.focus();
    }
};
window.setPattern = function(pattern, fieldId = 'OcrNamingPattern') {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = pattern;
        updatePreview(fieldId);
        input.focus();
    }
};
window.clearPattern = function(fieldId = 'OcrNamingPattern') {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = '';
        updatePreview(fieldId);
        input.focus();
    }
};
window.updatePreview = function(fieldId = 'OcrNamingPattern') {
    const input = document.getElementById(fieldId);
    const preview = document.getElementById(fieldId + '_preview');
    
    if (input && preview) {
        // Utiliser la méthode generatePreview si elle existe dans le contexte
        if (window.profileManager && window.profileManager.generatePreview) {
            preview.textContent = window.profileManager.generatePreview(input.value);
        } else {
            // Fallback simple
            const now = new Date();
            let previewText = input.value
                .replace(/\$\(YYYY\)/g, now.getFullYear())
                .replace(/\$\(YY\)/g, now.getFullYear().toString().slice(-2))
                .replace(/\$\(MM\)/g, (now.getMonth() + 1).toString().padStart(2, '0'))
                .replace(/\$\(DD\)/g, now.getDate().toString().padStart(2, '0'))
                .replace(/\$\(HH\)/g, now.getHours().toString().padStart(2, '0'))
                .replace(/\$\(mm\)/g, now.getMinutes().toString().padStart(2, '0'))
                .replace(/\$\(ss\)/g, now.getSeconds().toString().padStart(2, '0'))
                .replace(/\$\(nnn\)/g, '001')
                .replace(/\$\(nn\)/g, '01')
                .replace(/\$\(n\)/g, '1');
            
            preview.textContent = previewText || 'Aperçu vide';
        }
    }
};