const path = require('path');

class ScannerController {
    constructor() {
        // Chemin vers l'exécutable NAPS2 (ajustez selon votre installation)
        this.naps2Path = path.join(__dirname, 'bin', 'naps2', 'App', 'NAPS2.Console.exe');
        
        // SOLUTION 1: Bind des méthodes dans le constructeur
        this.getConnectedScanners = this.getConnectedScanners.bind(this);
    }

    /**
     * Récupère la liste des scanners connectés via NAPS2
     */
    async getConnectedScanners(req, res) {
        try {
            console.log('Récupération de la liste des scanners...');
            console.log('NAPS2 Path:', this.naps2Path); // Debug
            
            // Commande NAPS2 pour lister les scanners
            const command = `"${this.naps2Path}" -o list -v`;
            
            const scanners = await this.executeNaps2Command(command);
            
            if (scanners && scanners.length > 0) {
                res.json({
                    success: true,
                    scanners: scanners,
                    count: scanners.length
                });
            } else {
                res.json({
                    success: true,
                    scanners: [],
                    count: 0,
                    message: 'Aucun scanner détecté'
                });
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des scanners:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des scanners',
                details: error.message
            });
        }
    }

    // SOLUTION 2: Méthode fléchée (alternative)
    getConnectedScannersArrow = async (req, res) => {
        try {
            console.log('Récupération de la liste des scanners...');
            console.log('NAPS2 Path:', this.naps2Path); // Debug
            
            // Commande NAPS2 pour lister les scanners
            const command = `"${this.naps2Path}" -o list -v`;
            
            const scanners = await this.executeNaps2Command(command);
            
            if (scanners && scanners.length > 0) {
                res.json({
                    success: true,
                    scanners: scanners,
                    count: scanners.length
                });
            } else {
                res.json({
                    success: true,
                    scanners: [],
                    count: 0,
                    message: 'Aucun scanner détecté'
                });
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des scanners:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des scanners',
                details: error.message
            });
        }
    }

    // Méthode helper pour exécuter les commandes NAPS2
    async executeNaps2Command(command) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr) {
                console.warn('NAPS2 warning:', stderr);
            }
            
            // Parser la sortie pour extraire les scanners
            // Adaptez selon le format de sortie de NAPS2
            const scanners = this.parseScannerOutput(stdout);
            return scanners;
            
        } catch (error) {
            console.error('Erreur exécution NAPS2:', error);
            throw error;
        }
    }

    // Parser la sortie de NAPS2
    parseScannerOutput(output) {
        if (!output || output.trim() === '') {
            console.log('Aucune sortie de NAPS2');
            return [];
        }

        console.log('Sortie brute NAPS2:', output);
        
        const lines = output.split('\n').filter(line => line.trim());
        const scanners = [];
        
        // Adapter selon le format exact de sortie de NAPS2
        // Exemple de formats possibles :
        lines.forEach((line, index) => {
            line = line.trim();
            
            // Ignorer les lignes vides et les messages Qt
            if (line === '' || line.includes('Qt:') || line.includes('Untested')) {
                return;
            }
            
            // Adapter ces conditions selon la sortie réelle de NAPS2
            if (line.includes('Scanner') || 
                line.includes('Device') || 
                line.includes('WIA') || 
                line.includes('TWAIN') ||
                (line.length > 5 && !line.includes('No scanners'))) {
                
                scanners.push({
                    id: `scanner_${index}`,
                    name: line,
                    driver: line.includes('WIA') ? 'WIA' : line.includes('TWAIN') ? 'TWAIN' : 'Unknown',
                    status: 'available'
                });
            }
        });
        
        console.log('Scanners détectés:', scanners);
        return scanners;
    }

    // Méthode alternative pour API REST (nouvelle méthode)
    async getConnectedScannersAlternative(req, res) {
        try {
            console.log('Utilisation de la méthode alternative PowerShell...');
            
            const scanners = await this.getPowerShellScanners();
            
            res.json({
                success: true,
                scanners: scanners,
                count: scanners.length,
                method: 'PowerShell Alternative'
            });
            
        } catch (error) {
            console.error('Erreur méthode alternative:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur méthode alternative scanner detection',
                details: error.message
            });
        }
    }

    // Méthode pour tester NAPS2 uniquement
    async testNaps2Only(req, res) {
        try {
            console.log('Test NAPS2 uniquement...');
            
            const scanners = await this.getNaps2Scanners();
            
            res.json({
                success: true,
                scanners: scanners,
                count: scanners.length,
                method: 'NAPS2 Only'
            });
            
        } catch (error) {
            console.error('Erreur test NAPS2:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur test NAPS2',
                details: error.message
            });
        }
    }
}

// SOLUTION 3: Dans votre fichier de routes
// Exemple d'utilisation correcte dans les routes Express

// Option A: Avec bind lors de l'enregistrement de la route
const scannerController = new ScannerController();
// router.get('/scanners', scannerController.getConnectedScanners.bind(scannerController));

// Option B: Avec une fonction wrapper
// router.get('/scanners', (req, res) => scannerController.getConnectedScanners(req, res));

// Option C: Si vous utilisez la méthode fléchée
// router.get('/scanners', scannerController.getConnectedScannersArrow);

module.exports = ScannerController;