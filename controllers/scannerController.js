const path = require('path');

class ScannerController {
    constructor() {
        // Chemin vers l'exécutable NAPS2 (ajustez selon votre installation)
        this.naps2Path = path.join('bin', 'naps2', 'App', 'NAPS2.Console.exe');
        
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
            
            // CORRECTION: Commande NAPS2 corrigée avec --driver wia
            const command = `"${this.naps2Path}" --driver twain --listdevices`;
            
            const scanners = await this.executeNaps2Command(command);
            
            if (scanners && scanners.length > 0) {
                res.json({
                    success: true,
                    scanners: scanners,
                    count: scanners.length,
                    driver: 'wia'
                });
            } else {
                res.json({
                    success: true,
                    scanners: [],
                    count: 0,
                    message: 'Aucun scanner détecté',
                    driver: 'wia'
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

    // SOLUTION 2: Méthode fléchée (alternative) - CORRIGÉE
    getConnectedScannersArrow = async (req, res) => {
        try {
            console.log('Récupération de la liste des scanners...');
            console.log('NAPS2 Path:', this.naps2Path); // Debug
            
            // CORRECTION: Commande NAPS2 corrigée avec --driver wia
            const command = `"${this.naps2Path}" --driver wia --listdevices`;
            
            const scanners = await this.executeNaps2Command(command);
            
            if (scanners && scanners.length > 0) {
                res.json({
                    success: true,
                    scanners: scanners,
                    count: scanners.length,
                    driver: 'wia'
                });
            } else {
                res.json({
                    success: true,
                    scanners: [],
                    count: 0,
                    message: 'Aucun scanner détecté',
                    driver: 'wia'
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
            console.log('Exécution commande NAPS2:', command);
            const { stdout, stderr } = await execAsync(command);
            
            // CORRECTION: Ignorer l'avertissement Qt spécifique
            if (stderr && !stderr.includes('Qt: Untested Windows version')) {
                console.warn('NAPS2 warning:', stderr);
            } else if (stderr) {
                console.log('Avertissement Qt ignoré:', stderr);
            }
            
            // Parser la sortie pour extraire les scanners
            const scanners = this.parseScannerOutput(stdout);
            return scanners;
            
        } catch (error) {
            console.error('Erreur exécution NAPS2:', error);
            throw error;
        }
    }

    // Parser la sortie de NAPS2 - VERSION AMÉLIORÉE
    parseScannerOutput(output) {
        if (!output || output.trim() === '') {
            console.log('Aucune sortie de NAPS2');
            return [];
        }

        console.log('Sortie brute NAPS2:', output);
        
        const lines = output.split('\n').filter(line => line.trim());
        const scanners = [];
        
        lines.forEach((line, index) => {
            line = line.trim();
            
            // Ignorer les lignes vides et les messages Qt
            if (line === '' || line.includes('Qt:') || line.includes('Untested')) {
                return;
            }
            
            // CORRECTION: Parser amélioré pour les scanners WIA
            // Pour WIA, les scanners sont listés directement (comme "fi-7140")
            if (line.length > 2 && 
                !line.includes('No devices') && 
                !line.includes('Beginning') &&
                !line.includes('Starting') &&
                !line.includes('Finished') &&
                !line.includes('Error')) {
                
                scanners.push({
                    id: `scanner_${index}`,
                    name: line,
                    driver: 'wia',
                    status: 'available',
                    displayName: line
                });
            }
        });
        
        console.log('Scanners détectés:', scanners);
        return scanners;
    }

    // NOUVELLE MÉTHODE: Tester tous les drivers disponibles
    async getConnectedScannersAllDrivers(req, res) {
        try {
            console.log('Test de tous les drivers disponibles...');
            
            const drivers = ['wia', 'twain', 'escl'];
            const allScanners = [];
            
            for (const driver of drivers) {
                try {
                    const command = `"${this.naps2Path}" --driver ${driver} --listdevices`;
                    console.log(`Test du driver ${driver}...`);
                    
                    const scanners = await this.executeNaps2Command(command);
                    
                    if (scanners && scanners.length > 0) {
                        // Ajouter le driver à chaque scanner
                        scanners.forEach(scanner => {
                            scanner.driver = driver;
                            scanner.id = `${driver}_${scanner.name}`;
                        });
                        allScanners.push(...scanners);
                    }
                } catch (error) {
                    console.log(`Driver ${driver} échoué:`, error.message);
                }
            }
            
            res.json({
                success: true,
                scanners: allScanners,
                count: allScanners.length,
                method: 'Multi-driver scan'
            });
            
        } catch (error) {
            console.error('Erreur test multi-driver:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur test multi-driver',
                details: error.message
            });
        }
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

    // NOUVELLE MÉTHODE: PowerShell pour lister les scanners
    async getPowerShellScanners() {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const command = `powershell "Get-WmiObject -Class Win32_PnPEntity | Where-Object {$_.Name -like '*scan*' -or $_.Name -like '*imaging*'} | Select-Object Name, DeviceID"`;
            
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr) {
                console.warn('PowerShell warning:', stderr);
            }
            
            const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Name') && !line.includes('----'));
            const scanners = [];
            
            lines.forEach((line, index) => {
                line = line.trim();
                if (line) {
                    scanners.push({
                        id: `ps_scanner_${index}`,
                        name: line,
                        driver: 'powershell',
                        status: 'detected',
                        displayName: line
                    });
                }
            });
            
            return scanners;
            
        } catch (error) {
            console.error('Erreur PowerShell:', error);
            throw error;
        }
    }

    // Méthode pour tester NAPS2 uniquement
    async testNaps2Only(req, res) {
        try {
            console.log('Test NAPS2 uniquement...');
            
            const command = `"${this.naps2Path}" --driver wia --listdevices`;
            const scanners = await this.executeNaps2Command(command);
            
            res.json({
                success: true,
                scanners: scanners,
                count: scanners.length,
                method: 'NAPS2 WIA Only',
                command: command
            });
            
        } catch (error) {
            console.error('Erreur test NAPS2:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur test NAPS2',
                details: error.message,
                command: `"${this.naps2Path}" --driver wia --listdevices`
            });
        }
    }
}

// SOLUTION 3: Configuration des routes Express - MULTI-DRIVER
// Exemple d'utilisation correcte dans les routes Express

// ROUTES PRINCIPALES
const scannerController = new ScannerController();

// Route principale - détection automatique avec tous les drivers
// router.get('/scanners', scannerController.getConnectedScanners.bind(scannerController));

// Routes alternatives
// router.get('/scanners/arrow', scannerController.getConnectedScannersArrow);
// router.get('/scanners/alternative', scannerController.getConnectedScannersAlternative.bind(scannerController));
// router.get('/scanners/test', scannerController.testNaps2Only.bind(scannerController));

// NOUVELLES ROUTES MULTI-DRIVER
// router.get('/scanners/compatibility', scannerController.testDriverCompatibility.bind(scannerController));
// router.get('/scanners/:driver/:scannerName', scannerController.getScannerByDriver.bind(scannerController));

// EXEMPLE D'UTILISATION DANS VOTRE APP:
/*
// Route pour tester la compatibilité des drivers
app.get('/api/scanners/compatibility', scannerController.testDriverCompatibility.bind(scannerController));

// Route principale qui teste tous les drivers
app.get('/api/scanners', scannerController.getConnectedScanners.bind(scannerController));

// Route pour chercher un scanner spécifique avec un driver
app.get('/api/scanners/:driver/:scannerName', scannerController.getScannerByDriver.bind(scannerController));


*/

module.exports = ScannerController;