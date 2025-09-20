// controllers/profilesController.js
const {
  addProfile,
  getAllProfiles,
  getProfileByDisplayName,
  updateProfileByDisplayName,
  deleteProfileByDisplayName,
  getDeletedProfiles,
  restoreProfile
} = require("../services/xmlProfileService"); // <-- ton fichier avec les méthodes xml2js

class ProfilesController {
  // 🔹 Récupère la liste des profils
  async getProfiles(req, res) {
    try {
      const profiles = await getAllProfiles();
      const profileNames = profiles.map(p => p?.DisplayName?.[0]);
      res.json({ success: true, profiles: profileNames });
    } catch (error) {
      console.error("Erreur récupération profils:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 🔹 Récupère un profil spécifique
  async getProfile(req, res) {
    try {
      const profile = await getProfileByDisplayName(req.params.name);
      if (!profile) {
        return res.status(404).json({ success: false, error: "Profil non trouvé" });
      }
      res.json({ success: true, profile });
    } catch (error) {
      console.error("Erreur récupération profil:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 🔹 Crée un nouveau profil
  async createProfile(req, res) {
    try {
      const profile = await addProfile(req.body);
      res.json({ success: true, message: "Profil créé avec succès", profile });
    } catch (error) {
      console.error("Erreur création profil:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // 🔹 Met à jour un profil
  async updateProfile(req, res) {
    try {
      await updateProfileByDisplayName(req.params.name, req.body);
      res.json({ success: true, message: "Profil mis à jour avec succès" });
    } catch (error) {
      console.error("Erreur mise à jour profil:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // 🔹 Supprime un profil
  async deleteProfile(req, res) {
    try {
      await deleteProfileByDisplayName(req.params.name);
      res.json({ success: true, message: "Profil supprimé avec succès" });
    } catch (error) {
      console.error("Erreur suppression profil:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // 🔹 Liste des profils supprimés (backup)
  async getDeleted(req, res) {
    try {
      const deleted = getDeletedProfiles();
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 🔹 Restaurer un profil supprimé
  async restore(req, res) {
    try {
      const restoredName = await restoreProfile(req.params.file);
      res.json({ success: true, message: `Profil "${restoredName}" restauré avec succès` });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProfilesController();
