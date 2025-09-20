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
            <PatchType>${this.escapeXml(config.patchType || 'T_classique')}</PatchType>
            <PatchNaming>${this.escapeXml(config.patchNaming || 'barcode_ocr_generic')}</PatchNaming>
            <PatchEnabled>${config.patchEnabled || false}</PatchEnabled>
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

        // ✅ Lire les champs Patch avec PatchType
        if (patchSettings) {
            const patchTypeElement = patchSettings.getElementsByTagName('PatchType')[0];
            const patchNamingElement = patchSettings.getElementsByTagName('PatchNaming')[0];
            const patchEnabledElement = patchSettings.getElementsByTagName('PatchEnabled')[0];
            
            result.patchType = patchTypeElement ? patchTypeElement.textContent : 'T_classique';  // ✅ patchType
            result.patchNaming = patchNamingElement ? patchNamingElement.textContent : 'barcode_ocr_generic';
            result.patchEnabled = patchEnabledElement ? patchEnabledElement.textContent === 'true' : false;
        } else {
            // Valeurs par défaut si la section n'existe pas
            result.patchType = 'T_classique';  // ✅ patchType
            result.patchNaming = 'barcode_ocr_generic';
            result.patchEnabled = false;
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

        // ✅ CORRECTION: Valider patchType au lieu de patchMode
        if (config.patchType && !this.isValidPatchType(config.patchType)) {
            return res.status(400).json({
                error: 'Mode de traitement Patch invalide. Valeurs autorisées: T_classique, T_with_bookmarks'
            });
        }

        if (config.patchNaming && !this.isValidPatchNaming(config.patchNaming)) {
            return res.status(400).json({
                error: 'Stratégie de nommage Patch invalide. Valeurs autorisées: barcode_ocr_generic, barcode, ocr, generic'
            });
        }

        // ✅ Valeurs par défaut pour les champs (utiliser patchType)
        const configWithDefaults = {
            ...config,
            patchType: config.patchType || 'T_classique',  // ✅ patchType au lieu de patchMode
            patchNaming: config.patchNaming || 'barcode_ocr_generic',
            patchEnabled: config.patchEnabled || false
        };

        const filePath = this.getConfigFilePath(config.profileName);
        const xmlContent = this.createOcrConfigXml(configWithDefaults);
        
        await fs.writeFile(filePath, xmlContent, 'utf8');
        
        console.log(`Configuration OCR sauvegardée pour le profil: ${config.profileName}`);
        console.log(`Patch Type: ${configWithDefaults.patchType}, Patch Naming: ${configWithDefaults.patchNaming}, Patch Enabled: ${configWithDefaults.patchEnabled}`);
        
        res.json({ 
            success: true, 
            message: 'Configuration OCR sauvegardée avec succès',
            filePath: filePath,
            patchType: configWithDefaults.patchType,  // ✅ Retourner patchType
            patchNaming: configWithDefaults.patchNaming,
            patchEnabled: configWithDefaults.patchEnabled
        });

    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration OCR:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur', 
             details: error.message 
        });
    }
}

// ✅ Nouvelles méthodes de validation pour les modes et stratégies
isValidPatchType(patchType) {  // Au lieu de isValidPatchMode
    const validTypes = ['T_classique', 'T_with_bookmarks'];
    return validTypes.includes(patchType);
}

isValidPatchNaming(patchNaming) {
    const validStrategies = [
        'barcode_ocr_generic',
        'barcode',
        'ocr',
        'generic'
    ];
    return validStrategies.includes(patchNaming);
}

// ✅ Nouvelles routes pour obtenir les modes et stratégies disponibles
async getPatchModes(req, res) {
    try {
        const modes = [
            {
                value: 'T_classique',
                label: '⚡ Traitement classique (Standard)',
                description: 'Traitement standard sans fonctionnalités avancées'
            },
            {
                value: 'T_with_bookmarks',
                label: '🔖 Traitement avec signets automatiques',
                description: 'Traitement avancé avec création automatique de signets'
            }
        ];

        res.json({
            success: true,
            modes: modes
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des modes de traitement:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
}

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

// ✅ Méthode pour migrer les anciens fichiers sans section PatchSettings mise à jour
async migrateLegacyConfig(filePath) {
    try {
        const xmlContent = await fs.readFile(filePath, 'utf8');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Vérifier si PatchSettings existe déjà
        const patchSettings = xmlDoc.getElementsByTagName('PatchSettings')[0];
        let needsMigration = false;

        if (!patchSettings) {
            needsMigration = true;
            // Ajouter la section PatchSettings complète
            const profile = xmlDoc.getElementsByTagName('Profile')[0];
            const advanced = xmlDoc.getElementsByTagName('Advanced')[0];
            
            const patchSettingsElement = xmlDoc.createElement('PatchSettings');
            
            const patchModeElement = xmlDoc.createElement('PatchMode');
            patchModeElement.textContent = 'T_classique';
            patchSettingsElement.appendChild(patchModeElement);
            
            const patchNamingElement = xmlDoc.createElement('PatchNaming');
            patchNamingElement.textContent = 'barcode_ocr_generic';
            patchSettingsElement.appendChild(patchNamingElement);

            const patchEnabledElement = xmlDoc.createElement('PatchEnabled');
            patchEnabledElement.textContent = 'false';
            patchSettingsElement.appendChild(patchEnabledElement);
            
            // Insérer avant Advanced
            profile.insertBefore(patchSettingsElement, advanced);
        } else {
            // Vérifier et migrer les éléments manquants
            if (!patchSettings.getElementsByTagName('PatchEnabled')[0]) {
                needsMigration = true;
                const patchEnabledElement = xmlDoc.createElement('PatchEnabled');
                patchEnabledElement.textContent = 'false';
                patchSettings.appendChild(patchEnabledElement);
            }

            // Migrer l'ancien format de PatchMode si nécessaire
            const patchModeElement = patchSettings.getElementsByTagName('PatchMode')[0];
            if (patchModeElement) {
                const currentValue = patchModeElement.textContent;
                if (currentValue === 'true' || currentValue === 'false') {
                    needsMigration = true;
                    patchModeElement.textContent = currentValue === 'true' ? 'T_with_bookmarks' : 'T_classique';
                    console.log(`PatchMode migré de ${currentValue} vers ${patchModeElement.textContent}`);
                }
            }
        }

        if (needsMigration) {
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
        }
        
        return false; // Pas besoin de migration
        
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
    
}

module.exports = OcrConfigController;