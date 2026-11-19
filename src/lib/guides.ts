import type { Metadata } from "next";
import { LANDING_ORIGIN, LANDING_OG_IMAGE } from "./landing-seo";

export const guides = {
  emotions: {
    path: "/guides/dnevnik-emotsiy",
    title: "Как вести дневник эмоций: шаблон и пример заполнения",
    description: "Три короткие записи о том, как прошёл вечер. Посмотрите, как назвать чувство, вести дневник настроения и вернуться к своим отметкам в конце недели.",
  },
  therapy: {
    path: "/guides/mezhdu-sessiyami",
    title: "Что записывать между сессиями с психологом",
    description: "Как сохранить момент, который хочется обсудить с психологом, и вспомнить его на встрече. Пример записи, вопросы для подготовки и заметка после сеанса.",
  },
} as const;

export function guideMetadata(key: keyof typeof guides): Metadata {
  const { path, title, description } = guides[key];
  return {
    title: { absolute: `${title} — Between` }, description,
    alternates: { canonical: path },
    openGraph: { type: "article", locale: "ru_RU", siteName: "Between", title, description,
      url: LANDING_ORIGIN + path, images: [LANDING_OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [LANDING_OG_IMAGE] },
  };
}
