// index.js - Intégration des nouvelles routes avec OCR Patch
const express = require('express');
const cors = require('cors');
const path = require('path');
const { swaggerUi, specs, swaggerOptions } = require('./swagger');
const app = express();

// Routes existantes
const fileRoute = require("./routes/processFile");
const profilesRouter = require("./routes/profiles");
const scannersRouter = require("./routes/scanners");
const patchRouter = require("./routes/patch");
const SwaggerRouter = require("./swagger");

// ✅ Nouveau contrôleur OCR avec instanciation
const OcrConfigController = require('./controllers/ocrConfigController');
const ocrController = new OcrConfigController();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques
app.use(express.static('public'));

// =================== ROUTES PROFILS AMÉLIORÉES ===================
const profileController = require('./controllers/profilesController');

// Routes pour les profils avec le nouveau contrôleur
app.get('/profiles', profileController.getProfiles);
app.get('/profiles/:name', profileController.getProfile);
app.post('/profiles/add', profileController.createProfile);
app.post('/profiles', profileController.createProfile);
app.put('/profiles/:name', profileController.updateProfile);
app.delete('/profiles/:name', profileController.deleteProfile);

// =================== NOUVELLES ROUTES OCR AVEC PATCH ===================

/**
 * @swagger
 * components:
 *   schemas:
 *     OcrConfig:
 *       type: object
 *       required:
 *         - profileName
 *       properties:
 *         profileName:
 *           type: string
 *           description: Nom du profil de scanner
 *           example: "MonProfilScanner"
 *         ocrMode:
 *           type: boolean
 *           description: Mode OCR activé ou désactivé
 *           example: true
 *         lang:
 *           type: string
 *           description: Langue de reconnaissance OCR
 *           example: "fra"
 *           enum: ["", "ara", "fra", "eng"]
 *         namingPattern:
 *           type: string
 *           description: Modèle de nommage automatique
 *           example: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *         pdfMode:
 *           type: string
 *           description: Format de sortie PDF
 *           example: "pdfa"
 *           enum: ["pdf", "pdfa"]
 *         patchMode:
 *           type: boolean
 *           description: Mode traitement par lots (Patch) activé
 *           example: false
 *         patchNaming:
 *           type: string
 *           description: Stratégie de nommage des fichiers pour le mode Patch
 *           example: "barcode_ocr_generic"
 *           enum: ["barcode_ocr_generic", "barcode", "ocr", "generic"]
 *     PatchStrategy:
 *       type: object
 *       properties:
 *         value:
 *           type: string
 *           example: "barcode_ocr_generic"
 *         label:
 *           type: string
 *           example: "Code-barres → OCR → Générique (Recommandé)"
 *         description:
 *           type: string
 *           example: "Le système essaiera d'abord les codes-barres, puis l'OCR, puis un nom générique"
 *         priority:
 *           type: integer
 *           example: 1
 *         recommended:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/profile/ocr:
 *   post:
 *     summary: Sauvegarder une configuration OCR avec support Patch
 *     tags: [OCR Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OcrConfig'
 *     responses:
 *       200:
 *         description: Configuration OCR sauvegardée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Configuration OCR sauvegardée avec succès"
 *                 filePath:
 *                   type: string
 *                   example: "OcrProfiles/MonProfilScanner.xml"
 *                 patchMode:
 *                   type: boolean
 *                   example: false
 *                 patchNaming:
 *                   type: string
 *                   example: "barcode_ocr_generic"
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur interne du serveur
 */
app.post('/api/profile/ocr', ocrController.saveOcrConfig.bind(ocrController));

/**
 * @swagger
 * /api/profile/ocr/{profileName}:
 *   get:
 *     summary: Récupérer une configuration OCR avec paramètres Patch
 *     tags: [OCR Configuration]
 *     parameters:
 *       - in: path
 *         name: profileName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du profil de scanner
 *         example: "MonProfilScanner"
 *     responses:
 *       200:
 *         description: Configuration OCR récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/OcrConfig'
 *                 - type: object
 *                   properties:
 *                     lastModified:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-15T14:30:25Z"
 *       404:
 *         description: Configuration OCR non trouvée
 *       500:
 *         description: Erreur interne du serveur
 */
