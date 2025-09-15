const fs = require("fs");
const pdfParse = require("pdf-parse");
const { PDFDocument } = require("pdf-lib");
const path = require("path");

exports.extractText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    console.log(data.text);
    return data.text.trim();
  } catch (err) {
    console.error("❌ Erreur lecture PDF :", err);
    return "";
  }
};

exports.getPageCount = async (pdfPath) => {
  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { updateMetadata: false }); // <-- ignore métadonnées
    return pdfDoc.getPageCount();
  } catch (err) {
    console.error("❌ Erreur getPageCount PDF :", err);
    return 0;
  }
};

exports.splitIntoBlocks = async (pdfPath, blockSize = 10, outputDir) => {
  const fileBuffer = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBuffer, { updateMetadata: false }); // <-- ignore métadonnées
  const totalPages = pdfDoc.getPageCount();
  const blocks = [];

  for (let i = 0; i < totalPages; i += blockSize) {
    const newPdf = await PDFDocument.create();
    const end = Math.min(i + blockSize, totalPages);
    const pagesToCopy = await newPdf.copyPages(pdfDoc, [...Array(end - i).keys()].map(k => k + i));
    pagesToCopy.forEach(p => newPdf.addPage(p));

    const outputPath = path.join(
      outputDir,
      `${path.basename(pdfPath, ".pdf")}_part${i / blockSize + 1}.pdf`
    );

    try {
      const pdfBytes = await newPdf.save();
      fs.writeFileSync(outputPath, pdfBytes);
      blocks.push(outputPath);
    } catch (err) {
      console.error("❌ Erreur sauvegarde PDF partielle :", outputPath, err);
    }
  }

  return blocks;
};
