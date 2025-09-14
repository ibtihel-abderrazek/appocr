const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const ocrmypdfExe = path.join(__dirname, "..", "bin", "ocrmypdf_runner.exe");
 // ton exe packagé
const tesseractDir = path.resolve("bin/tesseract");
const ghostscriptDir = path.resolve("bin/ghostscript/gs10.05.1/bin");
const popplerDir = path.resolve("bin/poppler/library/bin"); // ton pdftoppm.exe

exports.extractText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    console.error("❌ Erreur lecture PDF :", err);
    return "";
  }
};

// ---------------- Fonction utilitaire pour nettoyer les noms ----------------
function sanitizeFileName(name) {
  return name
    .normalize("NFD")                    // enlève les accents
    .replace(/[\u0300-\u036f]/g, "")     // supprime les diacritiques
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_") // remplace caractères interdits par _
    .replace(/_+/g, "_")                 // évite underscores multiples
    .replace(/^_+|_+$/g, "");            // supprime underscores début/fin
}

// ---------------- OCR PDF avec ocrmypdf ----------------
exports.ocrPdfFile = async (inputPath, lang, outputDir) => {
  return new Promise((resolve, reject) => {
    try {
      const absoluteInputPath = path.resolve(inputPath);

      // Crée le dossier de sortie si nécessaire
      if (!outputDir) outputDir = path.dirname(inputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      // Nettoyage du nom de fichier
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const safeBaseName = sanitizeFileName(baseName);

      const outputPath = path.join(outputDir, `${safeBaseName}_ocr.pdf`);

      // ---------------- Configuration environnement Tesseract/ocrmypdf ----------------
      const env = {
        ...process.env,
        PATH: `${tesseractDir};${ghostscriptDir};${popplerDir};${process.env.PATH}`,
        TESSDATA_PREFIX: path.join(tesseractDir, "tessdata"),
      };

      const args = [absoluteInputPath, outputPath, "--language", lang, "--force-ocr"];

      console.log("📥 Input Path :", absoluteInputPath);
      console.log("📤 Output Path :", outputPath);
      console.log("📎 Commande :", ocrmypdfExe, args.join(" "));

      execFile(ocrmypdfExe, args, { env }, (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Erreur ocrmypdf :", stderr || err);
          reject(stderr || err.message);
        } else {
          console.log("✅ PDF OCRisé créé :", outputPath);
          resolve(outputPath);
        }
      });

    } catch (err) {
      reject(err);
    }
  });
};

exports.imageToPdf = (imagePath, lang, outputDir) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPdf = path.join(
      outputDir,
      path.basename(imagePath, path.extname(imagePath)) + "_ocr.pdf"
    );

    const env = {
      ...process.env,
      PATH: `${tesseractDir};${ghostscriptDir};${popplerDir};${process.env.PATH}`,
    };

    const args = [
      imagePath,
      outputPdf,
      "-l",
      lang,
      "--force-ocr",
      "--image-dpi",
      "300",
    ];

    console.log("📥 Image Path :", imagePath);
    console.log("📤 Output Path :", outputPdf);
    console.log("📎 Commande :", ocrmypdfExe, args.join(" "));

    execFile(ocrmypdfExe, args, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Erreur ocrmypdf (imageToPdf) :", stderr || error);
        return reject(stderr || error.message);
      }
      console.log("✅ PDF OCRisé créé depuis image :", outputPdf);
      resolve(outputPdf);
    });
  });
}