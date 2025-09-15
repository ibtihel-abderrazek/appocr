// services/scanService.js - Version améliorée
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { getProfileByDisplayName } = require("../services/xmlProfileService");
const { execFile, exec } = require("child_process");
const sharp = require("sharp");

class ScanService {
    constructor() {
        this.scannersCache = null;
        this.lastFetch = null;
        this.cacheTimeout = 30000; // 30 secondes
    }

    /**
     * Récupère la liste des scanners connectés
     */
    async getConnectedScanners(forceRefresh = false) {
        try {
            // Vérifier le cache
            if (!forceRefresh && this.scannersCache && this.lastFetch && 
                (Date.now() - this.lastFetch < this.cacheTimeout)) {
                return this.scannersCache;
            }

            console.log('Récupération des scanners depuis le serveur...');
            
            const response = await fetch('/scanners', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Mise à jour du cache
                this.scannersCache = data;
                this.lastFetch = Date.now();
                
                console.log(`${data.scanners.length} scanners trouvés`);
                return data;
            } else {
                throw new Error(data.error || 'Erreur lors de la récupération des scanners');
            }

        } catch (error) {
            console.error('Erreur ScannerService:', error);
            
            // Retourner des scanners par défaut en cas d'erreur
            const fallbackData = {
                success: false,
                scanners: [
                    {
                        id: 'TWAIN2 FreeImage Software Scanner',
                        name: 'TWAIN2 FreeImage Software Scanner',
                        driver: 'TWAIN',
                        displayName: 'TWAIN2 FreeImage Software Scanner (TWAIN)'
                    }
                ],
                count: 1,
                error: error.message,
                isFallback: true
            };
            
            return fallbackData;
        }
    }

