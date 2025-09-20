// main.js - Fichier principal avec serveur Express intégré et support Patch OCR

// =================== CONFIGURATION GLOBALE ===================
const CONFIG = {
    API_BASE: "/profiles", // Changé pour utiliser les routes relatives
    OCR_ENDPOINT: "/api/profile/ocr", // Nouvel endpoint OCR
    SCANNERS_ENDPOINT: "/scanners",
    FILES_ENDPOINT: "/files",

     // Ajouter les endpoints manquants
    PROFILE_CREATE_ENDPOINT: "/api/profiles", // Nouvel endpoint pour créer
    PROFILE_UPDATE_ENDPOINT: "/profiles",     // Endpoint existant pour modifier
    
    
    // Configuration des options de champs (ajoutée depuis profile-manager.js)
    fieldOptions: {
        BitDepth: ["C24Bit", "C8Bit"],
        PaperSource: ["Glass", "Feeder"],
        Resolution: ["Dpi50", "Dpi100", "Dpi150", "Dpi200", "Dpi300", "Dpi400", "Dpi600"],
        PageSize: ["Letter", "A4", "Legal", "Custom"],
        PageAlign: ["Left", "Center", "Right"],
        DriverName: ["twain", "wia"],
        TwainImpl: ["Default", "OldDsm", "Legacy"],
        WiaVersion: ["Default", "1.0", "2.0"],
        AfterScanScale: ["OneToOne", "FitToPage", "Custom"]
    },
    
    // Champs à préserver
    preserveNullFields: [
        'IconUri', 'ConnectionUri', 'Caps', 'CustomPageSizeName', 
        'CustomPageSize', 'AutoSaveSettings', 'KeyValueOptions'
    ]
};

// =================== CLASSES UTILITAIRES ===================
class Utils {
    static extractValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (Array.isArray(value)) {
            if (value.length === 1 && typeof value[0] === "object" && value[0].$ && value[0].$.hasOwnProperty("xsi:nil")) return false;
            if (value.length === 1 && typeof value[0] === "object") return value[0];
            return value.join(", ");
        }
        
        if (value && typeof value === "object" && value.$ && value.$.hasOwnProperty("xsi:nil")) return false;
        if (typeof value === "object" && value !== null) return value;
        
        return value;
    }

    static setNestedValue(obj, keys, value) {
        keys.reduce((curr, key, i) => {
            if (i === keys.length - 1) curr[key] = value;
            else curr[key] = curr[key] || {};
            return curr[key];
        }, obj);
    }

    static processValue(value) {
        if (value === 'true' || value === 'false') return value === 'true';
        if (value === 'on') return 'true';
        if (!isNaN(value) && value !== '') return Number(value);
        return value;
    }

    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
            padding: 12px 24px; border-radius: 6px; color: white; font-weight: 500; 
            z-index: 1001; opacity: 0; transition: opacity 0.3s ease;
        `;
        
        const colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
        notification.style.background = colors[type] || colors.info;
        if (type === 'warning') notification.style.color = '#000';
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.opacity = '1', 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.parentNode?.removeChild(notification), 300);
        }, 3000);
    }
}

class ApiService {
    static async call(endpoint, method = 'GET', data = null) {
        try {
            const options = { 
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(endpoint, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Erreur API ${response.status}:`, errorText);
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
                } catch (parseError) {
                    throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                }
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erreur API:', error);
            throw error;
        }
    }

    // MÉTHODES CORRIGÉES pour les profils
    static async getProfiles() { 
        return this.call(CONFIG.API_BASE); 
    }
    
    static async getProfile(name) { 
        return this.call(`${CONFIG.API_BASE}/${encodeURIComponent(name)}`); 
    }
    
    // ✅ CORRECTION PRINCIPALE: Utiliser l'endpoint correct pour la création
    static async createProfile(data) { 
        // Essayer d'abord l'endpoint standard, puis l'endpoint alternatif
        try {
            return await this.call(CONFIG.API_BASE, 'POST', data);
        } catch (error) {
            if (error.message.includes('404')) {
                console.warn('Endpoint /profiles non trouvé, tentative avec /api/profiles');
                return await this.call(CONFIG.PROFILE_CREATE_ENDPOINT, 'POST', data);
            }
            throw error;
        }
    }
    
    static async updateProfile(name, data) { 
        return this.call(`${CONFIG.PROFILE_UPDATE_ENDPOINT}/${encodeURIComponent(name)}`, 'PUT', data); 
    }
    
    static async deleteProfile(name) { 
        return this.call(`${CONFIG.API_BASE}/${encodeURIComponent(name)}`, 'DELETE'); 
    }

    // Méthodes OCR
    static async saveOcrConfig(config) {
        return this.call(CONFIG.OCR_ENDPOINT, 'POST', config);
    }

    static async getOcrConfig(profileName) {
        return this.call(`${CONFIG.OCR_ENDPOINT}/${encodeURIComponent(profileName)}`);
    }

    static async deleteOcrConfig(profileName) {
        return this.call(`${CONFIG.OCR_ENDPOINT}/${encodeURIComponent(profileName)}`, 'DELETE');
    }

    static async getScanners() {
        return this.call(CONFIG.SCANNERS_ENDPOINT);
    }
}

