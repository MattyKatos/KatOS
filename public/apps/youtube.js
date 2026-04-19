export default {
  id: "youtube",
  title: "YouTube",
  order: 10,
  iconGlyph: "YT",
  create: () => {
    const el = document.createElement("div");
    el.className = "webapp";

    const header = document.createElement("div");
    header.className = "webapp__header";

    const title = document.createElement("div");
    title.className = "webapp__title";
    title.textContent = "Loading latest video...";

    const openBtn = document.createElement("a");
    openBtn.href = "https://www.youtube.com/@mattykatos";
    openBtn.target = "_blank";
    openBtn.rel = "noreferrer";
    openBtn.textContent = "Open on YouTube";

    header.appendChild(title);
    header.appendChild(openBtn);

    const body = document.createElement("div");
    body.className = "webapp__body";

    const frame = document.createElement("iframe");
    frame.className = "webapp__frame";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    body.appendChild(frame);

    el.appendChild(header);
    el.appendChild(body);

    async function loadLatest() {
      const res = await fetch("/api/latest-video?handle=mattykatos", { headers: { Accept: "application/json" } });
      if (!res.ok) {
        title.textContent = `Failed to load latest video (${res.status})`;
        frame.remove();
        return;
      }
      const data = await res.json();
      const videoId = data?.videoId;
      if (!videoId) {
        title.textContent = "Failed to load latest video";
        frame.remove();
        return;
      }
      title.textContent = data?.title ? `Latest: ${data.title}` : "Latest video";
      openBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      frame.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }

    return {
      el,
      async boot() {
        await loadLatest();
      },
    };
  },
};
