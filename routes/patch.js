const express = require("express");
const patchService = require("../services/patchService");
const router = express.Router();
const { generatePatchOnly } = require('../controllers/fileProcessor');
 
/**
 * @swagger
 * tags:
 *   name: Patch
 *   description: Gestion des patches et découpage de PDF
 */

/**
 * @swagger
 * /patch/split:
 *   post:
 *     summary: Découpage d'un PDF par patch
 *     tags: [Patch]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchSplitRequest'
 *           example:
 *             pdfPath: "/uploads/document.pdf"
 *             patchMode: "auto"
 *             lang: "fra"
 *             naming: "sequential"
 *             namingPattern: "page_{n}"
 *             ocrMode: "true"
 *             containsPatch: "false"
 *     responses:
 *       200:
 *         description: Découpage réussi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PatchSplitResponse'
 *             example:
 *               success: true
 *               results:
 *                 - filename: "page_1.pdf"
 *                   path: "/outputs/page_1.pdf"
 *                 - filename: "page_2.pdf"
 *                   path: "/outputs/page_2.pdf"
 *       400:
 *         description: Paramètres manquants ou invalides
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "pdfPath est obligatoire"
 *       500:
 *         description: Erreur lors du découpage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Erreur split: Fichier PDF corrompu"
 */
// 📂 Découpage d'un PDF par patch
router.post("/split", async (req, res) => {
  try {
    const { pdfPath, patchMode, lang, naming, namingPattern, ocrMode, containsPatch } = req.body;
    if (!pdfPath) return res.status(400).send("pdfPath est obligatoire");
    
    const results = await patchService.splitByPatch(pdfPath, {
      patchMode,
      lang,
      naming,
      namingPattern,
      ocrMode: ocrMode === 'true',
      containsPatch: containsPatch === 'true'
    });
    
    res.json({ success: true, results });
  } catch (err) {
    console.error("Erreur split:", err);
    res.status(500).json({ success: false, message: "Erreur split: " + err.message });
  }
});

/**
 * @swagger
 * /patch/generatePatch:
 *   post:
 *     summary: Génération de patch uniquement
 *     tags: [Patch]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier à traiter pour la génération de patch
 *               options:
 *                 type: string
 *                 description: Options de génération en JSON
 *     responses:
 *       200:
 *         description: Patch généré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Fichier manquant ou invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erreur lors de la génération
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/generatePatch', generatePatchOnly);

module.exports = router;