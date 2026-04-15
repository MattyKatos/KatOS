export default {
  name: "about",
  description: "About KatOS",
  run: async () => {
    return [
      { type: "typed", text: "About KatOS", speed: 10 },
      { type: "text", text: "# Matty Katos creates content, but is not a content creator.", muted: true },
      { type: "text", text: "$ ls ./about", muted: true },
      { type: "link", href: "https://youtube.com/@mattykatos", text: "youtube.html" },
      { type: "link", href: "https://twitch.tv/mattykatos", text: "twitch.html" },
      { type: "link", href: "https://github.com/mattykatos", text: "github.html" },
    ];
  },
};
