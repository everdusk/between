const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;

type TagRule = { tag: string; words?: string[]; prefixes?: string[] };

/**
 * Short words are exact so «друг» does not mark «другой».
 * Prefixes are stems of 4+ letters with a short tail («мам» → «мамой»).
 */
const RULES: TagRule[] = [
  { tag: "мама", prefixes: ["мам", "матер"] },
  { tag: "папа", words: ["папа", "папу", "папе", "папой", "отец", "отца", "отцу", "отцом"] },
  { tag: "работа", prefixes: ["работ", "офис", "начальн", "коллег", "дедлайн"] },
  {
    tag: "сон",
    words: ["сон", "сна", "сну", "сном", "сны", "сплю", "спал", "спала"],
    prefixes: ["бессон", "засну"],
  },
  { tag: "тревога", prefixes: ["тревог", "паник"] },
  {
    tag: "злость",
    words: ["злой", "злая", "злое", "злые", "злюсь", "злит"],
    prefixes: ["злост", "бешен", "раздраж"],
  },
  { tag: "деньги", prefixes: ["деньг", "денег", "зарплат", "кредит"] },
  { tag: "отношения", prefixes: ["отношен", "партнер", "парень", "девушк", "бывш"] },
  {
    tag: "друзья",
    words: ["друг", "друга", "другу", "другом", "друзья", "друзьями", "друзей"],
    prefixes: ["подруг"],
  },
  { tag: "тело", words: ["тело"], prefixes: ["болел", "голов", "тошн"] },
  { tag: "еда", prefixes: ["аппетит", "голод", "переел", "поела", "поел"] },
  { tag: "одиночество", prefixes: ["одинок"] },
  { tag: "стыд", prefixes: ["стыд", "стыж"] },
  { tag: "вина", prefixes: ["винова", "вину"] },
  { tag: "семья", prefixes: ["семь", "семейн", "родител", "брат", "сестр"] },
  { tag: "учеба", prefixes: ["учеб", "универ", "экзамен", "лекц"] },
  { tag: "дом", prefixes: ["квартир", "сосед"] },
  { tag: "будущее", prefixes: ["будущ"] },
  { tag: "границы", prefixes: ["границ"] },
  { tag: "усталость", prefixes: ["устал"] },
];

function fold(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function tokens(text: string): string[] {
  return fold(text)
    .split(/[^a-zа-я]+/i)
    .filter((token) => token.length >= 3);
}

function ruleHits(words: string[], rule: TagRule): boolean {
  if (rule.words?.some((word) => words.includes(fold(word)))) return true;
  return Boolean(
    rule.prefixes?.some((prefix) => {
      const stem = fold(prefix);
      return words.some(
        (token) =>
          token.startsWith(stem) && token.length <= stem.length + 4,
      );
    }),
  );
}

export function sanitizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const tag = fold(item).replace(/\s+/g, " ");
    if (!tag || tag === "бот") continue;
    if (tag.length > MAX_TAG_LENGTH) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function suggestTags(text: string): string[] {
  const words = tokens(text);
  const found: string[] = [];
  for (const rule of RULES) {
    if (ruleHits(words, rule)) found.push(rule.tag);
  }
  return sanitizeTags(found);
}