app.get('/api/profile/ocr/:profileName', ocrController.getOcrConfig.bind(ocrController));

/**
 * @swagger
 * /api/profile/ocr/{profileName}:
 *   delete:
 *     summary: Supprimer une configuration OCR
 *     tags: [OCR Configuration]
 *     parameters:
 *       - in: path
 *         name: profileName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du profil de scanner
 *         example: "MonProfilScanner"
 *     responses:
 *       200:
 *         description: Configuration OCR supprimée avec succès
 *       404:
 *         description: Configuration OCR non trouvée
 *       500:
 *         description: Erreur interne du serveur
 */
app.delete('/api/profile/ocr/:profileName', ocrController.deleteOcrConfig.bind(ocrController));

/**
 * @swagger
 * /api/profile/ocr:
 *   get:
 *     summary: Lister toutes les configurations OCR
 *     tags: [OCR Configuration]
 *     responses:
 *       200:
 *         description: Liste des profils avec configuration OCR
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["MonProfilScanner", "ProfilOCR2"]
 *                 count:
 *                   type: integer
 *                   example: 2
 *       500:
 *         description: Erreur interne du serveur
 */
app.get('/api/profile/ocr', ocrController.getAllOcrConfigs.bind(ocrController));

// ✅ NOUVELLES ROUTES SPÉCIFIQUES PATCH

/**
 * @swagger
 * /api/profile/ocr/patch/strategies:
 *   get:
 *     summary: Obtenir les stratégies de nommage Patch disponibles
 *     tags: [OCR Patch]
 *     responses:
 *       200:
 *         description: Liste des stratégies de nommage Patch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 strategies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PatchStrategy'
 *                 count:
 *                   type: integer
 *                   example: 4
 *       500:
 *         description: Erreur interne du serveur
 */
