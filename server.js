import express from "express";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/commands", async (req, res) => {
  try {
    const commandsDir = path.join(__dirname, "public", "commands");
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });

    const modules = entries
      .filter((e) => e.isFile() && e.name.endsWith(".js"))
      .map((e) => `/commands/${e.name}`)
      .filter((p) => !p.endsWith("/index.js"));

    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
