// profile-manager.js - Gestionnaire principal des profils de scanner avec support OCR

class ProfileManager {
    constructor() {
        this.profiles = [];
        this.scanners = [];
        this.selectedProfile = null;
        this.apiService = null;
        this.popupManager = null;
        this.ocrConfigManager = null; // Ajouté pour la gestion OCR unifiée
        this.isLoading = false;
        
        // Configuration des champs par onglet
        this.fieldsByTab = {
            general: {
                required: ['DisplayName'],
                fields: {
                    'DisplayName': { label: 'Nom du profil *', type: 'text', required: true },
                    'Version': { label: 'Version', type: 'number', default: '5' },
                    'IconID': { label: 'Icône ID', type: 'number', default: '0' },
                    'IsDefault': { label: 'Profil par défaut', type: 'checkbox' },
                    'MaxQuality': { label: 'Qualité maximale', type: 'checkbox' },
                    'UseNativeUI': { label: 'Interface native', type: 'checkbox' }
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
                    'Resolution': { label: 'Résolution', type: 'select', options: ['Dpi50', 'Dpi100', 'Dpi150', 'Dpi200', 'Dpi300', 'Dpi400', 'Dpi600'], default: 'Dpi200' },
                    'BitDepth': { label: 'Profondeur de couleur', type: 'select', options: ['C24Bit', 'C8Bit'], default: 'C24Bit' },
                    'Quality': { label: 'Qualité JPEG (%)', type: 'number', min: 1, max: 100, default: 75 },
                    'PaperSource': { label: 'Source papier', type: 'select', options: ['Glass', 'Feeder'], default: 'Glass' },
                    'PageSize': { label: 'Taille de page', type: 'select', options: ['Letter', 'A4', 'Legal', 'Custom'], default: 'Letter' },
                    'PageAlign': { label: 'Alignement', type: 'select', options: ['Left', 'Center', 'Right'], default: 'Center' },
                    'AutoDeskew': { label: 'Redressement automatique', type: 'checkbox' },
                    'ExcludeBlankPages': { label: 'Exclure pages vides', type: 'checkbox' },
                    'ForcePageSize': { label: 'Forcer taille de page', type: 'checkbox' }
                }
            },
            advanced: {
                fields: {
                    'Brightness': { label: 'Luminosité', type: 'number', min: -100, max: 100, default: 0 },
                    'Contrast': { label: 'Contraste', type: 'number', min: -100, max: 100, default: 0 },
                    'RotateDegrees': { label: 'Rotation (degrés)', type: 'select', options: ['0', '90', '180', '270'], default: '0' },
                    'BlankPageWhiteThreshold': { label: 'Seuil blanc (%)', type: 'number', min: 0, max: 100, default: 70 },
                    'BlankPageCoverageThreshold': { label: 'Seuil couverture (%)', type: 'number', min: 0, max: 100, default: 25 },
                    'TwainProgress': { label: 'Afficher progression TWAIN', type: 'checkbox' },
                    'BrightnessContrastAfterScan': { label: 'Appliquer corrections après scan', type: 'checkbox' },
                    'EnableAutoSave': { label: 'Sauvegarde automatique', type: 'checkbox' }
                }
            },
            // NOUVEL ONGLET OCR
            ocr: {
                fields: {
                    'OcrMode': { 
                        label: 'Activer OCR', 
                        type: 'checkbox', 
                        default: false,
                        help: 'Active ou désactive la reconnaissance optique de caractères'
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
                        help: 'Choisissez la langue du document ou laissez en détection automatique'
                    },
                    'OcrNamingPattern': {
                        label: 'Modèle de nommage automatique',
                        type: 'naming-pattern-builder',
                        default: '$(DD)-$(MM)-$(YYYY)-$(n)',
                        help: 'Le fichier sera automatiquement nommé selon le modèle construit. Cliquez sur les éléments pour construire votre modèle.'
                    },
                    'OcrPdfMode': { 
                        label: 'Format de sortie', 
                        type: 'select', 
                        options: [
                            { value: 'pdfa', label: '📚 PDF/A (Recommandé - Archivage long terme)' },
                            { value: 'pdf', label: '📄 PDF Standard' }
                        ],
                        default: 'pdfa',
                        help: 'PDF/A est recommandé pour l\'archivage et la compatibilité maximale'
                    },
                    'OcrPatchMode': {
                        label: 'Mode traitement par lots (Patch)',
                        type: 'checkbox',
                        default: false,
                        help: 'Active le traitement par lots pour séparer automatiquement les documents'
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
                        help: 'Le système essaiera d\'abord les codes-barres, puis l\'OCR, puis un nom générique'
                    }
                }
            }
        };
    }

