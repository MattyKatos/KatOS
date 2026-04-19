export default {
  id: "mattyclicker",
  title: "MattyClicker",
  order: 20,
  iconGlyph: "+1",
  create: () => {
    const STORAGE_KEY = "katos.mattyclicker.count";

    const el = document.createElement("div");
    el.className = "clicker";

    const header = document.createElement("div");
    header.className = "clicker__header";

    const title = document.createElement("div");
    title.className = "clicker__title";
    title.textContent = "Click make number go up.";

    const countEl = document.createElement("div");
    countEl.className = "clicker__count";

    header.appendChild(title);

    const body = document.createElement("div");
    body.className = "clicker__body";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clicker__btn";
    btn.textContent = "click();";

    const sub = document.createElement("div");
    sub.className = "clicker__sub";
    sub.textContent = "The world is arguably worse with more Matty.";

    body.appendChild(countEl);
    body.appendChild(btn);
    body.appendChild(sub);

    el.appendChild(header);
    el.appendChild(body);

    let count = 0;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const n = Number(raw);
      if (Number.isFinite(n)) count = n;
    } catch {
      // ignore
    }

    function render() {
      countEl.textContent = String(count);
    }

    function save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(count));
      } catch {
        // ignore
      }
    }

    btn.addEventListener("click", () => {
      count += 1;
      render();
      save();
      if (typeof anime !== "undefined") {
        anime({
          targets: btn,
          scale: [1, 1.06, 1],
          duration: 180,
          easing: "easeOutQuad",
        });
      }
    });

    render();

    return {
      el,
      focus() {
        btn.focus();
      },
    };
  },
};
