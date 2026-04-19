import express from "express";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = process.env.PORT || 6767;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/apps", async (req, res) => {
  try {
    const appsDir = path.join(__dirname, "public", "apps");
    const entries = await fs.readdir(appsDir, { withFileTypes: true });

    const modules = entries
      .filter((e) => e.isFile() && e.name.endsWith(".js"))
      .map((e) => `/apps/${e.name}`)
      .filter((p) => !p.endsWith("/index.js"));

    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

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

app.get("/api/latest-video", async (req, res) => {
  try {
    const handle = String(req.query.handle ?? "").replace(/^@/, "").trim();
    if (!handle) {
      res.status(400).json({ error: "Missing handle" });
      return;
    }

    const channelPageUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}/videos`;
    const pageRes = await fetch(channelPageUrl, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!pageRes.ok) {
      res.status(502).json({ error: `Failed to fetch channel page: ${pageRes.status}` });
      return;
    }

    const html = await pageRes.text();

    const channelId =
      html.match(/\"channelId\"\s*:\s*\"(UC[0-9A-Za-z_-]{20,})\"/)?.[1] ??
      html.match(/\"externalId\"\s*:\s*\"(UC[0-9A-Za-z_-]{20,})\"/)?.[1] ??
      html.match(/\"browseId\"\s*:\s*\"(UC[0-9A-Za-z_-]{20,})\"/)?.[1] ??
      html.match(/https:\/\/www\.youtube\.com\/channel\/(UC[0-9A-Za-z_-]{20,})/)?.[1] ??
      html.match(/\/channel\/(UC[0-9A-Za-z_-]{20,})/)?.[1];

    if (!channelId) {
      const isConsent = /consent\.youtube\.com|before you continue|consent/gi.test(html);
      res.status(502).json({
        error: "Could not resolve channelId from handle",
        details: {
          step: "resolve_channel_id",
          url: channelPageUrl,
          possibleConsentPage: isConsent,
        },
      });
      return;
    }

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feedRes = await fetch(feedUrl, { headers: { "user-agent": "Mozilla/5.0", accept: "application/xml" } });
    if (!feedRes.ok) {
      res.status(502).json({ error: `Failed to fetch feed: ${feedRes.status}`, details: { step: "fetch_feed", feedUrl } });
      return;
    }

    const xml = await feedRes.text();
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    const entryXml = entryMatch?.[1] ?? "";
    const videoId = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entryXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const published = entryXml.match(/<published>([^<]+)<\/published>/)?.[1];

    if (!videoId) {
      res.status(502).json({ error: "Could not parse latest video from feed", details: { step: "parse_feed", feedUrl } });
      return;
    }

    res.json({ handle, channelId, videoId, title: title ?? "", published: published ?? "" });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
