// services/patchService.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.splitByPatch = async (pdfPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, "..", "bin", "patchsplitter.exe");
    const outputDir = path.join(__dirname, "../output");
    const templatePath = path.join(__dirname, "..", "patchT", "patchT_template.png");

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    let args = [];

    // 🟢 Cas 1 : Split PDF normal
    if (!options.generatePatch) {
      const pdfAbsolutePath = path.resolve(pdfPath);
      if (!fs.existsSync(templatePath)) 
        return reject(new Error("Template introuvable : " + templatePath));
      if (!fs.existsSync(pdfAbsolutePath))
        return reject(new Error("PDF introuvable : " + pdfAbsolutePath));

      args = [
        "--pdf_path", pdfAbsolutePath,
        "--template_path", templatePath,
        "--mode", options.patchMode || "T_classique",
        "--lang", options.lang || "fra",
        "--naming", options.naming || "barcode_ocr_generic"
      ];
    }

    // 🟢 Cas 2 : Génération de patch uniquement
    if (options.generatePatch && options.data) {
      args.push("--generate_patch", "--data", options.data);
    }

    const child = spawn(exePath, args, { cwd: outputDir, stdio: ["ignore", "pipe", "pipe"] });

    let error = "";
    child.stderr.on("data", (data) => error += data.toString());
    child.stdout.on("data", (data) => console.log(data.toString()));

    child.on("close", (code) => {
      if (code !== 0) 
        return reject(new Error(`patchsplitter.exe failed (code ${code}): ${error}`));

      try {
        const jsonFile = path.join(outputDir, "results.json");
        if (!fs.existsSync(jsonFile)) 
          return reject(new Error("JSON de sortie introuvable : " + jsonFile));

        const files = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));

        const correctedFiles = files.map(f => ({
          ...f,
          file: path.join(outputDir, path.basename(f.file))
        }));

        resolve(correctedFiles);
      } catch (err) {
        reject(err);
      }
    });
  });
};

// 🟢 Fonction generatePatchFromData
exports.generatePatchFromData = async (data, templatePath) => {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, "..", "bin", "patchsplitter.exe");
    const outputDir = path.join(__dirname, "../output");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Arguments pour générer le patch
    const args = [
      "--template_path", templatePath,
      "--generate_patch",
      "--data", data
    ];

    console.log("Arguments pour génération patch:", args);

    const child = spawn(exePath, args, { 
      cwd: outputDir, 
      stdio: ["ignore", "pipe", "pipe"] 
    });

    let error = "";
    let stdout = "";

    child.stderr.on("data", d => {
      const errorMsg = d.toString();
      console.error("STDERR patchsplitter:", errorMsg);
      error += errorMsg;
    });

    child.stdout.on("data", d => {
      const line = d.toString();
      console.log("STDOUT patchsplitter:", line);
      stdout += line;
    });

    child.on("close", code => {
      console.log(`patchsplitter.exe terminé avec le code: ${code}`);

      if (code !== 0) {
        return reject(new Error(`patchsplitter.exe failed (code ${code}): ${error}`));
      }

      try {
        // Extraire le chemin exact du patch depuis stdout
        const fileMatch = stdout.match(/Patch généré\s*:\s*(.+?\.(pdf|png))/i);
        if (!fileMatch) {
          return reject(new Error("Aucun fichier patch trouvé dans la sortie"));
        }

        const generatedPatch = fileMatch[1];
        if (!fs.existsSync(generatedPatch)) {
          return reject(new Error("Fichier patch introuvable : " + generatedPatch));
        }

        // Copier le patch dans outputDir
        const destPath = path.join(outputDir, path.basename(generatedPatch));
        fs.copyFileSync(generatedPatch, destPath);

        // Lire et encoder en base64
        const fileBuffer = fs.readFileSync(destPath);
        const base64Content = fileBuffer.toString("base64");

        // Déterminer le type MIME
        const ext = path.extname(destPath).toLowerCase();
        const mimeType = ext === ".pdf" ? "application/pdf" : "image/png";

        // Optionnel : supprimer le fichier original s'il est ailleurs
        try {
          if (generatedPatch !== destPath) fs.unlinkSync(generatedPatch);
        } catch (cleanupErr) {
          console.warn("Erreur nettoyage fichier original patch:", cleanupErr.message);
        }

        resolve({
          name: path.basename(destPath),
          base64: base64Content,
          mimeType: mimeType,
          path: destPath
        });

      } catch (err) {
        console.error("Erreur traitement résultat patch:", err);
        reject(err);
      }
    });

    child.on("error", (err) => {
      console.error("Erreur spawn patchsplitter:", err);
      reject(new Error(`Impossible de lancer patchsplitter.exe: ${err.message}`));
    });
  });
};