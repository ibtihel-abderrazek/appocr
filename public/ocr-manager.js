// ocr-manager.js - Version complète et corrigée
class OCRManager {
    constructor() {
        this.importedFile = null;
        this.importedFiles = [];
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

    // =================== GESTION DES PARAMÈTRES PROFIL ===================
    async loadProfileOCRSettings() {
        try {
            // Vérifier si ProfileManager existe et a un profil sélectionné
            if (window.profileManager && window.profileManager.selectedProfile) {
                const profileName = window.profileManager.selectedProfile;
                const profileSettings = await this.getProfileSettings(profileName);
                
                if (profileSettings) {
                    // Appliquer les paramètres OCR du profil
                    this.applyOCRSettings(profileSettings.ocrSettings || {});
                    // Appliquer les paramètres Patch du profil
                    this.applyPatchSettings(profileSettings.patchSettings || {});
                    
                    console.log(`Paramètres du profil "${profileName}" chargés`);
                    return profileSettings;
                }
            }
            
            // Si aucun profil sélectionné ou pas de ProfileManager, charger les paramètres par défaut
            const defaultSettings = this.getDefaultProfileSettings();
            this.applyOCRSettings(defaultSettings.ocrSettings);
            this.applyPatchSettings(defaultSettings.patchSettings);
            
            return defaultSettings;
            
        } catch (error) {
            console.error('Erreur lors du chargement des paramètres du profil:', error);
            
            // En cas d'erreur, utiliser les paramètres par défaut
            const defaultSettings = this.getDefaultProfileSettings();
            this.applyOCRSettings(defaultSettings.ocrSettings);
            this.applyPatchSettings(defaultSettings.patchSettings);
            
            return defaultSettings;
        }
    }

    async getProfileSettings(profileName) {
        try {
            // Tenter de récupérer les paramètres depuis le serveur
            const response = await fetch(`http://localhost:3000/profiles/${profileName}`);
            if (response.ok) {
                const profileData = await response.json();
                return profileData;
            }
            
            // Si le serveur n'est pas disponible, tenter de récupérer depuis localStorage
            const savedProfiles = localStorage.getItem('ocrProfiles');
            if (savedProfiles) {
                const profiles = JSON.parse(savedProfiles);
                return profiles[profileName] || null;
            }
            
            return null;
            
        } catch (error) {
            console.error('Erreur lors de la récupération des paramètres du profil:', error);
            return null;
        }
    }

    getDefaultProfileSettings() {
        return {
            ocrSettings: {
                language: 'fra',
                confidence: '80',
                dpi: '300',
                preprocessImage: 'true',
                enhanceContrast: 'true',
                removeNoise: 'false',
                autoRotate: 'true'
            },
            patchSettings: {
                splitByBarcode: 'true',
                barcodePosition: 'top-right',
                namingPattern: 'barcode',
                outputFormat: 'pdf',
                includeOriginalPages: 'false'
            }
        };
    }

    // =================== TRAITEMENT OCR ===================
    setupOCRProcessing() {
        const btnOCR = document.getElementById("btnOCR");
        const ocrForm = document.getElementById("ocrForm");

        if (btnOCR) {
            btnOCR.addEventListener("click", () => this.openOCRDialog());
        }

        if (ocrForm) {
            ocrForm.addEventListener("submit", (e) => this.processOCR(e));
        }
    }

    async openOCRDialog() {
        if (!this.importedFile) {
            this.showNotification("Veuillez importer un fichier avant de lancer l'OCR.", 'warning');
            return;
        }
        
        const ocrPopup = document.getElementById("ocrPopup");
        if (ocrPopup) {
            ocrPopup.style.display = "flex";
            
            // Charger automatiquement les paramètres du profil sélectionné
            await this.loadProfileOCRSettings();
        }
    }

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
        const namingPattern = formData.get("namingPattern");
        if (namingPattern) {
            console.log("Pattern de nommage pour patch appliqué:", namingPattern);
        }
        
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
            this.showProcessingError("OCR", err.message);
        }
    }

    // =================== TRAITEMENT PATCH ===================
    setupPatchProcessing() {
        const btnPatch = document.getElementById("btnPatch");
        const patchForm = document.getElementById("patchForm");

        if (btnPatch) {
            btnPatch.addEventListener("click", () => this.openPatchDialog());
        }

        if (patchForm) {
            patchForm.addEventListener("submit", (e) => this.processPatch(e));
        }
    }

    async openPatchDialog() {
        if (!this.importedFile) {
            this.showNotification("Veuillez importer un fichier avant de traiter les patches.", 'warning');
            return;
        }
        
        const patchPopup = document.getElementById("patchPopup");
        if (patchPopup) {
            patchPopup.style.display = "flex";
            
            // Charger automatiquement les paramètres du profil sélectionné
            await this.loadProfileOCRSettings();
        }
    }

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
        const namingPattern = formData.get("namingPattern");
        if (namingPattern) {
            console.log("Pattern de nommage pour patch appliqué:", namingPattern);
        }
        
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
            this.showProcessingError("Patch", err.message);
        }
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

        // Gestion du toggle aperçu - Correction du sélecteur
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
        // Cette fonction sera appelée par ProfileManager
        // pour maintenir la séparation des responsabilités
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
                // Gérer la réponse JSON si nécessaire
                this.showNotification("Scan terminé avec succès !", 'success');
            } else {
                // Fichier unique en téléchargement direct
                await this.handleSingleFile(response);
                this.showNotification("Scan terminé et fichier disponible !", 'success');
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

    // =================== MÉTHODES SUPPLÉMENTAIRES ===================
    
    // Sauvegarder les paramètres actuels dans un profil
    async saveCurrentSettingsToProfile(profileName) {
        try {
            const ocrSettings = this.getCurrentOCRSettings();
            const patchSettings = this.getCurrentPatchSettings();
            
            const profileData = {
                name: profileName,
                ocrSettings: ocrSettings,
                patchSettings: patchSettings,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Tenter de sauvegarder sur le serveur
            try {
                const response = await fetch(`http://localhost:3000/profiles/${profileName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileData)
                });
                
                if (response.ok) {
                    this.showNotification(`Profil "${profileName}" sauvegardé sur le serveur`, 'success');
                    return true;
                }
            } catch (serverError) {
                console.log('Serveur non disponible, sauvegarde en local');
            }

            // Fallback vers localStorage
            const savedProfiles = JSON.parse(localStorage.getItem('ocrProfiles') || '{}');
            savedProfiles[profileName] = profileData;
            localStorage.setItem('ocrProfiles', JSON.stringify(savedProfiles));
            
            this.showNotification(`Profil "${profileName}" sauvegardé localement`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur lors de la sauvegarde du profil:', error);
            this.showNotification('Erreur lors de la sauvegarde du profil: ' + error.message, 'error');
            return false;
        }
    }

    getCurrentOCRSettings() {
        const form = document.getElementById("ocrForm");
        const settings = {};
        
        if (form) {
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
                settings[key] = value;
            }
        }
        
        return settings;
    }

    getCurrentPatchSettings() {
        const form = document.getElementById("patchForm");
        const settings = {};
        
        if (form) {
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
                settings[key] = value;
            }
        }
        
        return settings;
    }

    // Obtenir la liste des profils disponibles
    async getAvailableProfiles() {
        const profiles = [];

        // Tenter de récupérer depuis le serveur
        try {
            const response = await fetch('http://localhost:3000/profiles');
            if (response.ok) {
                const serverProfiles = await response.json();
                profiles.push(...serverProfiles);
            }
        } catch (error) {
            console.log('Serveur non disponible pour les profils');
        }

        // Récupérer depuis localStorage
        try {
            const localProfiles = JSON.parse(localStorage.getItem('ocrProfiles') || '{}');
            Object.keys(localProfiles).forEach(profileName => {
                if (!profiles.find(p => p.name === profileName)) {
                    profiles.push({
                        name: profileName,
                        source: 'local',
                        ...localProfiles[profileName]
                    });
                }
            });
        } catch (error) {
            console.error('Erreur lors de la lecture des profils locaux:', error);
        }

        return profiles;
    }

    // Valider les paramètres avant traitement
    validateSettings(settings) {
        const errors = [];

        // Validation des paramètres OCR
        if (settings.confidence && (settings.confidence < 0 || settings.confidence > 100)) {
            errors.push('La confiance OCR doit être entre 0 et 100');
        }

        if (settings.dpi && (settings.dpi < 72 || settings.dpi > 600)) {
            errors.push('La résolution DPI doit être entre 72 et 600');
        }

        // Validation des paramètres de patch
        if (settings.namingPattern && !['barcode', 'sequence', 'timestamp'].includes(settings.namingPattern)) {
            errors.push('Pattern de nommage invalide');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Réinitialiser tous les paramètres aux valeurs par défaut
    resetToDefaults() {
        const defaultSettings = this.getDefaultProfileSettings();
        this.applyOCRSettings(defaultSettings.ocrSettings);
        this.applyPatchSettings(defaultSettings.patchSettings);
        this.showNotification('Paramètres réinitialisés aux valeurs par défaut', 'info');
    }

    // Obtenir les statistiques d'utilisation
    getUsageStats() {
        const stats = JSON.parse(localStorage.getItem('ocrStats') || '{}');
        return {
            filesProcessed: stats.filesProcessed || 0,
            ocrOperations: stats.ocrOperations || 0,
            patchOperations: stats.patchOperations || 0,
            scanOperations: stats.scanOperations || 0,
            lastUsed: stats.lastUsed || null,
            totalProcessingTime: stats.totalProcessingTime || 0
        };
    }

    // Mettre à jour les statistiques
    updateStats(operation, processingTime = 0) {
        const stats = this.getUsageStats();
        
        stats[operation] = (stats[operation] || 0) + 1;
        stats.lastUsed = new Date().toISOString();
        stats.totalProcessingTime += processingTime;

        localStorage.setItem('ocrStats', JSON.stringify(stats));
    }

    // Vérifier la santé du système
    async checkSystemHealth() {
        const health = {
            server: false,
            scanner: false,
            localStorage: false,
            errors: []
        };

        // Vérifier le serveur
        try {
            const response = await fetch('http://localhost:3000/health', { method: 'GET' });
            health.server = response.ok;
        } catch (error) {
            health.errors.push('Serveur non accessible: ' + error.message);
        }

        // Vérifier localStorage
        try {
            localStorage.setItem('healthCheck', 'test');
            localStorage.removeItem('healthCheck');
            health.localStorage = true;
        } catch (error) {
            health.errors.push('LocalStorage non accessible: ' + error.message);
        }

        // Vérifier le scanner (si disponible)
        try {
            const scanResponse = await fetch('http://localhost:3000/scanner/status');
            health.scanner = scanResponse.ok;
        } catch (error) {
            health.errors.push('Scanner non disponible: ' + error.message);
        }

        return health;
    }

    // Nettoyer les données obsolètes
    cleanupOldData() {
        try {
            // Nettoyer les statistiques anciennes (plus de 30 jours)
            const stats = this.getUsageStats();
            if (stats.lastUsed) {
                const lastUsedDate = new Date(stats.lastUsed);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                if (lastUsedDate < thirtyDaysAgo) {
                    localStorage.removeItem('ocrStats');
                    console.log('Statistiques anciennes nettoyées');
                }
            }

            // Nettoyer les URLs blob orphelines
            this.cleanup();
            
        } catch (error) {
            console.error('Erreur lors du nettoyage:', error);
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

    // =================== FONCTIONS UTILITAIRES ===================
    showNotification(message, type = 'info') {
        // Utiliser Utils.showNotification si disponible, sinon console.log
        if (window.Utils && typeof window.Utils.showNotification === 'function') {
            window.Utils.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
            alert(message); // Fallback basique
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
    }

    getImportedFile() {
        return this.importedFile;
    }

    hasImportedFile() {
        return this.importedFile !== null;
    }

    // =================== FONCTIONS D'EXPORT/IMPORT ===================
    exportOCRSettings() {
        const form = document.getElementById("ocrForm");
        if (!form) return;

        const formData = new FormData(form);
        const settings = {};
        
        for (let [key, value] of formData.entries()) {
            settings[key] = value;
        }

        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'ocr-settings.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Paramètres OCR exportés avec succès !', 'success');
    }

    exportPatchSettings() {
        const form = document.getElementById("patchForm");
        if (!form) return;

        const formData = new FormData(form);
        const settings = {};
        
        for (let [key, value] of formData.entries()) {
            settings[key] = value;
        }

        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'patch-settings.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Paramètres Patch exportés avec succès !', 'success');
    }

    importOCRSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    this.applyOCRSettings(settings);
                    this.showNotification('Paramètres OCR importés avec succès !', 'success');
                } catch (err) {
                    this.showNotification('Erreur lors de l\'import des paramètres : ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }

    importPatchSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    this.applyPatchSettings(settings);
                    this.showNotification('Paramètres Patch importés avec succès !', 'success');
                } catch (err) {
                    this.showNotification('Erreur lors de l\'import des paramètres : ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }

    applyOCRSettings(settings) {
        const form = document.getElementById("ocrForm");
        if (!form) return;

        Object.entries(settings).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value === 'true' || value === true;
                } else {
                    field.value = value;
                }
            }
        });
    }

    applyPatchSettings(settings) {
        const form = document.getElementById("patchForm");
        if (!form) return;

        Object.entries(settings).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value === 'true' || value === true;
                } else {
                    field.value = value;
                }
            }
        });
    }

    // =================== FONCTIONS DE NETTOYAGE ===================
    cleanup() {
        // Nettoyer les URLs d'objets créées
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.src.startsWith('blob:')) {
                URL.revokeObjectURL(iframe.src);
            }
        });

        // Nettoyer les liens de téléchargement
        const links = document.querySelectorAll('a[href^="blob:"]');
        links.forEach(link => {
            URL.revokeObjectURL(link.href);
        });
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
            stats: this.getUsageStats(),
            timestamp: new Date().toISOString()
        };
    }

    logDebugInfo() {
        console.log('OCRManager Debug Info:', this.getDebugInfo());
    }

    async generateDiagnosticReport() {
        const report = {
            timestamp: new Date().toISOString(),
            debugInfo: this.getDebugInfo(),
            systemHealth: await this.checkSystemHealth(),
            profiles: await this.getAvailableProfiles(),
            browserInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            }
        };

        // Créer un fichier de diagnostic
        const reportStr = JSON.stringify(report, null, 2);
        const blob = new Blob([reportStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `ocr-diagnostic-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return report;
    }
}