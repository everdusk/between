import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { practices } from "../src/lib/companion-practices";

const titles: Record<string, string> = {
  repair: "Когда собеседник поправляет тебя",
  listen: "Когда хочется выговориться",
  wording: "Подобрать слова для разговора",
  return: "Возвращение к важному разговору или решению",
  "old-help": "Трудность вернулась. Что раньше помогло?",
  judgment: "Страх чужой оценки. Что обо мне подумают?",
  hurt: "Человека уже задели, высмеяли или унизили",
  anticipation: "Ожидание неприятной реакции, которой пока не было",
  "self-judgment": "Самокритика и жёсткие слова о себе",
  "unclear-feeling": "Сильное чувство с неясной причиной",
  "two-wishes": "Противоречивые желания",
  boundary: "Трудно отказать или обозначить границу",
  "ask-for-help": "Хочется разделить нагрузку",
  "small-change": "Заметить изменение и понять, что помогло",
  rumination: "Мысль возвращается снова и снова",
  "practical-step": "Выбрать первый посильный шаг",
};

async function main() {
  const directory = process.argv[2];
  if (!directory)
    throw new Error("Pass the output directory for practice Markdown files");
  await mkdir(directory, { recursive: true });
  for (const practice of practices) {
    const title = titles[practice.id];
    if (!title) throw new Error("Missing practice title: " + practice.id);
    const body = [
      "# " + title,
      practice.guidance,
      "Источник подхода: " + practice.source,
    ];
    await writeFile(
      join(directory, practice.id + ".md"),
      body.join("\n\n") + "\n",
      "utf8",
    );
  }
  const books = join(__dirname, "../knowledge/companion/books");
  const files = (await readdir(books)).filter((name) =>
    /^(mi|cbt|act)-[a-z-]+\.md$/.test(name),
  );
  for (const name of files) {
    await copyFile(join(books, name), join(directory, name));
  }
  console.log(practices.length + files.length + " practice files exported");
}

void main();
