import { type LocaleId } from "./i18n";

export const LEGAL_INN = "770507475005";
export const LEGAL_NAME = "Ляторовская Анастасия Борисовна";
export const LEGAL_TERMS_URL = "https://www.between-journal.ru/terms";
export const LEGAL_PRIVACY_URL = "https://www.between-journal.ru/privacy";

export type LegalKind = "terms" | "privacy";
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDoc = { title: string; updated: string; sections: LegalSection[] };

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

const TERMS: Record<LocaleId, LegalDoc> = {
  ru: doc("Условия использования", "3 ноября 2026", [
    ["Кто ведёт сервис", ["Between — дневник между сеансами терапии. Его ведёт самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005. Написать можно боту @BetweenJournalBot."]],
    ["Что делает сервис", ["Вы отмечаете чувство и пишете короткую заметку. К сеансу из этого собирается неделя: спектр, повторы и темы, о которых стоит сказать. Если подключить бота в Telegram, вечером он может спросить, как прошёл день, и сохранить ответ в этот же дневник."]],
    ["Дневник и «Неделя»", ["Дневник бесплатный. Вкладка «Неделя» открыта 7 дней с первого захода, дальше её нужно оплатить. В Telegram оплата идёт Telegram Stars. В браузере цена указана в рублях на самой вкладке. Голосовое сообщение превращается в текст только после оплаты «Недели», не больше 10 раз в день."]],
    ["Это не лечение", ["Between не врач и не замена сеансу. Если вам плохо прямо сейчас, обратитесь к своему специалисту или в экстренную службу."]],
    ["Оплата", ["Срок и цена написаны до оплаты. В Telegram 30 дней — подписка: её отменяют в Telegram, доступ остаётся до конца оплаченного срока. 3 месяца и год — разовый платёж. Если деньги списались, а «Неделя» не открылась, или нужен возврат, напишите боту, что случилось и когда."]],
    ["Записи", ["Заметки принадлежат вам. Мы не продаём их текст. Можно перестать пользоваться сервисом в любой момент. Чтобы удалить дневник, напишите боту и укажите почту или Telegram, с которого входили."]],
  ]),
  en: doc("Terms of use", "3 November 2026", [
    ["Who runs the service", ["Between is a journal between therapy sessions. It is run by Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), a self-employed person, INN 770507475005. You can write to the bot @BetweenJournalBot."]],
    ["What it does", ["You mark a feeling and write a short note. By the session this becomes a week: the spectrum, what repeated, and topics worth saying. If you connect the Telegram bot, it can ask in the evening how the day went and save the answer in the same journal."]],
    ["The journal and Week", ["The journal is free. Week stays open for 7 days after you first open it, then it has to be paid. In Telegram the payment is Telegram Stars. In the browser the price is in rubles on the Week tab. A voice message becomes text only after Week is paid, up to 10 a day."]],
    ["This is not treatment", ["Between is not a doctor and not a replacement for a session. If you feel bad right now, contact your own specialist or an emergency service."]],
    ["Payment", ["The period and the price are shown before you pay. In Telegram, 30 days is a subscription: cancel it in Telegram, and access stays until the paid period ends. 3 months and a year are one-time payments. If money was charged and Week did not open, or you need a refund, write the bot what happened and when."]],
    ["Your notes", ["The notes are yours. We do not sell their text. You can stop using the service at any time. To delete the journal, write the bot and say which email or Telegram you used."]],
  ], true),
  uk: doc("Умови використання", "3 листопада 2026", [
    ["Хто веде сервіс", ["Between — щоденник між сеансами терапії. Його веде самозайнята Ляторовська Анастасія Борисівна (Ляторовская Анастасия Борисовна), ІПН 770507475005. Написати можна боту @BetweenJournalBot."]],
    ["Що робить сервіс", ["Ви позначаєте почуття і пишете коротку нотатку. До сеансу з цього збирається тиждень: спектр, повтори і теми, про які варто сказати. Якщо підключити бота в Telegram, увечері він може спитати, як минув день, і зберегти відповідь у цей самий щоденник."]],
    ["Щоденник і «Тиждень»", ["Щоденник безкоштовний. Вкладка «Тиждень» відкрита 7 днів від першого заходу, далі її треба оплатити. У Telegram оплата йде через Telegram Stars. У браузері ціна вказана в рублях на самій вкладці. Голосове повідомлення стає текстом лише після оплати «Тижня», не більше 10 разів на день."]],
    ["Це не лікування", ["Between не лікар і не заміна сеансу. Якщо вам погано просто зараз, зверніться до свого спеціаліста або в екстрену службу."]],
    ["Оплата", ["Строк і ціна написані до оплати. У Telegram 30 днів — підписка: її скасовують у Telegram, доступ лишається до кінця оплаченого строку. 3 місяці і рік — разовий платіж. Якщо гроші списалися, а «Тиждень» не відкрився, або потрібне повернення, напишіть боту, що сталося і коли."]],
    ["Нотатки", ["Нотатки належать вам. Ми не продаємо їхній текст. Можна перестати користуватися сервісом будь-коли. Щоб видалити щоденник, напишіть боту і вкажіть пошту або Telegram, з якого входили."]],
  ], true),
  es: doc("Condiciones de uso", "3 de noviembre de 2026", [
    ["Quién lleva el servicio", ["Between es un diario entre sesiones de terapia. Lo lleva Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), trabajadora autónoma, INN 770507475005. Puedes escribir al bot @BetweenJournalBot."]],
    ["Qué hace", ["Marcas un sentimiento y escribes una nota corta. Para la sesión eso se reúne en una semana: el espectro, lo que se repitió y los temas que conviene decir. Si conectas el bot de Telegram, por la noche puede preguntar cómo fue el día y guardar la respuesta en el mismo diario."]],
    ["El diario y Semana", ["El diario es gratis. Semana está abierta 7 días desde la primera vez, y después hay que pagarla. En Telegram el pago es con Telegram Stars. En el navegador el precio está en rublos en la propia pestaña. Un mensaje de voz se convierte en texto solo después de pagar Semana, hasta 10 al día."]],
    ["Esto no es un tratamiento", ["Between no es un médico ni sustituye una sesión. Si te sientes mal ahora, contacta a tu especialista o a un servicio de urgencias."]],
    ["Pago", ["El plazo y el precio se muestran antes de pagar. En Telegram, 30 días es una suscripción: se cancela en Telegram y el acceso sigue hasta el fin del periodo pagado. 3 meses y un año son un pago único. Si se cobró el dinero y Semana no se abrió, o necesitas un reembolso, escribe al bot qué pasó y cuándo."]],
    ["Tus notas", ["Las notas son tuyas. No vendemos su texto. Puedes dejar de usar el servicio cuando quieras. Para borrar el diario, escribe al bot e indica el correo o el Telegram con el que entraste."]],
  ], true),
  pt: doc("Termos de uso", "3 de novembro de 2026", [
    ["Quem conduz o serviço", ["Between é um diário entre sessões de terapia. Quem o conduz é Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), autônoma, INN 770507475005. Você pode escrever ao bot @BetweenJournalBot."]],
    ["O que ele faz", ["Você marca um sentimento e escreve uma nota curta. Para a sessão isso vira uma semana: o espectro, o que se repetiu e os temas que vale dizer. Se conectar o bot do Telegram, à noite ele pode perguntar como foi o dia e salvar a resposta no mesmo diário."]],
    ["O diário e a Semana", ["O diário é grátis. A Semana fica aberta por 7 dias depois da primeira vez, e depois precisa ser paga. No Telegram o pagamento é em Telegram Stars. No navegador o preço está em rublos na própria aba. Uma mensagem de voz vira texto só depois do pagamento da Semana, até 10 por dia."]],
    ["Isto não é tratamento", ["Between não é médico e não substitui uma sessão. Se você está mal agora, fale com o seu especialista ou com um serviço de emergência."]],
    ["Pagamento", ["O prazo e o preço aparecem antes do pagamento. No Telegram, 30 dias é uma assinatura: cancele no Telegram, o acesso fica até o fim do período pago. 3 meses e um ano são um pagamento único. Se o dinheiro foi cobrado e a Semana não abriu, ou você precisa de reembolso, escreva ao bot o que aconteceu e quando."]],
    ["Suas notas", ["As notas são suas. Não vendemos o texto. Você pode parar de usar o serviço quando quiser. Para apagar o diário, escreva ao bot e diga qual e-mail ou Telegram usou."]],
  ], true),
  tr: doc("Kullanım koşulları", "3 Kasım 2026", [
    ["Hizmeti kim yürütür", ["Between, terapi seansları arasında tutulan bir günlüktür. Onu serbest meslek sahibi Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) yürütür, INN 770507475005. @BetweenJournalBot botuna yazabilirsiniz."]],
    ["Ne yapar", ["Bir duygu işaretler ve kısa bir not yazarsınız. Seansa kadar bu bir hafta olur: yelpaze, tekrar edenler ve söylenmeye değer konular. Telegram botunu bağlarsanız akşam günün nasıl geçtiğini sorabilir ve yanıtı aynı günlüğe kaydeder."]],
    ["Günlük ve Hafta", ["Günlük ücretsizdir. Hafta, ilk açılıştan sonra 7 gün açıktır, sonra ödenir. Telegram’da ödeme Telegram Stars iledir. Tarayıcıda fiyat, Hafta sekmesinde ruble olarak yazar. Sesli mesaj, Hafta ödendikten sonra metne döner, günde en fazla 10."]],
    ["Bu bir tedavi değildir", ["Between hekim değildir ve seansın yerine geçmez. Şu anda kötüyseniz kendi uzmanınıza ya da acil servise başvurun."]],
    ["Ödeme", ["Süre ve fiyat ödemeden önce yazılır. Telegram’da 30 gün aboneliktir: Telegram’da iptal edilir, erişim ödenen sürenin sonuna kadar sürer. 3 ay ve bir yıl tek seferlik ödemedir. Para çekildiyse ve Hafta açılmadıysa ya da iade gerekiyorsa, bota ne olduğunu ve ne zaman olduğunu yazın."]],
    ["Notlarınız", ["Notlar sizindir. Metnini satmayız. Hizmeti istediğiniz zaman bırakabilirsiniz. Günlüğü silmek için bota yazın ve hangi e-posta ya da Telegram ile girdiğinizi belirtin."]],
  ], true),
  id: doc("Ketentuan penggunaan", "3 November 2026", [
    ["Siapa yang menjalankan layanan", ["Between adalah jurnal di antara sesi terapi. Layanan ini dijalankan oleh Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), pekerja mandiri, INN 770507475005. Anda dapat menulis ke bot @BetweenJournalBot."]],
    ["Apa yang dilakukan", ["Anda menandai perasaan dan menulis catatan pendek. Menjelang sesi, ini menjadi satu minggu: spektrum, yang berulang, dan topik yang perlu dikatakan. Jika bot Telegram dihubungkan, pada malam hari bot dapat bertanya bagaimana hari berjalan dan menyimpan jawaban di jurnal yang sama."]],
    ["Jurnal dan Minggu", ["Jurnal gratis. Minggu terbuka 7 hari sejak pertama dibuka, lalu perlu dibayar. Di Telegram pembayarannya Telegram Stars. Di peramban harga tertulis dalam rubel pada tab Minggu. Pesan suara menjadi teks hanya setelah Minggu dibayar, paling banyak 10 sehari."]],
    ["Ini bukan perawatan", ["Between bukan dokter dan bukan pengganti sesi. Jika Anda sedang tidak baik, hubungi spesialis Anda atau layanan darurat."]],
    ["Pembayaran", ["Jangka waktu dan harga tertulis sebelum membayar. Di Telegram, 30 hari adalah langganan: batalkan di Telegram, akses tetap sampai akhir masa yang dibayar. 3 bulan dan satu tahun adalah pembayaran sekali. Jika uang terpotong dan Minggu tidak terbuka, atau Anda perlu pengembalian, tulis ke bot apa yang terjadi dan kapan."]],
    ["Catatan Anda", ["Catatan adalah milik Anda. Kami tidak menjual teksnya. Anda dapat berhenti kapan saja. Untuk menghapus jurnal, tulis ke bot dan sebutkan email atau Telegram yang dipakai untuk masuk."]],
  ], true),
  vi: doc("Điều khoản sử dụng", "3 tháng 11 năm 2026", [
    ["Ai điều hành dịch vụ", ["Between là nhật ký giữa các buổi trị liệu. Người điều hành là Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), cá nhân tự kinh doanh, INN 770507475005. Bạn có thể viết cho bot @BetweenJournalBot."]],
    ["Dịch vụ làm gì", ["Bạn đánh dấu một cảm xúc và viết một ghi chú ngắn. Đến buổi trị liệu, những ghi chú này thành một tuần: phổ cảm xúc, điều lặp lại và chủ đề đáng nói. Nếu kết nối bot Telegram, buổi tối bot có thể hỏi ngày của bạn thế nào và lưu câu trả lời vào cùng nhật ký."]],
    ["Nhật ký và Tuần", ["Nhật ký miễn phí. Tuần mở 7 ngày kể từ lần đầu, sau đó cần trả phí. Trên Telegram, thanh toán bằng Telegram Stars. Trên trình duyệt, giá bằng rúp nằm ngay trên tab Tuần. Tin nhắn thoại thành chữ chỉ sau khi Tuần đã được trả, tối đa 10 lần một ngày."]],
    ["Đây không phải điều trị", ["Between không phải bác sĩ và không thay buổi trị liệu. Nếu bạn đang không ổn, hãy liên hệ chuyên gia của bạn hoặc dịch vụ cấp cứu."]],
    ["Thanh toán", ["Thời hạn và giá được ghi trước khi trả. Trên Telegram, 30 ngày là đăng ký: hủy trong Telegram, quyền truy cập giữ đến hết kỳ đã trả. 3 tháng và một năm là trả một lần. Nếu tiền đã bị trừ mà Tuần không mở, hoặc bạn cần hoàn tiền, hãy viết cho bot chuyện gì đã xảy ra và khi nào."]],
    ["Ghi chú của bạn", ["Ghi chú là của bạn. Chúng tôi không bán nội dung. Bạn có thể ngừng dùng bất cứ lúc nào. Để xóa nhật ký, hãy viết cho bot và nói email hoặc Telegram bạn đã dùng để vào."]],
  ], true),
  ar: doc("شروط الاستخدام", "3 نوفمبر 2026", [
    ["من يدير الخدمة", ["Between يوميات بين جلسات العلاج. تديرها أناستاسيا بوريسوفنا لياتوروفسكايا (Ляторовская Анастасия Борисовна)، عاملة لحسابها، رقم INN 770507475005. يمكن الكتابة إلى البوت @BetweenJournalBot."]],
    ["ماذا تفعل", ["تحدّد شعورًا وتكتب ملاحظة قصيرة. قبل الجلسة يتجمع هذا في أسبوع: الطيف، وما تكرر، والمواضيع التي تستحق القول. إذا وصلت بوت تيليغرام، يمكنه مساءً أن يسأل كيف مضى اليوم ويحفظ الإجابة في اليوميات نفسها."]],
    ["اليوميات و«الأسبوع»", ["اليوميات مجانية. تبويب «الأسبوع» مفتوح 7 أيام من أول فتح، ثم يلزم دفعه. في تيليغرام الدفع عبر Telegram Stars. في المتصفح السعر بالروبل على التبويب نفسه. الرسالة الصوتية تصبح نصًا فقط بعد دفع «الأسبوع»، حتى 10 مرات في اليوم."]],
    ["هذا ليس علاجًا", ["Between ليس طبيبًا ولا يحل محل الجلسة. إذا كنت بحالة سيئة الآن، فتواصل مع اختصاصيك أو مع خدمة الطوارئ."]],
    ["الدفع", ["المدة والسعر مكتوبان قبل الدفع. في تيليغرام، 30 يومًا اشتراك: يُلغى في تيليغرام، ويبقى الوصول حتى نهاية المدة المدفوعة. 3 أشهر وسنة دفعة واحدة. إذا خُصم المال ولم يُفتح «الأسبوع»، أو احتجت إلى استرداد، فاكتب للبوت ماذا حدث ومتى."]],
    ["ملاحظاتك", ["الملاحظات لك. لا نبيع نصها. يمكنك التوقف في أي وقت. لحذف اليوميات، اكتب للبوت واذكر البريد أو تيليغرام الذي دخلت منه."]],
  ], true),
  fa: doc("شرایط استفاده", "۳ نوامبر ۲۰۲۶", [
    ["چه کسی سرویس را اداره می‌کند", ["Between دفتر بین جلسه‌های درمان است. آن را آناستاسیا بوریسوونا لیاتوروفسایا (Ляторовская Анастасия Борисовна)، خویش‌فرما، با INN 770507475005 اداره می‌کند. می‌توانید به بات @BetweenJournalBot بنویسید."]],
    ["چه می‌کند", ["یک احساس را علامت می‌زنید و یادداشتی کوتاه می‌نویسید. تا جلسه، این‌ها یک هفته می‌شوند: طیف، تکرارها و موضوع‌هایی که گفتنشان مهم است. اگر بات تلگرام را وصل کنید، عصر می‌تواند بپرسد روز چطور گذشت و پاسخ را در همین دفتر ذخیره کند."]],
    ["دفتر و «هفته»", ["دفتر رایگان است. برگه «هفته» از اولین باز کردن ۷ روز باز است و بعد باید پرداخت شود. در تلگرام پرداخت با Telegram Stars است. در مرورگر قیمت به روبل روی همان برگه نوشته شده. پیام صوتی فقط پس از پرداخت «هفته» متن می‌شود، حداکثر ۱۰ بار در روز."]],
    ["این درمان نیست", ["Between پزشک نیست و جای جلسه را نمی‌گیرد. اگر همین حالا حالتان بد است، به متخصص خود یا اورژانس مراجعه کنید."]],
    ["پرداخت", ["مدت و قیمت پیش از پرداخت نوشته می‌شود. در تلگرام ۳۰ روز اشتراک است: در تلگرام لغو می‌شود و دسترسی تا پایان دورهٔ پرداخت‌شده می‌ماند. ۳ ماه و یک سال پرداخت یک‌باره است. اگر پول کم شد و «هفته» باز نشد، یا بازپرداخت لازم است، به بات بنویسید چه شد و کی."]],
    ["یادداشت‌های شما", ["یادداشت‌ها مال شماست. متنشان را نمی‌فروشیم. هر وقت بخواهید می‌توانید استفاده را متوقف کنید. برای حذف دفتر، به بات بنویسید و بگویید با کدام ایمیل یا تلگرام وارد شده‌اید."]],
  ], true),
  hi: doc("उपयोग की शर्तें", "3 नवंबर 2026", [
    ["सेवा कौन चलाता है", ["Between थेरेपी सत्रों के बीच की डायरी है. इसे स्व-नियोजित Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) चलाती हैं, INN 770507475005. आप बॉट @BetweenJournalBot को लिख सकते हैं."]],
    ["यह क्या करता है", ["आप एक भावना चिह्नित करते हैं और छोटा नोट लिखते हैं. सत्र तक इससे एक हफ़्ता बनता है: स्पेक्ट्रम, जो दोहराया, और जिन विषयों पर कहना चाहिए. Telegram बॉट जोड़ने पर वह शाम को पूछ सकता है कि दिन कैसा रहा, और जवाब इसी डायरी में रखे."]],
    ["डायरी और «हफ़्ता»", ["डायरी मुफ़्त है. «हफ़्ता» पहली बार खोलने के 7 दिन तक खुला रहता है, फिर भुगतान करना होता है. Telegram में भुगतान Telegram Stars से होता है. ब्राउज़र में कीमत रूबल में उसी टैब पर लिखी होती है. आवाज़ का संदेश «हफ़्ता» के भुगतान के बाद ही पाठ बनता है, दिन में 10 तक."]],
    ["यह इलाज नहीं है", ["Between डॉक्टर नहीं है और सत्र की जगह नहीं लेता. अगर अभी बुरा लग रहा है, तो अपने विशेषज्ञ या आपातकालीन सेवा से संपर्क करें."]],
    ["भुगतान", ["अवधि और कीमत भुगतान से पहले लिखी होती है. Telegram में 30 दिन सदस्यता है: Telegram में रद्द करें, पहुँच भुगतान अवधि के अंत तक रहती है. 3 महीने और एक साल एक बार का भुगतान है. अगर पैसे कट गए और «हफ़्ता» नहीं खुला, या धनवापसी चाहिए, तो बॉट को लिखें क्या हुआ और कब."]],
    ["आपके नोट", ["नोट आपके हैं. हम उनका पाठ नहीं बेचते. सेवा कभी भी छोड़ सकते हैं. डायरी मिटाने के लिए बॉट को लिखें और बताएं कि किस ईमेल या Telegram से आए थे."]],
  ], true),
  uz: doc("Foydalanish shartlari", "3 noyabr 2026", [
    ["Xizmatni kim yuritadi", ["Between — terapiya seanslari orasidagi kundalik. Uni o‘zini o‘zi band qilgan Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) yuritadi, INN 770507475005. @BetweenJournalBot botiga yozishingiz mumkin."]],
    ["Nima qiladi", ["His-tuyg‘uni belgilaysiz va qisqa yozuv yozasiz. Seansga borib bu haftaga aylanadi: spektr, takrorlar va aytishga arziydigan mavzular. Telegram botini ulasangiz, kechqurun kun qanday o‘tganini so‘rashi va javobni shu kundalikka saqlashi mumkin."]],
    ["Kundalik va «Hafta»", ["Kundalik bepul. «Hafta» birinchi ochilganidan 7 kun ochiq, keyin to‘lanadi. Telegramda to‘lov Telegram Stars orqali. Brauzerda narx rubl bilan shu varaqda yozilgan. Ovozli xabar matnga faqat «Hafta» to‘langach aylanadi, kuniga 10 tagacha."]],
    ["Bu davolash emas", ["Between shifokor emas va seans o‘rnini bosmaydi. Hozir yomon bo‘lsangiz, o‘z mutaxassisingizga yoki tez yordamga murojaat qiling."]],
    ["To‘lov", ["Muddat va narx to‘lovdan oldin yoziladi. Telegramda 30 kun — obuna: Telegramda bekor qilinadi, kirish to‘langan muddat oxirigacha qoladi. 3 oy va bir yil — bir martalik to‘lov. Pul yechilgan, lekin «Hafta» ochilmagan bo‘lsa yoki qaytarish kerak bo‘lsa, botga nima bo‘lganini va qachonligini yozing."]],
    ["Yozuvlaringiz", ["Yozuvlar sizniki. Matnini sotmaymiz. Xizmatdan istalgan payt chiqishingiz mumkin. Kundalikni o‘chirish uchun botga yozing va qaysi pochta yoki Telegramdan kirganingizni ayting."]],
  ], true),
};

