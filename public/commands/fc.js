export default {
  name: "fc",
  description: "Eternal Hearth",
  run: async () => {
    return [
      { type: "typed", text: "Eternal Hearth", speed: 10 },
      { type: "text", text: "# I swear we're not a cult.", muted: true },
      { type: "text", text: "$ ls ./fc", muted: true },
      { type: "link", href: "https://ffxivfc.com", text: "website.html" },
      { type: "link", href: "https://forums.ffxivfc.com", text: "forums.html" },
    ];
  },
};
