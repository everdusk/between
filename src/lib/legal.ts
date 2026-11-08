import { type LocaleId } from "./i18n";
import { WEB_PRIVACY, WEB_TERMS } from "./legal-web";

export const LEGAL_INN = "770507475005";
export const LEGAL_NAME = "Ляторовская Анастасия Борисовна";
export const LEGAL_TERMS_URL = "https://www.between-journal.ru/terms";
export const LEGAL_PRIVACY_URL = "https://www.between-journal.ru/privacy";
export const LEGAL_EMAIL = "help@between-journal.ru";
export const LEGAL_DELETE_URL = "https://www.between-journal.ru/delete";

export type LegalKind = "terms" | "privacy";
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalSurface = "web" | "telegram";
export type LegalDoc = { title: string; updated: string; preface?: string[]; sections: LegalSection[] };

const BINDING =
  "Если формулировки разойдутся, главный текст — на русском языке.";

type Pair = [heading: string, paragraphs: string[]];

function doc(title: string, updated: string, sections: Pair[], binding = false): LegalDoc {
  const [first, ...rest] = sections;
  const paragraphs = binding ? [...first[1], BINDING] : first[1];
  return {
    title,
    updated,
    sections: [{ heading: first[0], paragraphs }, ...rest.map(([heading, body]) => ({ heading, paragraphs: body }))],
  };
}