class PopupManager {
    constructor() {
        this.activePopups = new Set();
    }

    show(popupId, resetTabs = false) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'flex';
            this.activePopups.add(popupId);
            if (resetTabs) this.resetTabs(popupId);
        }
    }

    hide(popupId, resetForm = false) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'none';
            this.activePopups.delete(popupId);
            if (resetForm) {
                this.resetTabs(popupId);
                const formId = popupId.replace('Popup', 'Form');
                const form = document.getElementById(formId);
                if (form) form.reset();
            }
        }
    }

    resetTabs(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            const firstTab = popup.querySelector('.tab-btn');
            const firstPane = popup.querySelector('.tab-pane');
            
            popup.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            popup.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            if (firstTab) firstTab.classList.add('active');
            if (firstPane) firstPane.classList.add('active');
        }
    }

    switchTab(evt, tabName) {
        const tabContainer = evt.currentTarget.closest('.tab-container');
        
        tabContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(tabName).classList.add('active');
        evt.currentTarget.classList.add('active');
    }
}

class FormManager {
    static createField(container, key, value, options = null) {
        const div = document.createElement("div");
        div.className = "form-group";
        const displayValue = Utils.extractValue(value);
        const fieldName = key.split('.').pop();
        const fieldId = key.replace(/\./g, '_');

        if (displayValue === "true" || displayValue === "false" || displayValue === false || displayValue === true) {
            const checked = (displayValue === "true" || displayValue === true) ? "checked" : "";
            div.innerHTML = `<div class="checkbox-item">
                <input type="checkbox" id="${fieldId}" name="${key}" ${checked}>
                <label for="${fieldId}">${fieldName}</label>
            </div>`;
        } else if (options || CONFIG.fieldOptions[fieldName]) {
            const fieldOptions = options || CONFIG.fieldOptions[fieldName];
            const optionsHtml = fieldOptions.map(opt => 
                `<option value="${opt}" ${displayValue === opt ? "selected" : ""}>${opt}</option>`
            ).join("");
            div.innerHTML = `<label for="${fieldId}">${fieldName}</label>
                <select id="${fieldId}" name="${key}">${optionsHtml}</select>`;
        } else if (typeof displayValue === "object") {
            return;
        } else {
            const inputType = ["Brightness", "Contrast", "Quality", "RotateDegrees", "BlankPageWhiteThreshold", "BlankPageCoverageThreshold"].includes(fieldName) ? "number" : "text";
            div.innerHTML = `<label for="${fieldId}">${fieldName}</label>
                <input type="${inputType}" id="${fieldId}" name="${key}" value="${displayValue || ""}">`;
        }

        container.appendChild(div);
    }

