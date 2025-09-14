const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const { exec } = require("child_process");

// Chemins
const profilesFile = path.join(__dirname, "..", "bin", "naps2", "Data", "profiles.xml");
const backupDir = path.join(__dirname, "..", "data", "deleted");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// --- UTILITAIRES ---
async function readProfilesXml() {
  const data = await fs.promises.readFile(profilesFile, "utf-8");
  return xml2js.parseStringPromise(data, { explicitArray: true });
}

async function writeProfilesXml(xmlObj) {
  const builder = new xml2js.Builder({
    xmldec: { version: "1.0", encoding: "utf-8" },
    renderOpts: { pretty: true },
  });
  await fs.promises.writeFile(profilesFile, builder.buildObject(xmlObj), "utf-8");
}

// --- MÉTHODES PRINCIPALES ---

async function getAllProfiles() {
  const xmlObj = await readProfilesXml();
  return xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
}

async function getProfileByDisplayName(displayName) {
  const profiles = await getAllProfiles();
  return profiles.find((p) => p?.DisplayName?.[0] === displayName);
}

// MÉTHODE CORRIGÉE : Ajouter un nouveau profil
async function addProfile(profileData) {
  try {
    // Vérifier si un profil avec ce DisplayName existe déjà
    const existingProfile = await getProfileByDisplayName(profileData.DisplayName);
    if (existingProfile) {
      throw new Error("Un profil avec ce nom existe déjà");
    }

    // Construire l'objet de profil avec les données reçues
    const newProfile = {
      Version: [profileData.Version || '5'],
      Device: [{
        ID: [profileData['Device.ID'] || 'TWAIN2 FreeImage Software Scanner'],
        Name: [profileData['Device.Name'] || 'TWAIN2 FreeImage Software Scanner'],
        IconUri: [{ $: { 'xsi:nil': 'true' } }],
        ConnectionUri: [{ $: { 'xsi:nil': 'true' } }]
      }],
      Caps: [{
        PaperSources: ['Glass,Feeder'],
        FeederCheck: ['true'],
        Glass: [{ 
          ScanArea: ['8,5x14 in'],
          Resolutions: ['50,100,150,200,300,400,600'] 
        }],
        Feeder: [{ 
          ScanArea: ['8,5x14 in'],
          Resolutions: ['50,100,150,200,300,400,600'] 
        }],
        Duplex: ['']
      }],
      DriverName: [profileData.DriverName || 'twain'],
      DisplayName: [profileData.DisplayName],
      IconID: [profileData.IconID || '0'],
      MaxQuality: [profileData.MaxQuality || 'false'],
      IsDefault: [profileData.IsDefault || 'false'],
      UseNativeUI: [profileData.UseNativeUI || 'false'],
      AfterScanScale: [profileData.AfterScanScale || 'OneToOne'],
      Brightness: [profileData.Brightness || '0'],
      Contrast: [profileData.Contrast || '0'],
      BitDepth: [profileData.BitDepth || 'C24Bit'],
      PageAlign: [profileData.PageAlign || 'Right'],
      PageSize: [profileData.PageSize || 'Letter'],
      CustomPageSizeName: [{ $: { 'xsi:nil': 'true' } }],
      CustomPageSize: [{ $: { 'xsi:nil': 'true' } }],
      Resolution: [profileData.Resolution || 'Dpi100'],
      PaperSource: [profileData.PaperSource || 'Glass'],
      EnableAutoSave: [profileData.EnableAutoSave || 'false'],
      AutoSaveSettings: [{ $: { 'xsi:nil': 'true' } }],
      Quality: [profileData.Quality || '75'],
      AutoDeskew: [profileData.AutoDeskew || 'false'],
      RotateDegrees: [profileData.RotateDegrees || '0'],
      BrightnessContrastAfterScan: [profileData.BrightnessContrastAfterScan || 'false'],
      ForcePageSize: [profileData.ForcePageSize || 'false'],
      ForcePageSizeCrop: [profileData.ForcePageSizeCrop || 'false'],
      TwainImpl: [profileData.TwainImpl || 'Default'],
      TwainProgress: [profileData.TwainProgress || 'false'],
      ExcludeBlankPages: [profileData.ExcludeBlankPages || 'false'],
      BlankPageWhiteThreshold: [profileData.BlankPageWhiteThreshold || '70'],
      BlankPageCoverageThreshold: [profileData.BlankPageCoverageThreshold || '25'],
      WiaOffsetWidth: [profileData.WiaOffsetWidth || 'false'],
      WiaRetryOnFailure: [profileData.WiaRetryOnFailure || 'false'],
      WiaDelayBetweenScans: [profileData.WiaDelayBetweenScans || 'false'],
      WiaDelayBetweenScansSeconds: [profileData.WiaDelayBetweenScansSeconds || '2'],
      WiaVersion: [profileData.WiaVersion || 'Default'],
      FlipDuplexedPages: [profileData.FlipDuplexedPages || 'false'],
      KeyValueOptions: [{ $: { 'xsi:nil': 'true' } }]
    };

    // Lire le fichier XML existant
    const xmlObj = await readProfilesXml();
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];

    // Ajouter le nouveau profil
    profiles.push(newProfile);

    // Mettre à jour la structure XML
    xmlObj.ArrayOfScanProfile.ScanProfile = profiles;

    // Sauvegarder le fichier
    await writeProfilesXml(xmlObj);

    return newProfile;
  } catch (error) {
    throw new Error(`Erreur lors de l'ajout du profil: ${error.message}`);
  }
}

