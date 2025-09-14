const langdetect = require("../services/langDetect");
const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("../controllers/fileProcessor");

const upload = multer({ dest: "uploads/" });

/**
 * @swagger
 * tags:
 *   name: File Processing
 *   description: Traitement et analyse de fichiers
 */

/**
 * @swagger
 * /processFile:
 *   post:
 *     summary: Traitement et analyse d'un fichier uploadé
 *     tags: [File Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier à traiter (PDF, image, etc.)
 *               options:
 *                 type: string
 *                 description: Options de traitement en JSON
 *                 example: '{"lang":"fra","ocr":true,"format":"pdf"}'
 *               profile:
 *                 type: string
 *                 description: Nom du profil de traitement à utiliser
 *                 example: "default"
 *     responses:
 *       200:
 *         description: Fichier traité avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Fichier traité avec succès"
 *                 results:
 *                   type: object
 *                   properties:
 *                     originalFile:
 *                       type: string
 *                       example: "document.pdf"
 *                     processedFile:
 *                       type: string
 *                       example: "document_processed.pdf"
 *                     detectedLanguage:
 *                       type: string
 *                       example: "fra"
 *                     extractedText:
 *                       type: string
 *                       example: "Texte extrait du document..."
 *                     downloadUrl:
 *                       type: string
 *                       example: "/download?name=document_processed.pdf"
 *       400:
 *         description: Fichier manquant ou invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Bad Request"
 *               message: "Aucun fichier fourni"
 *       415:
 *         description: Type de fichier non supporté
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Unsupported Media Type"
 *               message: "Type de fichier non supporté. Formats acceptés: PDF, PNG, JPG, JPEG"
 *       500:
 *         description: Erreur lors du traitement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Internal Server Error"
 *               message: "Erreur lors du traitement OCR"
 */
router.post("/", upload.single("file"), controller.processFile);

module.exports = router;