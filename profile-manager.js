// profile-manager.js - Gestionnaire principal des profils de scanner avec support OCR et Patch intégré

class ProfileManager {
    constructor() {
        this.profiles = [];
        this.scanners = [];
        this.selectedProfile = null;
        this.apiService = null;
        this.popupManager = null;
        this.ocrConfigManager = null;
        this.isLoading = false;
        
        // Configuration des champs par onglet - MISE À JOUR AVEC AUTOSAVE
        this.fieldsByTab = {
            general: {
                required: ['DisplayName'],
                fields: {
                    'DisplayName': { label: 'Nom du profil', type: 'text', required: true },
                    'Device.Name': { label: 'Scanner', type: 'select', source: 'scanners' },
                    'IsDefault': { label: 'Définir comme profil par défaut', type: 'checkbox' },
                    'FlipDuplexedPages': { 
                        label: 'Activer recto-verso', 
                        type: 'checkbox',
                    },
                    'MaxQuality': { 
                        label: 'Utiliser la qualité maximale', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'UseNativeUI': { 
                        label: 'Utiliser l\'interface native du scanner', 
                        type: 'checkbox',
                        toggles: [
                            'MaxQuality', 'Resolution', 'BitDepth', 'Quality', 
                            'PaperSource', 'PageSize', 'PageAlign', 
                            'AutoDeskew', 'Brightness', 'Contrast', 
                            'RotateDegrees', 'TwainProgress', 'BrightnessContrastAfterScan'
                        ]
                    },
                    // Section AutoSave - NOUVEAU
                    'EnableAutoSave': { 
                        label: 'Activer la sauvegarde automatique', 
                        type: 'checkbox',
                        toggles: ['AutoSaveSettings.FilePath', 'AutoSaveSettings.PromptForFilePath', 'AutoSaveSettings.ClearImagesAfterSaving', 'AutoSaveSettings.Separator']
                    },
                    'AutoSaveSettings.FilePath': {
                        label: 'Chemin de sauvegarde automatique',
                        type: 'naming-pattern',
                        default: '$(DD)-$(MM)-$(YYYY)-$(n)',
                        dependsOn: 'EnableAutoSave',
                        hideWhen: false
                    },
                    'AutoSaveSettings.PromptForFilePath': {
                        label: 'Demander le chemin à chaque sauvegarde',
                        type: 'checkbox',
                        dependsOn: 'EnableAutoSave',
                        hideWhen: false
                    },
                    'AutoSaveSettings.ClearImagesAfterSaving': {
                        label: 'Effacer les images après sauvegarde',
                        type: 'checkbox',
                        dependsOn: 'EnableAutoSave',
                        hideWhen: false
                    },
                    'AutoSaveSettings.Separator': {
                        label: 'Mode de séparation des pages',
                        type: 'select',
                        options: [
                            { value: 'FilePerPage', label: 'Un fichier par page' },
                            { value: 'SingleFile', label: 'Un seul fichier pour toutes les pages' }
                        ],
                        default: 'FilePerPage',
                        dependsOn: 'EnableAutoSave',
                        hideWhen: false
                    },
                    // Champs cachés avec valeurs par défaut
                    'Version': { label: 'Version', type: 'hidden', default: '5' },
                    'IconID': { label: 'ID de l\'icône', type: 'hidden', default: '0' },
                    'Device.ID': { label: 'ID de l\'appareil', type: 'hidden', default: 'auto' },
                    'DriverName': { label: 'Pilote du scanner', type: 'hidden', default: 'twain' },
                }
            },
            scan: {
                fields: {
                    'Resolution': { 
                        label: 'Résolution (DPI)', 
                        type: 'select', 
                        options: [
                            { value: 'Dpi50', label: '50 DPI' },
                            { value: 'Dpi100', label: '100 DPI' },
                            { value: 'Dpi150', label: '150 DPI' },
                            { value: 'Dpi200', label: '200 DPI' },
                            { value: 'Dpi300', label: '300 DPI' },
                            { value: 'Dpi400', label: '400 DPI' },
                            { value: 'Dpi600', label: '600 DPI' }
                        ], 
                        default: 'Dpi200',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BitDepth': { 
                        label: 'Profondeur de couleur', 
                        type: 'select', 
                        options: [
                            { value: 'C24Bit', label: 'Couleur (24 bits)' },
                            { value: 'C8Bit', label: 'Niveaux de gris (8 bits)' }
                        ], 
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
                        options: [
                            { value: 'Glass', label: 'Vitre (Glass)' },
                            { value: 'Feeder', label: 'Chargeur automatique (Feeder)' }
                        ], 
                        default: 'Glass',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'PageSize': { 
                        label: 'Format de page', 
                        type: 'select', 
                        options: [
                            { value: 'Letter', label: 'Letter (US)' },
                            { value: 'A4', label: 'A4 (Standard)' },
                            { value: 'Legal', label: 'Legal (US)' },
                            { value: 'Custom', label: 'Personnalisé' }
                        ], 
                        default: 'A4',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'PageAlign': { 
                        label: 'Alignement de la page', 
                        type: 'select', 
                        options: [
                            { value: 'Left', label: 'Gauche' },
                            { value: 'Center', label: 'Centré' },
                            { value: 'Right', label: 'Droite' }
                        ], 
                        default: 'Center',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'AutoDeskew': { 
                        label: 'Redressement automatique des pages', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'ExcludeBlankPages': { 
                        label: 'Exclure les pages vides', 
                        type: 'checkbox',
                        toggles: ['BlankPageWhiteThreshold', 'BlankPageCoverageThreshold']
                    },
                    'ForcePageSize': { label: 'Forcer le format de page', type: 'checkbox' }
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
                        label: 'Rotation de l\'image (°)', 
                        type: 'select', 
                        options: [
                            { value: '0', label: '0° (aucune rotation)' },
                            { value: '90', label: '90°' },
                            { value: '180', label: '180°' },
                            { value: '270', label: '270°' }
                        ], 
                        default: '0',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BlankPageWhiteThreshold': { 
                        label: 'Seuil de blanc (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 70,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'BlankPageCoverageThreshold': { 
                        label: 'Seuil de couverture (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 25,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'TwainProgress': { 
                        label: 'Afficher la progression TWAIN', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'BrightnessContrastAfterScan': { 
                        label: 'Appliquer les corrections après numérisation', 
                        type: 'checkbox',
                        dependsOn: 'UseNativeUI',
                        hideWhen: true
                    },
                    'OcrMode': { 
                        label: 'Activer la reconnaissance de texte (OCR)', 
                        type: 'checkbox', 
                        default: false,
                        toggles: ['OcrLang']
                    },
                    'OcrLang': { 
                        label: 'Langue de reconnaissance OCR', 
                        type: 'select', 
                        options: [
                            { value: '', label: 'Détection automatique' },
                            { value: 'ara', label: 'Arabe' },
                            { value: 'fra', label: 'Français' },
                            { value: 'eng', label: 'Anglais' }
                        ],
                        default: 'fra',
                        dependsOn: 'OcrMode',
                        hideWhen: false
                    },
                }
            },
            ocr: {
                fields: {
                    'OcrPatchMode': {
                        label: 'Activer le traitement par lots (Patch)',
                        type: 'checkbox',
                        default: false,
                        toggles: ['OcrPatchNaming', 'PatchMode']
                    },
                    'OcrPatchNaming': {
                        label: 'Méthode de nommage des fichiers',
                        type: 'select',
                        options: [
                            { value: 'barcode_ocr_generic', label: 'Code-barres → OCR → Générique (Recommandé)' },
                            { value: 'barcode', label: 'Code-barres uniquement' },
                            { value: 'ocr', label: 'Texte OCR uniquement' },
                            { value: 'generic', label: 'Nommage générique simple' }
                        ],
                        default: 'barcode_ocr_generic',
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false
                    },
                    'PatchMode': {
                        label: 'Mode de traitement',
                        type: 'select',
                        options: [
                            { value: 'T_classique', label: 'Classique (Standard)' },
                            { value: 'T_with_bookmarks', label: 'Avec signets automatiques' }
                        ],
                        default: 'T_classique',
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false
                    },
                    'OcrPdfMode': { 
                        label: 'Format du fichier de sortie', 
                        type: 'select', 
                        options: [
                            { value: 'pdfa', label: 'PDF/A (Recommandé - Archivage long terme)' },
                            { value: 'pdf', label: 'PDF standard' }
                        ],
                        default: 'pdfa'
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
        const buttons = {
            'btnRefresh': () => this.loadProfiles(),
            'btnAddProfile': () => this.showAddPopup(),
            'btnDetails': () => this.showDetails(),
            'btnEdit': () => this.showEditPopup(),
            'btnDelete': () => this.deleteProfile(),
            'btnScan': () => this.scanWithProfile(),
            'btnScanPatch': () => this.scanAndPatchWithProfile()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.removeEventListener('click', handler);
                btn.addEventListener('click', handler);
            }
        });

        // Formulaires
        this.setupFormHandlers();

        // Gestion du clic sur les cartes
        document.removeEventListener('click', this.handleCardClick);
        document.addEventListener('click', this.handleCardClick.bind(this));
    }

    setupFormHandlers() {
        const forms = ['profileAddForm', 'profileEditForm'];
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                const handler = (e) => {
                    e.preventDefault();
                    if (formId === 'profileAddForm') {
                        this.createProfile();
                    } else {
                        this.updateProfile();
                    }
                };
                form.removeEventListener('submit', handler);
                form.addEventListener('submit', handler);
            }
        });
    }

    handleCardClick(e) {
        const card = e.target.closest('.scanner-card');
        if (card && card.dataset.profileName) {
            this.selectProfile(card.dataset.profileName);
        }
    }

    // Scanner et traiter avec Patch en une seule action
    async scanAndPatchWithProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            this.showNotification(`Démarrage du scan & patch avec le profil "${this.selectedProfile}"...`, 'info');
            
            const ocrConfig = await this.loadOcrConfig(this.selectedProfile);
            console.log('Configuration OCR chargée:', ocrConfig);

            const scanResponse = await this.triggerScan(this.selectedProfile);
            if (!scanResponse.success) {
                throw new Error(scanResponse.error || 'Erreur lors du scan');
            }

            this.showNotification('Scan terminé, traitement Patch en cours...', 'info');

            const patchData = this.buildPatchDataFromProfile(ocrConfig, scanResponse.filePath);
            const patchResponse = await this.processPatchWithConfig(patchData);
            
            if (!patchResponse.success) {
                throw new Error(patchResponse.error || 'Erreur lors du traitement Patch');
            }

            this.showNotification(
                `Scan & Patch terminés avec succès!\nFichier(s) généré(s): ${patchResponse.outputFiles?.join(', ') || 'Voir dossier de sortie'}`, 
                'success'
            );

        } catch (error) {
            console.error('Erreur Scan & Patch:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    renderProfiles() {
        const grid = document.getElementById('scannersGrid');
        
        if (!this.profiles || this.profiles.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">Aucun profil trouvé</div>
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
                 data-profile-name="${this.escapeHtml(profileName)}" 
                 role="button" 
                 tabindex="0"
                 aria-label="Profil ${this.escapeHtml(profileName)}">
                 <center><img src="images.png" width="50" alt="Icône profil"></center>
                 <p class="scanner-name">${this.escapeHtml(profileName)}</p>
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

    createNamingPatternBuilder(fieldId, fieldName, value) {
        return `
            <div class="naming-pattern-builder">
                <div class="pattern-preview">
                    <strong>Aperçu :</strong> <span id="${fieldId}_preview">${this.generatePreview(value || '')}</span>
                </div>
                <div class="pattern-input-container">
                    <input type="text" name="${fieldName}" id="${fieldId}" class="pattern-input" 
                           value="${this.escapeHtml(value || '')}" 
                           placeholder="Cliquez sur les éléments ci-dessous pour construire votre modèle..."
                           onkeyup="window.updatePreview && window.updatePreview('${fieldId}')">
                    <button type="button" class="clear-pattern-btn" 
                            onclick="window.clearPattern && window.clearPattern('${fieldId}')" 
                            title="Effacer tout">Effacer</button>
                </div>
                
                <div class="substitutions-section">
                    <div class="section-title">Date et Heure</div>
                    <div class="substitution-grid">
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(YYYY)', '${fieldId}')">
                            <div class="substitution-code">$(YYYY)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(YY)', '${fieldId}')">
                            <div class="substitution-code">$(YY)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(MM)', '${fieldId}')">
                            <div class="substitution-code">$(MM)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(DD)', '${fieldId}')">
                            <div class="substitution-code">$(DD)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(HH)', '${fieldId}')">
                            <div class="substitution-code">$(HH)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(mm)', '${fieldId}')">
                            <div class="substitution-code">$(mm)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(ss)', '${fieldId}')">
                            <div class="substitution-code">$(ss)</div>
                        </div>
                    </div>
                    
                    <div class="section-title">Numéros</div>
                    <div class="substitution-grid">
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(nnn)', '${fieldId}')">
                            <div class="substitution-code">$(nnn)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(nn)', '${fieldId}')">
                            <div class="substitution-code">$(nn)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(n)', '${fieldId}')">
                            <div class="substitution-code">$(n)</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <small>Le fichier sera automatiquement nommé selon le modèle construit ci-dessus.</small>
        `;
    }

    generatePreview(pattern) {
        if (!pattern) return 'Exemple: 18-09-2025-1';
        
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
            const regex = new RegExp('\\$\\(' + token.slice(2, -1) + '\\)', 'g');
            preview = preview.replace(regex, value);
        });
        
        return preview;
    }

    setupFieldDependencies(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        console.log(`Setting up field dependencies for form: ${formId}`);
        
        const isEditMode = formId === 'profileEditForm';

        // Nettoyer les anciens event listeners
        form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
            // Cloner le checkbox pour supprimer tous les event listeners
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });

        // Re-sélectionner après le clonage
        form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
            const toggledFields = checkbox.getAttribute('data-toggles')?.split(',').map(f => f.trim()) || [];
            
            console.log(`Setup dependencies for ${checkbox.name}: toggles [${toggledFields.join(', ')}], currently ${checkbox.checked ? 'checked' : 'unchecked'}`);
            
            const updateDependentFields = () => {
                const isChecked = checkbox.checked;
                console.log(`Updating dependencies for ${checkbox.name}: ${isChecked}`);
                
                toggledFields.forEach(fieldName => {
                    if (['OcrPatchNaming', 'PatchMode'].includes(fieldName)) return;

                    const field = form.querySelector(`[name="${fieldName}"]`);
                    const container = field?.closest('.form-group');
                    
                    if (container) {
                        if (isEditMode) {
                            container.style.display = 'block';
                            if (field) field.disabled = false;
                        } else {
                            if (container.classList && container.classList.contains('hide-when-active')) {
                                container.style.display = isChecked ? 'none' : 'block';
                                if (field) {
                                    field.disabled = isChecked;
                                    if (isChecked && field.type !== 'checkbox') field.value = '';
                                }
                            } else {
                                container.style.display = isChecked ? 'block' : 'none';
                                if (field) {
                                    field.disabled = !isChecked;
                                    if (!isChecked && field.type !== 'checkbox') field.value = '';
                                }
                            }
                        }
                    }
                });
            };

            updateDependentFields();
            checkbox.addEventListener('change', updateDependentFields);
        });

        this.setupOcrFieldDependencies(form);
        this.setupAutoSaveFieldDependencies(form);
    }

