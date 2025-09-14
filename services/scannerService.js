const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
// scannerService.js
const { exec } = require('child_process');
function ajouterProfil(data, callback) {
  fs.readFile(profilesPath, 'utf-8', (err, xml) => {
    if (err) return callback(err);

    xml2js.parseString(xml, (err, result) => {
      if (err) return callback(err);

      if (!result.Profiles.Profile) result.Profiles.Profile = [];

      result.Profiles.Profile.push({
        $: {
          Name: data.name,
          Scanner: data.scanner,
          DPI: data.dpi || 300,
          ColorMode: data.colorMode || 'Color'
        }
      });

      const builder = new xml2js.Builder();
      const newXml = builder.buildObject(result);

      fs.writeFile(profilesPath, newXml, err => {
        if (err) return callback(err);
        callback(null, 'Profil ajouté avec succès !');
      });
    });
  });
}

module.exports = { ajouterProfil };
function listerScanners(callback) {
  // Sur Windows, on peut utiliser WIA via PowerShell
  const cmd = `powershell -Command "Get-WmiObject -Namespace root\\WIA -Class WIA_DeviceInfo | Select-Object Name"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) return callback(err, null);

    // Séparer les scanners par ligne et filtrer les vides
    const scanners = stdout.split('\n').map(s => s.trim()).filter(s => s);
    callback(null, scanners);
  });
}

module.exports = { listerScanners };

