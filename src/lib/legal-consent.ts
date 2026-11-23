import type { LocaleId } from "./i18n";

type Consent = { title: string; statement: string; scope: string; withdrawal: string };

export const CONSENT: Record<LocaleId, Consent> = {
  ru: {
    title: "Согласие на обработку персональных данных",
    statement: "Я даю оператору Between согласие на обработку данных для входа в аккаунт, хранения моих записей и работы выбранных мной функций дневника.",
    scope: "Согласие охватывает данные для входа (адрес почты или идентификатор подключённого аккаунта), мои записи и отметки, а также технические данные, необходимые для работы сервиса. Оператор может собирать, хранить, использовать, обновлять и удалять эти данные и передавать их сервисам, указанным в политике конфиденциальности, для названных целей.",
    withdrawal: "Согласие действует до его отзыва. Чтобы отозвать согласие, напишите на help@between-journal.ru. Удалить дневник можно в настройках аккаунта.",
  },
  en: {
    title: "Consent to personal data processing",
    statement: "I consent to the Between operator processing my data so I can sign in, keep my entries and use the journal features I choose.",
    scope: "This covers my sign-in email or linked account ID, my entries and check-ins, and technical data needed to run the service. The operator may collect, store, use, update and delete this data and share it with the providers listed in the privacy policy for these purposes.",
    withdrawal: "Consent remains in effect until withdrawn. To withdraw it, email help@between-journal.ru. You can delete your journal in account settings.",
  },
  uk: {
    title: "Згода на обробку персональних даних",
    statement: "Я погоджуюся на обробку моїх даних оператором Between для входу в акаунт, зберігання записів та роботи обраних функцій щоденника.",
    scope: "Це охоплює електронну пошту або ідентифікатор акаунта, записи, позначки й технічні дані. Оператор може збирати, зберігати, використовувати, оновлювати та видаляти їх і передавати зазначеним у політиці сервісам для цих цілей.",
    withdrawal: "Згода діє до відкликання. Для відкликання напишіть на help@between-journal.ru. Щоденник можна видалити в налаштуваннях акаунта.",
  },
  es: {
    title: "Consentimiento para el tratamiento de datos personales",
    statement: "Autorizo al operador de Between a tratar mis datos para iniciar sesión, guardar mis entradas y utilizar las funciones que elija.",
    scope: "Esto incluye mi correo o identificador de cuenta, mis entradas, mis registros de ánimo y los datos técnicos necesarios. El operador puede recopilar, guardar, usar, actualizar y eliminar estos datos y comunicarlos para estos fines a los proveedores indicados en la política de privacidad.",
    withdrawal: "El consentimiento sigue vigente hasta su retirada. Para retirarlo, escribe a help@between-journal.ru. Puedes eliminar tu diario en los ajustes de la cuenta.",
  },
  pt: {
    title: "Consentimento para o tratamento de dados pessoais",
    statement: "Autorizo o operador do Between a tratar meus dados para acessar a conta, guardar minhas anotações e usar as funções que eu escolher.",
    scope: "Isso inclui o e-mail ou identificador da conta, anotações, registros de humor e dados técnicos necessários. O operador pode coletar, armazenar, usar, atualizar e excluir esses dados e compartilhá-los para esses fins com os serviços indicados na política de privacidade.",
    withdrawal: "O consentimento vale até sua revogação. Para revogá-lo, escreva para help@between-journal.ru. Você pode excluir o diário nas configurações da conta.",
  },
  tr: {
    title: "Kişisel verilerin işlenmesine rıza",
    statement: "Oturum açmak, kayıtlarımı saklamak ve seçtiğim günlük özelliklerini kullanmak için Between işletmecisinin verilerimi işlemesine izin veriyorum.",
    scope: "Buna e-posta adresi veya bağlı hesap kimliği, günlük kayıtları, duygu işaretleri ve gerekli teknik veriler dahildir. İşletmeci bunları toplayabilir, saklayabilir, kullanabilir, güncelleyebilir, silebilir ve bu amaçlarla gizlilik politikasında belirtilen hizmetlerle paylaşabilir.",
    withdrawal: "Rıza geri çekilene kadar geçerlidir. Geri çekmek için help@between-journal.ru adresine yazın. Günlüğü hesap ayarlarından silebilirsiniz.",
  },
  id: {
    title: "Persetujuan pemrosesan data pribadi",
    statement: "Saya mengizinkan pengelola Between memproses data saya untuk masuk, menyimpan catatan dan menggunakan fitur jurnal yang saya pilih.",
    scope: "Data mencakup email atau ID akun tertaut, catatan, suasana hati dan data teknis yang diperlukan. Pengelola dapat mengumpulkan, menyimpan, memakai, memperbarui, menghapus dan membagikan data ini kepada penyedia dalam kebijakan privasi untuk tujuan tersebut.",
    withdrawal: "Persetujuan berlaku hingga dicabut. Untuk mencabutnya, kirim email ke help@between-journal.ru. Jurnal dapat dihapus di pengaturan akun.",
  },
  vi: {
    title: "Đồng ý cho xử lý dữ liệu cá nhân",
    statement: "Tôi đồng ý để đơn vị vận hành Between xử lý dữ liệu của tôi để đăng nhập, lưu các mục nhật ký và sử dụng những tính năng tôi chọn.",
    scope: "Dữ liệu gồm email hoặc mã tài khoản liên kết, các mục nhật ký, ghi nhận cảm xúc và dữ liệu kỹ thuật cần thiết. Đơn vị vận hành có thể thu thập, lưu trữ, sử dụng, cập nhật, xóa và chia sẻ chúng với các dịch vụ nêu trong chính sách quyền riêng tư cho các mục đích này.",
    withdrawal: "Sự đồng ý có hiệu lực đến khi được rút lại. Để rút lại, hãy gửi email đến help@between-journal.ru. Bạn có thể xóa nhật ký trong cài đặt tài khoản.",
  },
  hi: {
    title: "व्यक्तिगत डेटा के प्रसंस्करण की सहमति",
    statement: "मैं Between के संचालक को साइन इन करने, अपनी प्रविष्टियाँ सहेजने और अपनी चुनी हुई डायरी सुविधाओं का उपयोग करने के लिए अपने डेटा को संसाधित करने की अनुमति देता/देती हूँ।",
    scope: "इसमें ईमेल या जुड़े खाते की आईडी, प्रविष्टियाँ, भावनाओं के रिकॉर्ड और आवश्यक तकनीकी डेटा शामिल हैं। संचालक इन उद्देश्यों के लिए डेटा एकत्र, संग्रहीत, उपयोग, अपडेट और हटा सकता है तथा गोपनीयता नीति में उल्लिखित सेवाओं के साथ साझा कर सकता है।",
    withdrawal: "यह सहमति वापस लेने तक लागू रहती है। इसे वापस लेने के लिए help@between-journal.ru पर लिखें। खाता सेटिंग में डायरी हटाई जा सकती है।",
  },
  fa: {
    title: "رضایت به پردازش داده‌های شخصی",
    statement: "رضایت می‌دهم که گردانندهٔ Between برای ورود، نگهداری نوشته‌ها و استفاده از قابلیت‌های انتخابی دفتر، داده‌هایم را پردازش کند.",
    scope: "این داده‌ها شامل ایمیل یا شناسهٔ حساب متصل، نوشته‌ها، ثبت احساسات و داده‌های فنی لازم است. گرداننده می‌تواند برای همین اهداف داده‌ها را گردآوری، نگهداری، استفاده، به‌روز یا حذف کند و در اختیار خدمات ذکرشده در سیاست حریم خصوصی قرار دهد.",
    withdrawal: "رضایت تا زمان پس گرفتن آن معتبر است. برای پس گرفتن رضایت به help@between-journal.ru بنویسید. می‌توانید دفتر را در تنظیمات حساب حذف کنید.",
  },
  ar: {
    title: "الموافقة على معالجة البيانات الشخصية",
    statement: "أوافق على أن يعالج مشغّل Between بياناتي لتسجيل الدخول وحفظ تدويناتي واستخدام ميزات اليوميات التي أختارها.",
    scope: "يشمل ذلك البريد الإلكتروني أو معرّف الحساب المرتبط والتدوينات وتسجيلات المشاعر والبيانات التقنية اللازمة. يجوز للمشغّل جمع هذه البيانات وحفظها واستخدامها وتحديثها وحذفها ومشاركتها لهذه الأغراض مع الخدمات المذكورة في سياسة الخصوصية.",
    withdrawal: "تسري الموافقة حتى سحبها. لسحبها، راسل help@between-journal.ru. يمكنك حذف اليوميات من إعدادات الحساب.",
  },
  uz: {
    title: "Shaxsiy ma’lumotlarga ishlov berishga rozilik",
    statement: "Hisobga kirish, yozuvlarimni saqlash va tanlagan kundalik funksiyalaridan foydalanish uchun Between operatoriga ma’lumotlarimga ishlov berishga rozilik beraman.",
    scope: "Bunga elektron pochta yoki ulangan hisob identifikatori, yozuvlar, kayfiyat qaydlari va zarur texnik ma’lumotlar kiradi. Operator ularni shu maqsadlarda yig‘ishi, saqlashi, ishlatishi, yangilashi, o‘chirishi va maxfiylik siyosatida ko‘rsatilgan xizmatlarga uzatishi mumkin.",
    withdrawal: "Rozilik qaytarib olingunga qadar amal qiladi. Uni qaytarib olish uchun help@between-journal.ru manziliga yozing. Kundalikni hisob sozlamalarida o‘chirishingiz mumkin.",
  },
};
