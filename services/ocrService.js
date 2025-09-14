const sharp = require("sharp");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

exports.ocrImage = async (filePath) => {
  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const cleanedPath = path.join(dir, base + "-clean.png");
    const tesseractPath = path.resolve("bin/tesseract/tesseract.exe");
    const outputTxtPath = path.join(dir, base + "-clean"); // sans extension, tesseract ajoute .txt

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await sharp(filePath)
      .grayscale()
      .resize({ width: 1500 })
      .normalize()
      .toFile(cleanedPath);

    // Commande Tesseract : input cleaned image, output txt file
    const command = `"${tesseractPath}" "${cleanedPath}" "${outputTxtPath}" -l eng+fra+ara`;

    // Exécute Tesseract
    const ocrText = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
          return;
        }
        // Lire le fichier texte généré
        fs.readFile(outputTxtPath + ".txt", "utf8", (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    });

    // Nettoyer texte OCR
    const cleanedText = ocrText
      .replace(/[^\x00-\x7FÀ-ÿء-ي\u0600-\u06FF]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Supprimer fichiers temporaires (image + texte)
    fs.unlink(cleanedPath, () => {});
    fs.unlink(outputTxtPath + ".txt", () => {});

    return cleanedText;
  } catch (err) {
    console.error("❌ Erreur OCR :", err);
    return "";
  }
};
