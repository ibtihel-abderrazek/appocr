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

exports.processFile = async (req, res) => {
  let filePath, fileName;
  const ocrMode = req.body.ocrMode !== "false"; // true par défaut

  try {
    let pdfBlocks = [];
    const outputDir = req.body.outputDir || path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // ---------------- SCAN ----------------
    if (req.body.scan === "true") {
      if (!req.body.profileName)
        return res.status(400).json({ error: "profileName requis pour le scan" });

      const scanResult = await scanService.scanFile({
        profileName: req.body.profileName,
        outputDir
      });

      if (typeof scanResult === 'string') {
        filePath = scanResult;
        fileName = path.basename(filePath);
      } else if (scanResult && (scanResult.filePath || scanResult.path)) {
        filePath = scanResult.filePath || scanResult.path;
        fileName = path.basename(filePath);
      } else {
        console.log('Unexpected scanResult structure:', scanResult);
        return res.status(500).json({ error: "Structure de retour du scan inattendue" });
      }
    } else if (req.file) {
      filePath = req.file.path;
      fileName = req.file.originalname;
    } else {
      return res.status(400).json({ error: "Aucun fichier reçu." });
    }

    const ext = path.extname(fileName).toLowerCase();
    
    // ---------------- PDF ----------------
    if (ext === ".pdf") {
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
            } catch {}
          }
          lang = langDetect.detectLang(quickText || "") || "eng";
        }
      }

      const containsPatch = req.body.containsPatch === "true";
      const patchMode = req.body.patchMode || "T_classique";
      const naming = req.body.naming || "generic";
      const namingPattern = req.body.namingPattern;

      pdfBlocks = [filePath];
      if (containsPatch) {
        const patchOptions = { patchMode, lang, naming, namingPattern, ocrMode, containsPatch: true };
        console.log('Options patch envoyées:', patchOptions);
        pdfBlocks = await patchService.splitByPatch(filePath, patchOptions, outputDir);
        tempFiles.push(...pdfBlocks.map(f => (typeof f === 'string' ? f : f.file)));
        console.log('pdfBlocks retournés par patchService:', JSON.stringify(pdfBlocks, null, 2));
      }

      if (!ocrMode) {
        if (containsPatch) {
          const filesInfo = pdfBlocks.map((f, index) => {
            const fPath = typeof f === 'string' ? f : f.file;
            let finalName = path.basename(fPath);
            if (namingPattern && typeof f === 'object') finalName = applyNamingPattern(finalName, namingPattern, index + 1);
            return { name: finalName, content: fs.readFileSync(fPath).toString('base64'), pages: f.pages || [], barcode: f.barcode || null };
          });
          return res.json({ status: "success", message: "PDF découpés par blocs (mode patch sans OCR)", files: filesInfo });
        } else {
          return res.download(pdfBlocks[0], path.basename(pdfBlocks[0]));
        }
      } else {
        const filesInfo = [];
        for (const [blockIndex, pdfBlock] of pdfBlocks.entries()) {
          const blockPath = typeof pdfBlock === 'string' ? pdfBlock : pdfBlock.file;
          if (!blockPath || !fs.existsSync(blockPath)) continue;

          const ocrPath = await ocrPdfService.ocrPdfFile(blockPath, lang, outputDir);
          let finalOcrPath = ocrPath;
          
          // MODIFICATION : Condition simplifiée - appliquer le pattern si défini
          if (namingPattern) {
            const renamedFile = applyNamingPattern(path.basename(ocrPath), namingPattern, blockIndex + 1);
            const renamedPath = path.join(path.dirname(ocrPath), renamedFile);
            if (fs.existsSync(ocrPath)) { 
              console.log(`Renommage de ${ocrPath} vers ${renamedPath}`);
              fs.renameSync(ocrPath, renamedPath); 
              finalOcrPath = renamedPath; 
            } else {
              console.error(`Fichier OCR non trouvé pour renommage: ${ocrPath}`);
            }
          }

          if (!fs.existsSync(finalOcrPath)) throw new Error(`Fichier OCR non créé: ${finalOcrPath}`);
          const fileBuffer = fs.readFileSync(finalOcrPath);
          const base64Content = fileBuffer.toString('base64');

          filesInfo.push({
            name: path.basename(finalOcrPath),
            content: base64Content,
            pages: typeof pdfBlock === 'object' ? (pdfBlock.pages || []) : [],
            barcode: typeof pdfBlock === 'object' ? (pdfBlock.barcode || null) : null
          });

          tempFiles.push(finalOcrPath);
        }

        tempFiles.forEach(f => {
          const fPath = typeof f === 'string' ? f : f.path;
          try { if (fs.existsSync(fPath) && !filesInfo.find(info => info.name === path.basename(fPath))) fs.unlinkSync(fPath); } catch {}
        });

        if (containsPatch || filesInfo.length > 1) {
          return res.json({ status: "success", message: `${containsPatch ? 'PDF découpés par blocs et ' : ''}OCRisés avec succès`, files: filesInfo });
        } else {
          const tempPath = path.join(outputDir, filesInfo[0].name);
          fs.writeFileSync(tempPath, Buffer.from(filesInfo[0].content, 'base64'));
          return res.download(tempPath, filesInfo[0].name, (err) => { if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {} });
        }
      }

    } else if ([".jpg", ".jpeg", ".png", ".tiff", ".tif"].includes(ext)) {
      try {
        let lang = req.body.lang;
        if (!lang) lang = langDetect.detectLang(await ocrService.ocrImage(filePath) || "") || "eng";
        const cleanImagePath = path.join(outputDir, fileName);
        await sharp(filePath).removeAlpha().toFile(cleanImagePath);

        let finalPdf = await ocrPdfService.imageToPdf(cleanImagePath, lang, outputDir);
        if (req.body.namingPattern) {
          const renamedFile = applyNamingPattern(path.basename(finalPdf), req.body.namingPattern, 1);
          const renamedPath = path.join(path.dirname(finalPdf), renamedFile);
          if (fs.existsSync(finalPdf)) { fs.renameSync(finalPdf, renamedPath); finalPdf = renamedPath; }
        }

        cleanUploadsFolder();
        return res.download(finalPdf, path.basename(finalPdf));
      } catch (err) {
        console.error("Erreur OCR image :", err);
        return res.status(500).json({ error: "Erreur OCR image", details: err.toString() });
      }
    } else {
      return res.status(400).json({ error: "Type de fichier non supporté" });
    }

  } catch (err) {
    console.error("Erreur processFile :", err);
    tempFiles.forEach(f => { const fPath = typeof f === 'string' ? f : f.path; try { if (fs.existsSync(fPath)) fs.unlinkSync(fPath); } catch {} });
    return res.status(500).json({ error: "Erreur lors du traitement", details: err.message });
  }
};

// ---------------- Endpoint spécifique pour génération de patch ----------------
exports.generatePatchOnly = async (req, res) => {
  try {
    const { patchData } = req.body;
    if (!patchData) return res.status(400).json({ error: "Le paramètre 'patchData' est requis pour générer un patch" });

    const templatePath = path.join(__dirname, "..", "patchT", "patchT_template.png");
    if (!fs.existsSync(templatePath)) return res.status(500).json({ error: "Template de patch non trouvé : " + templatePath });

    console.log("Génération patch avec données:", patchData);
    const result = await patchService.generatePatchFromData(patchData, templatePath);

    res.json({ status: "success", message: "Patch généré avec succès", results: [result] });
  } catch (err) {
    console.error("Erreur génération patch :", err);
    res.status(500).json({ error: "Erreur lors de la génération du patch", details: err.message });
  }
};