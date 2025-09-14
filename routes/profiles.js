const express = require("express");
const router = express.Router();
const controller = require("../controllers/profilesController");

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: Gestion des profils de traitement
 */
router.get("/", controller.getProfiles);
/**
 * @swagger
 * /profiles:
 *   get:
 *     summary: Liste tous les profils disponibles
 *     tags: [Profiles]
 *     responses:
 *       200:
 *         description: Liste des profils récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "default"
 *                       description:
 *                         type: string
 *                         example: "Profil par défaut"
 *                       config:
 *                         type: object
 *                         example: {"lang": "fra", "ocr": true}
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */



/**
 * @swagger
 * /profiles/add:
 *   post:
 *     summary: Ajoute un nouveau profil
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Profile'
 *           example:
 *             name: "mon_profil_ocr"
 *             config:
 *               lang: "eng"
 *               ocr: true
 *               format: "pdf"
 *               quality: "medium"
 *               preprocessing: true
 *     responses:
 *       201:
 *         description: Profil créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Profil 'mon_profil_ocr' créé avec succès"
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Profil existe déjà
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/add", controller.createProfile);

/**
 * @swagger
 * /profiles/{name}:
 *   get:
 *     summary: Récupère un profil spécifique par son nom
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du profil
 *         example: "default"
 *     responses:
 *       200:
 *         description: Profil trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profil non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Met à jour un profil existant
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du profil à modifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 description: Nouvelle configuration du profil
 *           example:
 *             config:
 *               lang: "deu"
 *               ocr: false
 *               format: "txt"
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Profil non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Supprime un profil
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du profil à supprimer
 *     responses:
 *       200:
 *         description: Profil supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Profil non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Suppression interdite (profil système)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:name", controller.getProfile);
router.put("/:name", controller.updateProfile);
router.delete("/:name", controller.deleteProfile);

module.exports = router;