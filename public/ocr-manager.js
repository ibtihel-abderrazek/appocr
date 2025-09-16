// ocr-manager.js - Version modifiée avec exécution directe si profil sélectionné

class OCRManager {
    constructor() {
        this.importedFile = null;
        this.importedFiles = [];
        this.cachedProfileConfig = null; // Cache pour éviter des appels répétés
        this.init();
    }

    // =================== INITIALISATION ===================
    init() {
        this.setupDragAndDrop();
        this.setupFileImport();
        this.setupOCRProcessing();
        this.setupPatchProcessing();
        this.setupGeneratePatch();
        this.setupScanIntegration();
        this.loadImportedFiles();
        this.exposeGlobalFunctions();
    }

    // =================== DRAG & DROP ET IMPORT ===================
    setupDragAndDrop() {
        const importZone = document.getElementById("importZone");
        
        if (!importZone) return;

        importZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            importZone.classList.add("dragover");
        });
        
        importZone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            importZone.classList.remove("dragover");
        });
        
        importZone.addEventListener("drop", (e) => {
            e.preventDefault();
            importZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    setupFileImport() {
        const fileInput = document.getElementById("fileInput");
        const btnImportFile = document.getElementById("btnImportFile");

        if (btnImportFile && fileInput) {
            btnImportFile.addEventListener("click", () => fileInput.click());
            
            fileInput.addEventListener("change", () => {
                if (fileInput.files.length) {
                    this.handleFile(fileInput.files[0]);
                }
            });
        }
    }

    handleFile(file) {
        if (!this.validateFile(file)) {
            return;
        }

        this.importedFile = file;
        const importedFileName = document.getElementById("importedFileName");
        const btnOCR = document.getElementById("btnOCR");
        const btnPatch = document.getElementById("btnPatch");
        
        if (importedFileName) {
            importedFileName.innerText = `Fichier importé : ${file.name}`;
        }
        
        if (btnOCR) {
            btnOCR.disabled = false;
        }

        if (btnPatch) {
            btnPatch.disabled = false;
        }

        this.createFilePreview(file);
    }

    createFilePreview(file) {
        const url = URL.createObjectURL(file);
        const importZone = document.getElementById("importZone");
        
        if (!importZone) return;

        let preview = importZone.querySelector('.file-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'file-preview';
            importZone.appendChild(preview);
        }
        
        preview.innerHTML = `<iframe src="${url}" width="100%" height="400" style="border:1px solid #ccc; border-radius: 4px;"></iframe>`;
    }

    // =================== MÉTHODES DE RÉCUPÉRATION DES PARAMÈTRES PROFIL ===================

// =================== MÉTHODES DE RÉCUPÉRATION DES PARAMÈTRES PROFIL ===================

    async getSelectedProfileOcrConfig() {
        try {
            // Vérifier qu'un profil est sélectionné
            if (!window.profileManager || !window.profileManager.selectedProfile) {
                console.log('Aucun profil sélectionné');
                return this.getDefaultOcrPatchConfig();
            }

            const profileName = window.profileManager.selectedProfile;
            console.log(`Récupération configuration OCR/Patch pour le profil: ${profileName}`);

            // Utiliser le cache si disponible et récent
            if (this.cachedProfileConfig && 
                this.cachedProfileConfig.profileName === profileName &&
                Date.now() - this.cachedProfileConfig.timestamp < 30000) { // Cache valide 30 secondes
                console.log('Utilisation du cache de configuration');
                return this.cachedProfileConfig.config;
            }

            // Récupérer la configuration via ProfileManager (qui fait déjà la bonne récupération)
            const ocrConfig = await this.loadOcrConfigFromProfile(profileName);
            
            // Mettre en cache
            this.cachedProfileConfig = {
                profileName: profileName,
                config: ocrConfig,
                timestamp: Date.now()
            };

            console.log('Configuration OCR/Patch récupérée:', ocrConfig);
            return ocrConfig;

        } catch (error) {
            console.error('Erreur lors de la récupération de la configuration:', error);
            return this.getDefaultOcrPatchConfig();
        }
    }

    async loadOcrConfigFromProfile(profileName) {
        try {
            const response = await fetch(`/api/profile/ocr/${encodeURIComponent(profileName)}`);
            if (response.ok) {
                const data = await response.json();
                console.log("Données renvoyées par l'API :", data);
                return {
                    // Paramètres OCR standards
                    language: data.lang || 'fra',
                    confidence: '80',
                    dpi: '300',
                    preprocessImage: 'true',
                    enhanceContrast: 'true',
                    removeNoise: 'false',
                    autoRotate: 'true',
                    
                    // ✅ Paramètres spécifiques à l'OCR avec vérification enable
                    ocrMode: data.ocrMode || false, // Utiliser directement la valeur de l'API
                    namingPattern: data.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                    pdfMode: data.pdfMode || 'pdfa',
                    
                    // ✅ Paramètres Patch avec vérification enable
                    patchMode: data.patchType|| 'T_classique',
                    patchNaming: data.patchNaming || 'barcode_ocr_generic',
                    patchEnabled: data.patchEnabled || false, // Utiliser directement la valeur de l'API
                    splitByBarcode: data.patchEnabled ? 'true' : 'false',
                    barcodePosition: 'top-right',
                    outputFormat: 'pdf',
                    includeOriginalPages: 'false'
                };
            } else {
                console.log(`Aucune configuration OCR trouvée pour le profil ${profileName}`);
                return this.getDefaultOcrPatchConfig();
            }
        } catch (error) {
            console.warn('Erreur lors de la récupération de la configuration OCR:', error);
            return this.getDefaultOcrPatchConfig();
        }
    }

    getDefaultOcrPatchConfig() {
        return {
            // Paramètres OCR standards
            language: 'fra',
            confidence: '80',
            dpi: '300',
            preprocessImage: 'true',
            enhanceContrast: 'true',
            removeNoise: 'false',
            autoRotate: 'true',
            
            // Paramètres spécifiques OCR
            ocrMode: false,
            namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: 'pdfa',
            
            // ✅ Paramètres Patch par défaut avec nouveau patchMode
            patchMode: 'T_classique',
            patchNaming: 'barcode_ocr_generic',
            patchEnabled: false,
            splitByBarcode: 'false',
            barcodePosition: 'top-right',
            outputFormat: 'pdf',
            includeOriginalPages: 'false'
        };
    }

    // Appliquer les paramètres OCR au formulaire (inchangé)
    applyOcrConfigToForm(config) {
        const form = document.getElementById("ocrForm");
        if (!form) {
            console.error('Formulaire OCR non trouvé');
            return;
        }

        console.log('Application de la configuration OCR au formulaire:', config);

        const fieldMappings = {
            'language': config.language,
            'confidence': config.confidence,
            'dpi': config.dpi,
            'preprocessImage': config.preprocessImage,
            'enhanceContrast': config.enhanceContrast,
            'removeNoise': config.removeNoise,
            'autoRotate': config.autoRotate,
            'namingPattern': config.namingPattern,
            'pdfMode': config.pdfMode,
            'patchMode': config.patchMode,
            'pactchNaming': config.patchNaming
        };

        Object.entries(fieldMappings).forEach(([fieldName, value]) => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value === 'true' || value === true;
                } else {
                    field.value = value || '';
                }
                console.log(`OCR - ${fieldName}: ${value} appliqué`);
            } else {
                console.warn(`Champ OCR ${fieldName} non trouvé dans le formulaire`);
            }
        });
    }

    // ✅ Méthode mise à jour pour appliquer les paramètres Patch au formulaire
    applyPatchConfigToForm(config) {
        const form = document.getElementById("patchForm");
        if (!form) {
            console.error('Formulaire Patch non trouvé');
            return;
        }

        console.log('Application de la configuration Patch au formulaire:', config);

        const patchMappings = [
            { htmlName: 'patchMode', configKey: 'patchMode', type: 'select' },
            { htmlName: 'naming', configKey: 'patchNaming', type: 'select' },
            { htmlName: 'namingPattern', configKey: 'namingPattern', type: 'text' },
            { htmlName: 'ocrMode', configKey: 'patchEnabled', type: 'select', transform: (value) => {
                return (value === true || value === 'true') ? 'true' : 'false';
            }}
        ];

        let appliedCount = 0;

        patchMappings.forEach(({ htmlName, configKey, type, transform }) => {
            let value = config[configKey];
            
            if (transform && value !== undefined && value !== null) {
                value = transform(value);
            }
            
            if (value === undefined || value === null) return;
            
            let field = form.querySelector(`[name="${htmlName}"]`) || form.querySelector(`#${htmlName}`);
            
            if (field) {
                try {
                    if (type === 'checkbox' || field.type === 'checkbox') {
                        field.checked = value === 'true' || value === true;
                    } else {
                        field.value = value || '';
                        
                        if (field.tagName === 'SELECT') {
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    console.log(`Patch - ${htmlName}: "${value}" appliqué au champ`);
                    appliedCount++;
                } catch (error) {
                    console.warn(`Erreur application Patch ${htmlName}:`, error);
                }
            } else {
                console.warn(`Champ Patch "${htmlName}" non trouvé dans le formulaire`);
            }
        });

        console.log(`${appliedCount}/${patchMappings.length} paramètres Patch appliqués`);
    }

    // =================== NOUVELLES MÉTHODES POUR EXÉCUTION DIRECTE ===================

    // ✅ MÉTHODE MODIFIÉE : Vérifier si OCR est activé et exécuter ou ouvrir popup
    async checkProfileAndExecuteOcr() {
        // Vérifier qu'un fichier est importé
        if (!this.importedFile) {
            this.showNotification("Veuillez importer un fichier avant de lancer l'OCR.", 'warning');
            return false;
        }

        // ✅ MODIFICATION PRINCIPALE : Si aucun profil sélectionné, ouvrir popup directement
        if (!window.profileManager || !window.profileManager.selectedProfile) {
            console.log('Aucun profil sélectionné, ouverture de la popup OCR');
            return false; // Indique qu'il faut ouvrir la popup
        }

        const profileName = window.profileManager.selectedProfile;
        console.log(`Profil sélectionné détecté: ${profileName}`);

        try {
            // Récupérer la configuration du profil
            const config = await this.getSelectedProfileOcrConfig();
            
            // ✅ MODIFICATION PRINCIPALE : Vérifier si ocrMode est activé dans le profil
            if (!config.ocrMode || config.ocrMode === false || config.ocrMode === 'false') {
                console.log('OCR désactivé dans le profil, ouverture de la popup pour configuration manuelle');
                return false; // Ouvrir la popup pour permettre la saisie manuelle
            }

            console.log(`OCR activé dans le profil, exécution directe`);

            // Afficher le message de traitement
            const importZone = document.getElementById("importZone");
            if (importZone) {
                importZone.innerHTML = `<p>🔄 Traitement OCR automatique avec le profil "${profileName}"...</p>`;
            }
            
            // Créer FormData à partir de la configuration
            const formData = this.createOcrFormDataFromConfig(config);
            
            // Exécuter le traitement OCR
            await this.executeOcrRequest(formData);
            
            return true; // Indique que l'exécution directe a eu lieu
            
        } catch (error) {
            console.error('Erreur lors de l\'exécution automatique OCR:', error);
            this.showProcessingError("OCR automatique", error.message);
            return true; // Même en cas d'erreur, pas besoin d'ouvrir la popup
        }
    }

    // ✅ MÉTHODE MODIFIÉE : Vérifier si Patch est activé et exécuter ou ouvrir popup
    async checkProfileAndExecutePatch() {
        // Vérifier qu'un fichier est importé
        if (!this.importedFile) {
            this.showNotification("Veuillez importer un fichier avant de traiter les patches.", 'warning');
            return false;
        }

        // ✅ MODIFICATION PRINCIPALE : Si aucun profil sélectionné, ouvrir popup directement
        if (!window.profileManager || !window.profileManager.selectedProfile) {
            console.log('Aucun profil sélectionné, ouverture de la popup Patch');
            return false; // Indique qu'il faut ouvrir la popup
        }

        const profileName = window.profileManager.selectedProfile;
        console.log(`Profil sélectionné détecté: ${profileName}`);

        try {
            // Récupérer la configuration du profil
            const config = await this.getSelectedProfileOcrConfig();
            
            // ✅ MODIFICATION PRINCIPALE : Vérifier si patchEnabled est activé dans le profil
            if (!config.patchEnabled || config.patchEnabled === false || config.patchEnabled === 'false') {
                console.log('Patch désactivé dans le profil, ouverture de la popup pour configuration manuelle');
                return false; // Ouvrir la popup pour permettre la saisie manuelle
            }

            console.log(`Patch activé dans le profil, exécution directe`);

            // Afficher le message de traitement
            const importZone = document.getElementById("importZone");
            if (importZone) {
                importZone.innerHTML = `<p>🔄 Traitement Patch automatique avec le profil "${profileName}"...</p>`;
            }
            
            // Créer FormData à partir de la configuration
            const formData = this.createPatchFormDataFromConfig(config);
            
            // Exécuter le traitement Patch
            await this.executePatchRequest(formData);
            
            return true; // Indique que l'exécution directe a eu lieu
            
        } catch (error) {
            console.error('Erreur lors de l\'exécution automatique Patch:', error);
            this.showProcessingError("Patch automatique", error.message);
            return true; // Même en cas d'erreur, pas besoin d'ouvrir la popup
        }
    }

    // ✅ MÉTHODE : Créer FormData à partir de la configuration du profil
    createOcrFormDataFromConfig(config) {
        const formData = new FormData();
        
        // Ajouter le fichier
        formData.append("file", this.importedFile);
        
        // Paramètres OCR
        formData.append("ocrMode", "true");
        formData.append("containsPatch", "false");
        formData.append("lang", config.language || 'fra');
        formData.append("namingPattern", config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)');
        formData.append("mode", config.pdfMode || 'pdfa');
        formData.append("patchMode", config.patchMode || 'T_classique');
        formData.append("patchNaming", config.patchNaming || 'barcode_ocr_generic');
        // Paramètres techniques (valeurs par défaut)
        formData.append("confidence", config.confidence || '80');
        formData.append("dpi", config.dpi || '300');
        formData.append("preprocessImage", config.preprocessImage || 'true');
        formData.append("enhanceContrast", config.enhanceContrast || 'true');
        formData.append("removeNoise", config.removeNoise || 'false');
        formData.append("autoRotate", config.autoRotate || 'true');
        
        console.log('FormData OCR créé à partir de la configuration:', config);
        return formData;
    }

    // ✅ MÉTHODE : Créer FormData Patch à partir de la configuration du profil avec patchMode
    createPatchFormDataFromConfig(config) {
        const formData = new FormData();
        
        // Ajouter le fichier
        formData.append("file", this.importedFile);
        
        // ✅ Paramètres Patch avec le nouveau patchMode
        formData.append("containsPatch", "true");
        formData.append("patchMode", config.patchMode || 'T_classique');
        formData.append("naming", config.patchNaming || 'barcode_ocr_generic');
        formData.append("namingPattern", config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)');
        
        // ✅ CORRECTION : Forcer ocrMode à false pour traitement patch uniquement
        formData.append("ocrMode", "false"); 
        
        // Paramètres additionnels
        formData.append("splitByBarcode", config.splitByBarcode || 'false');
        formData.append("outputFormat", config.outputFormat || 'pdf');
        
        console.log('FormData Patch créé SANS OCR - patchMode:', config.patchMode);
        return formData;
    }

    // =================== TRAITEMENT OCR MODIFIÉ ===================
    setupOCRProcessing() {
        const btnOCR = document.getElementById("btnOCR");
        const ocrForm = document.getElementById("ocrForm");

        if (btnOCR) {
            // ✅ MODIFICATION PRINCIPALE : Nouvelle logique de clic
            btnOCR.addEventListener("click", async () => {
                const shouldExecuteDirectly = await this.checkProfileAndExecuteOcr();
                if (!shouldExecuteDirectly) {
                    // Si pas d'exécution directe, ouvrir la popup
                    await this.openOCRDialog();
                }
            });
        }

        if (ocrForm) {
            ocrForm.addEventListener("submit", (e) => this.processOCR(e));
        }
    }

    // ✅ MÉTHODE MODIFIÉE : openOCRDialog reste pour les cas où aucun profil n'est sélectionné
    async openOCRDialog() {
        const ocrPopup = document.getElementById("ocrPopup");
        if (!ocrPopup) {
            this.showNotification("Interface OCR non disponible.", 'error');
            return;
        }

        try {
            // Afficher le popup avec un indicateur de chargement
            ocrPopup.style.display = "flex";
            
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'ocrLoadingIndicator';
            loadingIndicator.style.cssText = `
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8); color: white; padding: 15px 25px;
                border-radius: 8px; z-index: 1002;
            `;
            loadingIndicator.innerHTML = '🔄 Chargement des paramètres...';
            ocrPopup.appendChild(loadingIndicator);

            // Récupérer et appliquer la configuration (même si pas de profil, pour les valeurs par défaut)
            const config = await this.getSelectedProfileOcrConfig();
            this.applyOcrConfigToForm(config);

            // Supprimer l'indicateur de chargement
            const indicator = document.getElementById('ocrLoadingIndicator');
            if (indicator) {
                indicator.remove();
            }

            console.log('Dialogue OCR ouvert');
            
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du dialogue OCR:', error);
            
            const indicator = document.getElementById('ocrLoadingIndicator');
            if (indicator) {
                indicator.remove();
            }
            
            this.showNotification('Erreur lors du chargement des paramètres: ' + error.message, 'warning');
        }
    }

    // ✅ NOUVELLE MÉTHODE : Extraction de la logique d'exécution OCR
    async executeOcrRequest(formData) {
        try {
            const response = await fetch(this.getOCREndpoint(), {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                await this.handleMultipleFiles(response);
            } else {
                await this.handleSingleFile(response);
            }

        } catch (err) {
            console.error("Erreur OCR :", err);
            throw err; // Re-lancer pour gestion par la méthode appelante
        }
    }

    // Méthode processOCR modifiée pour utiliser executeOcrRequest
    async processOCR(e) {
        e.preventDefault();

        if (!this.importedFile) {
            this.showNotification("Aucun fichier importé.", 'error');
            return;
        }

        // Fermer la popup et afficher le loading
        const ocrPopup = document.getElementById("ocrPopup");
        const importZone = document.getElementById("importZone");
        
        if (ocrPopup) ocrPopup.style.display = "none";
        if (importZone) importZone.innerHTML = `<p>🔄 Traitement OCR en cours...</p>`;

        const formData = new FormData(e.target);
        formData.append("file", this.importedFile);
        
        // Forcer le mode OCR à true pour OCR seul
        formData.set("ocrMode", "true");
        formData.set("containsPatch", "false");
        
        try {
            await this.executeOcrRequest(formData);
        } catch (err) {
            this.showProcessingError("OCR", err.message);
        }
    }

    // =================== TRAITEMENT PATCH MODIFIÉ ===================
    setupPatchProcessing() {
        const btnPatch = document.getElementById("btnPatch");
        const patchForm = document.getElementById("patchForm");

        if (btnPatch) {
            // ✅ MODIFICATION PRINCIPALE : Nouvelle logique de clic pour Patch
            btnPatch.addEventListener("click", async () => {
                const shouldExecuteDirectly = await this.checkProfileAndExecutePatch();
                if (!shouldExecuteDirectly) {
                    // Si pas d'exécution directe, ouvrir la popup
                    await this.openPatchDialog();
                }
            });
        }

        if (patchForm) {
            patchForm.addEventListener("submit", (e) => this.processPatch(e));
        }
    }

    // ✅ MÉTHODE MODIFIÉE : openPatchDialog reste pour les cas où aucun profil n'est sélectionné
    async openPatchDialog() {
        const patchPopup = document.getElementById("patchPopup");
        if (!patchPopup) {
            this.showNotification("Interface Patch non disponible.", 'error');
            return;
        }

        try {
            // Afficher le popup avec un indicateur de chargement
            patchPopup.style.display = "flex";
            
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'patchLoadingIndicator';
            loadingIndicator.style.cssText = `
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8); color: white; padding: 15px 25px;
                border-radius: 8px; z-index: 1002;
            `;
            loadingIndicator.innerHTML = '🔄 Chargement des paramètres Patch...';
            patchPopup.appendChild(loadingIndicator);

            // Récupérer et appliquer la configuration
            const config = await this.getSelectedProfileOcrConfig();
            this.applyPatchConfigToForm(config);

            // Supprimer l'indicateur de chargement
            const indicator = document.getElementById('patchLoadingIndicator');
            if (indicator) {
                indicator.remove();
            }

            console.log('Dialogue Patch ouvert');
            
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du dialogue Patch:', error);
            
            const indicator = document.getElementById('patchLoadingIndicator');
            if (indicator) {
                indicator.remove();
            }
            
            this.showNotification('Erreur lors du chargement des paramètres Patch: ' + error.message, 'warning');
        }
    }

    // ✅ NOUVELLE MÉTHODE : Extraction de la logique d'exécution Patch
    async executePatchRequest(formData) {
        try {
            const response = await fetch(this.getPatchEndpoint(), {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                await this.handleMultipleFiles(response);
            } else {
                await this.handleSingleFile(response);
            }

        } catch (err) {
            console.error("Erreur Patch :", err);
            throw err; // Re-lancer pour gestion par la méthode appelante
        }
    }

    // ✅ Méthode processPatch modifiée pour utiliser executePatchRequest avec patchMode
    async processPatch(e) {
        e.preventDefault();

        if (!this.importedFile) {
            this.showNotification("Aucun fichier importé.", 'error');
            return;
        }

        // Fermer la popup et afficher le loading
        const patchPopup = document.getElementById("patchPopup");
        const importZone = document.getElementById("importZone");
        
        if (patchPopup) patchPopup.style.display = "none";
        if (importZone) importZone.innerHTML = `<p>🔄 Traitement Patch en cours...</p>`;

        const formData = new FormData(e.target);
        formData.append("file", this.importedFile);

        // S'assurer que containsPatch est défini sur true pour le traitement patch
        formData.set("containsPatch", "true");
        
        // ✅ Validation du patchMode si présent
        const patchMode = formData.get("patchMode");
        if (patchMode && !this.isValidPatchMode(patchMode)) {
            this.showNotification("Mode de traitement Patch invalide.", 'error');
            return;
        }
        
        try {
            await this.executePatchRequest(formData);
        } catch (err) {
            this.showProcessingError("Patch", err.message);
        }
    }

    // ✅ Nouvelle méthode pour valider le patchMode
    isValidPatchMode(patchMode) {
        const validModes = ['T_classique', 'T_with_bookmarks'];
        return validModes.includes(patchMode);
    }

    // =================== GÉNÉRATION PATCH ===================
    setupGeneratePatch() {
        const btnGeneratePatch = document.getElementById("btnGeneratePatch");
        const generatePatchForm = document.getElementById("generatePatchForm");

        if (btnGeneratePatch) {
            btnGeneratePatch.addEventListener("click", () => this.openGeneratePatchDialog());
        }

        if (generatePatchForm) {
            generatePatchForm.addEventListener("submit", (e) => this.processGeneratePatch(e));
        }
    }

    openGeneratePatchDialog() {
        const generatePatchPopup = document.getElementById("generatePatchPopup");
        if (generatePatchPopup) {
            generatePatchPopup.style.display = "flex";
        }
    }

    async processGeneratePatch(e) {
        e.preventDefault();

        // Fermer la popup et afficher le loading
        const generatePatchPopup = document.getElementById("generatePatchPopup");
        const importZone = document.getElementById("importZone");
        
        if (generatePatchPopup) generatePatchPopup.style.display = "none";
        if (importZone) importZone.innerHTML = `<p>🔄 Génération du patch en cours...</p>`;

        const formData = new FormData(e.target);
        const patchData = formData.get('patchData');

        if (!patchData) {
            this.showNotification("Veuillez saisir le texte du patch.", 'error');
            return;
        }

        try {
            // Utiliser l'endpoint spécialisé pour la génération de patch
            const response = await fetch(this.getGeneratePatchEndpoint(), {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    patchData: patchData 
                })
            });

            if (!response.ok) {
                // Récupérer les détails de l'erreur
                let errorDetails;
                try {
                    const errorResponse = await response.json();
                    errorDetails = errorResponse.error || errorResponse.message || 'Erreur inconnue';
                } catch {
                    errorDetails = `${response.status} ${response.statusText}`;
                }
                throw new Error(`Erreur serveur: ${response.status} - ${errorDetails}`);
            }

            const result = await response.json();
            
            if (result.status === "success" && result.results) {
                await this.handleGeneratedPatch(result);
            } else {
                throw new Error(result.message || result.error || "Erreur lors de la génération du patch");
            }

        } catch (err) {
            console.error("Erreur génération patch :", err);
            this.showProcessingError("Génération Patch", err.message);
        }
    }

    async handleGeneratedPatch(result) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>✅ Patch généré avec succès</h3>
                <p>Le patch a été généré avec succès.</p>
            </div>
        `;

        result.results.forEach((patchData, i) => {
            const patchSection = document.createElement('div');
            patchSection.style.cssText = `
                margin-bottom: 30px; 
                padding: 15px; 
                border: 1px solid #ddd; 
                border-radius: 8px; 
                background-color: #f9f9f9;
            `;

            const patchUrl = `data:application/pdf;base64,${patchData.base64}`;

            patchSection.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">📄 ${patchData.name}</h4>
                </div>
                <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="${patchUrl}" 
                       download="${patchData.name}" 
                       class="btn-primary" 
                       style="display: inline-block; padding: 8px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">
                       📥 Télécharger Patch
                    </a>
                    <button class="btn-warning preview-btn" 
                            data-patch-index="${i}"
                            style="padding: 8px 15px; background-color: #ffc107; color: black; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">
                       👁️ Aperçu
                    </button>
                </div>
                <div class="preview-content" data-patch-index="${i}" style="display: none;">
                    <div style="margin-top: 15px;">
                        <h5>👁️ Aperçu du patch:</h5>
                        <iframe src="${patchUrl}" 
                                style="width: 100%; height: 500px; border: 1px solid #ccc; border-radius: 4px;"
                                title="Aperçu du patch ${patchData.name}">
                        </iframe>
                    </div>
                </div>
            `;

            importZone.appendChild(patchSection);
        });

        // Gestion du toggle aperçu
        document.querySelectorAll(".preview-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const patchIndex = btn.getAttribute('data-patch-index');
                const preview = document.querySelector(`.preview-content[data-patch-index="${patchIndex}"]`);
                
                if (preview) {
                    const isVisible = preview.style.display !== "none";
                    preview.style.display = isVisible ? "none" : "block";
                    
                    // Mettre à jour le texte du bouton
                    btn.innerHTML = isVisible ? "👁️ Aperçu" : "❌ Fermer aperçu";
                }
            });
        });
    }

    // =================== GESTION DES RÉPONSES ===================
    async handleMultipleFiles(response) {
        const result = await response.json();
        const importZone = document.getElementById("importZone");
        
        if (!importZone) return;
        
        if (result.status !== "success" || !result.files || result.files.length === 0) {
            throw new Error(result.message || "Aucun fichier retourné");
        }

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>✅ Traitement réussi (${result.files.length} fichier(s))</h3>
                <p>${result.message}</p>
            </div>
        `;

        result.files.forEach((fileData, i) => this.createFileSection(fileData, i));
    }

    async handleSingleFile(response) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const importZone = document.getElementById("importZone");

        if (!importZone) return;

        // Extraire le nom du fichier depuis les headers de réponse
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'resultat.pdf';
        if (contentDisposition && contentDisposition.includes('filename=')) {
            fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
        }

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p>✅ Traitement terminé avec succès</p>
            </div>
            <div style="margin-bottom:20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                <h4>📄 Résultat: ${fileName}</h4>
                <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
                    <a href="${url}" download="${fileName}" class="btn-primary" style="
                        display: inline-block; 
                        padding: 10px 20px; 
                        background-color: #007bff; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 4px;
                    ">📥 Télécharger ${fileName.endsWith('.pdf') ? 'PDF' : 'Fichier'}</a>
                    <button id="previewBtn" class="btn-warning" style="
                        padding: 10px 20px; 
                        border-radius: 4px;
                        cursor: pointer;
                    ">👁️ Aperçu</button>
                </div>
                <div id="previewDiv" style="display: none;">
                    <iframe src="${url}" width="100%" height="500px" style="border:1px solid #ccc; border-radius: 4px;"></iframe>
                </div>
            </div>
        `;

        // Ajout du gestionnaire pour afficher/cacher le preview
        const previewBtn = document.getElementById('previewBtn');
        const previewDiv = document.getElementById('previewDiv');

        if (previewBtn && previewDiv) {
            previewBtn.addEventListener('click', () => {
                previewDiv.style.display = previewDiv.style.display === 'none' ? 'block' : 'none';
                previewBtn.textContent = previewDiv.style.display === 'none' ? '👁️ Aperçu' : '👁️ Masquer l\'aperçu';
            });
        }
    }

    createFileSection(fileData, index) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        const fileSection = document.createElement('div');
        fileSection.style.cssText = `
            margin-bottom: 30px; 
            padding: 15px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            background-color: #f9f9f9;
        `;

        // Vérifie que le contenu Base64 existe
        if (!fileData.content) {
            fileSection.innerHTML = `
                <div style="margin-bottom:20px; padding:10px; border:1px solid #ff6b6b; background-color:#ffe0e0;">
                    <h4>❌ Fichier ${index + 1}: ${fileData.name}</h4>
                    <p>Fichier non trouvé ou inaccessible</p>
                </div>
            `;
            importZone.appendChild(fileSection);
            return;
        }

        // Crée une URL Base64
        const pdfUrl = `data:application/pdf;base64,${fileData.content}`;
        
        // Informations supplémentaires sur le fichier
        let additionalInfo = '';
        if (fileData.pages && fileData.pages.length > 0) {
            additionalInfo += `<p><strong>Pages:</strong> ${fileData.pages.join(', ')}</p>`;
        }
        if (fileData.barcode) {
            additionalInfo += `<p><strong>Code-barres détecté:</strong> ${fileData.barcode}</p>`;
        }

        fileSection.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">📄 Fichier ${index + 1}: ${fileData.name}</h4>
                ${additionalInfo}
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="${pdfUrl}" 
                   download="${fileData.name}" 
                   class="btn-primary" 
                   style="display: inline-block; padding: 8px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">
                   📥 Télécharger PDF
                </a>
                <button class="btn-warning preview-btn" 
                        style="padding: 8px 15px; background-color: #ffc107; color: black; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">
                   👁️ Aperçu PDF
                </button>
            </div>
            <div class="preview-content" style="display: none;"></div>
        `;

        // Gestionnaire pour l'aperçu
        const previewBtn = fileSection.querySelector('.preview-btn');
        const previewContent = fileSection.querySelector('.preview-content');

        if (previewBtn && previewContent) {
            previewBtn.addEventListener('click', () => {
                if (previewContent.style.display === 'none') {
                    previewContent.innerHTML = `
                        <div style="margin-top: 15px;">
                            <h5>👁️ Aperçu PDF:</h5>
                            <iframe src="${pdfUrl}" width="100%" height="500px" style="border: 1px solid #ccc; border-radius: 4px;"></iframe>
                        </div>
                    `;
                    previewContent.style.display = 'block';
                    previewBtn.textContent = '👁️ Masquer l\'aperçu';
                } else {
                    previewContent.style.display = 'none';
                    previewBtn.textContent = '👁️ Aperçu PDF';
                }
            });
        }

        importZone.appendChild(fileSection);
    }

    showProcessingError(processType, message) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        importZone.innerHTML = `
            <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <p>❌ Erreur ${processType} : ${message}</p>
                <button onclick="location.reload()" 
                        class="btn-primary" 
                        style="padding: 8px 15px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }

    // =================== INTÉGRATION AVEC SCANNER ===================
    setupScanIntegration() {
        const btnScan = document.getElementById("btnScan");
        
        if (btnScan) {
            btnScan.addEventListener("click", () => this.handleScanClick());
        }
    }

    async handleScanClick() {
        const selectedProfile = window.profileManager?.selectedProfile;
        
        if (!selectedProfile) {
            this.showNotification("Veuillez sélectionner un profil avant de scanner.", 'warning');
            return;
        }

        await this.scanWithProfile(selectedProfile);
    }

    async scanWithProfile(profileName) {
    const btnScan = document.getElementById("btnScan");
    
    if (btnScan) {
        btnScan.disabled = true;
        btnScan.textContent = "📄 Scan en cours...";
    }
    
    try {
        const formData = new FormData();
        formData.append("scan", "true");
        formData.append("profileName", profileName);
        formData.append("ocrMode", "false"); // Scan seul par défaut
        
        const response = await fetch(this.getOCREndpoint(), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!data.success && data.error) {
                throw new Error(data.error);
            }
            this.showNotification("Scan terminé avec succès !", 'success');
        } else {
            // MODIFICATION ICI : Traiter le fichier scanné comme un fichier importé
            const blob = await response.blob();
            
            // Extraire le nom du fichier depuis les headers
            const contentDisposition = response.headers.get('content-disposition');
            let fileName = 'document_scanne.pdf';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
            }
            
            // Créer un objet File à partir du blob
            this.importedFile = new File([blob], fileName, { type: blob.type });
            
            // Mettre à jour l'interface comme pour un fichier importé
            const importedFileName = document.getElementById("importedFileName");
            const btnOCR = document.getElementById("btnOCR");
            const btnPatch = document.getElementById("btnPatch");
            
            if (importedFileName) {
                importedFileName.innerText = `Fichier scanné : ${fileName}`;
            }
            
            if (btnOCR) {
                btnOCR.disabled = false;
            }

            if (btnPatch) {
                btnPatch.disabled = false;
            }

            // Créer la preview du fichier scanné dans la zone d'importation
            this.createFilePreview(this.importedFile);
            
            this.showNotification("Fichier scanné avec succès et prêt pour traitement OCR/Patch !", 'success');
        }

    } catch (err) {
        console.error("Erreur scan:", err);
        this.showNotification("Erreur scan : " + err.message, 'error');
    } finally {
        if (btnScan) {
            btnScan.disabled = false;
            btnScan.textContent = "📄 Scanner";
        }
    }
}
    // =================== GESTION DES FICHIERS IMPORTÉS ===================
    async loadImportedFiles() {
        const importedFilesList = document.getElementById("importedFilesList");
        if (!importedFilesList) return;

        try {
            const response = await fetch("http://localhost:3000/files/imported");
            const data = await response.json();
            
            importedFilesList.innerHTML = '';
            
            if (data.success && data.files.length) {
                data.files.forEach(file => {
                    const fileItem = this.createImportedFileItem(file);
                    importedFilesList.appendChild(fileItem);
                });
            } else {
                importedFilesList.innerHTML = '<p>Aucun fichier importé trouvé</p>';
            }
        } catch (err) {
            console.error("Erreur chargement fichiers importés:", err);
            importedFilesList.innerHTML = '<p>Erreur de chargement</p>';
        }
    }

    createImportedFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'imported-file-item';
        fileItem.style.cssText = `
            padding: 15px; 
            margin-bottom: 10px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            background-color: #f8f9fa;
        `;
        
        fileItem.innerHTML = `
            <div class="file-info" style="margin-bottom: 10px;">
                <strong>${file.fileName}</strong><br>
                <small>Créé: ${new Date(file.created).toLocaleString()}</small><br>
                <small>Taille: ${(file.size / 1024).toFixed(2)} KB</small>
            </div>
            <div class="file-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-select" data-filename="${file.fileName}" 
                        style="padding: 6px 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Sélectionner
                </button>
                <button class="btn-download" data-filename="${file.fileName}"
                        style="padding: 6px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Télécharger
                </button>
                <button class="btn-delete" data-filename="${file.fileName}"
                        style="padding: 6px 12px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Supprimer
                </button>
            </div>
        `;

        // Ajouter les gestionnaires d'événements
        const selectBtn = fileItem.querySelector('.btn-select');
        const downloadBtn = fileItem.querySelector('.btn-download');
        const deleteBtn = fileItem.querySelector('.btn-delete');

        if (selectBtn) {
            selectBtn.addEventListener('click', () => this.selectImportedFile(file.fileName));
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadImportedFile(file.fileName));
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteImportedFile(file.fileName));
        }

        return fileItem;
    }

    async selectImportedFile(fileName) {
        try {
            const response = await fetch(`http://localhost:3000/files/download/${fileName}`);
            if (!response.ok) {
                throw new Error("Erreur lors de la récupération du fichier");
            }

            const blob = await response.blob();
            this.importedFile = new File([blob], fileName, { type: blob.type });

            const importedFileName = document.getElementById("importedFileName");
            const btnOCR = document.getElementById("btnOCR");
            const btnPatch = document.getElementById("btnPatch");
            
            if (importedFileName) {
                importedFileName.innerText = `Fichier sélectionné : ${fileName}`;
            }
            
            if (btnOCR) {
                btnOCR.disabled = false;
            }

            if (btnPatch) {
                btnPatch.disabled = false;
            }

            this.createFilePreview(this.importedFile);
            this.showNotification("Fichier sélectionné avec succès", 'success');

        } catch (err) {
            console.error("Erreur sélection fichier:", err);
            this.showNotification("Erreur lors de la sélection du fichier : " + err.message, 'error');
        }
    }

    async downloadImportedFile(fileName) {
        try {
            const response = await fetch(`http://localhost:3000/files/download/${fileName}`);
            if (!response.ok) {
                throw new Error("Erreur lors du téléchargement");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            this.showNotification("Téléchargement démarré", 'success');

        } catch (err) {
            console.error("Erreur téléchargement:", err);
            this.showNotification("Erreur lors du téléchargement : " + err.message, 'error');
        }
    }

    async deleteImportedFile(fileName) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${fileName}" ?`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/files/delete/${fileName}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error("Erreur lors de la suppression");
            }

            const data = await response.json();
            
            if (data.success) {
                this.showNotification("Fichier supprimé avec succès", 'success');
                this.loadImportedFiles(); // Recharger la liste
            } else {
                throw new Error(data.error || "Erreur lors de la suppression");
            }

        } catch (err) {
            console.error("Erreur suppression:", err);
            this.showNotification("Erreur lors de la suppression : " + err.message, 'error');
        }
    }

    // =================== ENDPOINTS ET CONFIGURATION ===================
    getOCREndpoint() {
        return "http://localhost:3000/processFile";
    }

    getPatchEndpoint() {
        return "http://localhost:3000/processFile";
    }

    getGeneratePatchEndpoint() {
        return "http://localhost:3000/patch/generatePatch";
    }
    getscanEndpoint() {
        return "http://localhost:3000/scanners";
    }
    // =================== FONCTIONS UTILITAIRES ===================
    showNotification(message, type = 'info') {
        if (window.Utils && typeof window.Utils.showNotification === 'function') {
            window.Utils.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
            alert(message);
        }
    }

    validateFile(file) {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/tiff',
            'image/tif'
        ];

        if (!allowedTypes.includes(file.type)) {
            this.showNotification("Type de fichier non supporté. Veuillez utiliser PDF, JPG, PNG ou TIFF.", 'error');
            return false;
        }

        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            this.showNotification("Le fichier est trop volumineux. Taille maximum: 50MB.", 'error');
            return false;
        }

        return true;
    }

    reset() {
        this.importedFile = null;
        const importedFileName = document.getElementById("importedFileName");
        const btnOCR = document.getElementById("btnOCR");
        const btnPatch = document.getElementById("btnPatch");
        const importZone = document.getElementById("importZone");

        if (importedFileName) {
            importedFileName.innerText = '';
        }
        
        if (btnOCR) {
            btnOCR.disabled = true;
        }

        if (btnPatch) {
            btnPatch.disabled = true;
        }

        if (importZone) {
            const preview = importZone.querySelector('.file-preview');
            if (preview) {
                preview.remove();
            }
            
            if (!importZone.querySelector('p')) {
                importZone.innerHTML = '<p>📂 Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>';
            }
        }

        this.invalidateProfileConfigCache();
    }

    getImportedFile() {
        return this.importedFile;
    }

    hasImportedFile() {
        return this.importedFile !== null;
    }

    cleanup() {
        // Nettoyer les URLs d'objets créées
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.src.startsWith('blob:')) {
                URL.revokeObjectURL(iframe.src);
            }
        });

        const links = document.querySelectorAll('a[href^="blob:"]');
        links.forEach(link => {
            URL.revokeObjectURL(link.href);
        });
    }

    // =================== MÉTHODES DE CACHE ET OPTIMISATION ===================
    
    invalidateProfileConfigCache() {
        this.cachedProfileConfig = null;
        console.log('Cache de configuration profil invalidé');
    }

    setupProfileChangeListener() {
        if (window.profileManager) {
            const originalSelectProfile = window.profileManager.selectProfile;
            
            window.profileManager.selectProfile = (...args) => {
                const result = originalSelectProfile.apply(window.profileManager, args);
                this.invalidateProfileConfigCache();
                console.log('Profil sélectionné changé, cache invalidé');
                return result;
            };
        }
    }

    async debugProfileConfig() {
        console.log('=== DEBUG CONFIGURATION PROFIL ===');
        
        if (!window.profileManager || !window.profileManager.selectedProfile) {
            console.log('❌ Aucun profil sélectionné');
            return;
        }

        const profileName = window.profileManager.selectedProfile;
        console.log(`📋 Profil sélectionné: ${profileName}`);
        
        try {
            const config = await this.getSelectedProfileOcrConfig();
            console.log('✅ Configuration récupérée:', config);
            
            console.log('🔧 Test création FormData...');
            
            // Tester la création des FormData
            const ocrFormData = this.createOcrFormDataFromConfig(config);
            const patchFormData = this.createPatchFormDataFromConfig(config);
            
            console.log('✅ FormData OCR créé');
            console.log('✅ FormData Patch créé avec patchMode:', config.patchMode);
            
        } catch (error) {
            console.error('❌ Erreur:', error);
        }
        
        console.log('===================================');
    }

    // =================== EXPOSER LES FONCTIONS GLOBALEMENT ===================
    exposeGlobalFunctions() {
        // Fonctions pour fermer les popups
        window.closeOCRPopup = () => {
            const ocrPopup = document.getElementById("ocrPopup");
            if (ocrPopup) ocrPopup.style.display = "none";
        };

        window.closePatchPopup = () => {
            const patchPopup = document.getElementById("patchPopup");
            if (patchPopup) patchPopup.style.display = "none";
        };

        window.closeGeneratePatchPopup = () => {
            const generatePatchPopup = document.getElementById("generatePatchPopup");
            if (generatePatchPopup) generatePatchPopup.style.display = "none";
        };
        
        // Nouvelles fonctions de debug globales
        window.debugOCRProfileConfig = () => this.debugProfileConfig();
        window.testOCRConfigRecovery = async () => {
            console.log('=== TEST RÉCUPÉRATION CONFIGURATION ===');
            
            if (!window.profileManager?.selectedProfile) {
                console.log('❌ Aucun profil sélectionné');
                return;
            }

            console.log('🔧 Test récupération configuration...');
            const config = await this.getSelectedProfileOcrConfig();
            console.log('✅ Configuration récupérée:', config);
            console.log('✅ PatchMode:', config.patchMode);
            
            // Test application
            console.log('🔧 Test application aux formulaires...');
            this.applyOcrConfigToForm(config);
            this.applyPatchConfigToForm(config);
            console.log('✅ Configuration appliquée aux formulaires');
            
            console.log('=========================================');
            return config;
        };

        // Nouvelles fonctions pour tester l'exécution directe
        window.testDirectOCR = async () => {
            console.log('=== TEST EXÉCUTION DIRECTE OCR ===');
            if (!this.importedFile) {
                console.log('❌ Aucun fichier importé');
                return;
            }
            const result = await this.checkProfileAndExecuteOcr();
            console.log('Résultat:', result ? 'Exécuté directement' : 'Popup nécessaire');
            console.log('==================================');
            return result;
        };

        window.testDirectPatch = async () => {
            console.log('=== TEST EXÉCUTION DIRECTE PATCH ===');
            if (!this.importedFile) {
                console.log('❌ Aucun fichier importé');
                return;
            }
            const result = await this.checkProfileAndExecutePatch();
            console.log('Résultat:', result ? 'Exécuté directement' : 'Popup nécessaire');
            console.log('====================================');
            return result;
        };

        // ✅ Nouvelle fonction pour tester la validation du patchMode
        window.testPatchModeValidation = () => {
            console.log('=== TEST VALIDATION PATCHMODE ===');
            const testModes = ['T_classique', 'T_with_bookmarks', 'invalid_mode', ''];
            
            testModes.forEach(mode => {
                const isValid = this.isValidPatchMode(mode);
                console.log(`Mode "${mode}": ${isValid ? '✅ Valide' : '❌ Invalide'}`);
            });
            
            console.log('=================================');
        };

        // Exposer l'instance pour usage global
        window.ocrManager = this;
    }

    // =================== MÉTHODES DE DEBUGGING ===================
    getDebugInfo() {
        return {
            hasImportedFile: this.hasImportedFile(),
            importedFileName: this.importedFile?.name || null,
            importedFileSize: this.importedFile?.size || null,
            importedFileType: this.importedFile?.type || null,
            selectedProfile: window.profileManager?.selectedProfile || null,
            cachedConfig: this.cachedProfileConfig,
            profileManagerAvailable: !!window.profileManager,
            timestamp: new Date().toISOString(),
            // Nouvelles informations de debug
            canExecuteDirectOCR: !!window.profileManager?.selectedProfile && this.hasImportedFile(),
            canExecuteDirectPatch: !!window.profileManager?.selectedProfile && this.hasImportedFile(),
            // ✅ Information sur le patchMode du cache
            cachedPatchMode: this.cachedProfileConfig?.config?.patchMode || null
        };
    }
}