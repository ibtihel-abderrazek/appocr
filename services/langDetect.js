// services/langDetect.js
const { spawnSync } = require("child_process");
const path = require("path");

exports.detectLang = (text) => {
  if (!text) return "eng"; // fallback si texte vide ou undefined

  const scriptPath = path.join(__dirname, "..", "bin", "langDetect_script.exe");


  const result = spawnSync(scriptPath, [text], {
    encoding: "utf-8"
  });

  const langCode = (result.stdout || "").trim();

  if (langCode.startsWith("fr")) return "fra";
  if (langCode.startsWith("ar")) return "ara";
  if (langCode.startsWith("en")) return "eng";

  return "eng"; // fallback
};
