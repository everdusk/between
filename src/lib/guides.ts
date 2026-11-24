import type { Metadata } from "next";
import { LANDING_ORIGIN } from "./landing-seo";

export const guideIndex = {
  path: "/guides",
  title: "Статьи о дневнике эмоций",
  description: "Как начать дневник эмоций, записать тревожную мысль, разобраться в ссоре и подготовиться к встрече с психологом. Четыре практических разбора с примерами записей.",
  image: "/landing/chapters/overview.webp",
};

export const guides = {
  emotions: {
    path: "/guides/dnevnik-emotsiy",
    title: "Как вести дневник эмоций: шаблон и пример заполнения",
    shortTitle: "Как вести дневник эмоций",
    description: "Шаблон дневника эмоций из трёх вопросов, примеры записей о тревоге и спокойствии и способ сравнить свои отметки в конце недели.",
    image: "/landing/chapters/events.webp",
  },
  worry: {
    path: "/guides/trevoga-pered-snom",
    title: "Тревога перед сном: что записать, когда мысли ходят по кругу",
    shortTitle: "Тревога перед сном",
    description: "Как записать тревожную мысль перед сном, отделить вопрос на завтра от догадки и вернуться к нему утром. Разбираем на примере рабочего сообщения.",
    image: "/landing/chapters/overview.webp",
  },
  anger: {
    path: "/guides/pochemu-sryvayus-na-blizkih",
    title: "Почему я срываюсь на близких и как заметить злость раньше?",
    shortTitle: "Почему я срываюсь на близких",
    description: "На примере ссоры за ужином разбираем, где возникла злость, кому хотелось ответить и как взять паузу. Вопросы для дневника и фразы для разговора.",
    image: "/landing/chapters/feelings.webp",
  },
  therapy: {
    path: "/guides/mezhdu-sessiyami",
    title: "Что записывать между сессиями с психологом",
    shortTitle: "Записи между сессиями с психологом",
    description: "Что записать сразу после важного разговора, как выбрать тему для встречи с психологом и что сохранить после сессии. Пример заметки и вопросы для размышления.",
    image: "/landing/chapters/insights.webp",
  },
} as const;

export type GuideTopic = keyof typeof guides;

export function guideMetadata(key?: GuideTopic): Metadata {
  const { path, title, description, image } = key ? guides[key] : guideIndex;
  return {
    title: { absolute: `${title} — Between` }, description,
    alternates: { canonical: path },
    openGraph: { type: key ? "article" : "website", locale: "ru_RU", siteName: "Between",
      title, description, url: LANDING_ORIGIN + path, images: [image] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export function guideSchema(topic: GuideTopic) {
  const guide = guides[topic];
  const url = LANDING_ORIGIN + guide.path;
  const organization = { "@type": "Organization", name: "Between", url: LANDING_ORIGIN + "/" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", "@id": url + "#article", mainEntityOfPage: url, url, inLanguage: "ru",
        headline: guide.title, description: guide.description, image: LANDING_ORIGIN + guide.image,
        author: organization, publisher: organization },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Between", item: LANDING_ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: guideIndex.title, item: LANDING_ORIGIN + guideIndex.path },
        { "@type": "ListItem", position: 3, name: guide.shortTitle, item: url },
      ] },
    ],
  };
}
