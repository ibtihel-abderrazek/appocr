// services/xmlService.js - Service utilitaire pour la gestion XML
const { DOMParser, XMLSerializer } = require('xmldom');
const fs = require('fs').promises;
const path = require('path');

class XmlService {
    constructor() {
        this.parser = new DOMParser();
        this.serializer = new XMLSerializer();
    }

    /**
     * Crée un document XML pour une configuration OCR
     */
    createOcrDocument(config) {
    const now = new Date().toISOString();
    
    // Créer le document XML de base avec la nouvelle section PatchSettings
    const xmlString = `<?xml version="1.0" encoding="utf-8"?>
<OcrConfiguration version="1.0" created="${now}">
    <Profile name="">
        <Settings>
            <OcrMode>false</OcrMode>
            <Language>fra</Language>
            <NamingPattern>$(DD)-$(MM)-$(YYYY)-$(n)</NamingPattern>
            <PdfMode>pdfa</PdfMode>
        </Settings>
        <PatchSettings>
            <PatchMode>false</PatchMode>
            <PatchNaming>barcode_ocr_generic</PatchNaming>
        </PatchSettings>
        <Advanced>
            <AutoDetectLanguage>false</AutoDetectLanguage>
            <EnablePreprocessing>true</EnablePreprocessing>
            <OutputQuality>high</OutputQuality>
            <Dpi>300</Dpi>
            <ColorMode>color</ColorMode>
        </Advanced>
    </Profile>
    <Metadata>
        <Created>${now}</Created>
        <LastModified>${now}</LastModified>
        <Application>ScannerProfileManager</Application>
        <Version>1.0</Version>
        <Generator></Generator>
    </Metadata>
</OcrConfiguration>`;

    const doc = this.parser.parseFromString(xmlString, 'text/xml');
    
    // Remplir avec les données de configuration
    this.setElementValue(doc, 'Profile', 'name', config.profileName || '');
    this.setElementText(doc, 'OcrMode', config.ocrMode ? 'true' : 'false');
    this.setElementText(doc, 'Language', config.lang || 'fra');
    this.setElementText(doc, 'NamingPattern', config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)');
    this.setElementText(doc, 'PdfMode', config.pdfMode || 'pdfa');
    this.setElementText(doc, 'AutoDetectLanguage', (!config.lang || config.lang === '') ? 'true' : 'false');
    this.setElementText(doc, 'Generator', require('os').hostname());

    // ✅ Remplir les nouveaux champs Patch
    this.setElementText(doc, 'PatchMode', config.patchMode ? 'true' : 'false');
    this.setElementText(doc, 'PatchNaming', config.patchNaming || 'barcode_ocr_generic');

    // Paramètres avancés optionnels
    if (config.dpi) {
        this.setElementText(doc, 'Dpi', config.dpi.toString());
    }
    if (config.colorMode) {
        this.setElementText(doc, 'ColorMode', config.colorMode);
    }

    return doc;
}

// ✅ Modifier la méthode parseOcrDocument pour lire la section PatchSettings
parseOcrDocument(doc) {
    try {
        const profile = doc.getElementsByTagName('Profile')[0];
        const settings = profile.getElementsByTagName('Settings')[0];
        const patchSettings = profile.getElementsByTagName('PatchSettings')[0];
        const advanced = profile.getElementsByTagName('Advanced')[0];
        const metadata = doc.getElementsByTagName('Metadata')[0];

        if (!profile || !settings) {
            throw new Error('Structure XML invalide');
        }

        const result = {
            profileName: profile.getAttribute('name') || '',
            ocrMode: this.getElementText(settings, 'OcrMode') === 'true',
            lang: this.getElementText(settings, 'Language') || 'fra',
            namingPattern: this.getElementText(settings, 'NamingPattern') || '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: this.getElementText(settings, 'PdfMode') || 'pdfa',
            lastModified: metadata ? this.getElementText(metadata, 'LastModified') : null
        };

        // ✅ Lire les champs Patch
        if (patchSettings) {
            result.patchMode = this.getElementText(patchSettings, 'PatchMode') === 'true';
            result.patchNaming = this.getElementText(patchSettings, 'PatchNaming') || 'barcode_ocr_generic';
        } else {
            // Valeurs par défaut pour rétrocompatibilité
            result.patchMode = false;
            result.patchNaming = 'barcode_ocr_generic';
        }

        // Paramètres avancés optionnels
        if (advanced) {
            result.autoDetectLanguage = this.getElementText(advanced, 'AutoDetectLanguage') === 'true';
            result.enablePreprocessing = this.getElementText(advanced, 'EnablePreprocessing') === 'true';
            result.outputQuality = this.getElementText(advanced, 'OutputQuality') || 'high';
            result.dpi = parseInt(this.getElementText(advanced, 'Dpi')) || 300;
            result.colorMode = this.getElementText(advanced, 'ColorMode') || 'color';
        }

        return result;
    } catch (error) {
        throw new Error(`Erreur de parsing XML: ${error.message}`);
    }
}