const TELEGRAM_TERMS: Record<LocaleId, LegalDoc> = {
  ru: doc("Условия использования", "8 ноября 2026", [
    ["Кто ведёт сервис", ["Between — дневник между сеансами терапии. Его ведёт самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005. Написать можно на help@between-journal.ru."]],
    ["Что делает сервис", ["Вы отмечаете чувство и пишете короткую заметку. К сеансу из этого собирается неделя: спектр, повторы и темы, о которых стоит сказать. Если подключить бота в Telegram, вечером он может спросить, как прошёл день, и сохранить ответ в этот же дневник."]],
    ["Дневник и «Неделя»", ["Дневник бесплатный. Вкладка «Неделя» открыта 7 дней с первого захода, дальше её нужно оплатить. В Telegram оплата идёт Telegram Stars. В браузере цена указана в рублях на самой вкладке. Голосовое сообщение превращается в текст только после оплаты «Недели», не больше 10 раз в день."]],
    ["Это не лечение", ["Between не врач и не замена сеансу. Если вам плохо прямо сейчас, обратитесь к своему специалисту или в экстренную службу."]],
    ["Оплата", ["Срок и цена написаны до оплаты. В Telegram 30 дней — подписка: её отменяют в Telegram, доступ остаётся до конца оплаченного срока. 3 месяца и год — разовый платёж. Если деньги списались, а «Неделя» не открылась, или нужен возврат, напишите боту, что случилось и когда."]],
    ["Записи", ["Заметки принадлежат вам. Мы не продаём их текст. Можно перестать пользоваться сервисом в любой момент. Чтобы удалить дневник, откройте страницу удаления, пока вы вошли. Если войти не получается, напишите на help@between-journal.ru."]],
  ]),
  en: doc("Terms of use", "8 November 2026", [
    ["Who runs the service", ["Between is a journal between therapy sessions. It is run by Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), a self-employed person, INN 770507475005. You can write to help@between-journal.ru."]],
    ["What it does", ["You mark a feeling and write a short note. By the session this becomes a week: the spectrum, what repeated, and topics worth saying. If you connect the Telegram bot, it can ask in the evening how the day went and save the answer in the same journal."]],
    ["The journal and Week", ["The journal is free. Week stays open for 7 days after you first open it, then it has to be paid. In Telegram the payment is Telegram Stars. In the browser the price is in rubles on the Week tab. A voice message becomes text only after Week is paid, up to 10 a day."]],
    ["This is not treatment", ["Between is not a doctor and not a replacement for a session. If you feel bad right now, contact your own specialist or an emergency service."]],
    ["Payment", ["The period and the price are shown before you pay. In Telegram, 30 days is a subscription: cancel it in Telegram, and access stays until the paid period ends. 3 months and a year are one-time payments. If money was charged and Week did not open, or you need a refund, write the bot what happened and when."]],
    ["Your notes", ["The notes are yours. We do not sell their text. You can stop using the service at any time. To delete the journal, open the deletion page while you are signed in. If you cannot sign in, write to help@between-journal.ru."]],
  ], true),
  uk: doc("Умови використання", "8 листопада 2026", [
    ["Хто веде сервіс", ["Between — щоденник між сеансами терапії. Його веде самозайнята Ляторовська Анастасія Борисівна (Ляторовская Анастасия Борисовна), ІПН 770507475005. Написати можна на help@between-journal.ru."]],
    ["Що робить сервіс", ["Ви позначаєте почуття і пишете коротку нотатку. До сеансу з цього збирається тиждень: спектр, повтори і теми, про які варто сказати. Якщо підключити бота в Telegram, увечері він може спитати, як минув день, і зберегти відповідь у цей самий щоденник."]],
    ["Щоденник і «Тиждень»", ["Щоденник безкоштовний. Вкладка «Тиждень» відкрита 7 днів від першого заходу, далі її треба оплатити. У Telegram оплата йде через Telegram Stars. У браузері ціна вказана в рублях на самій вкладці. Голосове повідомлення стає текстом лише після оплати «Тижня», не більше 10 разів на день."]],
    ["Це не лікування", ["Between не лікар і не заміна сеансу. Якщо вам погано просто зараз, зверніться до свого спеціаліста або в екстрену службу."]],
    ["Оплата", ["Строк і ціна написані до оплати. У Telegram 30 днів — підписка: її скасовують у Telegram, доступ лишається до кінця оплаченого строку. 3 місяці і рік — разовий платіж. Якщо гроші списалися, а «Тиждень» не відкрився, або потрібне повернення, напишіть боту, що сталося і коли."]],
    ["Нотатки", ["Нотатки належать вам. Ми не продаємо їхній текст. Можна перестати користуватися сервісом будь-коли. Щоб видалити щоденник, відкрийте сторінку видалення, поки ви ввійшли. Якщо ввійти не виходить, напишіть на help@between-journal.ru."]],
  ], true),
  es: doc("Condiciones de uso", "8 de noviembre de 2026", [
    ["Quién lleva el servicio", ["Between es un diario entre sesiones de terapia. Lo lleva Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), trabajadora autónoma, INN 770507475005. Puedes escribir a help@between-journal.ru."]],
    ["Qué hace", ["Marcas un sentimiento y escribes una nota corta. Para la sesión eso se reúne en una semana: el espectro, lo que se repitió y los temas que conviene decir. Si conectas el bot de Telegram, por la noche puede preguntar cómo fue el día y guardar la respuesta en el mismo diario."]],
    ["El diario y Semana", ["El diario es gratis. Semana está abierta 7 días desde la primera vez, y después hay que pagarla. En Telegram el pago es con Telegram Stars. En el navegador el precio está en rublos en la propia pestaña. Un mensaje de voz se convierte en texto solo después de pagar Semana, hasta 10 al día."]],
    ["Esto no es un tratamiento", ["Between no es un médico ni sustituye una sesión. Si te sientes mal ahora, contacta a tu especialista o a un servicio de urgencias."]],
    ["Pago", ["El plazo y el precio se muestran antes de pagar. En Telegram, 30 días es una suscripción: se cancela en Telegram y el acceso sigue hasta el fin del periodo pagado. 3 meses y un año son un pago único. Si se cobró el dinero y Semana no se abrió, o necesitas un reembolso, escribe al bot qué pasó y cuándo."]],
    ["Tus notas", ["Las notas son tuyas. No vendemos su texto. Puedes dejar de usar el servicio cuando quieras. Para borrar el diario, abre la página de eliminación mientras hayas entrado. Si no puedes entrar, escribe a help@between-journal.ru."]],
  ], true),
  pt: doc("Termos de uso", "8 de novembro de 2026", [
    ["Quem conduz o serviço", ["Between é um diário entre sessões de terapia. Quem o conduz é Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), autônoma, INN 770507475005. Você pode escrever para help@between-journal.ru."]],
    ["O que ele faz", ["Você marca um sentimento e escreve uma nota curta. Para a sessão isso vira uma semana: o espectro, o que se repetiu e os temas que vale dizer. Se conectar o bot do Telegram, à noite ele pode perguntar como foi o dia e salvar a resposta no mesmo diário."]],
    ["O diário e a Semana", ["O diário é grátis. A Semana fica aberta por 7 dias depois da primeira vez, e depois precisa ser paga. No Telegram o pagamento é em Telegram Stars. No navegador o preço está em rublos na própria aba. Uma mensagem de voz vira texto só depois do pagamento da Semana, até 10 por dia."]],
    ["Isto não é tratamento", ["Between não é médico e não substitui uma sessão. Se você está mal agora, fale com o seu especialista ou com um serviço de emergência."]],
    ["Pagamento", ["O prazo e o preço aparecem antes do pagamento. No Telegram, 30 dias é uma assinatura: cancele no Telegram, o acesso fica até o fim do período pago. 3 meses e um ano são um pagamento único. Se o dinheiro foi cobrado e a Semana não abriu, ou você precisa de reembolso, escreva ao bot o que aconteceu e quando."]],
    ["Suas notas", ["As notas são suas. Não vendemos o texto. Você pode parar de usar o serviço quando quiser. Para apagar o diário, abra a página de exclusão enquanto estiver conectado. Se não conseguir entrar, escreva para help@between-journal.ru."]],
  ], true),
  tr: doc("Kullanım koşulları", "8 Kasım 2026", [
    ["Hizmeti kim yürütür", ["Between, terapi seansları arasında tutulan bir günlüktür. Onu serbest meslek sahibi Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) yürütür, INN 770507475005. help@between-journal.ru adresine yazabilirsiniz."]],
    ["Ne yapar", ["Bir duygu işaretler ve kısa bir not yazarsınız. Seansa kadar bu bir hafta olur: yelpaze, tekrar edenler ve söylenmeye değer konular. Telegram botunu bağlarsanız akşam günün nasıl geçtiğini sorabilir ve yanıtı aynı günlüğe kaydeder."]],
    ["Günlük ve Hafta", ["Günlük ücretsizdir. Hafta, ilk açılıştan sonra 7 gün açıktır, sonra ödenir. Telegram’da ödeme Telegram Stars iledir. Tarayıcıda fiyat, Hafta sekmesinde ruble olarak yazar. Sesli mesaj, Hafta ödendikten sonra metne döner, günde en fazla 10."]],
    ["Bu bir tedavi değildir", ["Between hekim değildir ve seansın yerine geçmez. Şu anda kötüyseniz kendi uzmanınıza ya da acil servise başvurun."]],
    ["Ödeme", ["Süre ve fiyat ödemeden önce yazılır. Telegram’da 30 gün aboneliktir: Telegram’da iptal edilir, erişim ödenen sürenin sonuna kadar sürer. 3 ay ve bir yıl tek seferlik ödemedir. Para çekildiyse ve Hafta açılmadıysa ya da iade gerekiyorsa, bota ne olduğunu ve ne zaman olduğunu yazın."]],
    ["Notlarınız", ["Notlar sizindir. Metnini satmayız. Hizmeti istediğiniz zaman bırakabilirsiniz. Günlüğü silmek için giriş yapmışken silme sayfasını açın. Giriş yapamazsanız help@between-journal.ru adresine yazın."]],
  ], true),
  id: doc("Ketentuan penggunaan", "8 November 2026", [
    ["Siapa yang menjalankan layanan", ["Between adalah jurnal di antara sesi terapi. Layanan ini dijalankan oleh Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), pekerja mandiri, INN 770507475005. Anda dapat menulis ke help@between-journal.ru."]],
    ["Apa yang dilakukan", ["Anda menandai perasaan dan menulis catatan pendek. Menjelang sesi, ini menjadi satu minggu: spektrum, yang berulang, dan topik yang perlu dikatakan. Jika bot Telegram dihubungkan, pada malam hari bot dapat bertanya bagaimana hari berjalan dan menyimpan jawaban di jurnal yang sama."]],
    ["Jurnal dan Minggu", ["Jurnal gratis. Minggu terbuka 7 hari sejak pertama dibuka, lalu perlu dibayar. Di Telegram pembayarannya Telegram Stars. Di peramban harga tertulis dalam rubel pada tab Minggu. Pesan suara menjadi teks hanya setelah Minggu dibayar, paling banyak 10 sehari."]],
    ["Ini bukan perawatan", ["Between bukan dokter dan bukan pengganti sesi. Jika Anda sedang tidak baik, hubungi spesialis Anda atau layanan darurat."]],
    ["Pembayaran", ["Jangka waktu dan harga tertulis sebelum membayar. Di Telegram, 30 hari adalah langganan: batalkan di Telegram, akses tetap sampai akhir masa yang dibayar. 3 bulan dan satu tahun adalah pembayaran sekali. Jika uang terpotong dan Minggu tidak terbuka, atau Anda perlu pengembalian, tulis ke bot apa yang terjadi dan kapan."]],
    ["Catatan Anda", ["Catatan adalah milik Anda. Kami tidak menjual teksnya. Anda dapat berhenti kapan saja. Untuk menghapus jurnal, buka halaman penghapusan saat Anda sudah masuk. Jika tidak bisa masuk, tulis ke help@between-journal.ru."]],
  ], true),
  vi: doc("Điều khoản sử dụng", "8 tháng 11 năm 2026", [
    ["Ai điều hành dịch vụ", ["Between là nhật ký giữa các buổi trị liệu. Người điều hành là Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), cá nhân tự kinh doanh, INN 770507475005. Bạn có thể viết tới help@between-journal.ru."]],
    ["Dịch vụ làm gì", ["Bạn đánh dấu một cảm xúc và viết một ghi chú ngắn. Đến buổi trị liệu, những ghi chú này thành một tuần: phổ cảm xúc, điều lặp lại và chủ đề đáng nói. Nếu kết nối bot Telegram, buổi tối bot có thể hỏi ngày của bạn thế nào và lưu câu trả lời vào cùng nhật ký."]],
    ["Nhật ký và Tuần", ["Nhật ký miễn phí. Tuần mở 7 ngày kể từ lần đầu, sau đó cần trả phí. Trên Telegram, thanh toán bằng Telegram Stars. Trên trình duyệt, giá bằng rúp nằm ngay trên tab Tuần. Tin nhắn thoại thành chữ chỉ sau khi Tuần đã được trả, tối đa 10 lần một ngày."]],
    ["Đây không phải điều trị", ["Between không phải bác sĩ và không thay buổi trị liệu. Nếu bạn đang không ổn, hãy liên hệ chuyên gia của bạn hoặc dịch vụ cấp cứu."]],
    ["Thanh toán", ["Thời hạn và giá được ghi trước khi trả. Trên Telegram, 30 ngày là đăng ký: hủy trong Telegram, quyền truy cập giữ đến hết kỳ đã trả. 3 tháng và một năm là trả một lần. Nếu tiền đã bị trừ mà Tuần không mở, hoặc bạn cần hoàn tiền, hãy viết cho bot chuyện gì đã xảy ra và khi nào."]],
    ["Ghi chú của bạn", ["Ghi chú là của bạn. Chúng tôi không bán nội dung. Bạn có thể ngừng dùng bất cứ lúc nào. Để xóa nhật ký, hãy mở trang xóa khi bạn đã đăng nhập. Nếu không vào được, hãy viết tới help@between-journal.ru."]],
  ], true),
  ar: doc("شروط الاستخدام", "8 نوفمبر 2026", [
    ["من يدير الخدمة", ["Between يوميات بين جلسات العلاج. تديرها أناستاسيا بوريسوفنا لياتوروفسكايا (Ляторовская Анастасия Борисовна)، عاملة لحسابها، رقم INN 770507475005. يمكن الكتابة إلى help@between-journal.ru."]],
    ["ماذا تفعل", ["تحدّد شعورًا وتكتب ملاحظة قصيرة. قبل الجلسة يتجمع هذا في أسبوع: الطيف، وما تكرر، والمواضيع التي تستحق القول. إذا وصلت بوت تيليغرام، يمكنه مساءً أن يسأل كيف مضى اليوم ويحفظ الإجابة في اليوميات نفسها."]],
    ["اليوميات و«الأسبوع»", ["اليوميات مجانية. تبويب «الأسبوع» مفتوح 7 أيام من أول فتح، ثم يلزم دفعه. في تيليغرام الدفع عبر Telegram Stars. في المتصفح السعر بالروبل على التبويب نفسه. الرسالة الصوتية تصبح نصًا فقط بعد دفع «الأسبوع»، حتى 10 مرات في اليوم."]],
    ["هذا ليس علاجًا", ["Between ليس طبيبًا ولا يحل محل الجلسة. إذا كنت بحالة سيئة الآن، فتواصل مع اختصاصيك أو مع خدمة الطوارئ."]],
    ["الدفع", ["المدة والسعر مكتوبان قبل الدفع. في تيليغرام، 30 يومًا اشتراك: يُلغى في تيليغرام، ويبقى الوصول حتى نهاية المدة المدفوعة. 3 أشهر وسنة دفعة واحدة. إذا خُصم المال ولم يُفتح «الأسبوع»، أو احتجت إلى استرداد، فاكتب للبوت ماذا حدث ومتى."]],
    ["ملاحظاتك", ["الملاحظات لك. لا نبيع نصها. يمكنك التوقف في أي وقت. لحذف اليوميات، افتح صفحة الحذف وأنت داخل الحساب. إذا لم تستطع الدخول، فاكتب إلى help@between-journal.ru."]],
  ], true),
  fa: doc("شرایط استفاده", "۸ نوامبر ۲۰۲۶", [
    ["چه کسی سرویس را اداره می‌کند", ["Between دفتر بین جلسه‌های درمان است. آن را آناستاسیا بوریسوونا لیاتوروفسایا (Ляторовская Анастасия Борисовна)، خویش‌فرما، با INN 770507475005 اداره می‌کند. می‌توانید به help@between-journal.ru بنویسید."]],
    ["چه می‌کند", ["یک احساس را علامت می‌زنید و یادداشتی کوتاه می‌نویسید. تا جلسه، این‌ها یک هفته می‌شوند: طیف، تکرارها و موضوع‌هایی که گفتنشان مهم است. اگر بات تلگرام را وصل کنید، عصر می‌تواند بپرسد روز چطور گذشت و پاسخ را در همین دفتر ذخیره کند."]],
    ["دفتر و «هفته»", ["دفتر رایگان است. برگه «هفته» از اولین باز کردن ۷ روز باز است و بعد باید پرداخت شود. در تلگرام پرداخت با Telegram Stars است. در مرورگر قیمت به روبل روی همان برگه نوشته شده. پیام صوتی فقط پس از پرداخت «هفته» متن می‌شود، حداکثر ۱۰ بار در روز."]],
    ["این درمان نیست", ["Between پزشک نیست و جای جلسه را نمی‌گیرد. اگر همین حالا حالتان بد است، به متخصص خود یا اورژانس مراجعه کنید."]],
    ["پرداخت", ["مدت و قیمت پیش از پرداخت نوشته می‌شود. در تلگرام ۳۰ روز اشتراک است: در تلگرام لغو می‌شود و دسترسی تا پایان دورهٔ پرداخت‌شده می‌ماند. ۳ ماه و یک سال پرداخت یک‌باره است. اگر پول کم شد و «هفته» باز نشد، یا بازپرداخت لازم است، به بات بنویسید چه شد و کی."]],
    ["یادداشت‌های شما", ["یادداشت‌ها مال شماست. متنشان را نمی‌فروشیم. هر وقت بخواهید می‌توانید استفاده را متوقف کنید. برای حذف دفتر، وقتی وارد شده‌اید صفحهٔ حذف را باز کنید. اگر نتوانستید وارد شوید، به help@between-journal.ru بنویسید."]],
  ], true),
  hi: doc("उपयोग की शर्तें", "8 नवंबर 2026", [
    ["सेवा कौन चलाता है", ["Between थेरेपी सत्रों के बीच की डायरी है. इसे स्व-नियोजित Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) चलाती हैं, INN 770507475005. आप help@between-journal.ru पर लिख सकते हैं."]],
    ["यह क्या करता है", ["आप एक भावना चिह्नित करते हैं और छोटा नोट लिखते हैं. सत्र तक इससे एक हफ़्ता बनता है: स्पेक्ट्रम, जो दोहराया, और जिन विषयों पर कहना चाहिए. Telegram बॉट जोड़ने पर वह शाम को पूछ सकता है कि दिन कैसा रहा, और जवाब इसी डायरी में रखे."]],
    ["डायरी और «हफ़्ता»", ["डायरी मुफ़्त है. «हफ़्ता» पहली बार खोलने के 7 दिन तक खुला रहता है, फिर भुगतान करना होता है. Telegram में भुगतान Telegram Stars से होता है. ब्राउज़र में कीमत रूबल में उसी टैब पर लिखी होती है. आवाज़ का संदेश «हफ़्ता» के भुगतान के बाद ही पाठ बनता है, दिन में 10 तक."]],
    ["यह इलाज नहीं है", ["Between डॉक्टर नहीं है और सत्र की जगह नहीं लेता. अगर अभी बुरा लग रहा है, तो अपने विशेषज्ञ या आपातकालीन सेवा से संपर्क करें."]],
    ["भुगतान", ["अवधि और कीमत भुगतान से पहले लिखी होती है. Telegram में 30 दिन सदस्यता है: Telegram में रद्द करें, पहुँच भुगतान अवधि के अंत तक रहती है. 3 महीने और एक साल एक बार का भुगतान है. अगर पैसे कट गए और «हफ़्ता» नहीं खुला, या धनवापसी चाहिए, तो बॉट को लिखें क्या हुआ और कब."]],
    ["आपके नोट", ["नोट आपके हैं. हम उनका पाठ नहीं बेचते. सेवा कभी भी छोड़ सकते हैं. डायरी मिटाने के लिए, साइन इन होने पर मिटाने का पृष्ठ खोलें. अगर साइन इन न हो, तो help@between-journal.ru पर लिखें."]],
  ], true),
  uz: doc("Foydalanish shartlari", "8 noyabr 2026", [
    ["Xizmatni kim yuritadi", ["Between — terapiya seanslari orasidagi kundalik. Uni o‘zini o‘zi band qilgan Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) yuritadi, INN 770507475005. help@between-journal.ru manziliga yozishingiz mumkin."]],
    ["Nima qiladi", ["His-tuyg‘uni belgilaysiz va qisqa yozuv yozasiz. Seansga borib bu haftaga aylanadi: spektr, takrorlar va aytishga arziydigan mavzular. Telegram botini ulasangiz, kechqurun kun qanday o‘tganini so‘rashi va javobni shu kundalikka saqlashi mumkin."]],
    ["Kundalik va «Hafta»", ["Kundalik bepul. «Hafta» birinchi ochilganidan 7 kun ochiq, keyin to‘lanadi. Telegramda to‘lov Telegram Stars orqali. Brauzerda narx rubl bilan shu varaqda yozilgan. Ovozli xabar matnga faqat «Hafta» to‘langach aylanadi, kuniga 10 tagacha."]],
    ["Bu davolash emas", ["Between shifokor emas va seans o‘rnini bosmaydi. Hozir yomon bo‘lsangiz, o‘z mutaxassisingizga yoki tez yordamga murojaat qiling."]],
    ["To‘lov", ["Muddat va narx to‘lovdan oldin yoziladi. Telegramda 30 kun — obuna: Telegramda bekor qilinadi, kirish to‘langan muddat oxirigacha qoladi. 3 oy va bir yil — bir martalik to‘lov. Pul yechilgan, lekin «Hafta» ochilmagan bo‘lsa yoki qaytarish kerak bo‘lsa, botga nima bo‘lganini va qachonligini yozing."]],
    ["Yozuvlaringiz", ["Yozuvlar sizniki. Matnini sotmaymiz. Xizmatdan istalgan payt chiqishingiz mumkin. Kundalikni o‘chirish uchun kirganingizda o‘chirish sahifasini oching. Kira olmasangiz, help@between-journal.ru manziliga yozing."]],
  ], true),
};

