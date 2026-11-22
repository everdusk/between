import { type LocaleId } from "./i18n";
import { translate } from "./messages";
import { WEB_PRIVACY, WEB_TERMS } from "./legal-web";
import { ATTRIBUTION_PRIVACY } from "./legal-attribution";

export const LEGAL_INN = "770507475005";
export const LEGAL_NAME = "Ляторовская Анастасия Борисовна";
export const LEGAL_TERMS_URL = "https://www.between-journal.ru/terms";
export const LEGAL_PRIVACY_URL = "https://www.between-journal.ru/privacy";
export const LEGAL_EMAIL = "help@between-journal.ru";
export const LEGAL_DELETE_URL = "https://www.between-journal.ru/delete";

export type LegalKind = "terms" | "privacy";
export const JOURNAL_PRIVACY: Record<LocaleId, string> = {
  "ru": "Дневник также сохраняет указанное вами имя, выбор режима терапии, ответы рефлексии и выводы по темам. Они удаляются вместе с дневником в настройках аккаунта.",
  "en": "Your journal also stores the name you enter, your therapy preference, reflection answers and topic conclusions. These are erased with your journal in account settings.",
  "es": "El diario también guarda tu nombre, tu preferencia de terapia, tus respuestas de reflexión y tus conclusiones. Se eliminan con el diario en los ajustes de la cuenta.",
  "pt": "O diário guarda também seu nome, sua preferência de terapia, respostas de reflexão e conclusões. Esses dados são apagados com o diário nas configurações da conta.",
  "uk": "Щоденник також зберігає ваше ім’я, вибір режиму терапії, відповіді під час рефлексії та висновки. Їх можна видалити разом зі щоденником у налаштуваннях.",
  "tr": "Günlük adınızı, terapi tercihinizi, düşünme sorularına yanıtlarınızı ve sonuçlarınızı saklar. Hesap ayarlarından günlükle birlikte silinirler.",
  "id": "Jurnal menyimpan nama, pilihan terapi, jawaban refleksi, dan kesimpulan Anda. Semuanya dihapus bersama jurnal melalui pengaturan akun.",
  "vi": "Nhật ký lưu tên, lựa chọn trị liệu, câu trả lời suy ngẫm và kết luận của bạn. Bạn có thể xóa chúng cùng nhật ký trong cài đặt tài khoản.",
  "hi": "डायरी आपका नाम, थेरेपी का विकल्प, चिंतन के जवाब और निष्कर्ष भी रखती है। खाता सेटिंग में डायरी हटाने पर ये भी मिट जाते हैं।",
  "fa": "دفتر نام شما، انتخاب درمان، پاسخ‌های تأمل و نتیجه‌گیری‌ها را هم ذخیره می‌کند. با حذف دفتر از تنظیمات حساب، این داده‌ها نیز پاک می‌شوند.",
  "ar": "تحتفظ اليوميات أيضاً باسمك وخيار العلاج وإجابات التأمل والخلاصات. تُحذف هذه البيانات مع اليوميات من إعدادات الحساب.",
  "uz": "Kundalik ismingiz, terapiya tanlovingiz, mulohaza javoblari va xulosalaringizni ham saqlaydi. Ular hisob sozlamalarida kundalik bilan birga o‘chiriladi."
};
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDoc = { title: string; updated: string; preface?: string[]; sections: LegalSection[] };

/** Site and MAX share this edition. Telegram builds its own documents inside the client. */
export function legalDocument(kind: LegalKind, locale: LocaleId): LegalDoc {
  const book = kind === "terms" ? WEB_TERMS : WEB_PRIVACY;
  const source = book[locale] ?? book.ru;
  const doc = { ...source, preface: [...(source.preface ?? []), translate(locale, "legalInn", { inn: LEGAL_INN })] };
  if (kind !== "privacy") return doc;
  const attribution = ATTRIBUTION_PRIVACY[locale] ?? ATTRIBUTION_PRIVACY.ru;
  return {
    ...doc,
    updated: attribution.updated,
    sections: doc.sections.map((section) => section.heading.startsWith("8.")
      ? { ...section, paragraphs: [...section.paragraphs, attribution.paragraph] }
      : section.heading.startsWith("3.") ? { ...section, paragraphs: [...section.paragraphs, JOURNAL_PRIVACY[locale]] } : section),
  };
}

export function legalLocales(): LocaleId[] {
  return Object.keys(WEB_TERMS) as LocaleId[];
}
