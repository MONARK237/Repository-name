// server.js
// Petit serveur qui génère des mini apps Telegram via l'API Claude,
// et garde un historique dans un fichier JSON local.

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "apps.json");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "⚠️  ANTHROPIC_API_KEY manquante. Ajoute-la dans les variables d'environnement."
  );
}

// Charge (ou crée) la petite base de données JSON
function readDB() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Génère une mini app à partir d'une description
app.post("/generate", async (req, res) => {
  const { description } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: "Description manquante." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `Tu es un générateur de mini apps web pour Telegram. Génère UNIQUEMENT le code d'un fichier HTML autonome (HTML+CSS+JS inline, sans dépendance externe sauf éventuellement le SDK Telegram via <script src="https://telegram.org/js/telegram-web-app.js"></script>) qui implémente l'app décrite. Design sombre adapté à Telegram, code commenté en français. Réponds uniquement avec le code, sans balises markdown.

Description : "${description}"`,
          },
        ],
      }),
    });

    const data = await response.json();
    const code = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .replace(/^```(html|javascript)?\n?/i, "")
      .replace(/```$/i, "")
      .trim();

    // Sauvegarde dans l'historique
    const db = readDB();
    const entry = {
      id: Date.now().toString(36),
      description,
      code,
      createdAt: new Date().toISOString(),
    };
    db.push(entry);
    writeDB(db);

    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la génération." });
  }
});

// Liste l'historique des apps générées
app.get("/apps", (req, res) => {
  res.json(readDB());
});

// Récupère une app précise par id
app.get("/apps/:id", (req, res) => {
  const db = readDB();
  const found = db.find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "Introuvable." });
  res.json(found);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
