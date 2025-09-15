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
  const profile = profiles.find((p) => p?.DisplayName?.[0] === displayName);
  if (!profile) return null;

  // Normalisation DeviceID / DeviceName
  if (profile.Device && profile.Device[0]) {
    profile.DeviceID = profile.Device[0].ID ? profile.Device[0].ID[0] : null;
    profile.DeviceName = profile.Device[0].Name ? profile.Device[0].Name[0] : null;
  }

  return profile;
}

// MÉTHODE CORRIGÉE : Ajouter un nouveau profil avec gestion améliorée des champs Device
async function addProfile(profileData) {
  try {
    console.log("Données reçues pour addProfile:", JSON.stringify(profileData, null, 2));
    
    // Vérifier si un profil avec ce DisplayName existe déjà
    const existingProfile = await getProfileByDisplayName(profileData.DisplayName);
    if (existingProfile) {
      throw new Error("Un profil avec ce nom existe déjà");
    }

    // Extraction des données Device avec gestion des cas vides
    const deviceID = profileData['Device.ID'] || profileData.DeviceID || 'TWAIN2 FreeImage Software Scanner';
    const deviceName = profileData['Device.Name'] || profileData.DeviceName || 'TWAIN2 FreeImage Software Scanner';
    
    console.log("Device ID extrait:", deviceID);
    console.log("Device Name extrait:", deviceName);

    // Construire l'objet de profil avec les données reçues
    const newProfile = {
      Version: [profileData.Version || '5'],
      Device: [{
        ID: [deviceID],
        Name: [deviceName],
        IconUri: [{ $: { 'xsi:nil': 'true' } }],
        ConnectionUri: [{ $: { 'xsi:nil': 'true' } }]
      }],
      Caps: [{
        PaperSources: [profileData.PaperSources || 'Glass,Feeder'],
        FeederCheck: [profileData.FeederCheck || 'true'],
        Glass: [{ 
          ScanArea: [profileData['Glass.ScanArea'] || '8,5x14 in'],
          Resolutions: [profileData['Glass.Resolutions'] || '50,100,150,200,300,400,600'] 
        }],
        Feeder: [{ 
          ScanArea: [profileData['Feeder.ScanArea'] || '8,5x14 in'],
          Resolutions: [profileData['Feeder.Resolutions'] || '50,100,150,200,300,400,600'] 
        }],
        Duplex: [profileData.Duplex || '']
      }],
      DriverName: [profileData.DriverName || 'twain'],
      DisplayName: [profileData.DisplayName],
      IconID: [profileData.IconID || '0'],
      MaxQuality: [profileData.MaxQuality === 'on' ? 'true' : (profileData.MaxQuality || 'false')],
      IsDefault: [profileData.IsDefault === 'on' ? 'true' : (profileData.IsDefault || 'false')],
      UseNativeUI: [profileData.UseNativeUI === 'on' ? 'true' : (profileData.UseNativeUI || 'false')],
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
      EnableAutoSave: [profileData.EnableAutoSave === 'on' ? 'true' : (profileData.EnableAutoSave || 'false')],
      AutoSaveSettings: [{ $: { 'xsi:nil': 'true' } }],
      Quality: [profileData.Quality || '75'],
      AutoDeskew: [profileData.AutoDeskew === 'on' ? 'true' : (profileData.AutoDeskew || 'false')],
      RotateDegrees: [profileData.RotateDegrees || '0'],
      BrightnessContrastAfterScan: [profileData.BrightnessContrastAfterScan === 'on' ? 'true' : (profileData.BrightnessContrastAfterScan || 'false')],
      ForcePageSize: [profileData.ForcePageSize === 'on' ? 'true' : (profileData.ForcePageSize || 'false')],
      ForcePageSizeCrop: [profileData.ForcePageSizeCrop === 'on' ? 'true' : (profileData.ForcePageSizeCrop || 'false')],
      TwainImpl: [profileData.TwainImpl || 'Default'],
      TwainProgress: [profileData.TwainProgress === 'on' ? 'true' : (profileData.TwainProgress || 'false')],
      ExcludeBlankPages: [profileData.ExcludeBlankPages === 'on' ? 'true' : (profileData.ExcludeBlankPages || 'false')],
      BlankPageWhiteThreshold: [profileData.BlankPageWhiteThreshold || '70'],
      BlankPageCoverageThreshold: [profileData.BlankPageCoverageThreshold || '25'],
      WiaOffsetWidth: [profileData.WiaOffsetWidth === 'on' ? 'true' : (profileData.WiaOffsetWidth || 'false')],
      WiaRetryOnFailure: [profileData.WiaRetryOnFailure === 'on' ? 'true' : (profileData.WiaRetryOnFailure || 'false')],
      WiaDelayBetweenScans: [profileData.WiaDelayBetweenScans === 'on' ? 'true' : (profileData.WiaDelayBetweenScans || 'false')],
      WiaDelayBetweenScansSeconds: [profileData.WiaDelayBetweenScansSeconds || '2'],
      WiaVersion: [profileData.WiaVersion || 'Default'],
      FlipDuplexedPages: [profileData.FlipDuplexedPages === 'on' ? 'true' : (profileData.FlipDuplexedPages || 'false')],
      KeyValueOptions: [{ $: { 'xsi:nil': 'true' } }]
    };

    console.log("Profil construit:", JSON.stringify(newProfile, null, 2));

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
    console.error("Erreur détaillée dans addProfile:", error);
    throw new Error(`Erreur lors de l'ajout du profil: ${error.message}`);
  }
}

