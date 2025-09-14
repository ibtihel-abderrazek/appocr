// profile-integration.js - Script d'intégration des profils avec OCR
class ProfileIntegration {
    constructor() {
        this.selectedProfile = null;
        this.profileData = null;
        this.init();
    }

    init() {
        this.setupProfileSelection();
        this.setupDebugLogging();
    }

    setupProfileSelection() {
        // Observer les changements de sélection de profil
        document.addEventListener('click', (e) => {
            // Vérifier si c'est un élément de profil qui a été cliqué
            if (e.target.closest('.scanner-card')) {
                const profileCard = e.target.closest('.scanner-card');
                const profileName = this.extractProfileName(profileCard);
                
                if (profileName) {
                    this.onProfileSelected(profileName);
                }
            }
        });

        // Observer les changements via le ProfileManager si disponible
        if (window.profileManager) {
            const originalSelectProfile = window.profileManager.selectProfile;
            window.profileManager.selectProfile = (profileName) => {
                // Appeler la méthode originale
                if (originalSelectProfile) {
                    originalSelectProfile.call(window.profileManager, profileName);
                }
                // Déclencher notre logique
                this.onProfileSelected(profileName);
            };
        }
    }

    extractProfileName(profileCard) {
        // Chercher le nom du profil dans différents éléments possibles
        const nameElement = profileCard.querySelector('.scanner-name, .profile-name, h3, h4');
        if (nameElement) {
            return nameElement.textContent.trim();
        }
        
        // Fallback: chercher dans les attributs data
        return profileCard.dataset.profileName || profileCard.dataset.name;
    }

    async onProfileSelected(profileName) {
        console.log(`=== PROFIL SÉLECTIONNÉ: ${profileName} ===`);
        
        this.selectedProfile = profileName;
        
        // Déclencher l'événement pour OCRManager
        const event = new CustomEvent('profileSelected', {
            detail: { profileName: profileName }
        });
        document.dispatchEvent(event);
        
        // Charger les paramètres du profil via l'API
        await this.loadProfileFromAPI(profileName);
        
        // Mettre à jour l'interface
        this.updateUI(profileName);
    }

    async loadProfileFromAPI(profileName) {
        const apiUrl = `/api/profile/ocr/${encodeURIComponent(profileName)}`;
        console.log(`Appel API: ${apiUrl}`);
        
        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                console.error(`Erreur API: ${response.status} ${response.statusText}`);
                
                // Essayer de lire le contenu de l'erreur
                try {
                    const errorData = await response.text();
                    console.error('Détails de l\'erreur:', errorData);
                } catch (e) {
                    console.error('Impossible de lire les détails de l\'erreur');
                }
                
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }
            
            const profileData = await response.json();
            console.log('✅ Données du profil récupérées:', profileData);
            
            this.profileData = profileData;
            
            // Valider la structure des données
            if (!this.validateProfileData(profileData)) {
                console.warn('⚠️ Structure de données du profil invalide:', profileData);
            }
            
