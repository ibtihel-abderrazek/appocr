// routes/scanner.js
const express = require('express');
const router = express.Router();
const ScannerController = require('../controllers/scannerController');

// Créer une instance du contrôleur
const scannerController = new ScannerController();

// Route principale - essaie NAPS2 puis alternatives
router.get('/', scannerController.getConnectedScanners);

// Route alternative - utilise seulement PowerShell
router.get('/scanners/alternative', scannerController.getConnectedScannersAlternative);

// Route de test - utilise seulement NAPS2
router.get('/scanners/naps2-only', scannerController.testNaps2Only);

// Route de diagnostic
router.get('/scanners/diagnostic', async (req, res) => {
    try {
        const fs = require('fs');
        const naps2Exists = fs.existsSync(scannerController.naps2Path);
        
        res.json({
            success: true,
            diagnostic: {
                naps2Path: scannerController.naps2Path,
                naps2Exists: naps2Exists,
                platform: process.platform,
                nodeVersion: process.version,
                workingDirectory: process.cwd()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;