const TELEGRAM_PRIVACY: Record<LocaleId, LegalDoc> = {
  ru: doc("Политика конфиденциальности", "8 ноября 2026", [
    ["Кто отвечает за данные", ["За данные отвечает самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005. Написать можно на help@between-journal.ru."]],
    ["Какие данные", ["Почта, если входите в браузере. Идентификатор и имя пользователя Telegram, если открываете мини-приложение или подключаете бота. Идентификатор MAX, если открываете дневник в MAX. Текст заметок, чувства, темы к сеансу, сеансы и напоминания. Язык и часовой пояс. Факт оплаты «Недели» и дата, до которой она открыта. Голосовое сообщение нужно только чтобы превратить его в текст заметки: сам файл не хранится. Письмо в поддержку хранит текст сообщения, платформу и идентификатор дневника."]],
    ["Зачем", ["Чтобы хранить дневник, открывать его с телефона и компьютера и соединять его с ботом в Telegram или MAX. Текст заметок может уходить в модель, которая собирает краткий текст недели и темы к сеансу. Коды входа и письма поддержки уходят с почты сервиса. Это не реклама других продуктов."]],
    ["Кому ещё они попадают", ["Заметки лежат в базе Upstash Redis. Сайт открывается через Vercel. Расшифровка голоса и текст для модели идут через AI Tunnel, а если этот ключ не задан — через Gemini или Groq. Письма уходят через почтовый ящик сервиса. На публичной странице сайта визит считает Яндекс Метрика. В приложении шаги воронки считает PostHog в США, без имени и без идентификатора Telegram. Страну по IP мы смотрим только в момент запроса, чтобы предупредить, что Telegram из России может не открыться без VPN, и отдельно её не храним."]],
    ["Сколько хранятся", ["Пока вы пользуетесь дневником. Страница удаления стирает заметки, вход и связанную копию в Telegram или MAX. Обезличенные счётчики за прошлые дни остаются без привязки к вам. Письмо, которое уже дошло на help@between-journal.ru, остаётся в почте поддержки."]],
    ["Что можно попросить", ["Можно попросить показать, исправить или удалить данные. Если вы вошли в дневник, это делает страница удаления. Если войти не получается, напишите на help@between-journal.ru и укажите почту, Telegram или MAX, с которого открывали дневник."]],
  ]),
  en: doc("Privacy policy", "8 November 2026", [
    ["Who is responsible", ["Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), a self-employed person, INN 770507475005, is responsible for the data. You can write to help@between-journal.ru."]],
    ["What data", ["Your email, if you sign in in the browser. Your Telegram id and username, if you open the Mini App or connect the bot. Your MAX id, if you open the journal in MAX. The text of notes, feelings, session topics, sessions, and reminders. Language and time zone. Whether Week is paid and until which date. A voice message is used only to turn it into note text: the file itself is not kept. A support letter keeps the message, the platform, and the journal id."]],
    ["Why", ["To keep the journal, open it from a phone and a computer, and connect it to the bot in Telegram or MAX. Note text can be sent to a model that writes the short week text and the topics for the session. Sign-in codes and support letters leave from the service mailbox. This is not advertising for other products."]],
    ["Who else receives it", ["Notes are stored in Upstash Redis. The site is served by Vercel. Voice transcription and the text for the model go through AI Tunnel, or through Gemini or Groq when that key is not set. Letters go through the service mailbox. Yandex Metrika counts visits on the public page. PostHog in the US counts funnel steps inside the app, without a name and without a Telegram id. We read the country from the IP only for that request, to warn that Telegram from Russia may not open without a VPN, and we do not store the country."]],
    ["How long", ["While you use the journal. The deletion page erases the notes, the sign-in, and a linked Telegram or MAX copy. Anonymous counts from past days stay, with nothing that points to you. A letter that already reached help@between-journal.ru stays in the support mailbox."]],
    ["What you can ask", ["You can ask to see, correct, or delete the data. If you are signed in, the deletion page does that. If you cannot sign in, write to help@between-journal.ru and say which email, Telegram, or MAX you used."]],
  ], true),
  uk: doc("Політика конфіденційності", "8 листопада 2026", [
    ["Хто відповідає за дані", ["За дані відповідає самозайнята Ляторовська Анастасія Борисівна (Ляторовская Анастасия Борисовна), ІПН 770507475005. Написати можна на help@between-journal.ru."]],
    ["Які дані", ["Пошта, якщо входите в браузері. Ідентифікатор і ім’я користувача Telegram, якщо відкриваєте мінізастосунок або підключаєте бота. Ідентифікатор MAX, якщо відкриваєте щоденник у MAX. Текст нотаток, почуття, теми до сеансу, сеанси і нагадування. Мова і часовий пояс. Факт оплати «Тижня» і дата, до якої він відкритий. Голосове повідомлення потрібне лише щоб перетворити його на текст нотатки: сам файл не зберігається. Лист у підтримку зберігає текст повідомлення, платформу й ідентифікатор щоденника."]],
    ["Навіщо", ["Щоб зберігати щоденник, відкривати його з телефона і комп’ютера і з’єднувати його з ботом у Telegram або MAX. Текст нотаток може йти в модель, яка збирає короткий текст тижня і теми до сеансу. Коди входу і листи підтримки йдуть із пошти сервісу. Це не реклама інших продуктів."]],
    ["Кому ще вони потрапляють", ["Нотатки лежать у базі Upstash Redis. Сайт відкривається через Vercel. Розшифрування голосу і текст для моделі йдуть через AI Tunnel, а якщо цей ключ не заданий — через Gemini або Groq. Листи йдуть через поштову скриньку сервісу. На публічній сторінці сайту візит рахує Яндекс Метрика. У застосунку кроки вирви рахує PostHog у США, без імені і без ідентифікатора Telegram. Країну за IP ми дивимося лише в момент запиту, щоб попередити, що Telegram з Росії може не відкритися без VPN, і окремо її не зберігаємо."]],
    ["Скільки зберігаються", ["Поки ви користуєтеся щоденником. Сторінка видалення стирає нотатки, вхід і пов’язану копію в Telegram або MAX. Знеособлені лічильники за минулі дні лишаються без прив’язки до вас. Лист, який уже дійшов на help@between-journal.ru, лишається в пошті підтримки."]],
    ["Що можна попросити", ["Можна попросити показати, виправити або видалити дані. Якщо ви ввійшли в щоденник, це робить сторінка видалення. Якщо ввійти не виходить, напишіть на help@between-journal.ru і вкажіть пошту, Telegram або MAX, з якого відкривали щоденник."]],
  ], true),
  es: doc("Política de privacidad", "8 de noviembre de 2026", [
    ["Quién responde de los datos", ["Responde Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), trabajadora autónoma, INN 770507475005. Puedes escribir a help@between-journal.ru."]],
    ["Qué datos", ["El correo, si entras en el navegador. El identificador y el nombre de usuario de Telegram, si abres la Mini App o conectas el bot. El identificador de MAX, si abres el diario en MAX. El texto de las notas, los sentimientos, los temas para la sesión, las sesiones y los recordatorios. El idioma y la zona horaria. Si Semana está pagada y hasta qué fecha. Un mensaje de voz solo sirve para convertirlo en texto: el archivo no se guarda. Una carta de ayuda guarda el mensaje, la plataforma y el identificador del diario."]],
    ["Para qué", ["Para guardar el diario, abrirlo desde el teléfono y el ordenador y conectarlo con el bot en Telegram o MAX. El texto de las notas puede ir a un modelo que escribe el texto breve de la semana y los temas para la sesión. Los códigos de entrada y las cartas de ayuda salen del buzón del servicio. No es publicidad de otros productos."]],
    ["Quién más los recibe", ["Las notas están en Upstash Redis. El sitio se abre a través de Vercel. La transcripción de la voz y el texto para el modelo van por AI Tunnel o, si esa clave no está, por Gemini o Groq. Las cartas salen por el buzón del servicio. En la página pública, Yandex Metrika cuenta la visita. Dentro de la app, PostHog en EE. UU. cuenta los pasos del recorrido, sin nombre y sin identificador de Telegram. El país según la IP se mira solo en esa solicitud, para avisar de que Telegram desde Rusia puede no abrirse sin VPN, y no se guarda."]],
    ["Cuánto tiempo", ["Mientras uses el diario. La página de eliminación borra las notas, el acceso y la copia vinculada en Telegram o MAX. Los conteos anónimos de días pasados se quedan, sin nada que te identifique. Una carta que ya llegó a help@between-journal.ru se queda en el buzón de ayuda."]],
    ["Qué puedes pedir", ["Puedes pedir ver, corregir o borrar los datos. Si has entrado, lo hace la página de eliminación. Si no puedes entrar, escribe a help@between-journal.ru e indica el correo, Telegram o MAX con el que abriste el diario."]],
  ], true),
  pt: doc("Política de privacidade", "8 de novembro de 2026", [
    ["Quem responde pelos dados", ["Quem responde é Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), autônoma, INN 770507475005. Você pode escrever para help@between-journal.ru."]],
    ["Quais dados", ["O e-mail, se você entra no navegador. O identificador e o nome de usuário do Telegram, se abre o Mini App ou conecta o bot. O identificador do MAX, se abre o diário no MAX. O texto das notas, sentimentos, temas da sessão, sessões e lembretes. Idioma e fuso horário. Se a Semana está paga e até qual data. Uma mensagem de voz serve só para virar texto: o arquivo não fica guardado. Uma carta de ajuda guarda a mensagem, a plataforma e o identificador do diário."]],
    ["Para quê", ["Para guardar o diário, abri-lo no telefone e no computador e ligá-lo ao bot no Telegram ou no MAX. O texto das notas pode ir a um modelo que escreve o texto curto da semana e os temas da sessão. Os códigos de entrada e as cartas de ajuda saem da caixa do serviço. Isso não é anúncio de outros produtos."]],
    ["Quem mais recebe", ["As notas ficam no Upstash Redis. O site abre pela Vercel. A transcrição da voz e o texto para o modelo passam pelo AI Tunnel ou, se essa chave não existe, pelo Gemini ou Groq. As cartas passam pela caixa do serviço. Na página pública, o Yandex Metrika conta a visita. No aplicativo, o PostHog nos EUA conta os passos, sem nome e sem identificador do Telegram. O país pelo IP é lido só naquela solicitação, para avisar que o Telegram da Rússia pode não abrir sem VPN, e não é guardado."]],
    ["Por quanto tempo", ["Enquanto você usa o diário. A página de exclusão apaga as notas, o acesso e a cópia ligada no Telegram ou no MAX. Contagens anônimas de dias passados ficam, sem nada que aponte para você. Uma carta que já chegou a help@between-journal.ru fica na caixa de ajuda."]],
    ["O que você pode pedir", ["Você pode pedir para ver, corrigir ou apagar os dados. Se estiver conectado, a página de exclusão faz isso. Se não conseguir entrar, escreva para help@between-journal.ru e diga qual e-mail, Telegram ou MAX usou."]],
  ], true),
  tr: doc("Gizlilik politikası", "8 Kasım 2026", [
    ["Veriden kim sorumlu", ["Veriden serbest meslek sahibi Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) sorumludur, INN 770507475005. help@between-journal.ru adresine yazabilirsiniz."]],
    ["Hangi veriler", ["Tarayıcıdan girerseniz e-posta. Mini uygulamayı açar veya botu bağlarsanız Telegram kimliği ve kullanıcı adı. Günlüğü MAX’te açarsanız MAX kimliği. Notların metni, duygular, seans konuları, seanslar ve anımsatmalar. Dil ve saat dilimi. Haftanın ödenip ödenmediği ve hangi tarihe kadar açık olduğu. Sesli mesaj yalnızca metne çevirmek içindir: dosyanın kendisi tutulmaz. Destek mektubu mesajı, platformu ve günlük kimliğini saklar."]],
    ["Neden", ["Günlüğü saklamak, telefondan ve bilgisayardan açmak ve Telegram veya MAX’teki bota bağlamak için. Not metni, haftanın kısa metnini ve seans konularını yazan bir modele gidebilir. Giriş kodları ve destek mektupları hizmetin posta kutusundan çıkar. Bu, başka ürünlerin reklamı değildir."]],
    ["Başka kim alır", ["Notlar Upstash Redis’te durur. Site Vercel üzerinden açılır. Ses çözümü ve model için metin AI Tunnel üzerinden gider; bu anahtar yoksa Gemini veya Groq üzerinden. Mektuplar hizmetin posta kutusundan gider. Herkese açık sayfada ziyareti Yandex Metrika sayar. Uygulamada ABD’deki PostHog adım sayar, ad ve Telegram kimliği olmadan. IP’den ülkeyi yalnızca o istek sırasında okuruz, Rusya’dan Telegram’ın VPN’siz açılmayabileceğini söylemek için, ve ülkeyi saklamayız."]],
    ["Ne kadar durur", ["Günlüğü kullandığınız sürece. Silme sayfası notları, girişi ve bağlı Telegram veya MAX kopyasını siler. Geçmiş günlerin anonim sayaçları, size bağlanmadan kalır. help@between-journal.ru adresine varmış bir mektup destek kutusunda kalır."]],
    ["Ne isteyebilirsiniz", ["Veriyi göstermeyi, düzeltmeyi veya silmeyi isteyebilirsiniz. Giriş yaptıysanız bunu silme sayfası yapar. Giriş yapamazsanız help@between-journal.ru adresine yazın ve hangi e-posta, Telegram veya MAX ile açtığınızı söyleyin."]],
  ], true),
  id: doc("Kebijakan privasi", "8 November 2026", [
    ["Siapa yang bertanggung jawab", ["Yang bertanggung jawab adalah Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), pekerja mandiri, INN 770507475005. Anda dapat menulis ke help@between-journal.ru."]],
    ["Data apa", ["Email, jika masuk lewat peramban. Id dan nama pengguna Telegram, jika membuka Mini App atau menghubungkan bot. Id MAX, jika membuka jurnal di MAX. Teks catatan, perasaan, topik sesi, sesi, dan pengingat. Bahasa dan zona waktu. Apakah Minggu sudah dibayar dan sampai tanggal berapa. Pesan suara hanya dipakai untuk dijadikan teks: berkasnya tidak disimpan. Surat bantuan menyimpan pesan, platform, dan id jurnal."]],
    ["Untuk apa", ["Untuk menyimpan jurnal, membukanya dari telepon dan komputer, dan menghubungkannya dengan bot di Telegram atau MAX. Teks catatan dapat dikirim ke model yang menulis ringkasan minggu dan topik untuk sesi. Kode masuk dan surat bantuan keluar dari kotak layanan. Ini bukan iklan produk lain."]],
    ["Siapa lagi yang menerimanya", ["Catatan disimpan di Upstash Redis. Situs dibuka lewat Vercel. Transkripsi suara dan teks untuk model lewat AI Tunnel, atau lewat Gemini atau Groq jika kunci itu tidak ada. Surat lewat kotak layanan. Di halaman publik, Yandex Metrika menghitung kunjungan. Di aplikasi, PostHog di AS menghitung langkah, tanpa nama dan tanpa id Telegram. Negara dari IP dibaca hanya pada permintaan itu, untuk memperingatkan bahwa Telegram dari Rusia mungkin tidak terbuka tanpa VPN, dan tidak disimpan."]],
    ["Berapa lama", ["Selama Anda memakai jurnal. Halaman penghapusan menghapus catatan, masuk, dan salinan Telegram atau MAX yang terhubung. Hitungan anonim hari-hari lalu tetap ada, tanpa yang menunjuk kepada Anda. Surat yang sudah sampai di help@between-journal.ru tetap di kotak bantuan."]],
    ["Apa yang dapat diminta", ["Anda dapat meminta data ditunjukkan, diperbaiki, atau dihapus. Jika Anda sudah masuk, halaman penghapusan yang melakukannya. Jika tidak bisa masuk, tulis ke help@between-journal.ru dan sebutkan email, Telegram, atau MAX yang dipakai."]],
  ], true),
  vi: doc("Chính sách quyền riêng tư", "8 tháng 11 năm 2026", [
    ["Ai chịu trách nhiệm về dữ liệu", ["Người chịu trách nhiệm là Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), cá nhân tự kinh doanh, INN 770507475005. Bạn có thể viết tới help@between-journal.ru."]],
    ["Dữ liệu nào", ["Email, nếu bạn vào bằng trình duyệt. Id và tên người dùng Telegram, nếu bạn mở Mini App hoặc kết nối bot. Id MAX, nếu bạn mở nhật ký trong MAX. Nội dung ghi chú, cảm xúc, chủ đề buổi trị liệu, buổi trị liệu và lời nhắc. Ngôn ngữ và múi giờ. Tuần đã được trả hay chưa và đến ngày nào. Tin nhắn thoại chỉ để chuyển thành chữ: tệp không được giữ. Thư hỗ trợ giữ nội dung, nền tảng và mã nhật ký."]],
    ["Để làm gì", ["Để giữ nhật ký, mở từ điện thoại và máy tính, và nối với bot trên Telegram hoặc MAX. Nội dung ghi chú có thể được gửi tới mô hình viết đoạn tóm tắt tuần và chủ đề cho buổi trị liệu. Mã đăng nhập và thư hỗ trợ đi từ hộp thư của dịch vụ. Đây không phải quảng cáo sản phẩm khác."]],
    ["Ai khác nhận được", ["Ghi chú nằm ở Upstash Redis. Trang được mở qua Vercel. Chuyển giọng nói thành chữ và nội dung cho mô hình đi qua AI Tunnel, hoặc qua Gemini hay Groq khi chưa có khóa đó. Thư đi qua hộp thư của dịch vụ. Trên trang công khai, Yandex Metrika đếm lượt vào. Trong ứng dụng, PostHog ở Mỹ đếm các bước, không có tên và không có id Telegram. Quốc gia theo IP chỉ được đọc ở lần yêu cầu đó, để báo rằng Telegram từ Nga có thể không mở nếu không có VPN, và không được lưu."]],
    ["Giữ bao lâu", ["Trong lúc bạn dùng nhật ký. Trang xóa sẽ xóa ghi chú, lối vào và bản sao Telegram hoặc MAX đã nối. Số đếm ẩn danh của những ngày trước vẫn còn, không gắn với bạn. Thư đã tới help@between-journal.ru vẫn nằm trong hộp thư hỗ trợ."]],
    ["Bạn có thể yêu cầu gì", ["Bạn có thể yêu cầu xem, sửa hoặc xóa dữ liệu. Nếu bạn đã đăng nhập, trang xóa làm việc đó. Nếu không vào được, hãy viết tới help@between-journal.ru và nói email, Telegram hoặc MAX bạn đã dùng."]],
  ], true),
  ar: doc("سياسة الخصوصية", "8 نوفمبر 2026", [
    ["من المسؤول عن البيانات", ["المسؤولة هي أناستاسيا بوريسوفنا لياتوروفسكايا (Ляторовская Анастасия Борисовна)، عاملة لحسابها، INN 770507475005. يمكن الكتابة إلى help@between-journal.ru."]],
    ["أي بيانات", ["البريد إذا دخلت من المتصفح. معرّف تيليغرام واسم المستخدم إذا فتحت التطبيق المصغّر أو وصلت البوت. معرّف MAX إذا فتحت اليوميات في MAX. نص الملاحظات والمشاعر ومواضيع الجلسة والجلسات والتذكيرات. اللغة والمنطقة الزمنية. هل دُفع «الأسبوع» وإلى أي تاريخ. الرسالة الصوتية تُستخدم فقط لتحويلها إلى نص: الملف نفسه لا يُحفظ. رسالة الدعم تحتفظ بالنص والمنصة ومعرّف اليوميات."]],
    ["لماذا", ["لحفظ اليوميات وفتحها من الهاتف والحاسوب وربطها بالبوت في تيليغرام أو MAX. قد يذهب نص الملاحظات إلى نموذج يكتب نص الأسبوع القصير ومواضيع الجلسة. رموز الدخول ورسائل الدعم تخرج من صندوق الخدمة. هذا ليس إعلانًا عن منتجات أخرى."]],
    ["من غيرك يستلمها", ["الملاحظات في قاعدة Upstash Redis. الموقع يُفتح عبر Vercel. تفريغ الصوت والنص للنموذج يمران عبر AI Tunnel، أو عبر Gemini أو Groq إذا لم يوجد هذا المفتاح. الرسائل تمر عبر صندوق الخدمة. في الصفحة العامة تحسب Yandex Metrika الزيارة. داخل التطبيق يحسب PostHog في الولايات المتحدة الخطوات، بلا اسم وبلا معرّف تيليغرام. نقرأ البلد من عنوان IP في لحظة الطلب فقط، لنحذّر أن تيليغرام من روسيا قد لا يفتح بلا VPN، ولا نخزّن البلد."]],
    ["كم تبقى", ["ما دمت تستخدم اليوميات. صفحة الحذف تمسح الملاحظات والدخول والنسخة المرتبطة في تيليغرام أو MAX. العدادات المجهولة للأيام السابقة تبقى من دون ما يدل عليك. الرسالة التي وصلت إلى help@between-journal.ru تبقى في صندوق الدعم."]],
    ["ماذا يمكن أن تطلب", ["يمكن طلب إظهار البيانات أو تصحيحها أو حذفها. إذا كنت داخل الحساب، صفحة الحذف تفعل ذلك. إذا لم تستطع الدخول، فاكتب إلى help@between-journal.ru واذكر البريد أو تيليغرام أو MAX الذي فتحت به اليوميات."]],
  ], true),
  fa: doc("سیاست حریم خصوصی", "۸ نوامبر ۲۰۲۶", [
    ["چه کسی مسئول داده‌هاست", ["مسئول داده‌ها آناستاسیا بوریسوونا لیاتوروفسایا (Ляторовская Анастасия Борисовна)، خویش‌فرما، با INN 770507475005 است. می‌توانید به help@between-journal.ru بنویسید."]],
    ["چه داده‌هایی", ["ایمیل، اگر از مرورگر وارد شوید. شناسه و نام کاربری تلگرام، اگر مینی‌اپ را باز کنید یا بات را وصل کنید. شناسهٔ MAX، اگر دفتر را در MAX باز کنید. متن یادداشت‌ها، احساس‌ها، موضوع‌های جلسه، جلسه‌ها و یادآوری‌ها. زبان و منطقهٔ زمانی. اینکه «هفته» پرداخت شده و تا چه تاریخی باز است. پیام صوتی فقط برای تبدیل به متن است: خود فایل نگه داشته نمی‌شود. نامهٔ پشتیبانی متن، سکو و شناسهٔ دفتر را نگه می‌دارد."]],
    ["برای چه", ["تا دفتر را نگه داریم، از تلفن و رایانه باز کنیم و به بات در تلگرام یا MAX وصل کنیم. متن یادداشت‌ها ممکن است به مدلی برود که متن کوتاه هفته و موضوع‌های جلسه را می‌نویسد. کدهای ورود و نامه‌های پشتیبانی از صندوق سرویس می‌روند. این تبلیغ محصول دیگر نیست."]],
    ["چه کس دیگری آن‌ها را می‌گیرد", ["یادداشت‌ها در Upstash Redis هستند. سایت از طریق Vercel باز می‌شود. تبدیل صدا به متن و متن برای مدل از AI Tunnel می‌گذرد، و اگر آن کلید نباشد از Gemini یا Groq. نامه‌ها از صندوق سرویس می‌روند. در صفحهٔ عمومی، Yandex Metrika بازدید را می‌شمارد. در برنامه، PostHog در آمریکا گام‌ها را می‌شمارد، بدون نام و بدون شناسهٔ تلگرام. کشور را از IP فقط در همان درخواست می‌خوانیم تا هشدار دهیم تلگرام از روسیه ممکن است بدون VPN باز نشود، و کشور را ذخیره نمی‌کنیم."]],
    ["چقدر می‌مانند", ["تا وقتی از دفتر استفاده می‌کنید. صفحهٔ حذف یادداشت‌ها، ورود و نسخهٔ وصل‌شده در تلگرام یا MAX را پاک می‌کند. شمارنده‌های بی‌نام روزهای گذشته، بدون پیوند به شما، می‌مانند. نامه‌ای که به help@between-journal.ru رسیده در صندوق پشتیبانی می‌ماند."]],
    ["چه می‌توانید بخواهید", ["می‌توانید نشان دادن، اصلاح یا حذف داده‌ها را بخواهید. اگر وارد شده‌اید، صفحهٔ حذف این کار را می‌کند. اگر نتوانستید وارد شوید، به help@between-journal.ru بنویسید و بگویید با کدام ایمیل، تلگرام یا MAX دفتر را باز کرده‌اید."]],
  ], true),
  hi: doc("गोपनीयता नीति", "8 नवंबर 2026", [
    ["डेटा का ज़िम्मा किसका है", ["डेटा की ज़िम्मेदार स्व-नियोजित Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) हैं, INN 770507475005. आप help@between-journal.ru पर लिख सकते हैं."]],
    ["कौन सा डेटा", ["ईमेल, अगर ब्राउज़र से आते हैं. Telegram id और उपयोगकर्ता नाम, अगर मिनी ऐप खोलते हैं या बॉट जोड़ते हैं. MAX id, अगर डायरी MAX में खोलते हैं. नोट का पाठ, भावनाएँ, सत्र के विषय, सत्र और याददिलाना. भाषा और समय क्षेत्र. «हफ़्ता» चुकाया गया है या नहीं, और किस तारीख तक. आवाज़ का संदेश केवल पाठ बनाने के लिए है: फ़ाइल नहीं रखी जाती. सहायता पत्र संदेश, प्लेटफ़ॉर्म और डायरी का पहचान चिह्न रखता है."]],
    ["किसलिए", ["डायरी रखने, उसे फ़ोन और कंप्यूटर से खोलने, और Telegram या MAX के बॉट से जोड़ने के लिए. नोट का पाठ उस मॉडल के पास जा सकता है जो हफ़्ते का छोटा पाठ और सत्र के विषय लिखता है. साइन-इन कोड और सहायता पत्र सेवा के डाकखाने से जाते हैं. यह दूसरे उत्पादों का विज्ञापन नहीं है."]],
    ["और किसे मिलता है", ["नोट Upstash Redis में रहते हैं. साइट Vercel से खुलती है. आवाज़ का पाठ और मॉडल के लिए लिखा AI Tunnel से जाता है, और वह कुंजी न हो तो Gemini या Groq से. पत्र सेवा के डाकखाने से जाते हैं. सार्वजनिक पृष्ठ पर यात्रा Yandex Metrika गिनती है. ऐप में कदम अमेरिका का PostHog गिनता है, नाम और Telegram id के बिना. IP से देश केवल उसी अनुरोध पर देखा जाता है, यह बताने के लिए कि रूस से Telegram बिना VPN नहीं खुल सकता, और देश अलग से नहीं रखा जाता."]],
    ["कितनी देर", ["जब तक आप डायरी इस्तेमाल करते हैं. मिटाने का पृष्ठ नोट, प्रवेश और जुड़ी Telegram या MAX प्रति मिटा देता है. पिछले दिनों की बिना नाम की गिनती रह जाती है, आपसे बिना जुड़े. help@between-journal.ru तक पहुँचा पत्र सहायता के डाकखाने में रहता है."]],
    ["आप क्या माँग सकते हैं", ["डेटा दिखाने, सुधारने या मिटाने को कह सकते हैं. अगर आप साइन इन हैं, तो मिटाने का पृष्ठ यह करता है. अगर साइन इन न हो, तो help@between-journal.ru पर लिखें और बताएं कि किस ईमेल, Telegram या MAX से डायरी खोली थी."]],
  ], true),
  uz: doc("Maxfiylik siyosati", "8 noyabr 2026", [
    ["Ma’lumot uchun kim javob beradi", ["Ma’lumot uchun o‘zini o‘zi band qilgan Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) javob beradi, INN 770507475005. help@between-journal.ru manziliga yozishingiz mumkin."]],
    ["Qanday ma’lumot", ["Pochta, agar brauzerdan kirsangiz. Telegram identifikatori va foydalanuvchi nomi, agar mini-ilovani ochsangiz yoki botni ulasangiz. MAX identifikatori, agar kundalikni MAX’da ochsangiz. Yozuvlar matni, his-tuyg‘ular, seans mavzulari, seanslar va eslatmalar. Til va vaqt mintaqasi. «Hafta» to‘langani va qaysi sanagacha ochiqligi. Ovozli xabar faqat matnga aylantirish uchun: faylning o‘zi saqlanmaydi. Yordam xati xabar matnini, platformani va kundalik identifikatorini saqlaydi."]],
    ["Nima uchun", ["Kundalikni saqlash, telefon va kompyuterdan ochish va Telegram yoki MAX’dagi botga ulash uchun. Yozuv matni haftaning qisqa matni va seans mavzularini yozadigan modelga borishi mumkin. Kirish kodlari va yordam xatlari xizmat pochta qutisidan chiqadi. Bu boshqa mahsulot reklaması emas."]],
    ["Yana kim oladi", ["Yozuvlar Upstash Redis’da turadi. Sayt Vercel orqali ochiladi. Ovozni matnga aylantirish va model uchun matn AI Tunnel orqali, agar bu kalit bo‘lmasa Gemini yoki Groq orqali ketadi. Xatlar xizmat pochta qutisi orqali ketadi. Ommaviy sahifada tashrifni Yandex Metrika sanaydi. Ilovada qadamlarni AQShdagi PostHog sanaydi, ism va Telegram identifikatorisiz. IP bo‘yicha mamlakatni faqat o‘sha so‘rov paytida ko‘ramiz, Rossiyadan Telegram VPN’siz ochilmasligi mumkinligini aytish uchun, va uni alohida saqlamaymiz."]],
    ["Qancha saqlanadi", ["Kundalikdan foydalanganingizcha. O‘chirish sahifasi yozuvlar, kirish va bog‘langan Telegram yoki MAX nusxasini o‘chiradi. O‘tgan kunlarning ismsiz hisoblagichlari sizga bog‘lanmagan holda qoladi. help@between-journal.ru manziliga yetib borgan xat yordam qutisida qoladi."]],
    ["Nima so‘rashingiz mumkin", ["Ma’lumotni ko‘rsatish, tuzatish yoki o‘chirishni so‘rashingiz mumkin. Agar kirgan bo‘lsangiz, buni o‘chirish sahifasi qiladi. Kira olmasangiz, help@between-journal.ru manziliga yozing va qaysi pochta, Telegram yoki MAX’dan ochganingizni ayting."]],
  ], true),
};


/** Web and MAX share one edition. Telegram keeps the documents that already live in that client. */
export function legalDocument(kind: LegalKind, locale: LocaleId, surface: LegalSurface = "web"): LegalDoc {
  const book =
    surface === "telegram"
      ? kind === "terms"
        ? TELEGRAM_TERMS
        : TELEGRAM_PRIVACY
      : kind === "terms"
        ? WEB_TERMS
        : WEB_PRIVACY;
  return book[locale] ?? book.ru;
}

export function legalLocales(): LocaleId[] {
  return Object.keys(TELEGRAM_TERMS) as LocaleId[];
}