    /**
     * Sauvegarde un document XML dans un fichier
     */
    async saveDocument(doc, filePath) {
        try {
            const xmlString = this.serializer.serializeToString(doc);
            
            // Formatter le XML avec indentation
            const formattedXml = this.formatXml(xmlString);
            
            await fs.writeFile(filePath, formattedXml, 'utf8');
            return true;
        } catch (error) {
            throw new Error(`Erreur de sauvegarde XML: ${error.message}`);
        }
    }

    /**
     * Charge un document XML depuis un fichier
     */
    async loadDocument(filePath) {
        try {
            const xmlContent = await fs.readFile(filePath, 'utf8');
            const doc = this.parser.parseFromString(xmlContent, 'text/xml');
            
            // Vérifier les erreurs de parsing
            const parseError = doc.getElementsByTagName('parsererror')[0];
            if (parseError) {
                throw new Error('Erreur de parsing XML: ' + parseError.textContent);
            }
            
            return doc;
        } catch (error) {
            throw new Error(`Erreur de chargement XML: ${error.message}`);
        }
    }

    /**
     * Valide la structure d'un document XML OCR
     */
    validateOcrDocument(doc) {
    const errors = [];
    const warnings = [];

    // Vérifier l'élément racine
    if (!doc.documentElement || doc.documentElement.tagName !== 'OcrConfiguration') {
        errors.push('Élément racine OcrConfiguration manquant');
        return { isValid: false, errors, warnings };
    }

    // Vérifier la version
    const version = doc.documentElement.getAttribute('version');
    if (!version) {
        warnings.push('Attribut version manquant');
    } else if (version !== '1.0') {
        warnings.push(`Version ${version} différente de la version supportée 1.0`);
    }

    // Vérifier la structure Profile
    const profile = doc.getElementsByTagName('Profile')[0];
    if (!profile) {
        errors.push('Élément Profile manquant');
    } else {
        const profileName = profile.getAttribute('name');
        if (!profileName) {
            errors.push('Attribut name du Profile manquant');
        } else if (profileName.length > 255) {
            warnings.push('Nom de profil très long (>255 caractères)');
        }
    }

    // Vérifier la structure Settings
    const settings = doc.getElementsByTagName('Settings')[0];
    if (!settings) {
        errors.push('Élément Settings manquant');
    } else {
        const requiredSettings = ['OcrMode', 'Language', 'NamingPattern', 'PdfMode'];
        requiredSettings.forEach(setting => {
            const element = settings.getElementsByTagName(setting)[0];
            if (!element) {
                errors.push(`Élément Settings/${setting} manquant`);
            } else {
                this.validateSettingValue(setting, element.textContent, errors, warnings);
            }
        });
    }

    // ✅ Vérifier la structure PatchSettings
    const patchSettings = doc.getElementsByTagName('PatchSettings')[0];
    if (!patchSettings) {
        warnings.push('Élément PatchSettings manquant (sera créé automatiquement)');
    } else {
        const requiredPatchSettings = ['PatchMode', 'PatchNaming'];
        requiredPatchSettings.forEach(setting => {
            const element = patchSettings.getElementsByTagName(setting)[0];
            if (!element) {
                errors.push(`Élément PatchSettings/${setting} manquant`);
            } else {
                this.validatePatchSettingValue(setting, element.textContent, errors, warnings);
            }
        });
    }

    // Vérifier la structure Metadata
    const metadata = doc.getElementsByTagName('Metadata')[0];
    if (!metadata) {
        warnings.push('Élément Metadata manquant');
    } else {
        const requiredMetadata = ['Created', 'LastModified', 'Application', 'Version'];
        requiredMetadata.forEach(meta => {
            if (!metadata.getElementsByTagName(meta)[0]) {
                warnings.push(`Élément Metadata/${meta} manquant`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

// ✅ Nouvelle méthode pour valider les paramètres Patch
validatePatchSettingValue(settingName, value, errors, warnings) {
    switch (settingName) {
        case 'PatchMode':
            if (value !== 'true' && value !== 'false') {
                errors.push('PatchMode doit être "true" ou "false"');
            }
            break;
        
        case 'PatchNaming':
            const validStrategies = ['barcode_ocr_generic', 'barcode', 'ocr', 'generic'];
            if (!validStrategies.includes(value)) {
                errors.push(`PatchNaming "${value}" invalide. Stratégies supportées: ${validStrategies.join(', ')}`);
            }
            break;
    }
}

    /**
     * Valide une valeur de paramètre spécifique
     */
    validateSettingValue(settingName, value, errors, warnings) {
        switch (settingName) {
            case 'OcrMode':
                if (value !== 'true' && value !== 'false') {
                    errors.push('OcrMode doit être "true" ou "false"');
                }
                break;
            
            case 'Language':
                const validLangs = ['', 'fra', 'eng', 'ara'];
                if (!validLangs.includes(value)) {
                    warnings.push(`Langue "${value}" non reconnue. Langues supportées: ${validLangs.join(', ')}`);
                }
                break;
            
            case 'PdfMode':
                const validModes = ['pdf', 'pdfa'];
                if (!validModes.includes(value)) {
                    errors.push(`PdfMode "${value}" invalide. Modes supportés: ${validModes.join(', ')}`);
                }
                break;
            
            case 'NamingPattern':
                if (!value || value.trim() === '') {
                    errors.push('NamingPattern ne peut pas être vide');
                }
                // Vérifier la présence de variables de nommage
                const hasVariables = /\$\([A-Z]+\)/.test(value);
                if (!hasVariables) {
                    warnings.push('NamingPattern ne contient aucune variable de substitution');
                }
                break;
        }
    }

    /**
     * Met à jour un document XML existant
     */
    updateDocument(doc, config) {
    const now = new Date().toISOString();
    
    // Mettre à jour les paramètres
    this.setElementValue(doc, 'Profile', 'name', config.profileName || '');
    this.setElementText(doc, 'OcrMode', config.ocrMode ? 'true' : 'false');
    this.setElementText(doc, 'Language', config.lang || 'fra');
    this.setElementText(doc, 'NamingPattern', config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)');
    this.setElementText(doc, 'PdfMode', config.pdfMode || 'pdfa');
    this.setElementText(doc, 'AutoDetectLanguage', (!config.lang || config.lang === '') ? 'true' : 'false');
    
    // ✅ Mettre à jour les paramètres Patch
    this.setElementText(doc, 'PatchMode', config.patchMode ? 'true' : 'false');
    this.setElementText(doc, 'PatchNaming', config.patchNaming || 'barcode_ocr_generic');
    
    // Mettre à jour les métadonnées
    this.setElementText(doc, 'LastModified', now);
    
    return doc;
}

    /**
     * Crée une sauvegarde d'un fichier XML
     */
    async createBackup(filePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = filePath.replace('.xml', `_backup_${timestamp}.xml`);
            
            const content = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, content, 'utf8');
            
            console.log(`Sauvegarde créée: ${backupPath}`);
            return backupPath;
        } catch (error) {
            throw new Error(`Erreur création sauvegarde: ${error.message}`);
        }
    }

    /**
     * Nettoie les anciens fichiers de sauvegarde
     */
    async cleanupBackups(directory, maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            const files = await fs.readdir(directory);
            const backupFiles = files.filter(file => file.includes('_backup_') && file.endsWith('.xml'));
            
            const now = Date.now();
            let deletedCount = 0;

            for (const file of backupFiles) {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }

            console.log(`Nettoyage terminé: ${deletedCount} fichiers de sauvegarde supprimés`);
            return deletedCount;
        } catch (error) {
            console.warn(`Erreur nettoyage sauvegardes: ${error.message}`);
            return 0;
        }
    }

    /**
     * Migre un ancien format XML vers le nouveau format
     */
    migrateDocument(doc, fromVersion = '1.0', toVersion = '1.0') {
    try {
        const root = doc.documentElement;
        if (!root) {
            throw new Error('Document XML invalide');
        }

        root.setAttribute('version', toVersion);
        
        const profile = doc.getElementsByTagName('Profile')[0];
        if (!profile) {
            throw new Error('Élément Profile manquant');
        }

        // ✅ Ajouter la section PatchSettings si elle n'existe pas
        let patchSettings = doc.getElementsByTagName('PatchSettings')[0];
        if (!patchSettings) {
            patchSettings = doc.createElement('PatchSettings');
            
            const patchModeElement = doc.createElement('PatchMode');
            patchModeElement.textContent = 'false';
            patchSettings.appendChild(patchModeElement);
            
            const patchNamingElement = doc.createElement('PatchNaming');
            patchNamingElement.textContent = 'barcode_ocr_generic';
            patchSettings.appendChild(patchNamingElement);
            
            // Insérer après Settings et avant Advanced
            const settings = doc.getElementsByTagName('Settings')[0];
            const advanced = doc.getElementsByTagName('Advanced')[0];
            
            if (settings && advanced) {
                profile.insertBefore(patchSettings, advanced);
            } else if (settings) {
                // Si Advanced n'existe pas, ajouter après Settings
                const nextSibling = settings.nextSibling;
                if (nextSibling) {
                    profile.insertBefore(patchSettings, nextSibling);
                } else {
                    profile.appendChild(patchSettings);
                }
            }
            
            console.log('Section PatchSettings ajoutée lors de la migration');
        }
        
        // Ajouter les nouveaux champs dans Advanced si nécessaire
        const advanced = doc.getElementsByTagName('Advanced')[0];
        if (advanced && !advanced.getElementsByTagName('Dpi')[0]) {
            const dpiElement = doc.createElement('Dpi');
            dpiElement.textContent = '300';
            advanced.appendChild(dpiElement);
        }
        
        if (advanced && !advanced.getElementsByTagName('ColorMode')[0]) {
            const colorElement = doc.createElement('ColorMode');
            colorElement.textContent = 'color';
            advanced.appendChild(colorElement);
        }

        console.log(`Document migré de la version ${fromVersion} vers ${toVersion}`);
        return doc;
    } catch (error) {
        throw new Error(`Erreur migration document: ${error.message}`);
    }
}

// ✅ Nouvelle méthode pour valider une stratégie de nommage Patch
isValidPatchNamingStrategy(strategy) {
    const validStrategies = [
        'barcode_ocr_generic',
        'barcode',
        'ocr',
        'generic'
    ];
    return validStrategies.includes(strategy);
}

// ✅ Nouvelle méthode pour obtenir les stratégies disponibles
getAvailablePatchStrategies() {
    return [
        {
            value: 'barcode_ocr_generic',
            label: 'Code-barres → OCR → Générique (Recommandé)',
            description: 'Essaie d\'abord les codes-barres, puis l\'OCR, puis un nom générique',
            priority: 1
        },
        {
            value: 'barcode',
            label: 'Code-barres uniquement',
            description: 'Utilise uniquement les codes-barres pour nommer les fichiers',
            priority: 2
        },
        {
            value: 'ocr',
            label: 'OCR de texte uniquement',
            description: 'Utilise uniquement la reconnaissance de texte pour nommer les fichiers',
            priority: 3
        },
        {
            value: 'generic',
            label: 'Nommage générique simple',
            description: 'Utilise un schéma de nommage générique basé sur la date/heure',
            priority: 4
        }
    ];
}

// ✅ Méthode pour créer un document avec configuration Patch par défaut
createDefaultPatchDocument(profileName) {
    const config = {
        profileName: profileName,
        ocrMode: false,
        lang: 'fra',
        namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
        pdfMode: 'pdfa',
        patchMode: false,
        patchNaming: 'barcode_ocr_generic'
    };
    
    return this.createOcrDocument(config);
}

// ✅ Méthode pour extraire uniquement la configuration Patch d'un document
extractPatchConfig(doc) {
    try {
        const patchSettings = doc.getElementsByTagName('PatchSettings')[0];
        
        if (!patchSettings) {
            return {
                patchMode: false,
                patchNaming: 'barcode_ocr_generic'
            };
        }
        
        return {
            patchMode: this.getElementText(patchSettings, 'PatchMode') === 'true',
            patchNaming: this.getElementText(patchSettings, 'PatchNaming') || 'barcode_ocr_generic'
        };
    } catch (error) {
        console.error('Erreur extraction config Patch:', error);
        return {
            patchMode: false,
            patchNaming: 'barcode_ocr_generic'
        };
    }
}

    /**
     * Compare deux documents XML OCR
     */
    compareDocuments(doc1, doc2) {
        try {
            const config1 = this.parseOcrDocument(doc1);
            const config2 = this.parseOcrDocument(doc2);
            
            const differences = [];
            const keys = new Set([...Object.keys(config1), ...Object.keys(config2)]);
            
            keys.forEach(key => {
                if (config1[key] !== config2[key]) {
                    differences.push({
                        field: key,
                        oldValue: config1[key],
                        newValue: config2[key]
                    });
                }
            });
            
            return {
                identical: differences.length === 0,
                differences: differences
            };
        } catch (error) {
            throw new Error(`Erreur comparaison documents: ${error.message}`);
        }
    }

    // Méthodes utilitaires privées

    setElementText(doc, tagName, text) {
        const elements = doc.getElementsByTagName(tagName);
        if (elements.length > 0) {
            elements[0].textContent = this.escapeXml(text);
        }
    }

    setElementValue(doc, tagName, attribute, value) {
        const elements = doc.getElementsByTagName(tagName);
        if (elements.length > 0) {
            elements[0].setAttribute(attribute, this.escapeXml(value));
        }
    }

    getElementText(parent, tagName) {
        const elements = parent.getElementsByTagName(tagName);
        return elements.length > 0 ? this.unescapeXml(elements[0].textContent) : '';
    }

    formatXml(xmlString) {
        // Formatter basique du XML avec indentation
        let formatted = '';
        let indent = '';
        const tab = '    ';
        
        xmlString.split(/>\s*</).forEach((node, index) => {
            if (index !== 0) {
                node = '<' + node;
            }
            if (index !== xmlString.split(/>\s*</).length - 1) {
                node = node + '>';
            }
            
            let padding = '';
            if (node.match(/^<\/\w/)) {
                // Tag de fermeture
                indent = indent.substring(tab.length);
            }
            
            padding = indent;
            
            if (node.match(/^<\w[^>]*[^/]>.*$/)) {
                // Tag d'ouverture
                indent += tab;
            }
            
            formatted += padding + node + '\n';
        });
        
        return formatted.trim();
    }

    escapeXml(unsafe) {
        if (typeof unsafe !== 'string') {
            return String(unsafe);
        }
        
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    unescapeXml(safe) {
        if (typeof safe !== 'string') {
            return String(safe);
        }
        
        return safe.replace(/&(lt|gt|amp|apos|quot);/g, function (match, entity) {
            switch (entity) {
                case 'lt': return '<';
                case 'gt': return '>';
                case 'amp': return '&';
                case 'apos': return '\'';
                case 'quot': return '"';
                default: return match;
            }
        });
    }

    /**
     * Génère un rapport de validation détaillé
     */
    async generateValidationReport(directory) {
        try {
            const files = await fs.readdir(directory);
            const xmlFiles = files.filter(file => file.endsWith('.xml') && !file.includes('_backup_'));
            
            const report = {
                totalFiles: xmlFiles.length,
                validFiles: 0,
                invalidFiles: 0,
                warnings: 0,
                details: []
            };

            for (const file of xmlFiles) {
                const filePath = path.join(directory, file);
                try {
                    const doc = await this.loadDocument(filePath);
                    const validation = this.validateOcrDocument(doc);
                    
                    const fileReport = {
                        filename: file,
                        valid: validation.isValid,
                        errors: validation.errors,
                        warnings: validation.warnings
                    };
                    
                    if (validation.isValid) {
                        report.validFiles++;
                    } else {
                        report.invalidFiles++;
                    }
                    
                    report.warnings += validation.warnings.length;
                    report.details.push(fileReport);
                    
                } catch (error) {
                    report.invalidFiles++;
                    report.details.push({
                        filename: file,
                        valid: false,
                        errors: [error.message],
                        warnings: []
                    });
                }
            }
            
            return report;
        } catch (error) {
            throw new Error(`Erreur génération rapport: ${error.message}`);
        }
    }
}

module.exports = XmlService;