const PRIVACY: Record<LocaleId, LegalDoc> = {
  ru: doc("Политика конфиденциальности", "3 ноября 2026", [
    ["Кто отвечает за данные", ["За данные отвечает самозанятая Ляторовская Анастасия Борисовна, ИНН 770507475005. Попросить показать, исправить или удалить данные можно у бота @BetweenJournalBot."]],
    ["Какие данные", ["Почта, если входите в браузере. Идентификатор Telegram, если открываете мини-приложение или подключаете бота. Идентификатор VK, Яндекса или Сбера, если входите через них. Текст заметок, чувства, темы, сеансы и напоминания. Язык и часовой пояс. Факт оплаты «Недели» и дата, до которой она открыта. Голосовое сообщение нужно только чтобы превратить его в текст заметки: сам файл в дневнике не хранится."]],
    ["Зачем", ["Чтобы хранить дневник, открывать его с телефона и компьютера и соединять его с ботом. Текст заметок может уходить в модель, которая собирает краткий текст недели и темы к сеансу. Это не реклама других продуктов."]],
    ["Кому ещё они попадают", ["Заметки лежат в базе Upstash Redis. Сайт открывается через Vercel. Расшифровка голоса и текст для модели идут через AI Tunnel, а если этот ключ не задан — через Gemini или Groq. На публичной странице сайта визит считает Яндекс Метрика. В приложении шаги воронки считает PostHog в США, без имени и без идентификатора Telegram. Страну по IP мы смотрим только в момент запроса, чтобы предупредить, что Telegram из России может не открыться без VPN, и отдельно её не храним."]],
    ["Сколько хранятся", ["Пока вы пользуетесь дневником. После просьбы удалить стираем заметки и вход. Обезличенные счётчики за прошлые дни остаются без привязки к вам."]],
    ["Что можно попросить", ["Можно попросить показать, исправить или удалить данные. Напишите боту, с какой почты или из какого Telegram открывали дневник."]],
  ]),
  en: doc("Privacy policy", "3 November 2026", [
    ["Who is responsible", ["Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), a self-employed person, INN 770507475005, is responsible for the data. You can ask the bot @BetweenJournalBot to show, correct, or delete it."]],
    ["What data", ["Your email, if you sign in in the browser. Your Telegram id, if you open the Mini App or connect the bot. A VK, Yandex, or Sber id, if you sign in through one of them. The text of notes, feelings, topics, sessions, and reminders. Language and time zone. Whether Week is paid and until which date. A voice message is used only to turn it into note text: the file itself is not kept in the journal."]],
    ["Why", ["To keep the journal, open it from a phone and a computer, and connect it to the bot. Note text can be sent to a model that writes the short week text and the topics for the session. This is not advertising for other products."]],
    ["Who else receives it", ["Notes are stored in Upstash Redis. The site is served by Vercel. Voice transcription and the text for the model go through AI Tunnel, or through Gemini or Groq when that key is not set. Yandex Metrika counts visits on the public page. PostHog in the US counts funnel steps inside the app, without a name and without a Telegram id. We read the country from the IP only for that request, to warn that Telegram from Russia may not open without a VPN, and we do not store the country."]],
    ["How long", ["While you use the journal. After you ask us to delete it, we erase the notes and the sign-in. Anonymous counts from past days stay, with nothing that points to you."]],
    ["What you can ask", ["You can ask to see, correct, or delete the data. Write the bot and say which email or Telegram you used."]],
  ], true),
  uk: doc("Політика конфіденційності", "3 листопада 2026", [
    ["Хто відповідає за дані", ["За дані відповідає самозайнята Ляторовська Анастасія Борисівна (Ляторовская Анастасия Борисовна), ІПН 770507475005. Показати, виправити або видалити дані можна попросити в бота @BetweenJournalBot."]],
    ["Які дані", ["Пошта, якщо входите в браузері. Ідентифікатор Telegram, якщо відкриваєте мінізастосунок або підключаєте бота. Ідентифікатор VK, Яндекса або Сбера, якщо входите через них. Текст нотаток, почуття, теми, сеанси і нагадування. Мова і часовий пояс. Факт оплати «Тижня» і дата, до якої він відкритий. Голосове повідомлення потрібне лише щоб перетворити його на текст нотатки: сам файл у щоденнику не зберігається."]],
    ["Навіщо", ["Щоб зберігати щоденник, відкривати його з телефона і комп’ютера і з’єднувати його з ботом. Текст нотаток може йти в модель, яка збирає короткий текст тижня і теми до сеансу. Це не реклама інших продуктів."]],
    ["Кому ще вони потрапляють", ["Нотатки лежать у базі Upstash Redis. Сайт відкривається через Vercel. Розшифрування голосу і текст для моделі йдуть через AI Tunnel, а якщо цей ключ не заданий — через Gemini або Groq. На публічній сторінці сайту візит рахує Яндекс Метрика. У застосунку кроки вирви рахує PostHog у США, без імені і без ідентифікатора Telegram. Країну за IP ми дивимося лише в момент запиту, щоб попередити, що Telegram з Росії може не відкритися без VPN, і окремо її не зберігаємо."]],
    ["Скільки зберігаються", ["Поки ви користуєтеся щоденником. Після прохання видалити стираємо нотатки і вхід. Знеособлені лічильники за минулі дні лишаються без прив’язки до вас."]],
    ["Що можна попросити", ["Можна попросити показати, виправити або видалити дані. Напишіть боту, з якої пошти або з якого Telegram відкривали щоденник."]],
  ], true),
  es: doc("Política de privacidad", "3 de noviembre de 2026", [
    ["Quién responde de los datos", ["Responde Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), trabajadora autónoma, INN 770507475005. Puedes pedir al bot @BetweenJournalBot que muestre, corrija o borre los datos."]],
    ["Qué datos", ["El correo, si entras en el navegador. El identificador de Telegram, si abres la Mini App o conectas el bot. Un identificador de VK, Yandex o Sber, si entras por ellos. El texto de las notas, los sentimientos, los temas, las sesiones y los recordatorios. El idioma y la zona horaria. Si Semana está pagada y hasta qué fecha. Un mensaje de voz solo sirve para convertirlo en texto: el archivo no se guarda en el diario."]],
    ["Para qué", ["Para guardar el diario, abrirlo desde el teléfono y el ordenador y conectarlo con el bot. El texto de las notas puede ir a un modelo que escribe el texto breve de la semana y los temas para la sesión. No es publicidad de otros productos."]],
    ["Quién más los recibe", ["Las notas están en Upstash Redis. El sitio se abre a través de Vercel. La transcripción de la voz y el texto para el modelo van por AI Tunnel o, si esa clave no está, por Gemini o Groq. En la página pública, Yandex Metrika cuenta la visita. Dentro de la app, PostHog en EE. UU. cuenta los pasos del recorrido, sin nombre y sin identificador de Telegram. La país según la IP se mira solo en esa solicitud, para avisar de que Telegram desde Rusia puede no abrirse sin VPN, y no se guarda."]],
    ["Cuánto tiempo", ["Mientras uses el diario. Si pides borrarlo, borramos las notas y el acceso. Los conteos anónimos de días pasados se quedan, sin nada que te identifique."]],
    ["Qué puedes pedir", ["Puedes pedir ver, corregir o borrar los datos. Escribe al bot y di con qué correo o Telegram entraste."]],
  ], true),
  pt: doc("Política de privacidade", "3 de novembro de 2026", [
    ["Quem responde pelos dados", ["Quem responde é Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), autônoma, INN 770507475005. Você pode pedir ao bot @BetweenJournalBot para mostrar, corrigir ou apagar os dados."]],
    ["Quais dados", ["O e-mail, se você entra no navegador. O identificador do Telegram, se abre o Mini App ou conecta o bot. Um identificador de VK, Yandex ou Sber, se entra por eles. O texto das notas, sentimentos, temas, sessões e lembretes. Idioma e fuso horário. Se a Semana está paga e até qual data. Uma mensagem de voz serve só para virar texto: o arquivo não fica no diário."]],
    ["Para quê", ["Para guardar o diário, abri-lo no telefone e no computador e ligá-lo ao bot. O texto das notas pode ir a um modelo que escreve o texto curto da semana e os temas da sessão. Isso não é anúncio de outros produtos."]],
    ["Quem mais recebe", ["As notas ficam no Upstash Redis. O site abre pela Vercel. A transcrição da voz e o texto para o modelo passam pelo AI Tunnel ou, se essa chave não existe, pelo Gemini ou Groq. Na página pública, o Yandex Metrika conta a visita. No aplicativo, o PostHog nos EUA conta os passos, sem nome e sem identificador do Telegram. O país pelo IP é lido só naquela solicitação, para avisar que o Telegram da Rússia pode não abrir sem VPN, e não é guardado."]],
    ["Por quanto tempo", ["Enquanto você usa o diário. Depois do pedido de exclusão, apagamos as notas e o acesso. Contagens anônimas de dias passados ficam, sem nada que aponte para você."]],
    ["O que você pode pedir", ["Você pode pedir para ver, corrigir ou apagar os dados. Escreva ao bot e diga qual e-mail ou Telegram usou."]],
  ], true),
  tr: doc("Gizlilik politikası", "3 Kasım 2026", [
    ["Veriden kim sorumlu", ["Veriden serbest meslek sahibi Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) sorumludur, INN 770507475005. Göstermesini, düzeltmesini veya silmesini @BetweenJournalBot botundan isteyebilirsiniz."]],
    ["Hangi veriler", ["Tarayıcıdan girerseniz e-posta. Mini uygulamayı açar veya botu bağlarsanız Telegram kimliği. VK, Yandex veya Sber ile girerseniz onların kimliği. Notların metni, duygular, konular, seanslar ve anımsatmalar. Dil ve saat dilimi. Haftanın ödenip ödenmediği ve hangi tarihe kadar açık olduğu. Sesli mesaj yalnızca metne çevirmek içindir: dosyanın kendisi günlükte tutulmaz."]],
    ["Neden", ["Günlüğü saklamak, telefondan ve bilgisayardan açmak ve bota bağlamak için. Not metni, haftanın kısa metnini ve seans konularını yazan bir modele gidebilir. Bu, başka ürünlerin reklamı değildir."]],
    ["Başka kim alır", ["Notlar Upstash Redis’te durur. Site Vercel üzerinden açılır. Ses çözümü ve model için metin AI Tunnel üzerinden gider; bu anahtar yoksa Gemini veya Groq üzerinden. Herkese açık sayfada ziyareti Yandex Metrika sayar. Uygulamada ABD’deki PostHog adım sayar, ad ve Telegram kimliği olmadan. IP’den ülkeyi yalnızca o istek sırasında okuruz, Rusya’dan Telegram’ın VPN’siz açılmayabileceğini söylemek için, ve ülkeyi saklamayız."]],
    ["Ne kadar durur", ["Günlüğü kullandığınız sürece. Silinmesini isteyince notları ve girişi sileriz. Geçmiş günlerin anonim sayaçları, size bağlanmadan kalır."]],
    ["Ne isteyebilirsiniz", ["Veriyi göstermeyi, düzeltmeyi veya silmeyi isteyebilirsiniz. Bota yazın ve hangi e-posta ya da Telegram ile girdiğinizi söyleyin."]],
  ], true),
  id: doc("Kebijakan privasi", "3 November 2026", [
    ["Siapa yang bertanggung jawab", ["Yang bertanggung jawab adalah Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), pekerja mandiri, INN 770507475005. Anda dapat meminta bot @BetweenJournalBot untuk menunjukkan, memperbaiki, atau menghapus data."]],
    ["Data apa", ["Email, jika masuk lewat peramban. Id Telegram, jika membuka Mini App atau menghubungkan bot. Id VK, Yandex, atau Sber, jika masuk lewat salah satunya. Teks catatan, perasaan, topik, sesi, dan pengingat. Bahasa dan zona waktu. Apakah Minggu sudah dibayar dan sampai tanggal berapa. Pesan suara hanya dipakai untuk dijadikan teks: berkasnya tidak disimpan di jurnal."]],
    ["Untuk apa", ["Untuk menyimpan jurnal, membukanya dari telepon dan komputer, dan menghubungkannya dengan bot. Teks catatan dapat dikirim ke model yang menulis ringkasan minggu dan topik untuk sesi. Ini bukan iklan produk lain."]],
    ["Siapa lagi yang menerimanya", ["Catatan disimpan di Upstash Redis. Situs dibuka lewat Vercel. Transkripsi suara dan teks untuk model lewat AI Tunnel, atau lewat Gemini atau Groq jika kunci itu tidak ada. Di halaman publik, Yandex Metrika menghitung kunjungan. Di aplikasi, PostHog di AS menghitung langkah, tanpa nama dan tanpa id Telegram. Negara dari IP dibaca hanya pada permintaan itu, untuk memperingatkan bahwa Telegram dari Rusia mungkin tidak terbuka tanpa VPN, dan tidak disimpan."]],
    ["Berapa lama", ["Selama Anda memakai jurnal. Setelah Anda minta dihapus, catatan dan masuk dihapus. Hitungan anonim hari-hari lalu tetap ada, tanpa yang menunjuk kepada Anda."]],
    ["Apa yang dapat diminta", ["Anda dapat meminta data ditunjukkan, diperbaiki, atau dihapus. Tulis ke bot dan sebutkan email atau Telegram yang dipakai untuk masuk."]],
  ], true),
  vi: doc("Chính sách quyền riêng tư", "3 tháng 11 năm 2026", [
    ["Ai chịu trách nhiệm về dữ liệu", ["Người chịu trách nhiệm là Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна), cá nhân tự kinh doanh, INN 770507475005. Bạn có thể nhờ bot @BetweenJournalBot cho xem, sửa hoặc xóa dữ liệu."]],
    ["Dữ liệu nào", ["Email, nếu bạn vào bằng trình duyệt. Id Telegram, nếu bạn mở Mini App hoặc kết nối bot. Id VK, Yandex hoặc Sber, nếu bạn vào bằng một trong các dịch vụ đó. Nội dung ghi chú, cảm xúc, chủ đề, buổi trị liệu và lời nhắc. Ngôn ngữ và múi giờ. Tuần đã được trả hay chưa và đến ngày nào. Tin nhắn thoại chỉ để chuyển thành chữ: tệp không được giữ trong nhật ký."]],
    ["Để làm gì", ["Để giữ nhật ký, mở từ điện thoại và máy tính, và nối với bot. Nội dung ghi chú có thể được gửi tới mô hình viết đoạn tóm tắt tuần và chủ đề cho buổi trị liệu. Đây không phải quảng cáo sản phẩm khác."]],
    ["Ai khác nhận được", ["Ghi chú nằm ở Upstash Redis. Trang được mở qua Vercel. Chuyển giọng nói thành chữ và nội dung cho mô hình đi qua AI Tunnel, hoặc qua Gemini hay Groq khi chưa có khóa đó. Trên trang công khai, Yandex Metrika đếm lượt vào. Trong ứng dụng, PostHog ở Mỹ đếm các bước, không có tên và không có id Telegram. Quốc gia theo IP chỉ được đọc ở lần yêu cầu đó, để báo rằng Telegram từ Nga có thể không mở nếu không có VPN, và không được lưu."]],
    ["Giữ bao lâu", ["Trong lúc bạn dùng nhật ký. Sau khi bạn yêu cầu xóa, ghi chú và lối vào bị xóa. Số đếm ẩn danh của những ngày trước vẫn còn, không gắn với bạn."]],
    ["Bạn có thể yêu cầu gì", ["Bạn có thể yêu cầu xem, sửa hoặc xóa dữ liệu. Hãy viết cho bot và nói email hoặc Telegram bạn đã dùng để vào."]],
  ], true),
  ar: doc("سياسة الخصوصية", "3 نوفمبر 2026", [
    ["من المسؤول عن البيانات", ["المسؤولة هي أناستاسيا بوريسوفنا لياتوروفسكايا (Ляторовская Анастасия Борисовна)، عاملة لحسابها، INN 770507475005. يمكن طلب الإظهار أو التصحيح أو الحذف من البوت @BetweenJournalBot."]],
    ["أي بيانات", ["البريد إذا دخلت من المتصفح. معرّف تيليغرام إذا فتحت التطبيق المصغّر أو وصلت البوت. معرّف VK أو ياندكس أو سبير إذا دخلت عبر أحدها. نص الملاحظات والمشاعر والمواضيع والجلسات والتذكيرات. اللغة والمنطقة الزمنية. هل دُفع «الأسبوع» وإلى أي تاريخ. الرسالة الصوتية تُستخدم فقط لتحويلها إلى نص: الملف نفسه لا يُحفظ في اليوميات."]],
    ["لماذا", ["لحفظ اليوميات وفتحها من الهاتف والحاسوب وربطها بالبوت. قد يذهب نص الملاحظات إلى نموذج يكتب نص الأسبوع القصير ومواضيع الجلسة. هذا ليس إعلانًا عن منتجات أخرى."]],
    ["من غيرك يستلمها", ["الملاحظات في قاعدة Upstash Redis. الموقع يُفتح عبر Vercel. تفريغ الصوت والنص للنموذج يمران عبر AI Tunnel، أو عبر Gemini أو Groq إذا لم يوجد هذا المفتاح. في الصفحة العامة تحسب Yandex Metrika الزيارة. داخل التطبيق يحسب PostHog في الولايات المتحدة الخطوات، بلا اسم وبلا معرّف تيليغرام. نقرأ البلد من عنوان IP في لحظة الطلب فقط، لنحذّر أن تيليغرام من روسيا قد لا يفتح بلا VPN، ولا نخزّن البلد."]],
    ["كم تبقى", ["ما دمت تستخدم اليوميات. بعد طلب الحذف نمسح الملاحظات والدخول. العدادات المجهولة للأيام السابقة تبقى من دون ما يدل عليك."]],
    ["ماذا يمكن أن تطلب", ["يمكن طلب إظهار البيانات أو تصحيحها أو حذفها. اكتب للبوت واذكر البريد أو تيليغرام الذي دخلت منه."]],
  ], true),
  fa: doc("سیاست حریم خصوصی", "۳ نوامبر ۲۰۲۶", [
    ["چه کسی مسئول داده‌هاست", ["مسئول داده‌ها آناستاسیا بوریسوونا لیاتوروفسایا (Ляторовская Анастасия Борисовна)، خویش‌فرما، با INN 770507475005 است. می‌توانید از بات @BetweenJournalBot بخواهید داده‌ها را نشان دهد، اصلاح کند یا حذف کند."]],
    ["چه داده‌هایی", ["ایمیل، اگر از مرورگر وارد شوید. شناسهٔ تلگرام، اگر مینی‌اپ را باز کنید یا بات را وصل کنید. شناسهٔ VK، یاندکس یا اسبر، اگر از آن‌ها وارد شوید. متن یادداشت‌ها، احساس‌ها، موضوع‌ها، جلسه‌ها و یادآوری‌ها. زبان و منطقهٔ زمانی. اینکه «هفته» پرداخت شده و تا چه تاریخی باز است. پیام صوتی فقط برای تبدیل به متن است: خود فایل در دفتر نگه داشته نمی‌شود."]],
    ["برای چه", ["تا دفتر را نگه داریم، از تلفن و رایانه باز کنیم و به بات وصل کنیم. متن یادداشت‌ها ممکن است به مدلی برود که متن کوتاه هفته و موضوع‌های جلسه را می‌نویسد. این تبلیغ محصول دیگر نیست."]],
    ["چه کس دیگری آن‌ها را می‌گیرد", ["یادداشت‌ها در Upstash Redis هستند. سایت از طریق Vercel باز می‌شود. تبدیل صدا به متن و متن برای مدل از AI Tunnel می‌گذرد، و اگر آن کلید نباشد از Gemini یا Groq. در صفحهٔ عمومی، Yandex Metrika بازدید را می‌شمارد. در برنامه، PostHog در آمریکا گام‌ها را می‌شمارد، بدون نام و بدون شناسهٔ تلگرام. کشور را از IP فقط در همان درخواست می‌خوانیم تا هشدار دهیم تلگرام از روسیه ممکن است بدون VPN باز نشود، و کشور را ذخیره نمی‌کنیم."]],
    ["چقدر می‌مانند", ["تا وقتی از دفتر استفاده می‌کنید. پس از درخواست حذف، یادداشت‌ها و ورود را پاک می‌کنیم. شمارنده‌های بی‌نام روزهای گذشته، بدون پیوند به شما، می‌مانند."]],
    ["چه می‌توانید بخواهید", ["می‌توانید نشان دادن، اصلاح یا حذف داده‌ها را بخواهید. به بات بنویسید و بگویید با کدام ایمیل یا تلگرام وارد شده‌اید."]],
  ], true),
  hi: doc("गोपनीयता नीति", "3 नवंबर 2026", [
    ["डेटा का ज़िम्मा किसका है", ["डेटा की ज़िम्मेदार स्व-नियोजित Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) हैं, INN 770507475005. दिखाने, सुधारने या मिटाने के लिए बॉट @BetweenJournalBot को लिख सकते हैं."]],
    ["कौन सा डेटा", ["ईमेल, अगर ब्राउज़र से आते हैं. Telegram id, अगर मिनी ऐप खोलते हैं या बॉट जोड़ते हैं. VK, Yandex या Sber की id, अगर उन्हीं से आते हैं. नोट का पाठ, भावनाएँ, विषय, सत्र और याददिलाना. भाषा और समय क्षेत्र. «हफ़्ता» चुकाया गया है या नहीं, और किस तारीख तक. आवाज़ का संदेश केवल पाठ बनाने के लिए है: फ़ाइल डायरी में नहीं रखी जाती."]],
    ["किसलिए", ["डायरी रखने, उसे फ़ोन और कंप्यूटर से खोलने, और बॉट से जोड़ने के लिए. नोट का पाठ उस मॉडल के पास जा सकता है जो हफ़्ते का छोटा पाठ और सत्र के विषय लिखता है. यह दूसरे उत्पादों का विज्ञापन नहीं है."]],
    ["और किसे मिलता है", ["नोट Upstash Redis में रहते हैं. साइट Vercel से खुलती है. आवाज़ का पाठ और मॉडल के लिए लिखा AI Tunnel से जाता है, और वह कुंजी न हो तो Gemini या Groq से. सार्वजनिक पृष्ठ पर यात्रा Yandex Metrika गिनती है. ऐप में कदम अमेरिका का PostHog गिनता है, नाम और Telegram id के बिना. IP से देश केवल उसी अनुरोध पर देखा जाता है, यह बताने के लिए कि रूस से Telegram बिना VPN नहीं खुल सकता, और देश अलग से नहीं रखा जाता."]],
    ["कितनी देर", ["जब तक आप डायरी इस्तेमाल करते हैं. मिटाने को कहने के बाद नोट और प्रवेश मिटा देते हैं. पिछले दिनों की बिना नाम की गिनती रह जाती है, आपसे बिना जुड़े."]],
    ["आप क्या माँग सकते हैं", ["डेटा दिखाने, सुधारने या मिटाने को कह सकते हैं. बॉट को लिखें और बताएं कि किस ईमेल या Telegram से आए थे."]],
  ], true),
  uz: doc("Maxfiylik siyosati", "3 noyabr 2026", [
    ["Ma’lumot uchun kim javob beradi", ["Ma’lumot uchun o‘zini o‘zi band qilgan Anastasia Borisovna Lyatorovskaya (Ляторовская Анастасия Борисовна) javob beradi, INN 770507475005. Ko‘rsatish, tuzatish yoki o‘chirishni @BetweenJournalBot botidan so‘rashingiz mumkin."]],
    ["Qanday ma’lumot", ["Pochta, agar brauzerdan kirsangiz. Telegram identifikatori, agar mini-ilovani ochsangiz yoki botni ulasangiz. VK, Yandex yoki Sber identifikatori, agar ulardan kirsangiz. Yozuvlar matni, his-tuyg‘ular, mavzular, seanslar va eslatmalar. Til va vaqt mintaqasi. «Hafta» to‘langani va qaysi sanagacha ochiqligi. Ovozli xabar faqat matnga aylantirish uchun: faylning o‘zi kundalikda saqlanmaydi."]],
    ["Nima uchun", ["Kundalikni saqlash, telefon va kompyuterdan ochish va botga ulash uchun. Yozuv matni haftaning qisqa matni va seans mavzularini yozadigan modelga borishi mumkin. Bu boshqa mahsulot reklaması emas."]],
    ["Yana kim oladi", ["Yozuvlar Upstash Redis’da turadi. Sayt Vercel orqali ochiladi. Ovozni matnga aylantirish va model uchun matn AI Tunnel orqali, agar bu kalit bo‘lmasa Gemini yoki Groq orqali ketadi. Ommaviy sahifada tashrifni Yandex Metrika sanaydi. Ilovada qadamlarni AQShdagi PostHog sanaydi, ism va Telegram identifikatorisiz. IP bo‘yicha mamlakatni faqat o‘sha so‘rov paytida ko‘ramiz, Rossiyadan Telegram VPN’siz ochilmasligi mumkinligini aytish uchun, va uni alohida saqlamaymiz."]],
    ["Qancha saqlanadi", ["Kundalikdan foydalanganingizcha. O‘chirishni so‘raganingizdan keyin yozuvlar va kirishni o‘chiramiz. O‘tgan kunlarning ismsiz hisoblagichlari sizga bog‘lanmagan holda qoladi."]],
    ["Nima so‘rashingiz mumkin", ["Ma’lumotni ko‘rsatish, tuzatish yoki o‘chirishni so‘rashingiz mumkin. Botga yozing va qaysi pochta yoki Telegramdan kirganingizni ayting."]],
  ], true),
};

export function legalDocument(kind: LegalKind, locale: LocaleId): LegalDoc {
  const book = kind === "terms" ? TERMS : PRIVACY;
  return book[locale] ?? book.ru;
}

export function legalLocales(): LocaleId[] {
  return Object.keys(TERMS) as LocaleId[];
}
