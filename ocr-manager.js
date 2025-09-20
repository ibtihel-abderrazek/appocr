// ocr-manager.js - Version modifiée avec interface unifiée OCR/Patch

class OCRManager {
    constructor() {
        this.importedFile = null;
        this.importedFiles = [];
        this.cachedProfileConfig = null;
        this.init();
    }

    // =================== INITIALISATION ===================
    init() {
        this.setupDragAndDrop();
        this.setupFileImport();
        this.setupUnifiedProcessing(); // NOUVEAU : Interface unifiée
        this.setupGeneratePatch();
        this.setupScanIntegration();
        this.loadImportedFiles();
        this.exposeGlobalFunctions();
    }

    // =================== DRAG & DROP ET IMPORT (Inchangé) ===================
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
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        
        if (importedFileName) {
            importedFileName.innerText = `Fichier importé : ${file.name}`;
        }
        
        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.disabled = false;
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

    // =================== NOUVELLE INTERFACE UNIFIÉE ===================
    
    setupUnifiedProcessing() {
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        const unifiedForm = document.getElementById("unifiedProcessingForm");

        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.addEventListener("click", async () => {
                const shouldExecuteDirectly = await this.checkProfileAndExecuteUnified();
                if (!shouldExecuteDirectly) {
                    await this.openUnifiedDialog();
                }
            });
        }