    setupAutoSaveFieldDependencies(form) {
        console.log('Setting up AutoSave field dependencies');

        const enableAutoSaveCheckbox = form.querySelector('input[name="EnableAutoSave"]');
        if (enableAutoSaveCheckbox) {
            // Nettoyer les anciens listeners
            const newCheckbox = enableAutoSaveCheckbox.cloneNode(true);
            enableAutoSaveCheckbox.parentNode.replaceChild(newCheckbox, enableAutoSaveCheckbox);

            const updateAutoSaveFields = () => {
                const isAutoSaveEnabled = newCheckbox.checked;
                const autoSaveDependentFields = [
                    'AutoSaveSettings.FilePath', 
                    'AutoSaveSettings.PromptForFilePath', 
                    'AutoSaveSettings.ClearImagesAfterSaving', 
                    'AutoSaveSettings.Separator'
                ];

                autoSaveDependentFields.forEach(fieldName => {
                    const field = form.querySelector(`[name="${fieldName}"]`);
                    const fieldContainer = field?.closest('.form-group');
                    if (fieldContainer) {
                        fieldContainer.style.display = isAutoSaveEnabled ? 'block' : 'none';
                        if (field) {
                            field.disabled = !isAutoSaveEnabled;
                            if (!isAutoSaveEnabled && field.type !== 'checkbox') {
                                if (fieldName === 'AutoSaveSettings.FilePath') {
                                    field.value = '$(YYYY)';
                                } else if (fieldName === 'AutoSaveSettings.Separator') {
                                    field.value = 'FilePerPage';
                                }
                            }
                        }
                    }
                });

                console.log(`AutoSave dependencies updated: ${isAutoSaveEnabled ? 'enabled' : 'disabled'}`);
            };

            updateAutoSaveFields();
            newCheckbox.addEventListener('change', updateAutoSaveFields);
        }
    }