app.get('/api/profile/ocr/patch/strategies', async (req, res) => {
    try {
        const strategies = [
            {
                value: 'barcode_ocr_generic',
                label: 'Code-barres → OCR → Générique (Recommandé)',
                description: 'Le système essaiera d\'abord les codes-barres, puis l\'OCR, puis un nom générique',
                priority: 1,
                recommended: true
            },
            {
                value: 'barcode',
                label: 'Code-barres uniquement',
                description: 'Utilise uniquement les codes-barres pour nommer les fichiers',
                priority: 2,
                recommended: false
            },
            {
                value: 'ocr',
                label: 'OCR de texte uniquement',
                description: 'Utilise uniquement la reconnaissance de texte pour nommer les fichiers',
                priority: 3,
                recommended: false
            },
            {
                value: 'generic',
                label: 'Nommage générique simple',
                description: 'Utilise un schéma de nommage générique basé sur la date/heure',
                priority: 4,
                recommended: false
            }
        ];

        res.json({
            success: true,
            strategies: strategies,
            count: strategies.length
        });
    } catch (error) {
        console.error('Erreur récupération stratégies Patch:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/profile/ocr/validate:
 *   post:
 *     summary: Valider une configuration OCR avec paramètres Patch
 *     tags: [OCR Patch]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OcrConfig'
 *     responses:
 *       200:
 *         description: Résultat de la validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   example: true
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: []
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Mode Patch activé sans OCR peut limiter les options de nommage"]
 *                 validatedConfig:
 *                   $ref: '#/components/schemas/OcrConfig'
 *       400:
 *         description: Configuration manquante
 *       500:
 *         description: Erreur interne du serveur
 */
app.post('/api/profile/ocr/validate', async (req, res) => {
    try {
        const config = req.body;
        
        if (!config) {
            return res.status(400).json({
                error: 'Configuration manquante'
            });
        }

        const errors = [];
        const warnings = [];

        // Validation des champs OCR existants
        if (config.lang && !['', 'fra', 'eng', 'ara'].includes(config.lang)) {
            warnings.push(`Langue OCR "${config.lang}" non standard`);
        }

        if (config.pdfMode && !['pdf', 'pdfa'].includes(config.pdfMode)) {
            errors.push(`Mode PDF "${config.pdfMode}" invalide`);
        }

        // ✅ Validation des nouveaux champs Patch
        if (config.patchNaming && !isValidPatchStrategy(config.patchNaming)) {
            errors.push(`Stratégie Patch "${config.patchNaming}" invalide`);
        }

        if (config.patchMode === true && !config.patchNaming) {
            warnings.push('Mode Patch activé mais aucune stratégie de nommage définie');
        }

        // Vérification de cohérence
        if (config.ocrMode === false && config.patchMode === true) {
            warnings.push('Mode Patch activé sans OCR peut limiter les options de nommage');
        }

        res.json({
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            validatedConfig: config
        });

    } catch (error) {
        console.error('Erreur validation configuration OCR:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/profile/ocr/migrate-all:
 *   post:
 *     summary: Migrer toutes les configurations OCR existantes pour inclure les paramètres Patch
 *     tags: [OCR Patch]
 *     responses:
 *       200:
 *         description: Migration terminée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Migration terminée: 3 configurations mises à jour"
 *                 totalFiles:
 *                   type: integer
 *                   example: 5
 *                 migratedFiles:
 *                   type: integer
 *                   example: 3
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       file:
 *                         type: string
 *                       error:
 *                         type: string
 *       404:
 *         description: Répertoire de configuration OCR non trouvé
 *       500:
 *         description: Erreur interne du serveur
 */
app.post('/api/profile/ocr/migrate-all', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const configDirectory = process.env.OCR_CONFIG_DIR || 'OcrProfiles';
        
        // Vérifier que le répertoire existe
        try {
            await fs.access(configDirectory);
        } catch (error) {
            return res.status(404).json({
                error: 'Répertoire de configuration OCR non trouvé'
            });
        }

        const files = await fs.readdir(configDirectory);
        const xmlFiles = files.filter(file => file.endsWith('.xml') && !file.includes('_backup_'));
        
        let migratedCount = 0;
        let errors = [];

        for (const file of xmlFiles) {
            const filePath = path.join(configDirectory, file);
            
            try {
                const migrated = await ocrController.migrateLegacyConfig(filePath);
                if (migrated) {
                    migratedCount++;
                }
            } catch (error) {
                errors.push({
                    file: file,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Migration terminée: ${migratedCount} configurations mises à jour`,
            totalFiles: xmlFiles.length,
            migratedFiles: migratedCount,
            errors: errors
        });

    } catch (error) {
        console.error('Erreur migration configurations OCR:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/profile/ocr/report:
 *   get:
 *     summary: Obtenir un rapport détaillé des configurations OCR avec statistiques Patch
 *     tags: [OCR Patch]
 *     responses:
 *       200:
 *         description: Rapport généré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalFiles:
 *                   type: integer
 *                   example: 10
 *                 validFiles:
 *                   type: integer
 *                   example: 8
 *                 invalidFiles:
 *                   type: integer
 *                   example: 2
 *                 warnings:
 *                   type: integer
 *                   example: 3
 *                 patchStatistics:
 *                   type: object
 *                   properties:
 *                     withPatch:
 *                       type: integer
 *                       example: 5
 *                     withoutPatch:
 *                       type: integer
 *                       example: 3
 *                     strategies:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         barcode_ocr_generic: 3
 *                         ocr: 2
 *       500:
 *         description: Erreur interne du serveur
 */
app.get('/api/profile/ocr/report', async (req, res) => {
    try {
        const XmlService = require('./services/xmlService');
        const xmlService = new XmlService();
        const configDirectory = process.env.OCR_CONFIG_DIR || 'OcrProfiles';
        
        const report = await xmlService.generateValidationReport(configDirectory);
        
        // ✅ Analyser les configurations Patch
        const patchStats = {
            withPatch: 0,
            withoutPatch: 0,
            strategies: {}
        };

        for (const detail of report.details) {
            if (detail.valid) {
                try {
                    const fs = require('fs').promises;
                    const path = require('path');
                    const filePath = path.join(configDirectory, detail.filename);
                    
                    const doc = await xmlService.loadDocument(filePath);
                    const config = xmlService.parseOcrDocument(doc);
                    
                    if (config.patchMode) {
                        patchStats.withPatch++;
                        patchStats.strategies[config.patchNaming] = (patchStats.strategies[config.patchNaming] || 0) + 1;
                    } else {
                        patchStats.withoutPatch++;
                    }
                } catch (error) {
                    console.warn(`Erreur analyse Patch pour ${detail.filename}:`, error);
                }
            }
        }

        res.json({
            success: true,
            ...report,
            patchStatistics: patchStats
        });

    } catch (error) {
        console.error('Erreur génération rapport OCR:', error);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/profile/ocr/test:
 *   get:
 *     summary: Tester la configuration OCR Patch
 *     tags: [OCR Patch]
 *     responses:
 *       200:
 *         description: Configuration OCR Patch opérationnelle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Configuration OCR Patch opérationnelle"
 *                 details:
 *                   type: object
 *                   properties:
 *                     ocrControllerInitialized:
 *                       type: boolean
 *                       example: true
 *                     supportedPatchStrategies:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["barcode_ocr_generic", "barcode", "ocr", "generic"]
 *       500:
 *         description: Erreur test configuration
 */
app.get('/api/profile/ocr/test', async (req, res) => {
    try {
        const XmlService = require('./services/xmlService');
        
        const testResults = {
            ocrControllerInitialized: !!ocrController,
            xmlServiceAvailable: !!XmlService,
            patchStrategiesEndpoint: '/api/profile/ocr/patch/strategies',
            validationEndpoint: '/api/profile/ocr/validate',
            migrationEndpoint: '/api/profile/ocr/migrate-all',
            reportEndpoint: '/api/profile/ocr/report',
            supportedPatchStrategies: [
                'barcode_ocr_generic',
                'barcode',
                'ocr',
                'generic'
            ]
        };

        res.json({
            success: true,
            message: 'Configuration OCR Patch opérationnelle',
            details: testResults
        });
    } catch (error) {
        console.error('Erreur test configuration OCR:', error);
        res.status(500).json({
            error: 'Erreur test configuration',
            details: error.message
        });
    }
});

// ✅ Fonction utilitaire pour valider les stratégies Patch
function isValidPatchStrategy(strategy) {
    const validStrategies = [
        'barcode_ocr_generic',
        'barcode',
        'ocr',
        'generic'
    ];
    return validStrategies.includes(strategy);
}

// -------------------- Routes principales existantes --------------------
app.use("/patch", patchRouter);
app.use("/processFile", fileRoute);
app.use("/scanners", scannersRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Page d'accueil de l'application
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Page HTML principale
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Vérification de l'état du serveur avec support OCR Patch
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Serveur opérationnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-15T14:30:25Z"
 *                 uptime:
 *                   type: number
 *                   example: 12345.67
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 features:
 *                   type: object
 *                   properties:
 *                     profiles:
 *                       type: boolean
 *                       example: true
 *                     ocr:
 *                       type: boolean
 *                       example: true
 *                     ocrPatch:
 *                       type: boolean
 *                       example: true
 *                     scanners:
 *                       type: boolean
 *                       example: true
 *                     patch:
 *                       type: boolean
 *                       example: true
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        features: {
            profiles: true,
            ocr: true,
            ocrPatch: true, // ✅ Nouvelle fonctionnalité Patch
            scanners: true,
            patch: true
        }
    });
});

// ✅ Middleware de gestion d'erreur spécifique pour les routes OCR
app.use('/api/profile/ocr', (error, req, res, next) => {
    console.error('Erreur middleware OCR:', error);
    
    if (error.code === 'ENOENT') {
        res.status(404).json({
            error: 'Configuration OCR non trouvée',
            details: error.message
        });
    } else if (error.name === 'SyntaxError') {
        res.status(400).json({
            error: 'Données JSON invalides',
            details: error.message
        });
    } else {
        res.status(500).json({
            error: 'Erreur interne du serveur',
            details: error.message
        });
    }
});

// Gestionnaire d'erreur global
app.use((error, req, res, next) => {
    console.error('Erreur serveur:', error);
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
});

// Gestionnaire 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.path,
        method: req.method
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌍 Interface web : http://localhost:${PORT}`);
    console.log(`📋 API Profils : http://localhost:${PORT}/profiles`);
    console.log(`🔎 API OCR : http://localhost:${PORT}/api/profile/ocr`);
    console.log(`📋 API OCR Patch : http://localhost:${PORT}/api/profile/ocr/patch/strategies`);
    console.log(`📱 API Scanners : http://localhost:${PORT}/scanners`);
    console.log(`📚 Documentation Swagger : http://localhost:${PORT}/api-docs`);
});

module.exports = app;