            return profileData;
            
        } catch (error) {
            console.error('❌ Erreur lors de la récupération du profil:', error);
            
            // Utiliser des données par défaut en cas d'erreur
            this.profileData = this.getDefaultProfileData(profileName);
            console.log('📝 Utilisation des paramètres par défaut:', this.profileData);
            
            return this.profileData;
        }
    }

    validateProfileData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Vérifier la présence des sections principales
        const hasOcrSettings = data.ocrSettings && typeof data.ocrSettings === 'object';
        const hasPatchSettings = data.patchSettings && typeof data.patchSettings === 'object';
        
        if (!hasOcrSettings && !hasPatchSettings) {
            console.warn('Aucune configuration OCR ou Patch trouvée');
            return false;
        }
        
        // Afficher la structure trouvée
        console.log('📋 Structure du profil validée:', {
            name: data.name,
            hasOcrSettings,
            hasPatchSettings,
            ocrKeys: hasOcrSettings ? Object.keys(data.ocrSettings) : [],
            patchKeys: hasPatchSettings ? Object.keys(data.patchSettings) : []
        });
        
        return true;
    }

    getDefaultProfileData(profileName) {
        return {
            name: profileName,
            ocrSettings: {
                language: 'fra',
                namingPattern: '$(YYYY)$(MM)$(DD)',
                mode: 'pdfa'
            },
            patchSettings: {
                patchMode: 'T_classique',
                naming: 'barcode_ocr_generic',
                namingPattern: '$(YYYY)$(MM)$(DD)',
                ocrMode: 'true'
            }
        };
    }

    updateUI(profileName) {
        // Mettre à jour l'affichage du profil sélectionné
        const profileDisplay = document.getElementById('selectedProfile');
        if (profileDisplay) {
            profileDisplay.textContent = `Profil sélectionné: ${profileName}`;
        }
        
        // Activer/désactiver les boutons selon le contexte
        this.updateButtons();
        
        // Afficher une notification
        this.showProfileNotification(profileName);
    }

    updateButtons() {
        const btnScan = document.getElementById('btnScan');
        const btnOCR = document.getElementById('btnOCR');
        const btnPatch = document.getElementById('btnPatch');
        
        if (this.selectedProfile) {
            if (btnScan) {
                btnScan.disabled = false;
                btnScan.title = `Scanner avec le profil: ${this.selectedProfile}`;
            }
            
            // Les boutons OCR/Patch restent conditionnés par la présence d'un fichier
            const hasFile = window.ocrManager?.hasImportedFile();
            if (btnOCR && hasFile) {
                btnOCR.title = `OCR avec le profil: ${this.selectedProfile}`;
            }
            if (btnPatch && hasFile) {
                btnPatch.title = `Patch avec le profil: ${this.selectedProfile}`;
            }
        } else {
            if (btnScan) {
                btnScan.disabled = true;
                btnScan.title = 'Sélectionnez un profil avant de scanner';
            }
        }
    }

    showProfileNotification(profileName) {
        // Utiliser la méthode de notification d'OCRManager si disponible
        if (window.ocrManager && typeof window.ocrManager.showNotification === 'function') {
            window.ocrManager.showNotification(
                `Profil "${profileName}" sélectionné et paramètres chargés`, 
                'success'
            );
        } else {
            console.log(`✅ Profil "${profileName}" sélectionné`);
        }
    }

    // Méthodes publiques pour l'inspection et le debug
    getCurrentProfile() {
        return {
            name: this.selectedProfile,
            data: this.profileData
        };
    }

    getProfileSettings(type = 'all') {
        if (!this.profileData) return null;
        
        switch (type) {
            case 'ocr':
                return this.profileData.ocrSettings || null;
            case 'patch':
                return this.profileData.patchSettings || null;
            case 'all':
            default:
                return this.profileData;
        }
    }

    setupDebugLogging() {
        // Ajouter des logs pour le debugging
        window.debugProfile = () => {
            console.log('=== DEBUG PROFIL ===');
            console.log('Profil sélectionné:', this.selectedProfile);
            console.log('Données du profil:', this.profileData);
            console.log('OCR Manager disponible:', !!window.ocrManager);
            console.log('Profile Manager disponible:', !!window.profileManager);
            
            if (window.ocrManager) {
                console.log('Debug OCR Manager:', window.ocrManager.getDebugInfo());
            }
        };
        
        // Exposer l'instance pour inspection
        window.profileIntegration = this;
    }
}

// Initialisation automatique quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation de l\'intégration des profils');
    
    // Attendre que les autres composants soient chargés
    setTimeout(() => {
        window.profileIntegration = new ProfileIntegration();
        console.log('✅ Intégration des profils initialisée');
    }, 100);
});

// Export pour usage modulaire si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileIntegration;
}