import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { practices, practiceTitles } from "../src/lib/companion-practices";
import { dialogueCards } from "../src/lib/companion-dialogue-cards";

async function main() {
  const directory = process.argv[2];
  if (!directory)
    throw new Error("Pass the output directory for practice Markdown files");
  await mkdir(directory, { recursive: true });
  const bundled = [...practices.map(p => ({
    id: p.id, title: practiceTitles[p.id], text: p.guidance, source: p.source,
  })), ...dialogueCards];
  for (const practice of bundled) {
    const title = practice.title;
    if (!title) throw new Error("Missing practice title: " + practice.id);
    const body = [
      "# " + title,
      practice.text,
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
  console.log(bundled.length + files.length + " practice files exported");
}

void main();