    setupOcrFieldDependencies(form) {
        console.log('Setting up OCR-specific field dependencies');

        // OCR Mode (langue)
        const ocrModeCheckbox = form.querySelector('input[name="OcrMode"]');
        if (ocrModeCheckbox) {
            // Nettoyer les anciens listeners
            const newCheckbox = ocrModeCheckbox.cloneNode(true);
            ocrModeCheckbox.parentNode.replaceChild(newCheckbox, ocrModeCheckbox);

            const updateOcrLanguageField = () => {
                const isOcrEnabled = newCheckbox.checked;
                const languageFieldContainer = form.querySelector(`[name="OcrLang"]`)?.closest('.form-group');
                if (languageFieldContainer) {
                    languageFieldContainer.style.display = isOcrEnabled ? 'block' : 'none';
                    const languageInput = languageFieldContainer.querySelector('select');
                    if (languageInput) languageInput.disabled = !isOcrEnabled;
                }
            };
            updateOcrLanguageField();
            newCheckbox.addEventListener('change', updateOcrLanguageField);
        }

        // Patch Mode
        const ocrPatchModeCheckbox = form.querySelector('input[name="OcrPatchMode"]');
        if (ocrPatchModeCheckbox) {
            // Nettoyer les anciens listeners
            const newCheckbox = ocrPatchModeCheckbox.cloneNode(true);
            ocrPatchModeCheckbox.parentNode.replaceChild(newCheckbox, ocrPatchModeCheckbox);

            const updatePatchFields = () => {
                const isPatchEnabled = newCheckbox.checked;
                const patchDependentFields = ['OcrPatchNaming', 'PatchMode'];

                patchDependentFields.forEach(fieldName => {
                    const fieldContainer = form.querySelector(`[name="${fieldName}"]`)?.closest('.form-group');
                    if (fieldContainer) {
                        fieldContainer.style.display = isPatchEnabled ? 'block' : 'none';
                        const input = fieldContainer.querySelector('input, select');
                        if (input) input.disabled = !isPatchEnabled;

                        if (!isPatchEnabled && input && input.type !== 'checkbox') input.value = '';
                    }
                });
            };

            updatePatchFields();
            newCheckbox.addEventListener('change', updatePatchFields);
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
            html += `<div class="form-group">${this.createFormField(fieldName, fieldConfig, data)}</div>`;
        });
        
