const portraitFilesByTemplateId: Record<string, string> = {
  "fire-eater": "fire-eater.png",
  "chrome-viper": "chrome-viper.png",
  "neon-shade": "neon-shade.png",
  "byte-ronin": "byte-ronin.png",
  "custom-ninja": "masked-agent.png",
  "clone-yakuza": "clone-yakuza.jpg",
  "motor-yabu": "motor-yabu.jpg",
  "mexico-lion": "mexico-lion.jpg",
  suicide: "suicide.jpg",
};

const fallbackPortraits = [
  "ronin-guard.png",
  "street-doc.png",
  "data-monk.png",
  "masked-agent.png",
];

export function portraitUrlForTemplateId(templateId: string): string {
  const file = portraitFilesByTemplateId[templateId] ?? fallbackPortraitFor(templateId);
  return `${import.meta.env.BASE_URL}assets/portraits/${file}`;
}

function fallbackPortraitFor(templateId: string): string {
  const hash = Array.from(templateId).reduce((total, char) => total + char.charCodeAt(0), 0);
  return fallbackPortraits[hash % fallbackPortraits.length];
}