    /**
     * Teste un scanner spécifique
     */
    async testScanner(scannerName) {
        try {
            const response = await fetch(`scanners/test/${encodeURIComponent(scannerName)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Erreur test scanner:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Force la mise à jour des scanners
     */
    async refreshScanners() {
        this.scannersCache = null;
        this.lastFetch = null;
        return await this.getConnectedScanners(true);
    }

    /**
     * Crée les options HTML pour un select
     */
    createScannerOptions(scanners, selectedValue = null) {
        if (!scanners || scanners.length === 0) {
            return '<option value="">Aucun scanner détecté</option>';
        }

        return scanners.map(scanner => {
            const isSelected = selectedValue && 
                (selectedValue === scanner.id || selectedValue === scanner.name) ? 'selected' : '';
            
            return `<option value="${scanner.id}" ${isSelected} data-driver="${scanner.driver}">
                ${scanner.displayName}
            </option>`;
        }).join('');
    }

    /**
     * Met à jour un select avec la liste des scanners
     */
    async populateScannerSelect(selectElement, selectedValue = null, showRefreshButton = true) {
        try {
            // Afficher un indicateur de chargement
            selectElement.innerHTML = '<option value="">Chargement...</option>';
            selectElement.disabled = true;

            const data = await this.getConnectedScanners();
            
            // Ajouter une option par défaut
            let optionsHtml = '<option value="">Sélectionnez un scanner</option>';
            
            if (data.scanners && data.scanners.length > 0) {
                optionsHtml += this.createScannerOptions(data.scanners, selectedValue);
            } else {
                optionsHtml += '<option value="">Aucun scanner trouvé</option>';
            }

            selectElement.innerHTML = optionsHtml;
            selectElement.disabled = false;

            // Ajouter un bouton de rafraîchissement si demandé
            if (showRefreshButton && !selectElement.nextElementSibling?.classList.contains('refresh-scanners-btn')) {
                const refreshBtn = document.createElement('button');
                refreshBtn.type = 'button';
                refreshBtn.className = 'btn-refresh refresh-scanners-btn';
                refreshBtn.innerHTML = '🔄';
                refreshBtn.title = 'Actualiser la liste des scanners';
                refreshBtn.style.marginLeft = '5px';
                
                refreshBtn.addEventListener('click', async () => {
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '⏳';
                    
                    try {
                        await this.refreshScanners();
                        await this.populateScannerSelect(selectElement, selectElement.value, false);
                        Utils.showNotification('Liste des scanners mise à jour', 'success');
                    } catch (error) {
                        Utils.showNotification('Erreur lors de la mise à jour: ' + error.message, 'error');
                    } finally {
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = '🔄';
                    }
                });

                selectElement.parentNode.insertBefore(refreshBtn, selectElement.nextSibling);
            }

            // Afficher un message si c'est un fallback
            if (data.isFallback) {
                Utils.showNotification('Impossible de détecter les scanners. Utilisation de la configuration par défaut.', 'warning');
            }

        } catch (error) {
            console.error('Erreur populate scanner select:', error);
            selectElement.innerHTML = '<option value="">Erreur de chargement</option>';
            selectElement.disabled = false;
        }
    }

    /**
     * Valide qu'un scanner est disponible
     */
    async validateScanner(scannerName) {
        if (!scannerName) return false;

        try {
            const data = await this.getConnectedScanners();
            return data.scanners.some(scanner => 
                scanner.id === scannerName || scanner.name === scannerName
            );
        } catch (error) {
            console.error('Erreur validation scanner:', error);
            return false;
        }
    }

    /**
     * Répare un PDF corrompu en utilisant Ghostscript
     */
    async repairPDF(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const gsCommand = `gs -o "${outputPath}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 "${inputPath}"`;
            
            exec(gsCommand, (error, stdout, stderr) => {
                if (error) {
                    console.log('Ghostscript non disponible, essai avec une méthode alternative...');
                    // Fallback: essayer de recréer le PDF avec pdf-lib
                    this.fallbackRepairPDF(inputPath, outputPath)
                        .then(resolve)
                        .catch(reject);
                } else {
                    console.log('✅ PDF réparé avec Ghostscript');
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Méthode de réparation alternative sans Ghostscript
     */
    async fallbackRepairPDF(inputPath, outputPath) {
        try {
            console.log('🔧 Tentative de réparation PDF avec pdf-lib...');
            
            // Essayer de lire le PDF avec pdf-lib
            const existingPdfBytes = fs.readFileSync(inputPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes, { 
                ignoreEncryption: true,
                parseSpeed: 'slow',
                throwOnInvalidObject: false
            });
            
            // Sauvegarder le PDF réparé
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
            
            console.log('✅ PDF réparé avec pdf-lib');
            return outputPath;
            
        } catch (pdfLibError) {
            console.error('❌ Impossible de réparer le PDF:', pdfLibError.message);
            throw new Error(`PDF corrompu et impossible à réparer: ${pdfLibError.message}`);
        }
    }

    /**
     * Convertit un PDF en images pour contourner les problèmes de corruption
     */
    async pdfToImages(pdfPath, outputDir) {
        try {
            const pdf2pic = require('pdf2pic');
            
            const convert = pdf2pic.fromPath(pdfPath, {
                density: 300,
                saveFilename: "scan_page",
                savePath: outputDir,
                format: "png",
                width: 2000,
                height: 2000
            });

            const results = await convert.bulk(-1);
            console.log(`✅ PDF converti en ${results.length} images`);
            
            return results.map(result => result.path);
            
        } catch (error) {
            console.error('❌ Erreur conversion PDF vers images:', error);
            throw error;
        }
    }

    /**
     * Crée un nouveau PDF propre à partir d'images
     */
    async imagesToCleanPDF(imagePaths, outputPath) {
        try {
            console.log('📄 Création d\'un nouveau PDF à partir des images...');
            
            const pdfDoc = await PDFDocument.create();
            
            for (const imagePath of imagePaths) {
                // Optimiser l'image avant de l'ajouter au PDF
                const optimizedImagePath = imagePath.replace('.png', '_optimized.png');
                
                await sharp(imagePath)
                    .png({ quality: 80, compressionLevel: 6 })
                    .toFile(optimizedImagePath);
                
                const imageBytes = fs.readFileSync(optimizedImagePath);
                const image = await pdfDoc.embedPng(imageBytes);
                
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
                
                // Nettoyer l'image optimisée
                fs.unlinkSync(optimizedImagePath);
            }
            
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
            
            console.log('✅ Nouveau PDF créé avec succès');
            return outputPath;
            
        } catch (error) {
            console.error('❌ Erreur création PDF depuis images:', error);
            throw error;
        }
    }

    /**
     * Fonction principale de scan avec gestion robuste des erreurs
     */
    async scanFile(profileName, outputDir) {
        console.log(`🔍 Début du scan avec le profil: ${profileName}`);
       try {
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // Construire le nom du fichier PDF
        const outputFile = path.join(outputDir, `${profileName}_scan_temp.pdf`);

        // Commande NAPS2 sans options invalides
        const command = `"${path.join(__dirname, '../bin/naps2/App/NAPS2.Console.exe')}" ` +
            `--driver twain ` +
            `--device "PaperStream IP fi-7140" ` +
            `--profile "${profileName}" ` +
            `--output "${outputFile}" ` +
            `--force ` +
            `-v`;  // verbose

        console.log("Exécution NAPS2:", command);

        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                console.log("STDOUT:", stdout);
                console.error("STDERR:", stderr);

                if (error) return reject(new Error(`Erreur lors du scan: ${error.message}`));
                if (!fs.existsSync(outputFile)) return reject(new Error(`Le fichier scanné n'a pas été créé: ${outputFile}`));

                resolve();
            });
        });

        console.log("Scan réussi:", outputFile);
        return outputFile;

    } catch (err) {
        console.error(err);
        throw err;
    } 
        
    }
}

// Export global si côté navigateur
if (typeof window !== 'undefined') {
    window.ScanService = ScanService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = new ScanService();
}