    static collectFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Formulaire ${formId} non trouvé`);
            return {};
        }
        
        const formData = new FormData(form);
        const profileData = {};
        
        for (let [key, value] of formData.entries()) {
            if (CONFIG.preserveNullFields.some(field => key.includes(field))) continue;
            Utils.setNestedValue(profileData, key.split('.'), Utils.processValue(value));
        }
        
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!CONFIG.preserveNullFields.some(field => checkbox.name.includes(field)) && !formData.has(checkbox.name)) {
                Utils.setNestedValue(profileData, checkbox.name.split('.'), 'false');
            }
        });
        
        return profileData;
    }
}

// =================== GESTION OCR AVEC SUPPORT PATCH ===================


class OcrConfigManager {
    static async saveConfig(profileName, ocrData) {
        try {
            // Gérer les deux formats possibles : objet direct ou données séparées
            let config;
            
            if (ocrData.profileName) {
                // Format déjà préparé par ProfileManager
                config = ocrData;
            } else {
                // Format des données brutes du formulaire - les convertir
                config = {
                    profileName: profileName,
                    ocrMode: ocrData.OcrMode === true || ocrData.OcrMode === 'true' || false,
                    lang: ocrData.OcrLang || 'fra',
                    namingPattern: ocrData.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                    pdfMode: ocrData.OcrPdfMode || 'pdfa',
                    patchEnabled: ocrData.OcrPatchMode === true || ocrData.OcrPatchMode === 'true' || false,
                    patchNaming: ocrData.OcrPatchNaming || 'barcode_ocr_generic'
                };
                
                // ✅ CORRECTION PRINCIPALE : Mapper PatchMode vers patchType (nom attendu par le serveur)
                if (ocrData.PatchMode) {
                    // Validation des valeurs autorisées
                    const validPatchTypes = ['T_classique', 'T_with_bookmarks'];
                    const patchType = ocrData.PatchMode;
                    
                    if (validPatchTypes.includes(patchType)) {
                        config.patchType = patchType;  // ✅ Utiliser patchType au lieu de patchMode
                    } else {
                        console.warn(`PatchMode invalide: "${patchType}", utilisation de T_classique par défaut`);
                        config.patchType = 'T_classique';
                    }
                } else {
                    config.patchType = 'T_classique'; // Valeur par défaut
                }
            }

            console.log('=== DEBUG OcrConfigManager.saveConfig ===');
            console.log('profileName:', profileName);
            console.log('ocrData reçu:', ocrData);
            console.log('config à envoyer:', config);
            console.log('=========================================');

            const response = await ApiService.saveOcrConfig(config);
            console.log('Configuration OCR sauvegardée:', response);
            return response;
        } catch (error) {
            console.error('Erreur sauvegarde OCR:', error);
            throw error;
        }
    }

    static async loadConfig(profileName) {
        try {
            const config = await ApiService.getOcrConfig(profileName);
            return {
                OcrMode: config.ocrMode,
                OcrLang: config.lang,
                OcrNamingPattern: config.namingPattern,
                OcrPdfMode: config.pdfMode,
                OcrPatchMode: config.patchEnabled,  // ✅ Mapper patchEnabled vers OcrPatchMode
                OcrPatchNaming: config.patchNaming,
                PatchMode: config.patchType || config.patchMode  // ✅ Mapper patchType/patchMode vers PatchMode
            };
        } catch (error) {
            console.warn('Aucune configuration OCR trouvée pour', profileName);
            return {};
        }
    }

    static async deleteConfig(profileName) {
        try {
            return await ApiService.deleteOcrConfig(profileName);
        } catch (error) {
            console.warn('Erreur suppression config OCR:', error);
            return { success: false };
        }
    }

    static async getPatchStrategies() {
        try {
            const response = await fetch('/api/profile/ocr/patch/strategies');
            if (response.ok) {
                const data = await response.json();
                return data.strategies;
            } else {
                return this.getDefaultPatchStrategies();
            }
        } catch (error) {
            console.warn('Erreur chargement stratégies Patch, utilisation des valeurs par défaut:', error);
            return this.getDefaultPatchStrategies();
        }
    }

    static getDefaultPatchStrategies() {
        return [
            {
                value: 'barcode_ocr_generic',
                label: '🎯 Code-barres → OCR → Générique (Recommandé)',
                description: 'Le système essaiera d\'abord les codes-barres, puis l\'OCR, puis un nom générique'
            },
            {
                value: 'barcode',
                label: '📊 Code-barres uniquement',
                description: 'Utilise uniquement les codes-barres pour nommer les fichiers'
            },
            {
                value: 'ocr',
                label: '🔤 OCR de texte uniquement',
                description: 'Utilise uniquement la reconnaissance de texte pour nommer les fichiers'
            },
            {
                value: 'generic',
                label: '📝 Nommage générique simple',
                description: 'Utilise un schéma de nommage générique basé sur la date/heure'
            }
        ];
    }

    static validateOcrConfig(config) {
        const errors = [];
        const warnings = [];

        if (config.OcrLang && !['', 'fra', 'eng', 'ara'].includes(config.OcrLang)) {
            warnings.push(`Langue OCR "${config.OcrLang}" non standard`);
        }

        if (config.OcrPdfMode && !['pdf', 'pdfa'].includes(config.OcrPdfMode)) {
            errors.push(`Mode PDF "${config.OcrPdfMode}" invalide`);
        }

        if (config.OcrPatchNaming && !this.isValidPatchStrategy(config.OcrPatchNaming)) {
            errors.push(`Stratégie Patch "${config.OcrPatchNaming}" invalide`);
        }

        // ✅ Validation du champ PatchMode (qui devient patchType côté serveur)
        if (config.PatchMode && !['T_classique', 'T_with_bookmarks'].includes(config.PatchMode)) {
            errors.push(`Mode de traitement Patch "${config.PatchMode}" invalide. Valeurs autorisées: T_classique, T_with_bookmarks`);
        }

        if (config.OcrPatchMode === true && !config.OcrPatchNaming) {
            warnings.push('Mode Patch activé mais aucune stratégie de nommage définie');
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    static isValidPatchStrategy(strategy) {
        const validStrategies = ['barcode_ocr_generic', 'barcode', 'ocr', 'generic'];
        return validStrategies.includes(strategy);
    }

    static createDefaultConfig(profileName) {
        return {
            profileName: profileName,
            ocrMode: false,
            lang: 'fra',
            namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: 'pdfa',
            patchEnabled: false,
            patchNaming: 'barcode_ocr_generic',
            patchType: 'T_classique'  // ✅ Utiliser patchType au lieu de patchMode
        };
    }

    static migrateConfig(oldConfig) {
        const migratedConfig = { ...oldConfig };
        
        if (!migratedConfig.hasOwnProperty('patchEnabled')) {
            migratedConfig.patchEnabled = false;
        }
        
        if (!migratedConfig.hasOwnProperty('patchNaming')) {
            migratedConfig.patchNaming = 'barcode_ocr_generic';
        }
        
        // ✅ Migration du champ patchType (au lieu de patchMode)
        if (!migratedConfig.hasOwnProperty('patchType')) {
            migratedConfig.patchType = 'T_classique';
        }
        
        return migratedConfig;
    }
}
// =================== APPLICATION PRINCIPALE AVEC SUPPORT PATCH ===================
class ScannerProfileApp {
    constructor() {
        this.profileManager = null;
        this.ocrManager = null;
        this.popupManager = new PopupManager();
        this.ocrConfigManager = OcrConfigManager;
        this.patchStrategiesCache = null; // Cache pour les stratégies Patch
    }

    async init() {
        try {
            // Attendre que les composants soient chargés
            await this.waitForComponents();
            
            // Initialiser les gestionnaires
            this.profileManager = new ProfileManager();
            
            // Vérifier si OCRManager existe (optionnel)
            if (typeof OCRManager !== 'undefined') {
                this.ocrManager = new OCRManager();
                this.ocrManager.popupManager = this.popupManager;
                window.ocrManager = this.ocrManager;
                this.ocrManager.exposeGlobalFunctions();
            }
            
            // Lier les composants
            this.profileManager.popupManager = this.popupManager;
            this.profileManager.apiService = ApiService;
            
            // Ajouter la gestion OCR intégrée au ProfileManager
            this.profileManager.ocrConfigManager = this.ocrConfigManager;
            
            // ✅ Précharger les stratégies Patch
            await this.loadPatchStrategies();
            
            // Exposer globalement
            window.profileManager = this.profileManager;
            window.popupManager = this.popupManager;
            window.ocrConfigManager = this.ocrConfigManager;
            
            // Initialiser les composants
            await this.profileManager.init();
            
            // Configurer les fonctions globales pour le HTML
            this.setupGlobalFunctions();
            
            // Améliorer l'accessibilité
            this.enhanceAccessibility();
            
            console.log('Application Scanner Profile Manager initialisée avec succès');
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            Utils.showNotification('Erreur lors de l\'initialisation de l\'application: ' + error.message, 'error');
        }
    }

    // ✅ Nouvelle méthode pour précharger les stratégies Patch
    async loadPatchStrategies() {
        try {
            this.patchStrategiesCache = await this.ocrConfigManager.getPatchStrategies();
        } catch (error) {
            console.warn('Erreur chargement stratégies Patch:', error);
            this.patchStrategiesCache = this.ocrConfigManager.getDefaultPatchStrategies();
        }
    }

    // ✅ Méthode pour obtenir les stratégies Patch en cache
    getPatchStrategies() {
        return this.patchStrategiesCache || this.ocrConfigManager.getDefaultPatchStrategies();
    }

    async waitForComponents() {
        // Attendre que ProfileManager soit défini
        return new Promise((resolve) => {
            if (typeof ProfileManager !== 'undefined') {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (typeof ProfileManager !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    async checkServerConnection() {
        try {
            const response = await fetch('/api/health');
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    setupGlobalFunctions() {
        // Fonctions globales pour l'interface
        window.showPopup = (popupId) => this.popupManager.show(popupId, true);
        window.hidePopup = (popupId) => this.popupManager.hide(popupId, true);
        window.switchTab = (evt, tabName) => this.popupManager.switchTab(evt, tabName);
        
        // Fonctions spécifiques pour les popups
        window.closeAddPopup = () => this.popupManager.hide('addPopup', true);
        window.closeEditPopup = () => this.popupManager.hide('editPopup', true);
        window.closeViewPopup = () => this.popupManager.hide('viewPopup', true);
        
        // Fonctions pour les profils
        window.openAddProfile = () => {
            this.popupManager.show('addPopup', true);
            if (this.profileManager) {
                this.profileManager.prepareAddForm();
            }
        };
        
        window.openEditProfile = (profileName) => {
            if (this.profileManager) {
                this.profileManager.editProfile(profileName);
            }
        };
        
        window.openViewProfile = (profileName) => {
            if (this.profileManager) {
                this.profileManager.viewProfile(profileName);
            }
        };
        
        window.deleteProfile = (profileName) => {
            if (this.profileManager) {
                this.profileManager.deleteProfile(profileName);
            }
        };
        
        window.saveProfile = (formId, isEdit = false) => {
            if (this.profileManager) {
                if (isEdit) {
                    this.profileManager.saveEditedProfile(formId);
                } else {
                    this.profileManager.saveNewProfile(formId);
                }
            }
        };
        
        // Fonctions de debug
        window.getDebugInfo = () => this.getDebugInfo();
        window.testApp = () => this.testApp();
        
        // Fonction de rechargement des profils
        window.refreshProfiles = () => {
            if (this.profileManager) {
                this.profileManager.loadProfiles();
            }
        };
    }

    enhanceAccessibility() {
        // Ajouter la navigation au clavier pour les popups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.popupManager.activePopups.size > 0) {
                const lastPopup = Array.from(this.popupManager.activePopups).pop();
                this.popupManager.hide(lastPopup, true);
            }
        });
    }

    // ✅ Modifier la méthode getDebugInfo pour inclure les informations Patch
    getDebugInfo() {
        return {
            profileManager: !!this.profileManager,
            ocrManager: !!this.ocrManager,
            ocrConfigManager: !!this.ocrConfigManager,
            selectedProfile: this.profileManager?.selectedProfile || null,
            hasImportedFile: this.ocrManager?.hasImportedFile() || false,
            activePopups: Array.from(this.popupManager?.activePopups || []),
            patchStrategiesLoaded: !!this.patchStrategiesCache,
            patchStrategiesCount: this.patchStrategiesCache?.length || 0,
            apiEndpoints: {
                profiles: CONFIG.API_BASE,
                ocr: CONFIG.OCR_ENDPOINT,
                scanners: CONFIG.SCANNERS_ENDPOINT,
                patchStrategies: '/api/profile/ocr/patch/strategies'
            },
            loadedClasses: {
                ProfileManager: typeof ProfileManager !== 'undefined',
                OCRManager: typeof OCRManager !== 'undefined',
                Utils: typeof Utils !== 'undefined',
                FormManager: typeof FormManager !== 'undefined'
            }
        };
    }

    // ✅ Nouvelle méthode pour tester la configuration OCR avec Patch
    async testOcrPatchConfig(profileName) {
        try {
            console.log('=== TEST CONFIGURATION OCR PATCH ===');
            
            // Charger la configuration
            const config = await this.ocrConfigManager.loadConfig(profileName);
            console.log('Configuration chargée:', config);
            
            // Valider la configuration
            const validation = this.ocrConfigManager.validateOcrConfig(config);
            console.log('Résultat validation:', validation);
            
            // Tester les stratégies Patch
            const strategies = this.getPatchStrategies();
            console.log('Stratégies Patch disponibles:', strategies);
            
            // Vérifier si la stratégie configurée est valide
            if (config.OcrPatchNaming) {
                const isValid = this.ocrConfigManager.isValidPatchStrategy(config.OcrPatchNaming);
                console.log(`Stratégie "${config.OcrPatchNaming}" valide:`, isValid);
            }
            
            console.log('=====================================');
            
            return {
                config: config,
                validation: validation,
                strategies: strategies
            };
            
        } catch (error) {
            console.error('Erreur test configuration OCR Patch:', error);
            return null;
        }
    }

    async testApp() {
        console.log('=== TEST APPLICATION ===');
        const debug = this.getDebugInfo();
        console.log('Informations de debug:', debug);
        
        if (this.profileManager?.selectedProfile) {
            await this.testOcrPatchConfig(this.profileManager.selectedProfile);
        }
        
        console.log('=======================');
        return debug;
    }
}

// =================== UTILITAIRES PATCH GLOBAUX ===================
window.PatchUtils = {
    // Méthode pour obtenir la description d'une stratégie
    getStrategyDescription: function(strategyValue) {
        const app = window.app;
        if (app && app.patchStrategiesCache) {
            const strategy = app.patchStrategiesCache.find(s => s.value === strategyValue);
            return strategy ? strategy.description : 'Description non disponible';
        }
        return 'Description non disponible';
    },
    
    // Méthode pour vérifier si le mode Patch est recommandé
    isPatchModeRecommended: function(ocrMode) {
        // Recommander le mode Patch si OCR est activé et qu'on traite des documents multiples
        return ocrMode === true || ocrMode === 'true';
    },
    
    // Méthode pour obtenir la stratégie recommandée
    getRecommendedStrategy: function() {
        return 'barcode_ocr_generic';
    },
    
    // Méthode pour formater l'affichage d'une stratégie
    formatStrategyLabel: function(value, label) {
        const isRecommended = value === this.getRecommendedStrategy();
        return isRecommended ? `${label} ⭐` : label;
    }
};

// =================== FONCTIONS GLOBALES DE DEBUG ===================
// ✅ Fonction globale pour déboguer les configurations Patch
window.debugPatchConfig = function(profileName) {
    const app = window.app;
    if (!app || !app.ocrConfigManager) {
        console.error('Application non initialisée');
        return;
    }
    
    return app.testOcrPatchConfig(profileName || app.profileManager?.selectedProfile);
};

// ✅ Fonction globale pour tester la validation des champs Patch
window.testPatchValidation = function(config) {
    const app = window.app;
    if (!app || !app.ocrConfigManager) {
        console.error('Application non initialisée');
        return;
    }
    
    console.log('=== TEST VALIDATION PATCH ===');
    const validation = app.ocrConfigManager.validateOcrConfig(config || {
        OcrMode: true,
        OcrLang: 'fra',
        OcrPatchMode: true,
        OcrPatchNaming: 'barcode_ocr_generic'
    });
    
    console.log('Résultat validation:', validation);
    console.log('=============================');
    
    return validation;
};

// =================== INITIALISATION ===================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM chargé, initialisation de l\'application...');
    
    // Créer et initialiser l'application
    const app = new ScannerProfileApp();
    window.app = app;
    
    try {
        // Vérifier la connexion serveur
        const serverConnected = await app.checkServerConnection();
        if (!serverConnected) {
            
        }
        
        await app.init();
        Utils.showNotification('Application chargée avec succès', 'success');
    } catch (error) {
        console.error('Erreur fatale:', error);
        Utils.showNotification('Erreur fatale lors du chargement: ' + error.message, 'error');
    }
});

// Gestionnaire d'erreurs global
window.addEventListener('error', (e) => {
    console.error('Erreur JavaScript:', e.error);
    Utils.showNotification('Une erreur est survenue: ' + e.error.message, 'error');
});

// Gestionnaire pour les promesses rejetées
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
    Utils.showNotification('Erreur de communication avec le serveur: ' + e.reason, 'error');
});

// =================== EXPORTS GLOBAUX ===================
// Export global pour faciliter l'accès
window.Utils = Utils;
window.ApiService = ApiService;
window.PopupManager = PopupManager;
window.FormManager = FormManager;
window.OcrConfigManager = OcrConfigManager;
window.CONFIG = CONFIG;