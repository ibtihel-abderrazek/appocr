//fileProcessor.js - Version améliorée
const path = require("path");
const fs = require("fs");
const pdfService = require("../services/pdfService");
const ocrPdfService = require("../services/ocrPdfService");
const ocrService = require("../services/ocrService");
const langDetect = require("../services/langDetect");
const pdfImageExtractor = require("../services/pdfImageExtractor");
const patchService = require("../services/patchService");
const scanService = require("../services/scanService");

const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");

const tempFiles = [];

function cleanUploadsFolder() {
  const uploadsPath = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadsPath)) return;
  fs.readdirSync(uploadsPath).forEach(file => {
    const filePath = path.join(uploadsPath, file);
    try { fs.unlinkSync(filePath); } catch {}
  });
}

function applyNamingPattern(baseName, pattern, index = 1) {
  if (!pattern) return baseName;
  const now = new Date();
  const YYYY = now.getFullYear().toString();
  const YY = YYYY.slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const DD = String(now.getDate()).padStart(2, "0");
  const n = index.toString();
  const nn = n.padStart(2, "0");

  const suffix = pattern
    .replace(/\$\((YYYY)\)/g, YYYY)
    .replace(/\$\((YY)\)/g, YY)
    .replace(/\$\((MM)\)/g, MM)
    .replace(/\$\((DD)\)/g, DD)
    .replace(/\$\((n)\)/g, n)
    .replace(/\$\((nn)\)/g, nn);

  const ext = path.extname(baseName);
  const nameWithoutExt = path.basename(baseName, ext);

  return `${nameWithoutExt}${suffix}${ext}`;
}

function cleanArabicText(text) {
  return text.replace(/[^\u0600-\u06FF\s]/g, "").replace(/\s+/g, " ").trim();
}

function fileToBase64(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

// Fonction pour valider un fichier PDF
async function validatePDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // Vérifier la taille minimale
    if (buffer.length < 1000) {
      throw new Error('Fichier PDF trop petit ou vide');
    }
    
    // Vérifier la signature PDF
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith('%PDF')) {
      throw new Error('Fichier ne contient pas une signature PDF valide');
    }
    
    // Essayer de charger avec pdf-lib
    // CORRECTION: parseSpeed doit être un nombre, pas une chaîne
    await PDFDocument.load(buffer, { 
      ignoreEncryption: true,
      // Option 1: Supprimer parseSpeed (il n'est pas nécessaire)
      throwOnInvalidObject: false 
    });
    
    // Option 2: Si parseSpeed est vraiment nécessaire, utilisez un nombre
    // await PDFDocument.load(buffer, { 
    //   ignoreEncryption: true,
    //   parseSpeed: 1,  // Valeur numérique (1 = lent, 2 = moyen, 3 = rapide)
    //   throwOnInvalidObject: false 
    // });
    
    console.log('✅ PDF validé avec succès');
    return true;
    
  } catch (error) {
    console.error('❌ Validation PDF échouée:', error.message);
    throw new Error(`PDF invalide ou corrompu: ${error.message}`);
  }
}

