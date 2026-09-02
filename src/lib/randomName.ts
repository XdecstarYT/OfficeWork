const NAME_ADJECTIVES = ["Northwind", "Summit", "Cedar", "Harbor", "Bright", "Silverline", "Riverside", "Granite"];
const NAME_NOUNS = ["Logistics", "Ventures", "Partners", "Solutions", "Holdings", "Collective", "& Co", "Group"];

export function randomCompanyName(): string {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adj} ${noun}`;
}
