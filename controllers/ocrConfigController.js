// controllers/ocrConfigController.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');

class OcrConfigController {
    constructor() {
        this.configDirectory = process.env.OCR_CONFIG_DIR || 'OcrProfiles';
        this.ensureDirectoryExists();
    }

    async ensureDirectoryExists() {
        try {
            await fs.access(this.configDirectory);
        } catch (error) {
            await fs.mkdir(this.configDirectory, { recursive: true });
            console.log(`Répertoire OCR créé: ${this.configDirectory}`);
        }
    }

    getConfigFilePath(profileName) {
        // Nettoyer le nom du profil pour éviter les problèmes de système de fichiers
        const cleanName = profileName.replace(/[<>:"/\\|?*]/g, '_');
        return path.join(this.configDirectory, `${cleanName}.xml`);
    }

    createOcrConfigXml(config) {
    const now = new Date().toISOString();
    
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<OcrConfiguration version="1.0" created="${now}">
    <Profile name="${this.escapeXml(config.profileName)}">
        <Settings>
            <OcrMode>${config.ocrMode || false}</OcrMode>
            <Language>${this.escapeXml(config.lang || 'fra')}</Language>
            <NamingPattern>${this.escapeXml(config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)')}</NamingPattern>
            <PdfMode>${this.escapeXml(config.pdfMode || 'pdfa')}</PdfMode>
        </Settings>
        <PatchSettings>
            <PatchMode>${config.patchMode || false}</PatchMode>
            <PatchNaming>${this.escapeXml(config.patchNaming || 'barcode_ocr_generic')}</PatchNaming>
        </PatchSettings>
        <Advanced>
            <AutoDetectLanguage>${!config.lang || config.lang === ''}</AutoDetectLanguage>
            <EnablePreprocessing>true</EnablePreprocessing>
            <OutputQuality>high</OutputQuality>
        </Advanced>
    </Profile>
    <Metadata>
        <Created>${now}</Created>
        <LastModified>${now}</LastModified>
        <Application>ScannerProfileManager</Application>
        <Version>1.0</Version>
        <Generator>${require('os').hostname()}</Generator>
    </Metadata>
</OcrConfiguration>`;

    return xmlContent;
}

// ✅ Modifier la méthode parseOcrConfigXml pour lire les nouveaux champs
parseOcrConfigXml(xmlContent) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        const profile = xmlDoc.getElementsByTagName('Profile')[0];
        const settings = profile.getElementsByTagName('Settings')[0];
        const patchSettings = profile.getElementsByTagName('PatchSettings')[0];
        const metadata = xmlDoc.getElementsByTagName('Metadata')[0];

        const result = {
            profileName: profile.getAttribute('name'),
            ocrMode: settings.getElementsByTagName('OcrMode')[0].textContent === 'true',
            lang: settings.getElementsByTagName('Language')[0].textContent,
            namingPattern: settings.getElementsByTagName('NamingPattern')[0].textContent,
            pdfMode: settings.getElementsByTagName('PdfMode')[0].textContent,
            lastModified: metadata.getElementsByTagName('LastModified')[0].textContent
        };

        // ✅ Ajouter les champs Patch s'ils existent
        if (patchSettings) {
            const patchModeElement = patchSettings.getElementsByTagName('PatchMode')[0];
            const patchNamingElement = patchSettings.getElementsByTagName('PatchNaming')[0];
            
            result.patchMode = patchModeElement ? patchModeElement.textContent === 'true' : false;
            result.patchNaming = patchNamingElement ? patchNamingElement.textContent : 'barcode_ocr_generic';
        } else {
            // Valeurs par défaut si la section n'existe pas (rétrocompatibilité)
            result.patchMode = false;
            result.patchNaming = 'barcode_ocr_generic';
        }

        return result;
    } catch (error) {
        throw new Error('Format XML invalide: ' + error.message);
    }
}

    escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    // Route POST - Sauvegarder la configuration OCR
    async saveOcrConfig(req, res) {
    try {
        const config = req.body;
        
        if (!config.profileName) {
            return res.status(400).json({ 
                error: 'Le nom du profil est obligatoire' 
            });
        }

        // ✅ Validation des nouveaux champs Patch
        if (config.patchNaming && !this.isValidPatchNaming(config.patchNaming)) {
            return res.status(400).json({
                error: 'Stratégie de nommage Patch invalide. Valeurs autorisées: barcode_ocr_generic, barcode, ocr, generic'
            });
        }

        // Valeurs par défaut pour les nouveaux champs
        const configWithDefaults = {
            ...config,
            patchMode: config.patchMode || false,
            patchNaming: config.patchNaming || 'barcode_ocr_generic'
        };

        const filePath = this.getConfigFilePath(config.profileName);
        const xmlContent = this.createOcrConfigXml(configWithDefaults);
        
        await fs.writeFile(filePath, xmlContent, 'utf8');
        
        console.log(`Configuration OCR sauvegardée pour le profil: ${config.profileName}`);
        console.log(`Patch Mode: ${configWithDefaults.patchMode}, Patch Naming: ${configWithDefaults.patchNaming}`);
        
        res.json({ 
            success: true, 
            message: 'Configuration OCR sauvegardée avec succès',
            filePath: filePath,
            patchMode: configWithDefaults.patchMode,
            patchNaming: configWithDefaults.patchNaming
        });

    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration OCR:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur', 
             details: error.message 
        });
    }
}

// ✅ Nouvelle méthode de validation pour les stratégies de nommage Patch
isValidPatchNaming(patchNaming) {
    const validStrategies = [
        'barcode_ocr_generic',
        'barcode',
        'ocr',
        'generic'
    ];
    return validStrategies.includes(patchNaming);
}

// ✅ Nouvelle route pour obtenir les stratégies de nommage disponibles
async getPatchNamingStrategies(req, res) {
    try {
        const strategies = [
            {
                value: 'barcode_ocr_generic',
                label: 'Code-barres → OCR → Générique (Recommandé)',
                description: 'Le système essaiera d\'abord les codes-barres, puis l\'OCR, puis un nom générique'
            },
            {
                value: 'barcode',
                label: 'Code-barres uniquement',
                description: 'Utilise uniquement les codes-barres pour nommer les fichiers'
            },
            {
                value: 'ocr',
                label: 'OCR de texte uniquement',
                description: 'Utilise uniquement la reconnaissance de texte pour nommer les fichiers'
            },
            {
                value: 'generic',
                label: 'Nommage générique simple',
                description: 'Utilise un schéma de nommage générique basé sur la date/heure'
            }
        ];

        res.json({
            success: true,
            strategies: strategies
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des stratégies de nommage:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
}

// ✅ Méthode pour migrer les anciens fichiers sans section PatchSettings
async migrateLegacyConfig(filePath) {
    try {
        const xmlContent = await fs.readFile(filePath, 'utf8');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Vérifier si PatchSettings existe déjà
        const patchSettings = xmlDoc.getElementsByTagName('PatchSettings')[0];
        if (patchSettings) {
            return false; // Pas besoin de migration
        }

        // Ajouter la section PatchSettings
        const profile = xmlDoc.getElementsByTagName('Profile')[0];
        const advanced = xmlDoc.getElementsByTagName('Advanced')[0];
        
        const patchSettingsElement = xmlDoc.createElement('PatchSettings');
        
        const patchModeElement = xmlDoc.createElement('PatchMode');
        patchModeElement.textContent = 'false';
        patchSettingsElement.appendChild(patchModeElement);
        
        const patchNamingElement = xmlDoc.createElement('PatchNaming');
        patchNamingElement.textContent = 'barcode_ocr_generic';
        patchSettingsElement.appendChild(patchNamingElement);
        
        // Insérer avant Advanced
        profile.insertBefore(patchSettingsElement, advanced);
        
        // Mettre à jour LastModified
        const metadata = xmlDoc.getElementsByTagName('Metadata')[0];
        const lastModified = metadata.getElementsByTagName('LastModified')[0];
        if (lastModified) {
            lastModified.textContent = new Date().toISOString();
        }
        
        // Sauvegarder le fichier migré
        const serializer = new XMLSerializer();
        const migratedXml = serializer.serializeToString(xmlDoc);
        await fs.writeFile(filePath, migratedXml, 'utf8');
        
        console.log(`Configuration OCR migrée: ${filePath}`);
        return true;
        
    } catch (error) {
        console.error(`Erreur migration configuration OCR ${filePath}:`, error);
        return false;
    }
}

    // Route GET - Récupérer la configuration OCR
    async getOcrConfig(req, res) {
    try {
        const profileName = req.params.profileName;
        
        if (!profileName) {
            return res.status(400).json({ 
                error: 'Le nom du profil est obligatoire' 
            });
        }

        const filePath = this.getConfigFilePath(profileName);
        
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ 
                error: 'Configuration OCR non trouvée pour ce profil' 
            });
        }

        // ✅ Tenter la migration automatique si nécessaire
        await this.migrateLegacyConfig(filePath);

        const xmlContent = await fs.readFile(filePath, 'utf8');
        const config = this.parseOcrConfigXml(xmlContent);
        
        res.json(config);

    } catch (error) {
        console.error('Erreur lors du chargement de la configuration OCR:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur', 
            details: error.message 
        });
    }
}

    // Route DELETE - Supprimer la configuration OCR
    async deleteOcrConfig(req, res) {
        try {
            const profileName = req.params.profileName;
            
            if (!profileName) {
                return res.status(400).json({ 
                    error: 'Le nom du profil est obligatoire' 
                });
            }

            const filePath = this.getConfigFilePath(profileName);
            
            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
                
                console.log(`Configuration OCR supprimée pour le profil: ${profileName}`);
                
                res.json({ 
                    success: true, 
                    message: 'Configuration OCR supprimée avec succès' 
                });
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return res.status(404).json({ 
                        error: 'Configuration OCR non trouvée pour ce profil' 
                    });
                }
                throw error;
            }

        } catch (error) {
            console.error('Erreur lors de la suppression de la configuration OCR:', error);
            res.status(500).json({ 
                error: 'Erreur interne du serveur', 
                details: error.message 
            });
        }
    }

    // Route GET - Lister tous les profils avec configuration OCR
    async getAllOcrConfigs(req, res) {
        try {
            const files = await fs.readdir(this.configDirectory);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));
            const profiles = xmlFiles.map(file => path.parse(file).name);
            
            res.json({ 
                success: true, 
                profiles: profiles,
                count: profiles.length
            });

        } catch (error) {
            console.error('Erreur lors de la récupération des configurations OCR:', error);
            res.status(500).json({ 
                error: 'Erreur interne du serveur', 
                details: error.message 
            });
        }
    }

    // Méthode pour vérifier si une configuration existe
    async configExists(profileName) {
        try {
            const filePath = this.getConfigFilePath(profileName);
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Créer le routeur Express
    createRouter() {
        const router = express.Router();

        // Middleware pour parser JSON
        router.use(express.json());

        // Routes
        router.post('/', this.saveOcrConfig.bind(this));
        router.get('/:profileName', this.getOcrConfig.bind(this));
        router.delete('/:profileName', this.deleteOcrConfig.bind(this));
        router.get('/', this.getAllOcrConfigs.bind(this));

        return router;
    }
}

module.exports = OcrConfigController;