        container.innerHTML = html;
    }

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

            const ocrConfig = await this.loadOcrConfig(target);
            const completeProfile = { ...response.profile, ...ocrConfig };
            
            console.log('Profil complet pour édition:', completeProfile);

            this.popupManager.show('editPopup', true);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.renderEditForm(completeProfile);
            
            setTimeout(() => {
                this.setupFieldDependencies('profileEditForm');
                this.debugFieldVisibility('profileEditForm');
                
                const form = document.getElementById('profileEditForm');
                if (form) {
                    const useNativeUI = form.querySelector('[name="UseNativeUI"]');
                    if (useNativeUI && !useNativeUI.checked) {
                        this.forceShowHiddenFields(form);
                    }
                    
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

    forceShowHiddenFields(form) {
        const fieldsToShow = [
            'Resolution', 'BitDepth', 'Quality', 'PaperSource', 'PageSize', 
            'PageAlign', 'AutoDeskew', 'Brightness', 'Contrast', 'RotateDegrees', 
            'TwainProgress', 'BrightnessContrastAfterScan'
        ];
        
        fieldsToShow.forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            const container = field?.closest('.form-group');
            if (container) {
                container.style.display = 'block';
                if (field) field.disabled = false;
                console.log(`Force showing field: ${fieldName}`);
            }
        });
    }

    getFieldValue(data, fieldPath) {
        console.log(`getFieldValue: fieldPath="${fieldPath}", data=`, data);
        
        if (!fieldPath || !data) return undefined;
        
        const keys = fieldPath.split('.');
        let result = data;
        
        for (let key of keys) {
            if (result && typeof result === 'object' && result.hasOwnProperty(key)) {
                result = result[key];
            } else {
                console.log(`getFieldValue: clé "${key}" non trouvée dans`, result);
                return undefined;
            }
        }
        
        console.log(`getFieldValue: résultat final pour "${fieldPath}" =`, result);
        return result;
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
        'OcrMode', 'OcrLang', 'OcrPdfMode',
        'OcrPatchMode', 'OcrPatchNaming', 'PatchMode'
    ];
    
    // AJOUT: Champs AutoSave à traiter séparément
    const autoSaveFields = [
        'EnableAutoSave',
        'AutoSaveSettings.FilePath',
        'AutoSaveSettings.PromptForFilePath', 
        'AutoSaveSettings.ClearImagesAfterSaving',
        'AutoSaveSettings.Separator'
    ];
    
    const ocrData = {};
    const profileData = { ...formData };
    
    // Traitement des champs OCR
    ocrFields.forEach(field => {
        if (formData.hasOwnProperty(field)) {
            let value = formData[field];
            
            if (field === 'OcrMode' || field === 'OcrPatchMode') {
                value = (value === true || value === 'true' || value === 'on');
            }
            
            ocrData[field] = value;
            delete profileData[field];
        }
    });
    
    // NOUVEAU: Traitement spécial des champs AutoSave
    const hasAutoSave = formData.EnableAutoSave === true || 
                       formData.EnableAutoSave === 'true' || 
                       formData.EnableAutoSave === 'on';
    
    if (hasAutoSave) {
        console.log('AutoSave activé, traitement des champs AutoSave...');
        
        // Garder EnableAutoSave dans profileData mais traiter les sous-champs
        autoSaveFields.forEach(field => {
            if (field !== 'EnableAutoSave' && formData.hasOwnProperty(field)) {
                // Les garder dans profileData car ils font partie du profil de scan
                console.log(`Champ AutoSave conservé: ${field} = ${formData[field]}`);
            }
        });
        
        // Assurer les valeurs par défaut si manquantes
        if (!profileData['AutoSaveSettings.FilePath']) {
            profileData['AutoSaveSettings.FilePath'] = '$(DD)-$(MM)-$(YYYY)-$(n)';
        }
        if (!profileData['AutoSaveSettings.Separator']) {
            profileData['AutoSaveSettings.Separator'] = 'FilePerPage';
        }
        if (profileData['AutoSaveSettings.PromptForFilePath'] === undefined) {
            profileData['AutoSaveSettings.PromptForFilePath'] = false;
        }
        if (profileData['AutoSaveSettings.ClearImagesAfterSaving'] === undefined) {
            profileData['AutoSaveSettings.ClearImagesAfterSaving'] = false;
        }
    } else {
        console.log('AutoSave désactivé, suppression des champs AutoSave...');
        // Si AutoSave est désactivé, supprimer tous les sous-champs
        autoSaveFields.forEach(field => {
            delete profileData[field];
        });
    }
    
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
            (ocrData.OcrLang && ocrData.OcrLang !== 'fra') ||
            (ocrData.OcrPdfMode && ocrData.OcrPdfMode !== 'pdfa') ||
            (ocrData.OcrPatchNaming && ocrData.OcrPatchNaming !== 'barcode_ocr_generic') ||
            (ocrData.PatchMode && ocrData.PatchMode !== 'T_classique')
        );
        
        console.log('Vérification OCR séparée:', {
            ocrData: ocrData,
            hasConfig: hasConfig
        });
        
        return hasConfig;
    }

    async saveOcrConfigSeparately(profileName, ocrData) {
        try {
            const ocrConfig = {
                profileName: profileName,
                ocrMode: ocrData.OcrMode === true || ocrData.OcrMode === 'true',
                lang: ocrData.OcrLang || 'fra',
                pdfMode: ocrData.OcrPdfMode || 'pdfa',
                patchEnabled: ocrData.OcrPatchMode === true || ocrData.OcrPatchMode === 'true',
                patchNaming: ocrData.OcrPatchNaming || 'barcode_ocr_generic',
                patchType: ocrData.PatchMode || 'T_classique'
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

            const ocrConfig = await this.loadOcrConfig(target);
            const completeProfile = { ...response.profile, ...ocrConfig };

            this.renderViewPopup(completeProfile);
            this.popupManager.show('viewPopup');
            
        } catch (error) {
            console.error('Erreur affichage détails:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async loadOcrConfig(profileName) {
        try {
            console.log(`Chargement config OCR pour: ${profileName}`);
            
            const timestamp = Date.now();
            const response = await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}?_t=${timestamp}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Données OCR reçues du serveur:', data);
                
                const config = {
                    OcrMode: data.ocrMode,
                    OcrLang: data.lang,
                    OcrPdfMode: data.pdfMode,
                    OcrPatchMode: data.patchEnabled,
                    OcrPatchNaming: data.patchNaming,
                    PatchMode: data.patchType || data.patchMode || 'T_classique'
                };
                
                console.log('Config OCR mappée pour le frontend:', config);
                return config;
            } else {
                console.warn(`Pas de config OCR trouvée pour ${profileName} (${response.status})`);
            }
        } catch (error) {
            console.warn('Aucune configuration OCR trouvée pour', profileName, error);
        }
        
        return {
            OcrMode: false,
            OcrLang: 'fra',
            OcrPdfMode: 'pdfa',
            OcrPatchMode: false,
            OcrPatchNaming: 'barcode_ocr_generic',
            PatchMode: 'T_classique'
        };
    }

    renderViewTab(containerId, fields, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let html = '<div class="profile-details">';
        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            if (fieldConfig.type === 'hidden') return;
            
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

    formatDisplayValue(value, fieldConfig) {
        if (value === null || value === undefined || value === '') {
            return '<em>Non défini</em>';
        }
        if (fieldConfig.type === 'checkbox') {
            return (value === 'true' || value === true) ? 'Activé' : 'Désactivé';
        }
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

    async triggerScan(profileName) {
        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    profileName: profileName,
                    action: 'scan'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur scan ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Erreur triggerScan:', error);
            throw error;
        }
    }

    buildPatchDataFromProfile(ocrConfig, scannedFilePath) {
        return {
            filePath: scannedFilePath,
            containsPatch: true,
            patchMode: ocrConfig.PatchMode ? 'T_with_bookmarks' : 'T_classique',
            naming: ocrConfig.OcrPatchNaming || 'barcode_ocr_generic',
            ocrMode: ocrConfig.OcrMode || false,
            lang: ocrConfig.OcrLang || 'fra',
            pdfMode: ocrConfig.OcrPdfMode || 'pdfa'
        };
    }

    async processPatchWithConfig(patchData) {
        try {
            const formData = new FormData();
            
            Object.entries(patchData).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    formData.append(key, value);
                }
            });

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur traitement ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Erreur processPatchWithConfig:', error);
            throw error;
        }
    }

    updateButtonStates() {
        const hasSelection = !!this.selectedProfile;
        
        const buttonsToToggle = ['btnDetails', 'btnEdit', 'btnDelete', 'btnScan', 'btnScanPatch'];
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

            this.renderFormTab('general-tab', this.fieldsByTab.general.fields);
            this.renderFormTab('scan-tab', this.fieldsByTab.scan.fields);
            this.renderFormTab('advanced-tab', this.fieldsByTab.advanced.fields);
            this.renderFormTab('ocr-tab', this.fieldsByTab.ocr.fields);

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

    createFormField(fieldName, fieldConfig, data = {}) {
        const fieldId = fieldName.replace(/\./g, '_');
        const rawValue = this.getFieldValue(data, fieldName);
        
        console.log(`createFormField: fieldName="${fieldName}"`);
        
        let value;
        if (rawValue !== undefined && rawValue !== null) {
            value = rawValue;
        } else {
            value = fieldConfig.default || '';
        }

        if (fieldConfig.type === 'hidden') {
            return `<input type="hidden" id="${fieldId}" name="${fieldName}" value="${this.escapeHtml(String(value || ''))}">`; 
        }
        
        let inputHtml = '';
        let fieldClass = 'form-group';
        
        if (fieldConfig.dependsOn) {
            fieldClass += ` depends-on-${fieldConfig.dependsOn}`;
            if (fieldConfig.hideWhen) {
                fieldClass += ' hide-when-active';
            } else {
                fieldClass += ' show-when-active';
            }
        }
        
        switch (fieldConfig.type) {
            case 'text':
            case 'number':
                const attrs = fieldConfig.type === 'number' ? 
                    `min="${fieldConfig.min || ''}" max="${fieldConfig.max || ''}"` : '';
                inputHtml = `<input type="${fieldConfig.type}" id="${fieldId}" name="${fieldName}" value="${this.escapeHtml(String(value || ''))}" ${attrs}>`;
                break;
                
            case 'select':
                let options = '';
                if (fieldConfig.source === 'scanners') {
                    console.log(`Scanner options for ${fieldName}:`, this.scanners);
                    
                    options = this.scanners.map(scanner => {
                        const isSelected = value === scanner.id || value === scanner.name;
                        
                        const optionValue = fieldName === 'Device.ID' ? scanner.id : 
                                          fieldName === 'Device.Name' ? scanner.name : scanner.id;
                        const selected = value === optionValue ? 'selected' : '';
                        
                        return `<option value="${this.escapeHtml(optionValue)}" ${selected}>${this.escapeHtml(scanner.name)}</option>`;
                    }).join('');
                } else if (fieldConfig.options) {
                    if (Array.isArray(fieldConfig.options) && typeof fieldConfig.options[0] === 'object') {
                        options = fieldConfig.options.map(option => 
                            `<option value="${this.escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${this.escapeHtml(option.label)}</option>`
                        ).join('');
                    } else {
                        options = fieldConfig.options.map(option => 
                            `<option value="${this.escapeHtml(String(option))}" ${value === option ? 'selected' : ''}>${this.escapeHtml(String(option))}</option>`
                        ).join('');
                    }
                }
                inputHtml = `<select id="${fieldId}" name="${fieldName}">${options}</select>`;
                break;
                
            case 'naming-pattern':
                inputHtml = this.createNamingPatternBuilder(fieldId, fieldName, value);
                break;
                
            case 'checkbox':
                const isChecked = (
                    value === true || 
                    value === 'true' || 
                    (typeof value === 'string' && value.toLowerCase() === 'true')
                );
                
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

    renderEditForm(profileData) {
        this.renderEditTab('editGeneralContent', this.fieldsByTab.general.fields, profileData);
        this.renderEditTab('editScanContent', this.fieldsByTab.scan.fields, profileData);
        this.renderEditTab('editAdvancedContent', this.fieldsByTab.advanced.fields, profileData);
        this.renderEditTab('editOcrContent', this.fieldsByTab.ocr.fields, profileData);
    }

    renderViewPopup(profileData) {
        this.renderViewTab('viewGeneralContent', this.fieldsByTab.general.fields, profileData);
        this.renderViewTab('viewScanContent', this.fieldsByTab.scan.fields, profileData);
        this.renderViewTab('viewAdvancedContent', this.fieldsByTab.advanced.fields, profileData);
        this.renderViewTab('viewOcrContent', this.fieldsByTab.ocr.fields, profileData);
    }

    collectFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            throw new Error(`Formulaire ${formId} non trouvé`);
        }
        
        const formData = new FormData(form);
        const profileData = {};
        
        console.log('FormData brute:', [...formData.entries()]);
        
        for (let [key, value] of formData.entries()) {
            console.log(`Processing form field: ${key} = ${value}`);
            this.setNestedValue(profileData, key.split('.'), this.processValue(value));
        }
        
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!formData.has(checkbox.name)) {
                console.log(`Checkbox non cochée: ${checkbox.name} = false`);
                this.setNestedValue(profileData, checkbox.name.split('.'), false);
            } else {
                console.log(`Checkbox cochée: ${checkbox.name} = true`);
                this.setNestedValue(profileData, checkbox.name.split('.'), true);
            }
        });

        this.addHiddenFieldDefaults(profileData);
        
        console.log('Données finales collectées:', profileData);
        return profileData;
    }

    addHiddenFieldDefaults(profileData) {
        Object.entries(this.fieldsByTab.general.fields).forEach(([fieldName, fieldConfig]) => {
            if (fieldConfig.type === 'hidden' && fieldConfig.default) {
                if (fieldName === 'Device.ID' && fieldConfig.default === 'auto' && profileData.Device?.Name) {
                    const scanner = this.scanners.find(s => s.name === profileData.Device.Name);
                    if (scanner) {
                        this.setNestedValue(profileData, fieldName.split('.'), scanner.id);
                        return;
                    }
                }
                
                if (!this.getFieldValue(profileData, fieldName)) {
                    this.setNestedValue(profileData, fieldName.split('.'), fieldConfig.default);
                }
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
            if (grid) grid.innerHTML = '<p class="loading-message">Chargement des profils...</p>';
            
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
            if (grid) grid.innerHTML = `<p class="error-message">❌ Erreur: ${error.message}</p>`;
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
                console.log('Scanners chargés:', this.scanners);
            } else {
                console.warn('Impossible de charger la liste des scanners');
                this.scanners = [];
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des scanners:', error);
            this.scanners = [];
        }
    }

    async scanWithProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            this.showNotification(`Démarrage du scan avec le profil "${this.selectedProfile}"...`, 'info');
            
            const scanResponse = await this.triggerScan(this.selectedProfile);
            if (!scanResponse.success) {
                throw new Error(scanResponse.error || 'Erreur lors du scan');
            }

            this.showNotification(`✅ Scan terminé avec succès!`, 'success');

        } catch (error) {
            console.error('Erreur lors du scan:', error);
            this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        }
    }

    async deleteOcrConfig(profileName) {
        try {
            const response = await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                console.log(`Configuration OCR supprimée pour ${profileName}`);
            } else {
                console.warn(`Aucune configuration OCR à supprimer pour ${profileName}`);
            }
        } catch (error) {
            console.warn('Erreur suppression config OCR:', error);
        }
    }

    async deleteOcrPatchConfig(profileName) {
        try {
            const response = await fetch(`/api/profile/patch/${encodeURIComponent(profileName)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                console.log(`Configuration Patch supprimée pour ${profileName}`);
            } else {
                console.warn(`Aucune configuration Patch à supprimer pour ${profileName}`);
            }
        } catch (error) {
            console.warn('Erreur suppression config Patch:', error);
        }
    }

    setNestedValue(obj, keys, value) {
        if (!keys || keys.length === 0) return;
        
        const lastKey = keys.pop();
        const target = keys.reduce((o, key) => {
            if (!o[key] || typeof o[key] !== 'object') {
                o[key] = {};
            }
            return o[key];
        }, obj);
        
        if (target && lastKey) {
            target[lastKey] = value;
        }
    }

    processValue(value) {
        // Conversion des valeurs string en types appropriés
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'on') return true; // Pour les checkboxes
        if (!isNaN(value) && value !== '' && typeof value === 'string') {
            const num = Number(value);
            if (Number.isFinite(num)) return num;
        }
        return value;
    }

    debugFieldVisibility(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        console.log(`=== Debug visibilité des champs - ${formId} ===`);
        form.querySelectorAll('.form-group').forEach(group => {
            const field = group.querySelector('input, select');
            if (field) {
                const isVisible = group.style.display !== 'none';
                const isDisabled = field.disabled;
                console.log(`Champ ${field.name}: visible=${isVisible}, disabled=${isDisabled}, classes=${group.className}`);
            }
        });
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Créer ou récupérer le conteneur de notifications
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(container);
        }

        // Créer la notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
            word-wrap: break-word;
            white-space: pre-line;
        `;
        
        notification.textContent = message;
        
        // Ajouter au conteneur
        container.appendChild(notification);

        // Auto-suppression après 5 secondes (sauf pour les erreurs)
        const autoHideDelay = type === 'error' ? 8000 : 5000;
        const timeoutId = setTimeout(() => {
            this.removeNotification(notification);
        }, autoHideDelay);

        // Suppression au clic
        notification.onclick = () => {
            clearTimeout(timeoutId);
            this.removeNotification(notification);
        };

        // Ajouter les styles d'animation si pas déjà présents
        this.addNotificationStyles();
    }

    getNotificationColor(type) {
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Initialisation des services externes
    setApiService(apiService) {
        this.apiService = apiService;
    }

    setPopupManager(popupManager) {
        this.popupManager = popupManager;
    }

    setOcrConfigManager(ocrConfigManager) {
        this.ocrConfigManager = ocrConfigManager;
    }
}

// Fonctions globales pour le constructeur de pattern de nommage
window.addToPattern = function(token, fieldId) {
    const input = document.getElementById(fieldId);
    if (input) {
        const currentValue = input.value || '';
        const cursorPos = input.selectionStart || 0;
        const newValue = currentValue.slice(0, cursorPos) + token + currentValue.slice(cursorPos);
        input.value = newValue;
        input.focus();
        
        // Positionner le curseur après le token ajouté
        const newCursorPos = cursorPos + token.length;
        setTimeout(() => {
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        
        if (window.updatePreview) {
            window.updatePreview(fieldId);
        }
    }
};

window.clearPattern = function(fieldId) {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = '';
        input.focus();
        if (window.updatePreview) {
            window.updatePreview(fieldId);
        }
    }
};

window.updatePreview = function(fieldId) {
    const input = document.getElementById(fieldId);
    const preview = document.getElementById(fieldId + '_preview');
    
    if (input && preview) {
        const pattern = input.value || '';
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
        
        let previewText = pattern;
        Object.entries(replacements).forEach(([token, value]) => {
            const regex = new RegExp('\\$\\(' + token.slice(2, -1) + '\\)', 'g');
            previewText = previewText.replace(regex, value);
        });
        
        preview.textContent = previewText || 'Exemple: 18-09-2025-1';
    }
};

// Export pour utilisation en module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileManager;
}