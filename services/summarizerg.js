require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getPrompt(text, lang) {
  switch (lang) {
    case "fr":
      return `📌 Résumé :\nVoici un texte. Merci de le résumer de manière concise et uniquement en français :\n\n${text}`;
    case "ar":
      return `📌 تلخيص:\nيرجى قراءة النص التالي ثم تقديم ملخص دقيق وموجز باللغة العربية فقط بدون أي لغة أخرى:\n\n${text}`;
    default:
      return `📌 Summary:\nPlease read the following and summarize it clearly and concisely in English only:\n\n${text}`;
  }
}



exports.summarize = async (text, lang = "en") => {
  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

    // Nettoyage de texte arabe
    if (lang === "ar") {
      text = text.replace(/[^\u0600-\u06FF\s]/g, "").replace(/\s+/g, " ").trim();
    }

    const trimmedText = text.length > 3000 ? text.slice(0, 3000) : text;
    const prompt = getPrompt(trimmedText, lang);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = await response.text();

    return summary.trim() || "❗ Aucun résumé généré.";
  } catch (error) {
    console.error("❌ Erreur Gemini :", error.message || error);
    return "❌ Erreur lors du résumé avec Gemini.";
  }
};
