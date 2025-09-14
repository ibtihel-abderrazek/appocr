const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");


exports.extractPageAsImage = async (pdfPath, pageNumber) => {
  return new Promise((resolve, reject) => {
    const outputBase = pdfPath.replace(/\.pdf$/, "");
    const outputImage = `${outputBase}-${pageNumber}.png`;
    const pdftoppmPath = path.resolve("bin/poppler/library/bin/pdftoppm.exe");
    const command = `"${pdftoppmPath}" -f ${pageNumber} -l ${pageNumber} -png -r 300 "${pdfPath}" "${outputBase}"`;

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Erreur pdftoppm :", stderr);
        reject(stderr);
      } else {
        fs.stat(outputImage, (err, stats) => {
          if (err) {
            console.error("❌ Fichier image non trouvé :", outputImage);
            reject(err);
          } else {
            console.log("✅ Image extraite, taille (octets):", stats.size);
            resolve(outputImage);
          }
        });
      }
    });
  });
};