exports.processFile = async (req, res) => {
  let filePath, fileName;
  const ocrMode = req.body.ocrMode !== "false"; // true par défaut

  try {
    let pdfBlocks = [];
    const outputDir = req.body.outputDir || path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // ---------------- SCAN ----------------
    if (req.body.scan === "true") {
      console.log('🖨️ Mode scan activé');
      
      if (!req.body.profileName) {
        return res.status(400).json({ 
          error: "Le paramètre 'profileName' est requis pour effectuer un scan" 
        });
      }

      console.log(`🔍 Début du scan avec le profil: ${req.body.profileName}`);
      
      try {
        // Appeler le service de scan amélioré
        const scanResult = await scanService.scanFile(req.body.profileName, outputDir);
        
        if (typeof scanResult === 'string' && fs.existsSync(scanResult)) {
          filePath = scanResult;
          fileName = path.basename(filePath);
          
          // Valider le PDF scanné
          try {
            await validatePDF(filePath);
            console.log('✅ Fichier scanné validé avec succès');
          } catch (validationError) {
            console.error('❌ Validation du scan échouée:', validationError.message);
            return res.status(500).json({ 
              error: "Le fichier scanné est corrompu ou invalide", 
              details: validationError.message 
            });
          }
          
        } else {
          console.error('❌ Structure de retour du scan inattendue:', scanResult);
          return res.status(500).json({ 
            error: "Erreur lors du scan - structure de retour invalide" 
          });
        }
        
      } catch (scanError) {
        console.error('❌ Erreur lors du scan:', scanError);
        return res.status(500).json({ 
          error: "Erreur lors du scan", 
          details: scanError.message,
          suggestions: [
            "Vérifiez que le scanner est connecté et allumé",
            "Vérifiez que le profil existe dans la configuration",
            "Assurez-vous que NAPS2 est correctement installé",
            "Vérifiez les permissions d'écriture dans le dossier de sortie"
          ]
        });
      }
      
    } else if (req.file) {
      filePath = req.file.path;
      fileName = req.file.originalname;
    } else {
      return res.status(400).json({ error: "Aucun fichier reçu et mode scan non activé." });
    }

    const ext = path.extname(fileName).toLowerCase();
    console.log(`📄 Traitement du fichier: ${fileName} (${ext})`);
    
    // ---------------- PDF ----------------
    if (ext === ".pdf") {
      try {
        // Validation supplémentaire pour les PDFs
        await validatePDF(filePath);
        
        const hasText = await pdfService.extractText(filePath);
        let lang = req.body.lang;

        if (!lang || lang.length < 2) {
          if (hasText && hasText.trim().length > 0) {
            lang = langDetect.detectLang(hasText.trim().slice(0, 1000)) || "eng";
          } else {
            let quickText = "";
            const pagesForLangDetection = 3;
            const totalPages = await pdfService.getPageCount(filePath);
            for (let i = 0; i < Math.min(pagesForLangDetection, totalPages); i++) {
              try {
                const imagePath = await pdfImageExtractor.extractPageAsImage(filePath, i + 1);
                tempFiles.push(imagePath);
                const pageText = await ocrService.ocrImage(imagePath);
                if (pageText) quickText += pageText + "\n";
              } catch (pageError) {
                console.warn(`⚠️ Erreur extraction page ${i + 1}:`, pageError.message);
              }
            }
            lang = langDetect.detectLang(quickText || "") || "eng";
          }
        }

        console.log(`🌍 Langue détectée: ${lang}`);

        const containsPatch = req.body.containsPatch === "true";
        const patchMode = req.body.patchMode || "T_classique";
        const naming = req.body.naming || "generic";
        const namingPattern = req.body.namingPattern;

        pdfBlocks = [filePath];
        
        if (containsPatch) {
          const patchOptions = { patchMode, lang, naming, namingPattern, ocrMode, containsPatch: true };
          console.log('🔧 Options patch:', patchOptions);
          
          try {
            pdfBlocks = await patchService.splitByPatch(filePath, patchOptions, outputDir);
            tempFiles.push(...pdfBlocks.map(f => (typeof f === 'string' ? f : f.file)));
            console.log(`✅ PDF divisé en ${pdfBlocks.length} bloc(s)`);
          } catch (patchError) {
            console.error('❌ Erreur lors de la division par patch:', patchError);
            return res.status(500).json({ 
              error: "Erreur lors de la division par patch", 
              details: patchError.message 
            });
          }
        }

        if (!ocrMode) {
          if (containsPatch) {
            const filesInfo = pdfBlocks.map((f, index) => {
              const fPath = typeof f === 'string' ? f : f.file;
              let finalName = path.basename(fPath);
              if (namingPattern && typeof f === 'object') {
                finalName = applyNamingPattern(finalName, namingPattern, index + 1);
              }
              return { 
                name: finalName, 
                content: fs.readFileSync(fPath).toString('base64'), 
                pages: f.pages || [], 
                barcode: f.barcode || null 
              };
            });
            return res.json({ 
              status: "success", 
              message: "PDF découpés par blocs (mode patch sans OCR)", 
              files: filesInfo 
            });
          } else {
            return res.download(pdfBlocks[0], path.basename(pdfBlocks[0]));
          }
        } else {
          console.log('🔤 Début du processus OCR...');
          const filesInfo = [];
          
          for (const [blockIndex, pdfBlock] of pdfBlocks.entries()) {
            const blockPath = typeof pdfBlock === 'string' ? pdfBlock : pdfBlock.file;
            
            if (!blockPath || !fs.existsSync(blockPath)) {
              console.warn(`⚠️ Bloc ${blockIndex + 1} ignoré (fichier introuvable): ${blockPath}`);
              continue;
            }

            try {
              console.log(`🔤 OCR du bloc ${blockIndex + 1}/${pdfBlocks.length}...`);
              const ocrPath = await ocrPdfService.ocrPdfFile(blockPath, lang, outputDir);
              let finalOcrPath = ocrPath;
              
              // Application du pattern de nommage si défini
              if (namingPattern) {
                const renamedFile = applyNamingPattern(path.basename(ocrPath), namingPattern, blockIndex + 1);
                const renamedPath = path.join(path.dirname(ocrPath), renamedFile);
                
                if (fs.existsSync(ocrPath)) { 
                  console.log(`📝 Renommage: ${path.basename(ocrPath)} → ${renamedFile}`);
                  fs.renameSync(ocrPath, renamedPath); 
                  finalOcrPath = renamedPath; 
                } else {
                  console.error(`❌ Fichier OCR non trouvé pour renommage: ${ocrPath}`);
                }
              }

              if (!fs.existsSync(finalOcrPath)) {
                throw new Error(`Fichier OCR non créé: ${finalOcrPath}`);
              }
              
              const fileBuffer = fs.readFileSync(finalOcrPath);
              const base64Content = fileBuffer.toString('base64');

              filesInfo.push({
                name: path.basename(finalOcrPath),
                content: base64Content,
                pages: typeof pdfBlock === 'object' ? (pdfBlock.pages || []) : [],
                barcode: typeof pdfBlock === 'object' ? (pdfBlock.barcode || null) : null
              });

              tempFiles.push(finalOcrPath);
              console.log(`✅ OCR terminé pour le bloc ${blockIndex + 1}`);
              
            } catch (ocrError) {
              console.error(`❌ Erreur OCR bloc ${blockIndex + 1}:`, ocrError);
              return res.status(500).json({ 
                error: `Erreur lors de l'OCR du bloc ${blockIndex + 1}`, 
                details: ocrError.message 
              });
            }
          }

          // Nettoyer les fichiers temporaires
          tempFiles.forEach(f => {
            const fPath = typeof f === 'string' ? f : f.path;
            try { 
              if (fs.existsSync(fPath) && !filesInfo.find(info => info.name === path.basename(fPath))) {
                fs.unlinkSync(fPath);
              }
            } catch (cleanupError) {
              console.warn('⚠️ Erreur nettoyage fichier temporaire:', cleanupError.message);
            }
          });

          if (containsPatch || filesInfo.length > 1) {
            console.log(`✅ Traitement terminé: ${filesInfo.length} fichier(s) créé(s)`);
            return res.json({ 
              status: "success", 
              message: `${containsPatch ? 'PDF découpés par blocs et ' : ''}OCRisés avec succès`, 
              files: filesInfo 
            });
          } else {
            const tempPath = path.join(outputDir, filesInfo[0].name);
            fs.writeFileSync(tempPath, Buffer.from(filesInfo[0].content, 'base64'));
            return res.download(tempPath, filesInfo[0].name, (err) => { 
              if (fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch {}
              }
            });
          }
        }

      } catch (pdfProcessError) {
        console.error('❌ Erreur traitement PDF:', pdfProcessError);
        return res.status(500).json({ 
          error: "Erreur lors du traitement du PDF", 
          details: pdfProcessError.message,
          suggestions: [
            "Vérifiez que le fichier PDF n'est pas corrompu",
            "Essayez avec un fichier PDF plus simple",
            "Vérifiez l'espace disque disponible",
            "Redémarrez l'application si le problème persiste"
          ]
        });
      }

    } else if ([".jpg", ".jpeg", ".png", ".tiff", ".tif"].includes(ext)) {
      try {
        console.log('🖼️ Traitement d\'image...');
        
        let lang = req.body.lang;
        if (!lang) {
          const ocrText = await ocrService.ocrImage(filePath);
          lang = langDetect.detectLang(ocrText || "") || "eng";
        }
        
        console.log(`🌍 Langue détectée: ${lang}`);
        
        const cleanImagePath = path.join(outputDir, fileName);
        await sharp(filePath).removeAlpha().toFile(cleanImagePath);

        let finalPdf = await ocrPdfService.imageToPdf(cleanImagePath, lang, outputDir);
        
        if (req.body.namingPattern) {
          const renamedFile = applyNamingPattern(path.basename(finalPdf), req.body.namingPattern, 1);
          const renamedPath = path.join(path.dirname(finalPdf), renamedFile);
          if (fs.existsSync(finalPdf)) { 
            fs.renameSync(finalPdf, renamedPath); 
            finalPdf = renamedPath; 
          }
        }

        cleanUploadsFolder();
        console.log('✅ Image traitée avec succès');
        return res.download(finalPdf, path.basename(finalPdf));
        
      } catch (imageError) {
        console.error("❌ Erreur OCR image:", imageError);
        return res.status(500).json({ 
          error: "Erreur lors du traitement de l'image", 
          details: imageError.message 
        });
      }
    } else {
      return res.status(400).json({ 
        error: "Type de fichier non supporté",
        supportedFormats: [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"]
      });
    }

  } catch (err) {
    console.error("❌ Erreur processFile:", err);
    
    // Nettoyer les fichiers temporaires en cas d'erreur
    tempFiles.forEach(f => { 
      const fPath = typeof f === 'string' ? f : f.path; 
      try { 
        if (fs.existsSync(fPath)) fs.unlinkSync(fPath); 
      } catch (cleanupError) {
        console.warn('⚠️ Erreur nettoyage fichier temporaire:', cleanupError.message);
      }
    });
    
    return res.status(500).json({ 
      error: "Erreur lors du traitement du fichier", 
      details: err.message,
      timestamp: new Date().toISOString(),
      suggestions: [
        "Vérifiez que tous les services requis sont démarrés",
        "Vérifiez l'espace disque disponible",
        "Essayez avec un fichier plus petit",
        "Contactez l'administrateur si le problème persiste"
      ]
    });
  }
};

// ---------------- Endpoint spécifique pour génération de patch ----------------
exports.generatePatchOnly = async (req, res) => {
  try {
    console.log('🔧 Génération de patch uniquement...');
    
    const { patchData } = req.body;
    if (!patchData) {
      return res.status(400).json({ 
        error: "Le paramètre 'patchData' est requis pour générer un patch" 
      });
    }

    const templatePath = path.join(__dirname, "..", "patchT", "patchT_template.png");
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ 
        error: "Template de patch non trouvé", 
        path: templatePath 
      });
    }

    console.log("📋 Données du patch:", patchData);
    const result = await patchService.generatePatchFromData(patchData, templatePath);

    console.log('✅ Patch généré avec succès');
    res.json({ 
      status: "success", 
      message: "Patch généré avec succès", 
      results: [result] 
    });
    
  } catch (err) {
    console.error("❌ Erreur génération patch:", err);
    res.status(500).json({ 
      error: "Erreur lors de la génération du patch", 
      details: err.message 
    });
  }
};