//require("dotenv").config();
//const axios = require("axios");
const modelMap = {
  fr: "ml6team/mbart-large-cc25-cnn-dailymail-xsum-fr",
  ar: "csebuetnlp/mT5_multilingual_XLSum",
  en: "facebook/bart-large-cnn",
};

exports.summarize = async (text, lang = "en") => {
  const model = modelMap[lang] || modelMap["en"];

  // 📌 Préparation du texte selon la langue et le modèle
  let inputText = text;

  if (lang === "ar") {
    inputText = `arabic: ${text}`; // obligatoire pour ce modèle
  } else if (lang === "fr") {
    inputText = `summarize: ${text}`; // pour mBART, ce préfixe fonctionne
  } else {
    inputText = `summarize: ${text}`; // anglais
  }

  // 📌 Limite de sécurité
  const trimmedText = inputText.length > 3000 ? inputText.slice(0, 3000) : inputText;

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      { inputs: trimmedText },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    return (
      response.data[0]?.summary_text ||
      response.data[0]?.generated_text ||
      "❗ Aucun résumé généré."
    );
  } catch (error) {
    console.error("❌ Erreur Hugging Face :", error.response?.data || error.message);
    return "❌ Erreur lors du résumé.";
  }
};
