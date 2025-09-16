// services/pdfRepairService.js
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

class PDFRepairService {
    constructor() {
        this.tempDir = path.join(__dirname, "../temp");
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Diagnostique un PDF pour identifier les problèmes
     */
    async diagnosePDF(pdfPath) {
        const diagnosis = {
            filePath: pdfPath,
            fileSize: 0,
            isValid: false,
            hasValidHeader: false,
            hasValidEOF: false,
            errors: [],
            warnings: [],
            pageCount: 0,
            hasText: false,
            compressionIssues: false
        };

        try {
            // Vérifier l'existence du fichier
            if (!fs.existsSync(pdfPath)) {
                diagnosis.errors.push("Fichier non trouvé");
                return diagnosis;
            }

            const stats = fs.statSync(pdfPath);
            diagnosis.fileSize = stats.size;

            // Vérifier la taille minimale
            if (stats.size < 100) {
                diagnosis.errors.push("Fichier trop petit pour être un PDF valide");
                return diagnosis;
            }

            const buffer = fs.readFileSync(pdfPath);

            // Vérifier l'en-tête PDF
            const header = buffer.slice(0, 8).toString();
            if (header.startsWith('%PDF-')) {
                diagnosis.hasValidHeader = true;
            } else {
                diagnosis.errors.push("En-tête PDF manquant ou invalide");
            }

            // Vérifier la fin du fichier
            const tail = buffer.slice(-50).toString();
            if (tail.includes('%%EOF')) {
                diagnosis.hasValidEOF = true;
            } else {
                diagnosis.warnings.push("Marqueur de fin de fichier (%%EOF) manquant");
            }

            // Rechercher des problèmes de compression spécifiques
            const content = buffer.toString('binary');
            if (content.includes('FlateDecode') && content.includes('Unknown compression method')) {
                diagnosis.compressionIssues = true;
                diagnosis.errors.push("Méthode de compression inconnue dans le flux FlateDecode");
            }

            // Essayer de charger avec pdf-lib
            try {
                const pdfDoc = await PDFDocument.load(buffer, { 
                    ignoreEncryption: true,
                    parseSpeed: 'slow',
                    throwOnInvalidObject: false 
                });
                
                diagnosis.isValid = true;
                diagnosis.pageCount = pdfDoc.getPageCount();

                // Vérifier s'il y a du texte
                if (diagnosis.pageCount > 0) {
                    // Cette vérification pourrait être améliorée avec un service OCR
                    diagnosis.hasText = true; // Approximation
                }

            } catch (loadError) {
                diagnosis.errors.push(`Erreur de chargement PDF-lib: ${loadError.message}`);
                
                // Analyser les erreurs spécifiques
                if (loadError.message.includes('compression method')) {
                    diagnosis.compressionIssues = true;
                }
            }

        } catch (error) {
            diagnosis.errors.push(`Erreur de diagnostic: ${error.message}`);
        }

        return diagnosis;
    }

    /**
     * Répare un PDF en utilisant différentes méthodes
     */
    async repairPDF(inputPath, outputPath = null) {
        console.log(`🔧 Début de la réparation PDF: ${inputPath}`);

        if (!outputPath) {
            const ext = path.extname(inputPath);
            const baseName = path.basename(inputPath, ext);
            outputPath = path.join(path.dirname(inputPath), `${baseName}_repaired${ext}`);
        }

        // Diagnostic initial
        const diagnosis = await this.diagnosePDF(inputPath);
        console.log('📊 Diagnostic PDF:', diagnosis);

        if (diagnosis.isValid && diagnosis.errors.length === 0) {
            console.log('✅ PDF déjà valide, pas de réparation nécessaire');
            if (inputPath !== outputPath) {
                fs.copyFileSync(inputPath, outputPath);
            }
            return outputPath;
        }

        // Essayer différentes méthodes de réparation
        const repairMethods = [
            () => this.repairWithGhostscript(inputPath, outputPath),
            () => this.repairWithPDFLib(inputPath, outputPath),
            () => this.repairViaImageConversion(inputPath, outputPath),
            () => this.repairWithQPDF(inputPath, outputPath)
        ];

        for (const [index, repairMethod] of repairMethods.entries()) {
            try {
                console.log(`🔧 Tentative méthode ${index + 1}...`);
                const result = await repairMethod();
                
                // Vérifier si la réparation a réussi
                const repairedDiagnosis = await this.diagnosePDF(result);
                if (repairedDiagnosis.isValid) {
                    console.log(`✅ Réparation réussie avec la méthode ${index + 1}`);
                    return result;
                }
                
            } catch (error) {
                console.log(`❌ Méthode ${index + 1} échouée:`, error.message);
                continue;
            }
        }

        throw new Error('Toutes les méthodes de réparation ont échoué');
    }

    /**
     * Réparation avec Ghostscript
     */
    async repairWithGhostscript(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const command = `gs -o "${outputPath}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dNOPAUSE -dBATCH -dSAFER -dCompatibilityLevel=1.4 "${inputPath}"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Ghostscript failed: ${error.message}`));
                } else {
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Réparation avec pdf-lib
     */
    async repairWithPDFLib(inputPath, outputPath) {
        try {
            const buffer = fs.readFileSync(inputPath);
            
            // Essayer avec différentes options de tolérance
            const loadOptions = [
                { ignoreEncryption: true, parseSpeed: 'slow', throwOnInvalidObject: false },
                { ignoreEncryption: true, parseSpeed: 'fast', throwOnInvalidObject: false },
                { ignoreEncryption: true, parseSpeed: 'slow', throwOnInvalidObject: true }
            ];

            for (const options of loadOptions) {
                try {
                    const pdfDoc = await PDFDocument.load(buffer, options);
                    const repairedBytes = await pdfDoc.save();
                    fs.writeFileSync(outputPath, repairedBytes);
                    return outputPath;
                } catch (loadError) {
                    continue;
                }
            }

            throw new Error('Impossible de charger le PDF avec pdf-lib');

        } catch (error) {
            throw new Error(`Réparation pdf-lib échouée: ${error.message}`);
        }
    }

    /**
     * Réparation via conversion en images puis reconversion en PDF
     */
    async repairViaImageConversion(inputPath, outputPath) {
        try {
            console.log('🖼️ Conversion PDF → Images → PDF propre...');

            // Utiliser pdf2pic si disponible
            let pdf2pic;
            try {
                pdf2pic = require('pdf2pic');
            } catch (requireError) {
                throw new Error('pdf2pic non disponible pour la conversion');
            }

            const tempImageDir = path.join(this.tempDir, `repair_${Date.now()}`);
            fs.mkdirSync(tempImageDir, { recursive: true });

            // Convertir le PDF en images
            const convert = pdf2pic.fromPath(inputPath, {
                density: 200, // DPI réduit pour éviter les erreurs mémoire
                saveFilename: "page",
                savePath: tempImageDir,
                format: "png",
                width: 1200,
                height: 1600
            });

            let pages;
            try {
                pages = await convert.bulk(-1);
            } catch (conversionError) {
                // Essayer page par page si la conversion en bloc échoue
                pages = [];
                let pageNum = 1;
                while (true) {
                    try {
                        const page = await convert(pageNum);
                        pages.push(page);
                        pageNum++;
                    } catch (pageError) {
                        break; // Plus de pages
                    }
                }
            }

            if (pages.length === 0) {
                throw new Error('Aucune page convertie');
            }

            console.log(`✅ ${pages.length} pages converties en images`);

            // Créer un nouveau PDF à partir des images
            const pdfDoc = await PDFDocument.create();

            for (const page of pages) {
                try {
                    // Optimiser l'image
                    const optimizedImagePath = page.path.replace('.png', '_optimized.png');
                    
                    await sharp(page.path)
                        .png({ quality: 80, compressionLevel: 6 })
                        .resize({ width: 1200, height: 1600, fit: 'inside' })
                        .toFile(optimizedImagePath);

                    const imageBytes = fs.readFileSync(optimizedImagePath);
                    const image = await pdfDoc.embedPng(imageBytes);
                    
                    const newPage = pdfDoc.addPage([image.width, image.height]);
                    newPage.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: image.width,
                        height: image.height,
                    });

                    // Nettoyer les fichiers temporaires
                    fs.unlinkSync(page.path);
                    fs.unlinkSync(optimizedImagePath);

                } catch (pageError) {
                    console.warn(`⚠️ Erreur traitement page: ${pageError.message}`);
                }
            }

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);

            // Nettoyer le dossier temporaire
            fs.rmdirSync(tempImageDir, { recursive: true });

            return outputPath;

        } catch (error) {
            throw new Error(`Réparation par conversion échouée: ${error.message}`);
        }
    }

    /**
     * Réparation avec QPDF (si disponible)
     */
    async repairWithQPDF(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const command = `qpdf --qdf --object-streams=preserve "${inputPath}" "${outputPath}"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`QPDF failed: ${error.message}`));
                } else {
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Nettoie les fichiers temporaires
     */
    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
                this.ensureTempDir();
            }
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage fichiers temporaires:', error.message);
        }
    }

    /**
     * Méthode utilitaire pour réparer automatiquement un PDF
     */
    async autoRepair(inputPath) {
        const diagnosis = await this.diagnosePDF(inputPath);
        
        if (diagnosis.isValid && diagnosis.errors.length === 0) {
            return {
                success: true,
                message: 'PDF déjà valide',
                outputPath: inputPath,
                diagnosis
            };
        }

        try {
            const outputPath = await this.repairPDF(inputPath);
            const finalDiagnosis = await this.diagnosePDF(outputPath);
            
            return {
                success: true,
                message: 'PDF réparé avec succès',
                outputPath,
                originalDiagnosis: diagnosis,
                finalDiagnosis
            };

        } catch (error) {
            return {
                success: false,
                message: 'Réparation échouée',
                error: error.message,
                diagnosis
            };
        }
    }
}

module.exports = new PDFRepairService();