// FONCTION CORRIGÉE : Mise à jour d'un profil avec gestion améliorée des champs Device
async function updateProfileByDisplayName(displayName, updatedParams) {
  try {
    console.log("Mise à jour du profil:", displayName);
    console.log("Paramètres reçus:", JSON.stringify(updatedParams, null, 2));

    const xmlObj = await readProfilesXml();
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
    const profileIndex = profiles.findIndex((p) => p?.DisplayName?.[0] === displayName);
    
    if (profileIndex === -1) {
      throw new Error("Profil non trouvé");
    }

    const profile = profiles[profileIndex];
    
    // Liste des champs qui doivent garder xsi:nil="true" quand ils sont vides/null
    const nullableFields = [
      'IconUri', 'ConnectionUri', 'CustomPageSizeName', 
      'CustomPageSize', 'AutoSaveSettings', 'KeyValueOptions'
    ];
    
    // Fonction pour mettre à jour de manière récursive en préservant la structure
    function updateNestedValue(obj, keyPath, value) {
      const keys = keyPath.split('.');
      let current = obj;
      
      // Gestion spéciale pour les champs Device
      if (keys[0] === 'Device') {
        if (!current.Device || !current.Device[0]) {
          current.Device = [{}];
        }
        const deviceKey = keys[1]; // ID ou Name
        if (!current.Device[0][deviceKey]) {
          current.Device[0][deviceKey] = [''];
        }
        current.Device[0][deviceKey][0] = value || '';
        console.log(`Mise à jour Device.${deviceKey}:`, value);
        return;
      }

      // Gestion spéciale pour les champs Caps
      if (keys[0] === 'Caps') {
        if (!current.Caps || !current.Caps[0]) {
          current.Caps = [{}];
        }
        
        if (keys.length === 2) {
          // Champ direct dans Caps (ex: PaperSources, FeederCheck, Duplex)
          current.Caps[0][keys[1]] = [value];
          return;
        } else if (keys.length === 3) {
          // Champ imbriqué (ex: Glass.ScanArea, Feeder.Resolutions)
          const subSection = keys[1]; // Glass ou Feeder
          const subKey = keys[2]; // ScanArea ou Resolutions
          
          if (!current.Caps[0][subSection] || !current.Caps[0][subSection][0]) {
            current.Caps[0][subSection] = [{}];
          }
          current.Caps[0][subSection][0][subKey] = [value];
          return;
        }
      }
      
      // Navigation standard pour les autres champs
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
        if (value !== null && value !== undefined && value !== '') {
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
    
    console.log("Profil mis à jour avec succès");
    return true;
  } catch (error) {
    console.error("Erreur détaillée dans updateProfile:", error);
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