        if (unifiedForm) {
            unifiedForm.addEventListener("submit", (e) => this.processUnified(e));
        }
    }

    // Vérifier si un traitement direct est possible selon le profil
    async checkProfileAndExecuteUnified() {
        if (!this.importedFile) {
            this.showNotification("Veuillez importer un fichier avant de lancer le traitement.", 'warning');
            return false;
        }

        if (!window.profileManager || !window.profileManager.selectedProfile) {
            console.log('Aucun profil sélectionné, ouverture de la popup unifiée');
            return false;
        }

        const profileName = window.profileManager.selectedProfile;
        console.log(`Profil sélectionné détecté: ${profileName}`);

        try {
            const config = await this.getSelectedProfileOcrConfig();
            
            // Déterminer le mode de traitement selon la configuration du profil
            let processingMode = 'none';
            
            if (config.ocrMode && config.patchEnabled) {
                processingMode = 'both';
            } else if (config.ocrMode) {
                processingMode = 'ocr';
            } else if (config.patchEnabled) {
                processingMode = 'patch';
            }
            
            if (processingMode === 'none') {
                console.log('Aucun traitement activé dans le profil, ouverture de la popup');
                return false;
            }

            console.log(`Traitement automatique: ${processingMode}`);

            const importZone = document.getElementById("importZone");
            if (importZone) {
                importZone.innerHTML = `<p>🔄 Traitement automatique (${processingMode}) avec le profil "${profileName}"...</p>`;
            }
            
            const formData = this.createUnifiedFormDataFromConfig(config, processingMode);
            await this.executeUnifiedRequest(formData);
            
            return true;
            
        } catch (error) {
            console.error('Erreur lors de l\'exécution automatique:', error);
            this.showProcessingError("Traitement automatique", error.message);
            return true;
        }
    }

    // Ouvrir la popup unifiée
    async openUnifiedDialog() {
    const unifiedPopup = document.getElementById("unifiedProcessingPopup");
    if (!unifiedPopup) {
        this.showNotification("Interface de traitement non disponible.", 'error');
        return;
    }

    try {
        unifiedPopup.style.display = "flex";
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'unifiedLoadingIndicator';
        loadingIndicator.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8); color: white; padding: 15px 25px;
            border-radius: 8px; z-index: 1002;
        `;
        loadingIndicator.innerHTML = '🔄 Chargement des paramètres...';
        unifiedPopup.appendChild(loadingIndicator);

        const config = await this.getSelectedProfileOcrConfig();
        this.applyUnifiedConfigToForm(config);

        const indicator = document.getElementById('unifiedLoadingIndicator');
        if (indicator) {
            indicator.remove();
        }
        setTimeout(() => {
                this.initProcessingModeListeners();
                this.updateProcessingOptionsVisibility();
            }, 50);

            console.log('Dialogue unifié ouvert');
    } catch (error) {
        console.error('Erreur lors de l\'ouverture du dialogue unifié:', error);
        
        const indicator = document.getElementById('unifiedLoadingIndicator');
        if (indicator) {
            indicator.remove();
        }
        
        this.showNotification('Erreur lors du chargement: ' + error.message, 'warning');
    }
    }
    // 2. Nouvelle méthode pour initialiser les listeners checkbox
initProcessingModeListeners() {
    // Event listeners pour les divs de traitement
    document.querySelectorAll('.processing-option').forEach(option => {
        // Supprimer les anciens listeners s'ils existent
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        newOption.addEventListener('click', (e) => {
            // Éviter le double trigger si on clique sur la checkbox
            if (e.target.type === 'checkbox') return;
            
            const mode = newOption.dataset.mode;
            if (mode) {
                this.toggleProcessingMode(mode);
            }
        });
    });

    // Event listeners pour les checkboxes directement
    document.querySelectorAll('.processing-option input[type="checkbox"]').forEach(checkbox => {
        // Supprimer les anciens listeners
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        
        newCheckbox.addEventListener('change', (e) => {
            const option = newCheckbox.closest('.processing-option');
            if (newCheckbox.checked) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
            this.updateProcessingOptionsVisibility();
        });
    });
    
    // Initialiser la visibilité des options
    this.updateProcessingOptionsVisibility();
}

// 3. Nouvelle méthode pour toggle des modes
toggleProcessingMode(mode) {
    const checkbox = document.getElementById(mode + 'Mode');
    if (!checkbox) return;
    
    const option = checkbox.closest('.processing-option');
    
    // Toggle checkbox
    checkbox.checked = !checkbox.checked;
    
    // Toggle visual state
    if (checkbox.checked) {
        option.classList.add('selected');
    } else {
        option.classList.remove('selected');
    }
    
    // Mettre à jour l'affichage des options
    this.updateProcessingOptionsVisibility();
}

// 4. Nouvelle méthode pour mettre à jour la visibilité des options
updateProcessingOptionsVisibility() {
    const ocrChecked = document.getElementById('ocrMode')?.checked || false;
    const patchChecked = document.getElementById('patchMode')?.checked || false;
    
    const ocrOptions = document.getElementById('ocrOptions');
    const patchOptions = document.getElementById('patchOptions');
    
    if (ocrOptions) {
        ocrOptions.style.display = ocrChecked ? 'block' : 'none';
    }
    if (patchOptions) {
        patchOptions.style.display = patchChecked ? 'block' : 'none';
    }
    
    // Désactiver les champs si les modes ne sont pas sélectionnés
    const ocrFields = document.querySelectorAll('#ocrOptions select, #ocrOptions input');
    const patchFields = document.querySelectorAll('#patchOptions select, #patchOptions input');
    
    ocrFields.forEach(field => field.disabled = !ocrChecked);
    patchFields.forEach(field => field.disabled = !patchChecked);
}
    // Appliquer la configuration du profil au formulaire unifié
    applyUnifiedConfigToForm(config) {
        const form = document.getElementById("unifiedProcessingForm");
        if (!form) {
            console.error('Formulaire unifié non trouvé');
            return;
        }

        console.log('Application de la configuration unifiée:', config);

        // Déterminer le mode de traitement par défaut
        const ocrCheckbox = form.querySelector('#ocrMode');
        const patchCheckbox = form.querySelector('#patchMode');

        if (ocrCheckbox) {
            ocrCheckbox.checked = config.ocrMode;
            const ocrOption = ocrCheckbox.closest('.processing-option');
            if (ocrOption) {
                ocrOption.classList.toggle('selected', config.ocrMode);
            }
        }

        if (patchCheckbox) {
            patchCheckbox.checked = config.patchEnabled;
            const patchOption = patchCheckbox.closest('.processing-option');
            if (patchOption) {
                patchOption.classList.toggle('selected', config.patchEnabled);
            }
        }


        // Appliquer les valeurs
        const fieldMappings = {
            'lang': config.language || 'fra',
            'mode': config.pdfMode || 'pdfa',
            'patchMode': config.patchMode || 'T_classique',
            'naming': config.patchNaming || 'barcode_ocr_generic',
            'namingPattern': config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
            'ocrMode': config.patchEnabled ? 'true' : 'false'
        };

        Object.entries(fieldMappings).forEach(([fieldName, value]) => {
            const field = form.querySelector(`[name="${fieldName}"]`) || form.querySelector(`#unified${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`);
            if (field) {
                field.value = value || '';
                
                // Déclencher l'événement change pour le mode de traitement
                if (fieldName === 'processingMode' && value) {
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                console.log(`Unifié - ${fieldName}: ${value} appliqué`);
            }
        });
        setTimeout(() => {
          this.initProcessingModeListeners();
        }, 100);
        // Mettre à jour l'aperçu du pattern
        this.updateUnifiedPreview();
    }

    // Traiter le formulaire unifié
    async processUnified(e) {
    e.preventDefault();

    if (!this.importedFile) {
        this.showNotification("Aucun fichier importé.", 'error');
        return;
    }

    // Récupérer les valeurs des checkboxes
    const ocrMode = document.getElementById('ocrMode')?.checked || false;
    const patchMode = document.getElementById('patchMode')?.checked || false;

    if (!ocrMode && !patchMode) {
        this.showNotification("Veuillez sélectionner au moins un mode de traitement.", 'error');
        return;
    }

    // Créer FormData à partir du formulaire
    const formData = new FormData(e.target);
    
    // Ajouter le fichier
    formData.append("file", this.importedFile);

    // Déterminer le mode combiné
    let processingMode = 'none';
    if (ocrMode && patchMode) {
        processingMode = 'both';
    } else if (ocrMode) {
        processingMode = 'ocr';
    } else if (patchMode) {
        processingMode = 'patch';
    }

    // Configurer les paramètres selon le mode
    this.configureFormDataByMode(formData, processingMode, ocrMode, patchMode);

    // Fermer la popup et afficher le loading
    const unifiedPopup = document.getElementById("unifiedProcessingPopup");
    const importZone = document.getElementById("importZone");
    
    if (unifiedPopup) unifiedPopup.style.display = "none";
    if (importZone) importZone.innerHTML = `<p>🔄 Traitement ${processingMode} en cours...</p>`;

    try {
        await this.executeUnifiedRequest(formData);
    } catch (err) {
        this.showProcessingError("Traitement unifié", err.message);
    }
}

    // Configurer FormData selon le mode de traitement
    configureFormDataByMode(formData, mode, ocrMode, patchMode) {
    // Configuration générale selon les modes sélectionnés
    formData.set("ocrMode", ocrMode ? "true" : "false");
    formData.set("containsPatch", patchMode ? "true" : "false");
    
    // Si aucun mode OCR n'est sélectionné, supprimer les paramètres OCR
    if (!ocrMode) {
        formData.delete("lang");
        formData.delete("mode");
    }
    
    // Si aucun mode Patch n'est sélectionné, supprimer les paramètres Patch
    if (!patchMode) {
        formData.delete("patchMode");
        formData.delete("naming");
    }
    
    // Valeurs par défaut si les champs sont vides
    if (ocrMode) {
        if (!formData.get("lang")) formData.set("lang", "fra");
        if (!formData.get("mode")) formData.set("mode", "pdfa");
    }
    
    if (patchMode) {
        if (!formData.get("patchMode")) formData.set("patchMode", "T_classique");
        if (!formData.get("naming")) formData.set("naming", "barcode_ocr_generic");
    }
    
    // Le pattern de nommage est toujours nécessaire
    if (!formData.get("namingPattern")) {
        formData.set("namingPattern", "$(YYYY)$(MM)$(DD)");
    }
}

    // Créer FormData à partir de la configuration du profil
    createUnifiedFormDataFromConfig(config, mode) {
        const formData = new FormData();
        
        formData.append("file", this.importedFile);
        formData.append("namingPattern", config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)');
        
        switch(mode) {
            case 'ocr':
                formData.append("ocrMode", "true");
                formData.append("containsPatch", "false");
                formData.append("lang", config.language || 'fra');
                formData.append("mode", config.pdfMode || 'pdfa');
                break;
                
            case 'patch':
                formData.append("ocrMode", "false");
                formData.append("containsPatch", "true");
                formData.append("patchMode", config.patchMode || 'T_classique');
                formData.append("naming", config.patchNaming || 'barcode_ocr_generic');
                break;
                
            case 'both':
                formData.append("ocrMode", "true");
                formData.append("containsPatch", "true");
                formData.append("lang", config.language || 'fra');
                formData.append("mode", config.pdfMode || 'pdfa');
                formData.append("patchMode", config.patchMode || 'T_classique');
                formData.append("naming", config.patchNaming || 'barcode_ocr_generic');
                break;
        }
        
        console.log('FormData unifié créé pour mode:', mode);
        return formData;
    }

    // Exécuter la requête unifiée
    async executeUnifiedRequest(formData) {
        try {
            const response = await fetch(this.getProcessingEndpoint(), {
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
            console.error("Erreur traitement unifié :", err);
            throw err;
        }
    }

    // =================== MÉTHODES CONSERVÉES POUR LA CONFIGURATION ===================

    async getSelectedProfileOcrConfig() {
        try {
            if (!window.profileManager || !window.profileManager.selectedProfile) {
                console.log('Aucun profil sélectionné');
                return this.getDefaultOcrPatchConfig();
            }

            const profileName = window.profileManager.selectedProfile;
            console.log(`Récupération configuration pour le profil: ${profileName}`);

            if (this.cachedProfileConfig && 
                this.cachedProfileConfig.profileName === profileName &&
                Date.now() - this.cachedProfileConfig.timestamp < 30000) {
                console.log('Utilisation du cache de configuration');
                return this.cachedProfileConfig.config;
            }

            const ocrConfig = await this.loadOcrConfigFromProfile(profileName);
            
            this.cachedProfileConfig = {
                profileName: profileName,
                config: ocrConfig,
                timestamp: Date.now()
            };

            console.log('Configuration récupérée:', ocrConfig);
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
                    profileName:profileName,
                    language: data.lang || 'fra',
                    confidence: '80',
                    dpi: '300',
                    preprocessImage: 'true',
                    enhanceContrast: 'true',
                    removeNoise: 'false',
                    autoRotate: 'true',
                    ocrMode: data.ocrMode || false,
                    namingPattern: data.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                    pdfMode: data.pdfMode || 'pdfa',
                    patchMode: data.patchType|| 'T_classique',
                    patchNaming: data.patchNaming || 'barcode_ocr_generic',
                    patchEnabled: data.patchEnabled || false,
                    splitByBarcode: data.patchEnabled ? 'true' : 'false',
                    barcodePosition: 'top-right',
                    outputFormat: 'pdf',
                    includeOriginalPages: 'false'
                };
            } else {
                console.log(`Aucune configuration trouvée pour le profil ${profileName}`);
                return this.getDefaultOcrPatchConfig();
            }
        } catch (error) {
            console.warn('Erreur lors de la récupération de la configuration:', error);
            return this.getDefaultOcrPatchConfig();
        }
    }

    getDefaultOcrPatchConfig() {
        return {
            language: 'fra',
            confidence: '80',
            dpi: '300',
            preprocessImage: 'true',
            enhanceContrast: 'true',
            removeNoise: 'false',
            autoRotate: 'true',
            ocrMode: false,
            namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: 'pdfa',
            patchMode: 'T_classique',
            patchNaming: 'barcode_ocr_generic',
            patchEnabled: false,
            splitByBarcode: 'false',
            barcodePosition: 'top-right',
            outputFormat: 'pdf',
            includeOriginalPages: 'false'
        };
    }

    // =================== GÉNÉRATION PATCH (Conservé) ===================
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

        document.querySelectorAll(".preview-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const patchIndex = btn.getAttribute('data-patch-index');
                const preview = document.querySelector(`.preview-content[data-patch-index="${patchIndex}"]`);
                
                if (preview) {
                    const isVisible = preview.style.display !== "none";
                    preview.style.display = isVisible ? "none" : "block";
                    btn.innerHTML = isVisible ? "👁️ Aperçu" : "❌ Fermer aperçu";
                }
            });
        });
    }

    // =================== INTÉGRATION SCANNER (Modifié) ===================
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
            formData.append("ocrMode", "false");
            
            const response = await fetch(this.getProcessingEndpoint(), {
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
                const blob = await response.blob();
                
                const contentDisposition = response.headers.get('content-disposition');
                let fileName = 'document_scanne.pdf';
                if (contentDisposition && contentDisposition.includes('filename=')) {
                    fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
                }
                
                this.importedFile = new File([blob], fileName, { type: blob.type });
                
                const importedFileName = document.getElementById("importedFileName");
                const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
                
                if (importedFileName) {
                    importedFileName.innerText = `Fichier scanné : ${fileName}`;
                }
                
                if (btnUnifiedProcessing) {
                    btnUnifiedProcessing.disabled = false;
                }

                this.createFilePreview(this.importedFile);
                
                this.showNotification("Fichier scanné avec succès et prêt pour traitement !", 'success');
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

    // =================== GESTION DES RÉPONSES (Conservé) ===================
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

        const pdfUrl = `data:application/pdf;base64,${fileData.content}`;
        
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

    // =================== GESTION DES FICHIERS IMPORTÉS (Conservé) ===================
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
            const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
            
            if (importedFileName) {
                importedFileName.innerText = `Fichier sélectionné : ${fileName}`;
            }
            
            if (btnUnifiedProcessing) {
                btnUnifiedProcessing.disabled = false;
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
                this.loadImportedFiles();
            } else {
                throw new Error(data.error || "Erreur lors de la suppression");
            }

        } catch (err) {
            console.error("Erreur suppression:", err);
            this.showNotification("Erreur lors de la suppression : " + err.message, 'error');
        }
    }

    // =================== ENDPOINTS ET CONFIGURATION ===================
    getProcessingEndpoint() {
        return "http://localhost:3000/processFile";
    }

    getGeneratePatchEndpoint() {
        return "http://localhost:3000/patch/generatePatch";
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
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        const importZone = document.getElementById("importZone");

        if (importedFileName) {
            importedFileName.innerText = '';
        }
        
        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.disabled = true;
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

    // =================== NOUVELLES FONCTIONS POUR L'INTERFACE UNIFIÉE ===================
    
    // Mettre à jour l'aperçu du pattern unifié
    updateUnifiedPreview() {
        const patternInput = document.getElementById('unifiedNamingPattern');
        const previewSpan = document.getElementById('unifiedPreview');
        
        if (!patternInput || !previewSpan) return;
        
        const pattern = patternInput.value;
        const now = new Date();
        
        let preview = pattern
            .replace(/\$\(YYYY\)/g, now.getFullYear().toString())
            .replace(/\$\(YY\)/g, now.getFullYear().toString().substr(-2))
            .replace(/\$\(MM\)/g, String(now.getMonth() + 1).padStart(2, '0'))
            .replace(/\$\(DD\)/g, String(now.getDate()).padStart(2, '0'))
            .replace(/\$\(HH\)/g, String(now.getHours()).padStart(2, '0'))
            .replace(/\$\(mm\)/g, String(now.getMinutes()).padStart(2, '0'))
            .replace(/\$\(ss\)/g, String(now.getSeconds()).padStart(2, '0'))
            .replace(/\$\(nnn\)/g, '001')
            .replace(/\$\(nn\)/g, '01')
            .replace(/\$\(n\)/g, '1');
        
        previewSpan.textContent = preview || '(vide)';
    }

    // =================== EXPOSER LES FONCTIONS GLOBALEMENT ===================
    exposeGlobalFunctions() {
        // Fonction pour fermer la popup unifiée
        window.closeUnifiedProcessingPopup = () => {
            const unifiedPopup = document.getElementById("unifiedProcessingPopup");
            if (unifiedPopup) unifiedPopup.style.display = "none";
        };

        // Fonctions pour fermer les autres popups (conservées)
        window.closeGeneratePatchPopup = () => {
            const generatePatchPopup = document.getElementById("generatePatchPopup");
            if (generatePatchPopup) generatePatchPopup.style.display = "none";
        };

        window.toggleProcessingMode = (mode) => this.toggleProcessingMode(mode);

        window.addToUnifiedPattern = (code) => {
            const input = document.getElementById('unifiedNamingPattern');
            if (!input) return;
            
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            input.value = value.substring(0, start) + code + value.substring(end);
            const newPos = start + code.length;
            input.setSelectionRange(newPos, newPos);
            input.focus();
            this.updateUnifiedPreview();
        };

        window.clearUnifiedPattern = () => {
            const input = document.getElementById('unifiedNamingPattern');
            if (!input) return;
            
            input.value = '';
            this.updateUnifiedPreview();
            input.focus();
        };

        // Fonctions de debug pour l'interface unifiée
        window.debugUnifiedConfig = () => this.debugUnifiedConfig();
        window.testUnifiedProcessing = async () => {
            console.log('=== TEST TRAITEMENT UNIFIÉ ===');
            if (!this.importedFile) {
                console.log('❌ Aucun fichier importé');
                return;
            }
            const result = await this.checkProfileAndExecuteUnified();
            console.log('Résultat:', result ? 'Exécuté directement' : 'Popup nécessaire');
            console.log('===============================');
            return result;
        };
        
        
        // Exposer l'instance pour usage global
        window.ocrManager = this;
        
    }

    // =================== MÉTHODES DE DEBUGGING ===================
    async debugUnifiedConfig() {
        console.log('=== DEBUG CONFIGURATION UNIFIÉE ===');
        
        if (!window.profileManager || !window.profileManager.selectedProfile) {
            console.log('❌ Aucun profil sélectionné');
            return;
        }

        const profileName = window.profileManager.selectedProfile;
        console.log(`📋 Profil sélectionné: ${profileName}`);
        
        try {
            const config = await this.getSelectedProfileOcrConfig();
            console.log('✅ Configuration récupérée:', config);
            
            // Déterminer le mode automatique
            let autoMode = 'none';
            if (config.ocrMode && config.patchEnabled) {
                autoMode = 'both';
            } else if (config.ocrMode) {
                autoMode = 'ocr';
            } else if (config.patchEnabled) {
                autoMode = 'patch';
            }
            
            console.log('🎯 Mode automatique déterminé:', autoMode);
            
            if (autoMode !== 'none') {
                console.log('🔧 Test création FormData unifié...');
                const formData = this.createUnifiedFormDataFromConfig(config, autoMode);
                console.log('✅ FormData unifié créé');
            }
            
        } catch (error) {
            console.error('❌ Erreur:', error);
        }
        
        console.log('====================================');
    }

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
            canExecuteDirectUnified: !!window.profileManager?.selectedProfile && this.hasImportedFile(),
            cachedOcrMode: this.cachedProfileConfig?.config?.ocrMode || null,
            cachedPatchEnabled: this.cachedProfileConfig?.config?.patchEnabled || null,
            cachedPatchMode: this.cachedProfileConfig?.config?.patchMode || null
        };
    }
}