    async init() {
        console.log('Initialisation du ProfileManager...');
        
        // Configurer les gestionnaires d'événements
        this.setupEventHandlers();
        
        // Charger les données initiales
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
            // Charger les profils et les scanners en parallèle
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
                this.scanners = [
                    { id: 'TWAIN2 FreeImage Software Scanner', name: 'TWAIN2 FreeImage Software Scanner' },
                    { id: 'WIA Scanner', name: 'WIA Scanner' }
                ];
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des scanners:', error);
            this.scanners = [
                { id: 'TWAIN2 FreeImage Software Scanner', name: 'TWAIN2 FreeImage Software Scanner' },
                { id: 'WIA Scanner', name: 'WIA Scanner' }
            ];
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
        
        // Restaurer la sélection précédente
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
        // Désélectionner l'ancien
        const oldSelected = document.querySelector('.scanner-card.selected');
        if (oldSelected) {
            oldSelected.classList.remove('selected');
        }

        // Sélectionner le nouveau
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
            // Afficher le popup
            this.popupManager.show('addPopup', true);

            // Générer dynamiquement tous les onglets y compris OCR
            this.renderFormTab('general-tab', this.fieldsByTab.general.fields);
            this.renderFormTab('device-tab', this.fieldsByTab.device.fields);
            this.renderFormTab('scan-tab', this.fieldsByTab.scan.fields);
            this.renderFormTab('advanced-tab', this.fieldsByTab.advanced.fields);
            this.renderFormTab('ocr-tab', this.fieldsByTab.ocr.fields);

            // Mettre le focus sur le premier champ
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

        let html = '';
        
        // Grouper les champs par section
        const sections = this.groupFieldsBySection(fields);
        
        Object.entries(sections).forEach(([sectionName, sectionFields]) => {
            html += `
                <div class="field-group">
                    <div class="field-group-title">${sectionName}</div>
                    <div class="form-grid">
            `;
            
            Object.entries(sectionFields).forEach(([fieldName, fieldConfig]) => {
                html += this.createFormField(fieldName, fieldConfig, data);
            });
            
            html += '</div></div>';
        });

        tab.innerHTML = html;
    }