// FONCTION CORRIGÉE : Mise à jour d'un profil
async function updateProfileByDisplayName(displayName, updatedParams) {
  try {
    const xmlObj = await readProfilesXml();
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
    const profileIndex = profiles.findIndex((p) => p?.DisplayName?.[0] === displayName);
    
    if (profileIndex === -1) {
      throw new Error("Profil non trouvé");
    }

    const profile = profiles[profileIndex];
    
    // Liste des champs qui doivent garder xsi:nil="true" quand ils sont vides/null
    const nullableFields = [
      'IconUri', 'ConnectionUri', 'Caps', 'CustomPageSizeName', 
      'CustomPageSize', 'AutoSaveSettings', 'KeyValueOptions'
    ];
    
    // Fonction pour mettre à jour de manière récursive en préservant la structure
    function updateNestedValue(obj, keyPath, value) {
      const keys = keyPath.split('.');
      let current = obj;
      
      // Naviguer jusqu'au parent de la clé finale
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] && Array.isArray(current[key]) && current[key][0]) {
          current = current[key][0];
        } else if (current[key]) {
          current = current[key];
        } else {
          // Créer la structure manquante si nécessaire
          current[key] = [{}];
          current = current[key][0];
        }
      }
      
      const finalKey = keys[keys.length - 1];
      
      // Vérifier si ce champ doit garder sa structure xsi:nil
      if (nullableFields.includes(finalKey) && 
          current[finalKey] && 
          Array.isArray(current[finalKey]) && 
          current[finalKey][0] && 
          current[finalKey][0].$ && 
          current[finalKey][0].$.hasOwnProperty('xsi:nil')) {
        // Ne pas modifier les champs avec xsi:nil="true" à moins que ce soit explicitement demandé
        if (value !== 'false' && value !== false) {
          current[finalKey][0] = value;
        }
        return;
      }
      
      // Convertir les valeurs checkbox "on" en "true"
      if (value === 'on') {
        value = 'true';
      }
      
      // Mettre à jour la valeur finale en préservant la structure de tableau
      if (current[finalKey] && Array.isArray(current[finalKey])) {
        current[finalKey][0] = value;
      } else {
        current[finalKey] = [value];
      }
    }
    
    // Appliquer toutes les mises à jour
    for (const [keyPath, value] of Object.entries(updatedParams)) {
      updateNestedValue(profile, keyPath, value);
    }
    
    // Sauvegarder le fichier XML mis à jour
    await writeProfilesXml(xmlObj);
    
    return true;
  } catch (error) {
    throw new Error(`Erreur lors de la mise à jour du profil: ${error.message}`);
  }
}

async function deleteProfileByDisplayName(displayName) {
  const xmlObj = await readProfilesXml();
  const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
  const index = profiles.findIndex((p) => p?.DisplayName?.[0] === displayName);
  if (index === -1) throw new Error("Profil non trouvé");

  const deletedProfile = profiles.splice(index, 1)[0];
  await writeProfilesXml(xmlObj);

  const backupFile = path.join(backupDir, `${displayName}_${Date.now()}.json`);
  await fs.promises.writeFile(
    backupFile,
    JSON.stringify({ originalName: displayName, profile: deletedProfile, deletedAt: new Date() }, null, 2)
  );

  return deletedProfile;
}

function getDeletedProfiles() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const content = fs.readFileSync(path.join(backupDir, f), "utf-8");
      return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
}

async function restoreProfile(backupFileName) {
  const backupPath = path.join(backupDir, backupFileName);
  if (!fs.existsSync(backupPath)) throw new Error("Fichier de backup non trouvé");

  const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const xmlObj = await readProfilesXml();
  const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];

  if (profiles.find((p) => p?.DisplayName?.[0] === backupContent.originalName)) {
    throw new Error(`Un profil avec le DisplayName "${backupContent.originalName}" existe déjà`);
  }

  profiles.push(backupContent.profile);
  await writeProfilesXml(xmlObj);
  await fs.promises.unlink(backupPath);

  return backupContent.originalName;
}

// --- EXPORTS ---
module.exports = {
  addProfile,
  getAllProfiles,
  getProfileByDisplayName,
  updateProfileByDisplayName,
  deleteProfileByDisplayName,
  getDeletedProfiles,
  restoreProfile,
};