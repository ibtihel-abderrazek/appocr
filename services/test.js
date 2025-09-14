const { execFile } = require("child_process");
const path = require("path");

execFile(path.join(__dirname, "../bin/tesseract/tesseract.exe"), ["--version"], (err, stdout, stderr) => {
  if (err) {
    console.error("Erreur :", err);
    return;
  }
  console.log("STDOUT:", stdout);
  console.log("STDERR:", stderr);
});