    groupFieldsBySection(fields) {
        // Organisation des champs par sections logiques
        const sections = {
            'Configuration principale': {},
            'Options avancées': {}
        };

        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            if (fieldName.includes('Device') || fieldName.includes('Driver') || fieldName.includes('Twain') || fieldName.includes('OcrMode') || fieldName === 'DisplayName') {
                sections['Configuration principale'][fieldName] = fieldConfig;
            } else {
                sections['Options avancées'][fieldName] = fieldConfig;
            }
        });

        return sections;
    }

    createFormField(fieldName, fieldConfig, data = {}) {
        const fieldId = fieldName.replace(/\./g, '_');
        const value = this.getFieldValue(data, fieldName) || fieldConfig.default || '';
        
        let inputHtml = '';
        
        switch (fieldConfig.type) {
            case 'text':
            case 'number':
                const attrs = fieldConfig.type === 'number' ? 
                    `min="${fieldConfig.min || ''}" max="${fieldConfig.max || ''}"` : '';
                inputHtml = `<input type="${fieldConfig.type}" id="${fieldId}" name="${fieldName}" value="${value}" ${attrs}>`;
                break;
                
            case 'select':
                let options = '';
                if (fieldConfig.source === 'scanners') {
                    options = this.scanners.map(scanner => 
                        `<option value="${scanner.id}" ${value === scanner.id ? 'selected' : ''}>${scanner.name}</option>`
                    ).join('');
                } else if (fieldConfig.options) {
                    if (Array.isArray(fieldConfig.options) && typeof fieldConfig.options[0] === 'object') {
                        // Options avec structure {value, label}
                        options = fieldConfig.options.map(option => 
                            `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>`
                        ).join('');
                    } else {
                        // Options simples
                        options = fieldConfig.options.map(option => 
                            `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`
                        ).join('');
                    }
                }
                inputHtml = `<select id="${fieldId}" name="${fieldName}">${options}</select>`;
                break;
                
            case 'checkbox':
                const checked = (value === 'true' || value === true) ? 'checked' : '';
                return `
                    <div class="form-group checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="${fieldId}" name="${fieldName}" ${checked}>
                            <label for="${fieldId}">${fieldConfig.label}</label>
                            ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
                        </div>
                    </div>
                `;
        }

        return `
            <div class="form-group">
                <label for="${fieldId}">${fieldConfig.label}</label>
                ${inputHtml}
                ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
            </div>
        `;
    }

    getFieldValue(data, fieldPath) {
        return fieldPath.split('.').reduce((obj, key) => obj && obj[key], data);
    }

    // ✅ CORRECTION PRINCIPALE : Méthode createProfile avec séparation OCR
    async createProfile() {
        try {
            console.log('Début création profil...'); // Debug
            
            const formData = this.collectFormData('profileAddForm');
            console.log('Données formulaire collectées:', formData); // Debug
            
            if (!formData.DisplayName) {
                throw new Error('Le nom du profil est obligatoire');
            }

            // ✅ Séparer les données OCR des données de profil standard
            const { ocrData, profileData } = this.separateOcrData(formData);
            console.log('Données séparées - Profil:', profileData, 'OCR:', ocrData); // Debug

            // ✅ Créer le profil standard UNIQUEMENT (sans données OCR)
            const response = await this.apiService.createProfile(profileData);
            console.log('Réponse création profil:', response); // Debug
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la création');
            }

            // ✅ Sauvegarder la configuration OCR séparément si nécessaire
            if (this.hasOcrConfigFromSeparatedData(ocrData)) {
                try {
                    console.log('Configuration OCR détectée, sauvegarde...'); // Debug
                    await this.saveOcrConfigSeparately(formData.DisplayName, ocrData);
                    console.log('Configuration OCR sauvegardée avec succès');
                } catch (ocrError) {
                    console.error('Erreur sauvegarde OCR:', ocrError);
                    this.showNotification(`Profil créé mais erreur OCR: ${ocrError.message}`, 'warning');
                }
            } else {
                console.log('Aucune configuration OCR active détectée'); // Debug
            }

            this.popupManager.hide('addPopup', true);
            this.showNotification('Profil créé avec succès', 'success');
            await this.loadProfiles();
            
        } catch (error) {
            console.error('Erreur création profil:', error);
            this.showNotification(`Erreur lors de la création: ${error.message}`, 'error');
        }
    }

    // ✅ Modifier la méthode separateOcrData pour inclure les nouveaux champs
    separateOcrData(formData) {
        // Ajouter les nouveaux champs patch à la liste
        const ocrFields = [
            'OcrMode', 'OcrLang', 'OcrNamingPattern', 'OcrPdfMode',
            'OcrPatchMode', 'OcrPatchNaming'  // ✅ NOUVEAUX CHAMPS AJOUTÉS
        ];
        const ocrData = {};
        const profileData = { ...formData };
        
        // Extraire les données OCR
        ocrFields.forEach(field => {
            if (formData.hasOwnProperty(field)) {
                ocrData[field] = formData[field];
                delete profileData[field]; // Retirer des données de profil standard
            }
        });
        
        console.log('Séparation données - OCR extrait:', ocrData);
        console.log('Séparation données - Profil restant:', profileData);
        
        return { ocrData, profileData };
    }

    // ✅ Modifier la méthode hasOcrConfigFromSeparatedData pour inclure les nouveaux champs
    hasOcrConfigFromSeparatedData(ocrData) {
        const hasConfig = (
            ocrData.OcrMode === true || 
            ocrData.OcrMode === 'true' ||
            (ocrData.OcrLang && ocrData.OcrLang !== '') ||
            (ocrData.OcrNamingPattern && ocrData.OcrNamingPattern !== '') ||
            (ocrData.OcrPdfMode && ocrData.OcrPdfMode !== '') ||
            ocrData.OcrPatchMode === true ||  // ✅ NOUVEAU CHAMP
            ocrData.OcrPatchMode === 'true' ||
            (ocrData.OcrPatchNaming && ocrData.OcrPatchNaming !== '')  // ✅ NOUVEAU CHAMP
        );
        
        console.log('Vérification OCR séparée:', {
            ocrData: ocrData,
            hasConfig: hasConfig
        });
        
        return hasConfig;
    }

    // ✅ Modifier la méthode saveOcrConfigSeparately pour inclure les nouveaux champs
    async saveOcrConfigSeparately(profileName, ocrData) {
        try {
            const ocrConfig = {
                profileName: profileName,
                ocrMode: ocrData.OcrMode === true || ocrData.OcrMode === 'true',
                lang: ocrData.OcrLang || 'fra',
                namingPattern: ocrData.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                pdfMode: ocrData.OcrPdfMode || 'pdfa',
                // ✅ NOUVEAUX CHAMPS PATCH AJOUTÉS
                patchMode: ocrData.OcrPatchMode === true || ocrData.OcrPatchMode === 'true',
                patchNaming: ocrData.OcrPatchNaming || 'barcode_ocr_generic'
            };

            console.log('Configuration OCR séparée à sauvegarder:', ocrConfig);

            if (this.ocrConfigManager) {
                await this.ocrConfigManager.saveConfig(profileName, ocrData);
            } else {
                // Fallback direct
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

    // ✅ CORRECTION : Méthode updateProfile aussi mise à jour pour cohérence
    async updateProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        try {
            console.log('Début mise à jour profil...'); // Debug
            
            const formData = this.collectFormData('profileEditForm');
            console.log('Données formulaire mise à jour:', formData); // Debug
            
            // Séparer les données OCR des données de profil standard
            const { ocrData, profileData } = this.separateOcrData(formData);
            console.log('Données séparées - Profil:', profileData, 'OCR:', ocrData); // Debug

            // Mettre à jour le profil standard (sans données OCR)
            const response = await this.apiService.updateProfile(this.selectedProfile, profileData);
            console.log('Réponse mise à jour profil:', response); // Debug
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la mise à jour');
            }

            // Mettre à jour la configuration OCR séparément
            if (this.hasOcrConfigFromSeparatedData(ocrData)) {
                try {
                    console.log('Configuration OCR détectée pour mise à jour...'); // Debug
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

    // ✅ MÉTHODE CONSERVÉE : Pour rétrocompatibilité avec l'ancienne version
    hasOcrConfig(data) {
        const hasOcr = (
            data.OcrMode === true || 
            data.OcrMode === 'true' || 
            (data.OcrLang && data.OcrLang !== '') ||
            (data.OcrNamingPattern && data.OcrNamingPattern !== '') ||
            (data.OcrPdfMode && data.OcrPdfMode !== '')
        );
        
        console.log('Vérification OCR (ancienne méthode):', {
            OcrMode: data.OcrMode,
            OcrLang: data.OcrLang,
            OcrNamingPattern: data.OcrNamingPattern,
            OcrPdfMode: data.OcrPdfMode,
            hasOcr: hasOcr
        }); // Debug
        
        return hasOcr;
    }

    // ✅ MÉTHODE CONSERVÉE : Sauvegarde directe en cas de fallback
    async saveOcrConfigDirect(profileName, data) {
        try {
            const ocrConfig = {
                profileName: profileName,
                ocrMode: data.OcrMode === true || data.OcrMode === 'true',
                lang: data.OcrLang || 'fra',
                namingPattern: data.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                pdfMode: data.OcrPdfMode || 'pdfa'
            };

            console.log('Configuration OCR à sauvegarder:', ocrConfig); // Debug

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
            
        } catch (error) {
            console.error('Erreur sauvegarde OCR directe:', error);
            throw error;
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
            
        } catch (error) {
            console.error('Erreur ouverture édition:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async loadOcrConfig(profileName) {
        try {
            const response = await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    OcrMode: data.ocrMode,
                    OcrLang: data.lang,
                    OcrNamingPattern: data.namingPattern,
                    OcrPdfMode: data.pdfMode,
                    // ✅ NOUVEAUX CHAMPS PATCH AJOUTÉS
                    OcrPatchMode: data.patchMode,
                    OcrPatchNaming: data.patchNaming
                };
            }
        } catch (error) {
            console.warn('Aucune configuration OCR trouvée pour', profileName);
        }
        return {};
    }

    renderViewPopup(profileData) {
        // Rendre chaque onglet en mode lecture seule y compris OCR
        this.renderViewTab('viewGeneralContent', this.fieldsByTab.general.fields, profileData);
        this.renderViewTab('viewDeviceContent', this.fieldsByTab.device.fields, profileData);
        this.renderViewTab('viewScanContent', this.fieldsByTab.scan.fields, profileData);
        this.renderViewTab('viewAdvancedContent', this.fieldsByTab.advanced.fields, profileData);
        this.renderViewTab('viewOcrContent', this.fieldsByTab.ocr.fields, profileData);
    }

    renderEditForm(profileData) {
        // Rendre chaque onglet en mode édition y compris OCR
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

            // Supprimer aussi la configuration OCR
            await this.deleteOcrConfig(target);

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
        } catch (error) {
            console.warn('Erreur suppression config OCR:', error);
        }
    }

    scanWithProfile() {
        if (!this.selectedProfile) {
            this.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }

        // Simuler le démarrage du scan
        this.showNotification(`Démarrage du scan avec le profil "${this.selectedProfile}"...`, 'info');
        
        // Ici vous pouvez ajouter la logique pour déclencher réellement le scan
        // par exemple en appelant une API NAPS2 ou un service externe
        
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
        
        console.log('FormData brute:', [...formData.entries()]); // Debug
        
        // Collecter les données du formulaire
        for (let [key, value] of formData.entries()) {
            this.setNestedValue(profileData, key.split('.'), this.processValue(value));
        }
        
        // Gérer les checkboxes non cochées (elles n'apparaissent pas dans FormData)
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!formData.has(checkbox.name)) {
                console.log(`Checkbox non cochée: ${checkbox.name} = false`); // Debug
                this.setNestedValue(profileData, checkbox.name.split('.'), false);
            } else {
                console.log(`Checkbox cochée: ${checkbox.name} = true`); // Debug
                this.setNestedValue(profileData, checkbox.name.split('.'), true);
            }
        });
        
        console.log('Données finales collectées:', profileData); // Debug
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
        // Conversion des valeurs
        if (value === 'true' || value === 'false') return value === 'true';
        if (value === 'on') return true;
        if (!isNaN(value) && value !== '') return Number(value);
        return value;
    }

    showNotification(message, type = 'info') {
        // Utiliser la fonction utilitaire globale si disponible
        if (window.Utils && window.Utils.showNotification) {
            window.Utils.showNotification(message, type);
        } else {
            // Fallback simple
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

    // Méthode utilitaire pour déboguer
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

    // ✅ MÉTHODE DEBUG : Pour tester la collecte de données OCR
    debugFormData(formId) {
        try {
            const form = document.getElementById(formId);
            if (!form) {
                console.error(`Formulaire ${formId} non trouvé`);
                return;
            }

            console.log('=== DEBUG FORM DATA ===');
            
            // Vérifier tous les champs OCR
            const ocrFields = ['OcrMode', 'OcrLang', 'OcrNamingPattern', 'OcrPdfMode'];
            ocrFields.forEach(fieldName => {
                const field = form.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    if (field.type === 'checkbox') {
                        console.log(`${fieldName}:`, field.checked, `(type: ${field.type})`);
                    } else {
                        console.log(`${fieldName}:`, field.value, `(type: ${field.type})`);
                    }
                } else {
                    console.warn(`Champ ${fieldName} non trouvé dans le formulaire`);
                }
            });

            // Collecter les données et les afficher
            const data = this.collectFormData(formId);
            console.log('Données collectées:', data);
            console.log('hasOcrConfig:', this.hasOcrConfig(data));
            console.log('========================');
            
        } catch (error) {
            console.error('Erreur debug form:', error);
        }
    }

    // ✅ MÉTHODE DEBUG AVANCÉE : Pour tester la séparation des données OCR
    debugOcrSeparation(formId = 'profileAddForm') {
        try {
            console.log('=== DEBUG SÉPARATION OCR ===');
            
            const form = document.getElementById(formId);
            if (!form) {
                console.error(`Formulaire ${formId} non trouvé`);
                return;
            }

            // Collecter et séparer les données
            const formData = this.collectFormData(formId);
            const { ocrData, profileData } = this.separateOcrData(formData);
            
            console.log('Données complètes:', formData);
            console.log('Données profil (sans OCR):', profileData);
            console.log('Données OCR séparées:', ocrData);
            console.log('hasOcrConfig (séparée):', this.hasOcrConfigFromSeparatedData(ocrData));
            console.log('===============================');
            
            return { formData, ocrData, profileData };
            
        } catch (error) {
            console.error('Erreur debug séparation OCR:', error);
        }
    }
}