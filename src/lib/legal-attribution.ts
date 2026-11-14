import type { LocaleId } from "./i18n";

/** Factual disclosure of the public site's advertising attribution. */
export const ATTRIBUTION_PRIVACY: Record<LocaleId, { updated: string; paragraph: string }> = {
  ru: {
    updated: "Редакция от 14 ноября 2026 года",
    paragraph: "8.3. Для оценки рекламы сайт связывает визит с подтверждённым запуском бота Telegram или MAX по ссылке или QR-коду. ClientID Метрики, yclid и случайная метка хранятся на сервере до 10 дней; cookie between_acquisition сохраняет метку на тот же срок. В Яндекс Метрику передаются идентификаторы визита или клика, мессенджер и время запуска. Имя, идентификатор аккаунта мессенджера, переписка и содержимое Дневника в эту передачу не входят.",
  },
  en: {
    updated: "Revision of 14 November 2026",
    paragraph: "8.3. To measure advertising, the site links a visit to a confirmed Telegram or MAX bot start through a link or QR code. Metrika ClientID, yclid and a random reference are stored on the server for up to 10 days; the between_acquisition cookie keeps the reference for the same period. Yandex Metrika receives visit or click identifiers, the messenger and start time. Names, messenger account IDs, messages and journal content are excluded from this transfer.",
  },
  uk: {
    updated: "Редакція від 14 листопада 2026 року",
    paragraph: "8.3. Для оцінки реклами сайт пов’язує візит із підтвердженим запуском бота Telegram або MAX за посиланням чи QR-кодом. ClientID Метрики, yclid і випадкова мітка зберігаються на сервері до 10 днів; cookie between_acquisition зберігає мітку на той самий строк. Яндекс Метрика отримує ідентифікатори візиту або кліку, месенджер і час запуску. Ім’я, ідентифікатор акаунта месенджера, листування та вміст щоденника не передаються.",
  },
  es: {
    updated: "Edición del 14 de noviembre de 2026",
    paragraph: "8.3. Para medir la publicidad, el sitio vincula una visita con el inicio confirmado del bot de Telegram o MAX mediante un enlace o QR. ClientID de Metrika, yclid y una referencia aleatoria se guardan en el servidor hasta 10 días; la cookie between_acquisition conserva la referencia el mismo plazo. Yandex Metrika recibe identificadores de visita o clic, el mensajero y la hora de inicio. No se envían nombres, identificadores de cuentas del mensajero, conversaciones ni contenido del diario.",
  },
  pt: {
    updated: "Edição de 14 de novembro de 2026",
    paragraph: "8.3. Para medir a publicidade, o site associa uma visita ao início confirmado do bot no Telegram ou MAX por link ou QR. ClientID do Metrika, yclid e uma referência aleatória ficam no servidor por até 10 dias; o cookie between_acquisition mantém a referência pelo mesmo prazo. O Yandex Metrika recebe identificadores da visita ou clique, o mensageiro e a hora de início. Nomes, identificadores de contas do mensageiro, conversas e conteúdo do diário não são enviados.",
  },
  tr: {
    updated: "14 Kasım 2026 sürümü",
    paragraph: "8.3. Reklamı ölçmek için site, ziyareti bağlantı veya QR ile doğrulanan Telegram ya da MAX bot başlangıcına bağlar. Metrika ClientID, yclid ve rastgele referans sunucuda en fazla 10 gün tutulur; between_acquisition çerezi referansı aynı süre saklar. Yandex Metrika ziyaret veya tıklama tanımlayıcılarını, mesajlaşma platformunu ve başlangıç zamanını alır. Ad, mesajlaşma hesabı kimliği, yazışmalar ve günlük içeriği aktarılmaz.",
  },
  id: {
    updated: "Revisi 14 November 2026",
    paragraph: "8.3. Untuk mengukur iklan, situs menghubungkan kunjungan dengan dimulainya bot Telegram atau MAX yang dikonfirmasi melalui tautan atau QR. ClientID Metrika, yclid dan referensi acak disimpan di server hingga 10 hari; cookie between_acquisition menyimpan referensi selama waktu yang sama. Yandex Metrika menerima pengenal kunjungan atau klik, platform pesan dan waktu mulai. Nama, ID akun pesan, percakapan dan isi jurnal tidak dikirim.",
  },
  vi: {
    updated: "Bản sửa đổi ngày 14 tháng 11 năm 2026",
    paragraph: "8.3. Để đo quảng cáo, trang web liên kết lượt truy cập với lần khởi động bot Telegram hoặc MAX được xác nhận qua liên kết hoặc QR. ClientID Metrika, yclid và mã ngẫu nhiên được lưu trên máy chủ tối đa 10 ngày; cookie between_acquisition giữ mã trong cùng thời hạn. Yandex Metrika nhận mã lượt truy cập hoặc lượt nhấp, nền tảng nhắn tin và thời điểm khởi động. Tên, ID tài khoản nhắn tin, hội thoại và nội dung nhật ký không được gửi.",
  },
  ar: {
    updated: "إصدار 14 نوفمبر 2026",
    paragraph: "8.3. لقياس الإعلانات، يربط الموقع الزيارة ببدء مؤكد لبوت Telegram أو MAX عبر رابط أو رمز QR. يُحفظ ClientID الخاص بـMetrika وyclid ومرجع عشوائي على الخادم لمدة تصل إلى 10 أيام؛ وتحفظ cookie المسماة between_acquisition المرجع للمدة نفسها. تتلقى Yandex Metrika معرّفات الزيارة أو النقرة ومنصة المراسلة ووقت البدء. لا تُرسل الأسماء أو معرّفات حسابات المراسلة أو المحادثات أو محتوى اليوميات.",
  },
  fa: {
    updated: "ویرایش ۱۴ نوامبر ۲۰۲۶",
    paragraph: "8.3. برای سنجش تبلیغات، سایت بازدید را به شروع تأییدشدهٔ ربات Telegram یا MAX از طریق پیوند یا QR مرتبط می‌کند. ClientID متریکا، yclid و یک مرجع تصادفی تا ۱۰ روز در سرور نگهداری می‌شوند؛ کوکی between_acquisition مرجع را برای همین مدت نگه می‌دارد. Yandex Metrika شناسهٔ بازدید یا کلیک، پیام‌رسان و زمان شروع را دریافت می‌کند. نام، شناسهٔ حساب پیام‌رسان، گفتگوها و محتوای دفتر ارسال نمی‌شوند.",
  },
  hi: {
    updated: "14 नवंबर 2026 का संस्करण",
    paragraph: "8.3. विज्ञापन मापने के लिए साइट विज़िट को लिंक या QR से पुष्टि किए गए Telegram या MAX बॉट शुरू होने से जोड़ती है. Metrika ClientID, yclid और एक यादृच्छिक संदर्भ सर्वर पर अधिकतम 10 दिन रहते हैं; between_acquisition कुकी संदर्भ को उतने ही समय रखती है. Yandex Metrika को विज़िट या क्लिक पहचान, मैसेंजर और शुरू होने का समय मिलता है. नाम, मैसेंजर खाते की पहचान, बातचीत और डायरी की सामग्री नहीं भेजी जाती.",
  },
  uz: {
    updated: "2026-yil 14-noyabr tahriri",
    paragraph: "8.3. Reklamani o‘lchash uchun sayt tashrifni havola yoki QR orqali tasdiqlangan Telegram yoki MAX botining ishga tushishi bilan bog‘laydi. Metrika ClientID, yclid va tasodifiy belgi serverda 10 kungacha saqlanadi; between_acquisition cookie belgini shu muddat saqlaydi. Yandex Metrika tashrif yoki bosish identifikatori, messenjer va boshlanish vaqtini oladi. Ism, messenjer hisobi identifikatori, yozishmalar va kundalik mazmuni yuborilmaydi.",
  },
};
