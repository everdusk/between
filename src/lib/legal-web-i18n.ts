import type { LocaleId } from "./i18n";
import type { LegalDoc } from "./legal";

const BINDING = "Если формулировки разойдутся, главный текст — на русском языке.";
const NAME = "Ляторовская Анастасия Борисовна";
const INN = "770507475005";
const MAIL = "help@between-journal.ru";

type Pair = [heading: string, paragraphs: string[]];
type Rest = Record<Exclude<LocaleId, "ru">, LegalDoc>;

function webDoc(title: string, updated: string, preface: string[], sections: Pair[]): LegalDoc {
  return {
    title,
    updated,
    preface,
    sections: sections.map(([heading, paragraphs], index) => ({
      heading,
      paragraphs: index === 0 ? [...paragraphs, BINDING] : paragraphs,
    })),
  };
}

export const TERMS_REST: Rest = {
  en: webDoc(
    "Terms of use of Between",
    "Revision of 9 November 2026",
    ["Between · between-journal.ru · these terms cover the website and the MAX version", `Operator: ${NAME}, self-employed, INN ${INN}`],
    [
      ["1. This document", [
        "1.1. These terms govern the website of Between at between-journal.ru and the Between mini app in MAX (together, the Service).",
        "1.2. The Telegram version (the bot @BetweenJournalBot) has its own documents inside that version. These terms do not apply to Telegram.",
        `1.3. The terms are a public offer by ${NAME} (the Operator). Using the Service means you accept the terms. If you do not accept them, do not use the Service.`,
      ]],
      ["2. Words", [
        "• Service: Between, a mood and thought journal with a weekly summary.",
        "• Website: the Service opened in a browser at between-journal.ru.",
        "• MAX version: the Service opened as a mini app in MAX.",
        "• Journal: your notes, marked feelings, topics, and reminders.",
        "• Week: the summary of a week, the spectrum, what repeated, and topics you can discuss with a specialist.",
        "• Paid period: the time Week stays open after you pay.",
      ]],
      ["3. Account", [
        "3.1. You reach the journal after you sign in with an email code or through MAX.",
        "3.2. The Service is for people who are 18 or older. Using it confirms that you are an adult.",
        "3.3. You keep your email and your MAX account safe. The Operator is not responsible for notes lost because someone else got into your account.",
        "3.4. One person uses one account. Do not share access.",
      ]],
      ["4. What the Service does", [
        "4.1. You can keep a journal: notes, feelings, topics, and reminders.",
        "4.2. Week builds a summary: the spectrum, what repeated, and topics to discuss with a psychologist or therapist.",
        "4.3. A voice message is used only to become note text. Transcription works during a paid period, up to 10 messages a day.",
        "4.4. The Operator may add or remove features. Important changes are shown in the Service.",
      ]],
      ["5. Price and payment", [
        "5.1. The journal is free and is not limited in time.",
        "5.2. Week is free for 7 days from the first time you open it. The trial starts when you open the tab, not when you register.",
        "5.3. After the trial, Week is paid. The current periods and prices are on the Week tab before you pay (for example, 150 rubles for 30 days; 3 months and 1 year may be offered).",
        "5.4. On the website, payment goes through YooKassa. The Operator does not receive or store card data. The payment service does.",
        "5.5. If the MAX version can be paid with MAX platform funds, that version shows the rules and the price.",
        "5.6. Access opens after payment is confirmed and lasts for the paid term. How renewal works is shown on the payment page before you pay.",
        "5.7. A receipt is issued as required by the law of the Russian Federation.",
      ]],
      ["6. Refunds", [
        "6.1. If payment went through and Week did not open because of a technical fault, the Operator opens access or returns the sum after you write.",
        `6.2. Write only to ${MAIL}. Name the email or MAX id of the journal, the sum, and the date. The answer takes up to 10 business days.`,
        "6.3. If you used the paid period, the part that already passed is not refunded, unless access was never given because of the Operator.",
        "6.4. Messages sent through chat bots and messengers are not reviewed. Official contact is email only.",
      ]],
      ["7. Your notes", [
        "7.1. The notes are yours. The Operator does not sell them, publish them, or pass them to others for advertising.",
        "7.2. You give the Operator a simple non-exclusive licence to process the notes only so the Service can store them, show them, build the Week summary, and send reminders.",
        "7.3. You are responsible for what you write. Do not enter other people's data without their consent, or content forbidden by the law of the Russian Federation.",
        "7.4. The notes are not emergency help. In a crisis, contact your own specialist or the emergency services (112).",
      ]],
      ["8. Deleting the journal", [
        "8.1. You may stop using the Service at any time.",
        "8.2. While you are signed in, the deletion page erases the notes, the sign-in, and the data tied to the account.",
        `8.3. If you cannot sign in, write to ${MAIL} and name the email or MAX id you used.`,
        "8.4. The Operator may limit access if you break these terms, and will email you about that limit.",
      ]],
      ["9. What is not allowed", [
        "9.1. You must not:",
        "• share account access;",
        "• use automated tools to collect data from the Service;",
        "• try to open someone else's journal or bypass technical limits;",
        "• post unlawful content or content that violates other people's rights;",
        "• use the Service for mailings, advertising, or commercial spam.",
      ]],
      ["10. This is not a medical service", [
        "10.1. Between is not a medical or psychotherapy service. It does not diagnose or prescribe treatment. The Week summary does not replace a specialist.",
        "10.2. Decisions about therapy and treatment are yours, together with your specialist.",
      ]],
      ["11. Changes", [
        "11.1. The Operator may change the terms. A new revision is published on this page with its date.",
        "11.2. If you keep using the Service after that, you accept the new revision.",
      ]],
      ["12. Liability", [
        "12.1. The Service is provided as is. The Operator does not guarantee uninterrupted work and is not responsible for your notes or for the circumstances of your therapy.",
        "12.2. The Operator's financial liability is limited to your last payment, unless the law of the Russian Federation says otherwise.",
      ]],
      ["13. Law and disputes", [
        "13.1. The law of the Russian Federation applies.",
        `13.2. Before going to court, send a claim to ${MAIL}. The answer takes up to 10 business days.`,
        "13.3. Disputes go to the court that has jurisdiction under the law of the Russian Federation.",
      ]],
      ["14. Operator and contact", [
        `14.1. Write about the Service only to ${MAIL}. Messages through chat bots and messengers are not accepted.`,
        `Operator details. ${NAME}, self-employed, INN ${INN}. Email: ${MAIL} (the only contact channel). Site: between-journal.ru.`,
      ]],
    ],
  ),
  uk: webDoc(
    "Умови використання сервісу Between",
    "Редакція від 9 листопада 2026 року",
    ["Сервіс Between · between-journal.ru · діють для вебверсії і версії в MAX", `Оператор: ${NAME}, самозайнята, ІПН ${INN}`],
    [
      ["1. Про документ", ["1.1. Ці умови регулюють сайт between-journal.ru і мінізастосунок Between у MAX. 1.2. Версія в Telegram (бот @BetweenJournalBot) має окремі документи в тій версії. Ці умови на неї не поширюються. 1.3. Умови є публічною офертою самозайнятої " + NAME + ". Початок користування означає прийняття умов."]],
      ["2. Терміни", ["Сервіс — щоденник настрою і думок зі зведенням за тиждень. Вебверсія відкривається в браузері. Версія MAX — мінізастосунок у MAX. Щоденник — нотатки, почуття, теми і нагадування. Вкладка «Тиждень» — спектр, повтори і теми для розмови зі спеціалістом. Платний період — строк доступу до «Тижня» після оплати."]],
      ["3. Обліковий запис", ["3.1. Вхід — код на пошту або MAX. 3.2. Сервіс для осіб від 18 років. 3.3. Ви бережете пошту і акаунт MAX. Оператор не відповідає за втрату записів через чужий доступ. 3.4. Один акаунт на одну людину. Передавати доступ не можна."]],
      ["4. Робота сервісу", ["4.1. Можна вести щоденник. 4.2. «Тиждень» збирає спектр, повтори і теми для психолога або психотерапевта. 4.3. Голос лише перетворюється на текст, у платному періоді, не більше 10 разів на добу. 4.4. Функції можуть змінюватися, про суттєве сказано в інтерфейсі."]],
      ["5. Тарифи і оплата", ["5.1. Щоденник безкоштовний і без строку. 5.2. «Тиждень» безкоштовний 7 днів від першого відкриття вкладки, не від реєстрації. 5.3. Далі — за плату, ціни на вкладці до оплати (наприклад, 150 рублів за 30 днів; можливі 3 місяці і рік). 5.4. На сайті платіж через ЮKassa. Дані картки оператор не отримує і не зберігає. 5.5. Якщо в MAX є оплата засобами платформи, правила і ціни показані там. 5.6. Доступ відкривається після підтвердження на весь оплачений строк. Продовження описане до платежу. 5.7. Чек — за законодавством Російської Федерації."]],
      ["6. Повернення", ["6.1. Якщо гроші пройшли, а «Тиждень» не відкрився з технічної причини, оператор відкриває доступ або повертає суму. 6.2. Пишіть лише на " + MAIL + ": пошта або ідентифікатор MAX, сума і дата. Строк відповіді — до 10 робочих днів. 6.3. За вже використану частину періоду повернення немає, якщо доступ не надано з вини оператора. 6.4. Звернення через ботів і месенджери не розглядаються."]],
      ["7. Ваші записи", ["7.1. Записи ваші. Оператор їх не продає, не публікує і не передає для реклами. 7.2. Ви даєте просту невиключну ліцензію лише для роботи сервісу: зберігання, показ, зведення «Тижня» і нагадування. 7.3. Ви відповідаєте за зміст і не вносите дані інших людей без згоди та заборонений контент. 7.4. Це не екстрена допомога. У кризі зверніться до свого спеціаліста або за номером 112."]],
      ["8. Видалення", ["8.1. Користування можна припинити будь-коли. 8.2. Сторінка видалення, поки ви ввійшли, стирає нотатки, вхід і пов’язані дані. 8.3. Якщо ввійти не виходить, напишіть на " + MAIL + " і вкажіть пошту або MAX. 8.4. За порушення доступ можуть обмежити і повідомити на пошту."]],
      ["9. Обмеження", ["9.1. Не можна передавати доступ, збирати дані автоматично, лізти в чужий щоденник, обходити обмеження, вносити протиправний контент і використовувати сервіс для розсилок, реклами і спаму."]],
      ["10. Це не медичний сервіс", ["10.1. Between не медична і не психотерапевтична послуга, не ставить діагнозів і не призначає лікування. Зведення «Тижня» не замінює спеціаліста. 10.2. Рішення про терапію ви приймаєте разом зі своїм спеціалістом."]],
      ["11. Зміна умов", ["11.1. Нова редакція публікується на цій сторінці з датою. 11.2. Подальше користування означає згоду."]],
      ["12. Відповідальність", ["12.1. Сервіс надається «як є». Безперебійність не гарантується. Оператор не відповідає за зміст записів і обставини терапії. 12.2. Фінансова відповідальність обмежена сумою останнього платежу, якщо закон Російської Федерації не каже інше."]],
      ["13. Право і спори", ["13.1. Застосовується право Російської Федерації. 13.2. До суду надішліть претензію на " + MAIL + ". Відповідь — до 10 робочих днів. 13.3. Спір розглядає суд за правилами підсудності."]],
      ["14. Реквізити і зв’язок", ["14.1. Усі звернення лише на " + MAIL + ". Через ботів і месенджери їх не приймають. " + NAME + ", ІПН " + INN + ". Сайт: between-journal.ru."]],
    ],
  ),
  es: webDoc(
    "Condiciones de uso de Between",
    "Edición del 9 de noviembre de 2026",
    ["Between · between-journal.ru · rigen para el sitio y la versión en MAX", `Operadora: ${NAME}, autónoma, INN ${INN}`],
    [
      ["1. El documento", ["1.1. Estas condiciones regulan el sitio between-journal.ru y la mini app de Between en MAX. 1.2. La versión de Telegram (bot @BetweenJournalBot) tiene documentos propios en esa versión. Estas condiciones no se aplican a Telegram. 1.3. Son una oferta pública de " + NAME + ". Usar el servicio significa aceptarlas."]],
      ["2. Términos", ["Servicio: diario de ánimo y pensamientos con un resumen semanal. Versión web: el sitio en el navegador. Versión MAX: la mini app en MAX. Diario: notas, sentimientos, temas y recordatorios. Semana: espectro, repeticiones y temas para hablar con un especialista. Periodo de pago: el tiempo en que Semana queda abierta tras pagar."]],
      ["3. Cuenta", ["3.1. El acceso es con un código al correo o por MAX. 3.2. El servicio es para mayores de 18 años. 3.3. Usted cuida su correo y su cuenta de MAX. La operadora no responde por notas perdidas si otra persona entra en su cuenta. 3.4. Una persona, una cuenta. No se comparte el acceso."]],
      ["4. Funcionamiento", ["4.1. Puede llevar el diario. 4.2. Semana reúne el espectro, las repeticiones y temas para un psicólogo o psicoterapeuta. 4.3. La voz solo se convierte en texto, en el periodo de pago, hasta 10 veces al día. 4.4. Las funciones pueden cambiar. Lo importante se muestra en el servicio."]],
      ["5. Precio y pago", ["5.1. El diario es gratis y sin límite de tiempo. 5.2. Semana es gratis 7 días desde la primera apertura de la pestaña, no desde el registro. 5.3. Después se paga. Precios en la pestaña antes de pagar (por ejemplo, 150 rublos por 30 días; puede haber 3 meses y 1 año). 5.4. En la web el pago es por YooKassa. La operadora no recibe ni guarda datos de tarjeta. 5.5. Si MAX permite pagar con fondos de la plataforma, las reglas y el precio están en esa versión. 5.6. El acceso se abre tras confirmar el pago y dura el plazo pagado. La renovación se explica antes del pago. 5.7. El recibo se emite según la ley de la Federación de Rusia."]],
      ["6. Devoluciones", ["6.1. Si el pago pasó y Semana no se abrió por un fallo técnico, la operadora abre el acceso o devuelve la suma. 6.2. Escriba solo a " + MAIL + ": correo o id de MAX, suma y fecha. Respuesta en hasta 10 días hábiles. 6.3. No hay devolución de la parte ya usada, salvo que el acceso no se diera por culpa de la operadora. 6.4. Los mensajes por bots y mensajeros no se revisan."]],
      ["7. Sus notas", ["7.1. Las notas son suyas. No se venden, no se publican y no se ceden para publicidad. 7.2. Usted da una licencia simple no exclusiva solo para guardar, mostrar, resumir la semana y recordar. 7.3. Usted responde por el contenido y no introduce datos de terceros sin consentimiento ni contenido prohibido. 7.4. No es ayuda de emergencia. En una crisis, contacte a su especialista o al 112."]],
      ["8. Borrado", ["8.1. Puede dejar el servicio cuando quiera. 8.2. La página de eliminación, con la sesión abierta, borra notas, acceso y datos de la cuenta. 8.3. Si no puede entrar, escriba a " + MAIL + " e indique el correo o el id de MAX. 8.4. Si incumple las condiciones, el acceso puede limitarse y se le avisa por correo."]],
      ["9. Límites", ["9.1. No comparta el acceso, no recoja datos con medios automáticos, no entre en diarios ajenos, no eluda límites, no publique contenido ilícito y no use el servicio para envíos, publicidad o spam."]],
      ["10. No es un servicio médico", ["10.1. Between no es un servicio médico ni de psicoterapia, no diagnostica ni prescribe. El resumen de Semana no sustituye a un especialista. 10.2. Las decisiones de terapia las toma con su especialista."]],
      ["11. Cambios", ["11.1. La nueva edición se publica en esta página con la fecha. 11.2. Seguir usando el servicio es aceptarla."]],
      ["12. Responsabilidad", ["12.1. El servicio se ofrece tal cual. No se garantiza el funcionamiento continuo. La operadora no responde por sus notas ni por las circunstancias de su terapia. 12.2. La responsabilidad económica se limita al último pago, salvo que la ley de la Federación de Rusia diga otra cosa."]],
      ["13. Ley y conflictos", ["13.1. Se aplica el derecho de la Federación de Rusia. 13.2. Antes de ir a juicio, envíe una reclamación a " + MAIL + ". Respuesta en hasta 10 días hábiles. 13.3. El tribunal es el que indique la ley."]],
      ["14. Datos y contacto", ["14.1. Escriba solo a " + MAIL + ". No se aceptan mensajes por bots ni mensajeros. " + NAME + ", INN " + INN + ". Sitio: between-journal.ru."]],
    ],
  ),
  pt: webDoc(
    "Termos de uso do Between",
    "Edição de 9 de novembro de 2026",
    ["Between · between-journal.ru · valem para o site e a versão no MAX", `Operadora: ${NAME}, autônoma, INN ${INN}`],
    [
      ["1. O documento", ["1.1. Estes termos regulam o site between-journal.ru e o mini app do Between no MAX. 1.2. A versão no Telegram (bot @BetweenJournalBot) tem documentos próprios nessa versão. Estes termos não se aplicam ao Telegram. 1.3. São uma oferta pública de " + NAME + ". Usar o serviço significa aceitá-los."]],
      ["2. Termos", ["Serviço: diário de humor e pensamentos com um resumo da semana. Versão web: o site no navegador. Versão MAX: o mini app no MAX. Diário: notas, sentimentos, temas e lembretes. Semana: espectro, repetições e temas para falar com um especialista. Período pago: o tempo em que a Semana fica aberta depois do pagamento."]],
      ["3. Conta", ["3.1. A entrada é com um código no e-mail ou pelo MAX. 3.2. O serviço é para maiores de 18 anos. 3.3. Você guarda o e-mail e a conta MAX. A operadora não responde por notas perdidas se outra pessoa entrar na conta. 3.4. Uma pessoa, uma conta. Não compartilhe o acesso."]],
      ["4. Funcionamento", ["4.1. Dá para manter o diário. 4.2. A Semana reúne espectro, repetições e temas para um psicólogo ou psicoterapeuta. 4.3. A voz só vira texto, no período pago, até 10 vezes por dia. 4.4. As funções podem mudar. O que for importante aparece no serviço."]],
      ["5. Preço e pagamento", ["5.1. O diário é grátis e sem prazo. 5.2. A Semana é grátis por 7 dias a partir da primeira abertura da aba, não do cadastro. 5.3. Depois é paga. Preços na aba antes do pagamento (por exemplo, 150 rublos por 30 dias; pode haver 3 meses e 1 ano). 5.4. No site o pagamento é pela YooKassa. A operadora não recebe nem guarda dados do cartão. 5.5. Se o MAX permitir pagar com fundos da plataforma, as regras e o preço ficam nessa versão. 5.6. O acesso abre após a confirmação e dura o prazo pago. A renovação é explicada antes do pagamento. 5.7. O recibo segue a lei da Federação da Rússia."]],
      ["6. Reembolsos", ["6.1. Se o pagamento passou e a Semana não abriu por falha técnica, a operadora abre o acesso ou devolve a soma. 6.2. Escreva só para " + MAIL + ": e-mail ou id do MAX, soma e data. Resposta em até 10 dias úteis. 6.3. Não há reembolso da parte já usada, salvo se o acesso não foi dado por culpa da operadora. 6.4. Mensagens por bots e mensageiros não são analisadas."]],
      ["7. Suas notas", ["7.1. As notas são suas. Não são vendidas, publicadas nem cedidas para publicidade. 7.2. Você dá uma licença simples e não exclusiva só para guardar, mostrar, resumir a semana e lembrar. 7.3. Você responde pelo conteúdo e não insere dados de terceiros sem consentimento nem conteúdo proibido. 7.4. Não é socorro de emergência. Numa crise, fale com seu especialista ou ligue 112."]],
      ["8. Exclusão", ["8.1. Você pode parar quando quiser. 8.2. A página de exclusão, com a sessão aberta, apaga notas, entrada e dados da conta. 8.3. Se não conseguir entrar, escreva para " + MAIL + " e diga o e-mail ou o id do MAX. 8.4. Se descumprir os termos, o acesso pode ser limitado, com aviso por e-mail."]],
      ["9. Limites", ["9.1. Não compartilhe o acesso, não colete dados com meios automáticos, não abra diários alheios, não contorne limites, não publique conteúdo ilícito e não use o serviço para envios, publicidade ou spam."]],
      ["10. Não é um serviço médico", ["10.1. Between não é serviço médico nem de psicoterapia, não diagnostica nem prescreve. O resumo da Semana não substitui um especialista. 10.2. Decisões de terapia são suas, com seu especialista."]],
      ["11. Mudanças", ["11.1. A nova edição é publicada nesta página com a data. 11.2. Continuar usando o serviço é aceitá-la."]],
      ["12. Responsabilidade", ["12.1. O serviço é oferecido como está. O funcionamento contínuo não é garantido. A operadora não responde pelas suas notas nem pelas circunstâncias da terapia. 12.2. A responsabilidade financeira se limita ao último pagamento, salvo se a lei da Federação da Rússia disser outra coisa."]],
      ["13. Lei e disputas", ["13.1. Aplica-se o direito da Federação da Rússia. 13.2. Antes do tribunal, envie uma reclamação para " + MAIL + ". Resposta em até 10 dias úteis. 13.3. O foro é o da lei."]],
      ["14. Dados e contato", ["14.1. Escreva só para " + MAIL + ". Mensagens por bots e mensageiros não são aceitas. " + NAME + ", INN " + INN + ". Site: between-journal.ru."]],
    ],
  ),
  tr: webDoc(
    "Between kullanım koşulları",
    "9 Kasım 2026 tarihli sürüm",
    ["Between · between-journal.ru · site ve MAX sürümü için geçerlidir", `İşleten: ${NAME}, serbest meslek, INN ${INN}`],
    [
      ["1. Belge", ["1.1. Bu koşullar between-journal.ru sitesini ve MAX’teki Between mini uygulamasını düzenler. 1.2. Telegram sürümünün (bot @BetweenJournalBot) kendi belgeleri o sürümün içindedir. Bu koşullar Telegram’a uygulanmaz. 1.3. Koşullar " + NAME + " adlı kişinin kamu teklifidir. Hizmeti kullanmak kabul anlamına gelir."]],
      ["2. Terimler", ["Hizmet: haftalık özetli bir duygu ve düşünce günlüğü. Web sürümü tarayıcıda açılır. MAX sürümü MAX’te mini uygulamadır. Günlük: notlar, duygular, konular ve anımsatmalar. Hafta: spektrum, tekrarlar ve bir uzmanla konuşulacak konular. Ücretli dönem: ödemeden sonra Haftanın açık kaldığı süre."]],
      ["3. Hesap", ["3.1. Giriş e-posta kodu ya da MAX iledir. 3.2. Hizmet 18 yaş ve üzeri içindir. 3.3. E-postanızı ve MAX hesabınızı siz korursunuz. Başkasının girmesiyle kaybolan notlardan işleten sorumlu değildir. 3.4. Bir kişi, bir hesap. Erişim devredilmez."]],
      ["4. Hizmetin işi", ["4.1. Günlük tutulabilir. 4.2. Hafta spektrumu, tekrarları ve bir psikolog ya da terapist ile konuşulacak konuları toplar. 4.3. Ses yalnızca metne çevrilir, ücretli dönemde, günde en çok 10 kez. 4.4. İşlevler değişebilir. Önemli olan arayüzde söylenir."]],
      ["5. Ücret ve ödeme", ["5.1. Günlük ücretsizdir ve süresi yoktur. 5.2. Hafta, kayıtta değil, sekmenin ilk açılışından itibaren 7 gün ücretsizdir. 5.3. Sonra ücretlidir. Süre ve fiyat ödemeden önce sekmededir (örneğin 30 gün için 150 ruble; 3 ay ve 1 yıl olabilir). 5.4. Sitede ödeme YooKassa iledir. Kart verisini işleten almaz ve saklamaz. 5.5. MAX’te platform bakiyesiyle ödeme varsa kural ve fiyat o sürümde yazılır. 5.6. Erişim onaydan sonra açılır ve ödenen süre boyunca sürer. Yenileme ödemeden önce yazılır. 5.7. Fiş, Rusya Federasyonu hukukuna göredir."]],
      ["6. İade", ["6.1. Ödeme geçip Hafta teknik nedenle açılmazsa işleten erişimi açar ya da tutarı iade eder. 6.2. Yalnızca " + MAIL + " adresine yazın: e-posta ya da MAX kimliği, tutar ve tarih. Yanıt en çok 10 iş günü. 6.3. Kullanılmış dönemin geçmiş kısmı iade edilmez; erişim işleten yüzünden hiç açılmadıysa bu kural işlemez. 6.4. Bot ve mesajlaşma başvuruları incelenmez."]],
      ["7. Notlarınız", ["7.1. Notlar sizindir. Satılmaz, yayımlanmaz ve reklam için verilmez. 7.2. Yalnızca saklamak, göstermek, hafta özetini kurmak ve anımsatmak için basit ve münhasır olmayan bir lisans verirsiniz. 7.3. İçerikten siz sorumlusunuz. Başkasının verisini rızasız ve yasak içeriği yazmayın. 7.4. Bu acil yardım değildir. Krizde uzmanınıza ya da 112’ye başvurun."]],
      ["8. Silme", ["8.1. Hizmeti istediğiniz an bırakabilirsiniz. 8.2. Giriş yapılmışken silme sayfası notları, girişi ve hesaba bağlı veriyi siler. 8.3. Giriş yapamazsanız " + MAIL + " adresine e-posta ya da MAX kimliğini yazın. 8.4. Koşullar bozulursa erişim sınırlanır ve e-posta ile bildirilir."]],
      ["9. Yasaklar", ["9.1. Erişimi paylaşmak, veriyi otomatik toplamak, başkasının günlüğüne girmek, sınırları aşmak, hukuka aykırı içerik koymak ve hizmeti duyuru, reklam ya da spam için kullanmak yasaktır."]],
      ["10. Tıbbi hizmet değildir", ["10.1. Between tıbbi ya da psikoterapi hizmeti değildir, tanı koymaz ve tedavi yazmaz. Hafta özeti uzman görüşünün yerine geçmez. 10.2. Tedavi kararını uzmanınızla birlikte siz verirsiniz."]],
      ["11. Değişiklik", ["11.1. Yeni sürüm bu sayfada tarihle yayımlanır. 11.2. Kullanmaya devam etmek kabuldür."]],
      ["12. Sorumluluk", ["12.1. Hizmet olduğu gibi sunulur. Kesintisiz çalışma garanti edilmez. İşleten notlarınızdan ve terapinizin koşullarından sorumlu değildir. 12.2. Mali sorumluluk son ödemeyle sınırlıdır, Rusya Federasyonu hukuku başka demedikçe."]],
      ["13. Hukuk ve uyuşmazlık", ["13.1. Rusya Federasyonu hukuku uygulanır. 13.2. Mahkemeden önce " + MAIL + " adresine talep yazın. Yanıt en çok 10 iş günü. 13.3. Yetkili mahkeme hukuka göredir."]],
      ["14. Künye ve iletişim", ["14.1. Yalnızca " + MAIL + " adresine yazın. Bot ve mesajlaşma kabul edilmez. " + NAME + ", INN " + INN + ". Site: between-journal.ru."]],
    ],
  ),
  id: webDoc(
    "Ketentuan penggunaan Between",
    "Revisi 9 November 2026",
    ["Between · between-journal.ru · berlaku untuk situs dan versi MAX", `Penyelenggara: ${NAME}, pekerja mandiri, INN ${INN}`],
    [
      ["1. Dokumen", ["1.1. Ketentuan ini mengatur situs between-journal.ru dan mini app Between di MAX. 1.2. Versi Telegram (bot @BetweenJournalBot) punya dokumen sendiri di versi itu. Ketentuan ini tidak berlaku untuk Telegram. 1.3. Ini penawaran umum dari " + NAME + ". Memakai layanan berarti menerima ketentuan."]],
      ["2. Istilah", ["Layanan: jurnal suasana dan pikiran dengan ringkasan minggu. Versi web dibuka di peramban. Versi MAX adalah mini app di MAX. Jurnal: catatan, perasaan, topik, dan pengingat. Minggu: spektrum, pengulangan, dan topik untuk dibicarakan dengan ahli. Masa berbayar: waktu Minggu tetap terbuka setelah bayar."]],
      ["3. Akun", ["3.1. Masuk dengan kode email atau lewat MAX. 3.2. Layanan untuk usia 18 tahun ke atas. 3.3. Anda menjaga email dan akun MAX. Penyelenggara tidak bertanggung jawab jika catatan hilang karena orang lain masuk ke akun Anda. 3.4. Satu orang, satu akun. Akses tidak dibagikan."]],
      ["4. Cara kerja", ["4.1. Jurnal bisa diisi. 4.2. Minggu menyusun spektrum, pengulangan, dan topik untuk psikolog atau terapis. 4.3. Suara hanya diubah menjadi teks, pada masa berbayar, paling banyak 10 kali sehari. 4.4. Fungsi dapat berubah. Yang penting ditampilkan di layanan."]],
      ["5. Harga dan pembayaran", ["5.1. Jurnal gratis dan tidak dibatasi waktu. 5.2. Minggu gratis 7 hari sejak tab pertama kali dibuka, bukan sejak pendaftaran. 5.3. Setelah itu berbayar. Harga ada di tab sebelum bayar (misalnya 150 rubel untuk 30 hari; bisa ada 3 bulan dan 1 tahun). 5.4. Di situs pembayaran lewat YooKassa. Data kartu tidak diterima dan tidak disimpan penyelenggara. 5.5. Jika MAX bisa dibayar dengan dana platform, aturan dan harga ada di versi itu. 5.6. Akses terbuka setelah pembayaran dikonfirmasi dan berlaku selama masa yang dibayar. Perpanjangan dijelaskan sebelum bayar. 5.7. Tanda terima mengikuti hukum Federasi Rusia."]],
      ["6. Pengembalian", ["6.1. Jika pembayaran masuk dan Minggu tidak terbuka karena gangguan teknis, penyelenggara membuka akses atau mengembalikan jumlahnya. 6.2. Tulis hanya ke " + MAIL + ": email atau id MAX, jumlah, dan tanggal. Jawaban paling lama 10 hari kerja. 6.3. Bagian masa yang sudah dipakai tidak dikembalikan, kecuali akses tidak diberikan karena kesalahan penyelenggara. 6.4. Pesan lewat bot dan pengirim pesan tidak ditinjau."]],
      ["7. Catatan Anda", ["7.1. Catatan milik Anda. Tidak dijual, tidak dipublikasikan, dan tidak diberikan untuk iklan. 7.2. Anda memberi lisensi sederhana non-eksklusif hanya untuk menyimpan, menampilkan, menyusun ringkasan minggu, dan mengingatkan. 7.3. Anda bertanggung jawab atas isi dan tidak memasukkan data orang lain tanpa persetujuan atau konten yang dilarang. 7.4. Ini bukan bantuan darurat. Dalam krisis, hubungi ahli Anda atau 112."]],
      ["8. Penghapusan", ["8.1. Anda boleh berhenti kapan saja. 8.2. Halaman penghapusan, saat Anda masuk, menghapus catatan, masuk, dan data akun. 8.3. Jika tidak bisa masuk, tulis ke " + MAIL + " dan sebutkan email atau id MAX. 8.4. Jika ketentuan dilanggar, akses dapat dibatasi dan diberitahu lewat email."]],
      ["9. Larangan", ["9.1. Jangan membagikan akses, mengumpulkan data secara otomatis, membuka jurnal orang lain, mengakali batas, memasukkan konten melanggar hukum, atau memakai layanan untuk kiriman, iklan, dan spam."]],
      ["10. Bukan layanan medis", ["10.1. Between bukan layanan medis atau psikoterapi, tidak mendiagnosis dan tidak meresepkan. Ringkasan Minggu tidak menggantikan ahli. 10.2. Keputusan terapi Anda ambil bersama ahli Anda."]],
      ["11. Perubahan", ["11.1. Edisi baru dipublikasikan di halaman ini beserta tanggalnya. 11.2. Terus memakai layanan berarti menerima edisi itu."]],
      ["12. Tanggung jawab", ["12.1. Layanan diberikan apa adanya. Kerja tanpa henti tidak dijamin. Penyelenggara tidak bertanggung jawab atas catatan Anda atau keadaan terapi Anda. 12.2. Tanggung jawab keuangan dibatasi pembayaran terakhir, kecuali hukum Federasi Rusia menentukan lain."]],
      ["13. Hukum dan sengketa", ["13.1. Hukum Federasi Rusia yang berlaku. 13.2. Sebelum ke pengadilan, kirim tuntutan ke " + MAIL + ". Jawaban paling lama 10 hari kerja. 13.3. Pengadilan mengikuti aturan yurisdiksi."]],
      ["14. Identitas dan kontak", ["14.1. Tulis hanya ke " + MAIL + ". Pesan lewat bot dan pengirim pesan tidak diterima. " + NAME + ", INN " + INN + ". Situs: between-journal.ru."]],
    ],
  ),
  vi: webDoc(
    "Điều khoản sử dụng Between",
    "Bản ngày 9 tháng 11 năm 2026",
    ["Between · between-journal.ru · áp dụng cho trang web và bản MAX", `Người điều hành: ${NAME}, tự kinh doanh, INN ${INN}`],
    [
      ["1. Văn bản", ["1.1. Điều khoản này điều chỉnh trang between-journal.ru và mini app Between trong MAX. 1.2. Bản Telegram (bot @BetweenJournalBot) có văn bản riêng trong bản đó. Điều khoản này không áp dụng cho Telegram. 1.3. Đây là chào bán công khai của " + NAME + ". Dùng dịch vụ là chấp nhận điều khoản."]],
      ["2. Thuật ngữ", ["Dịch vụ: nhật ký tâm trạng và suy nghĩ với bản tóm tắt tuần. Bản web mở trên trình duyệt. Bản MAX là mini app trong MAX. Nhật ký: ghi chú, cảm xúc, chủ đề và lời nhắc. Tuần: phổ cảm xúc, điều lặp lại và chủ đề để nói với chuyên gia. Thời gian trả phí: khoảng Tuần còn mở sau khi thanh toán."]],
      ["3. Tài khoản", ["3.1. Vào bằng mã email hoặc qua MAX. 3.2. Dịch vụ dành cho người từ 18 tuổi. 3.3. Bạn giữ email và tài khoản MAX. Người điều hành không chịu trách nhiệm nếu ghi chú mất vì người khác vào tài khoản. 3.4. Một người, một tài khoản. Không chia sẻ quyền vào."]],
      ["4. Cách hoạt động", ["4.1. Có thể ghi nhật ký. 4.2. Tuần gom phổ cảm xúc, điều lặp lại và chủ đề cho nhà tâm lý hoặc nhà trị liệu. 4.3. Giọng nói chỉ để chuyển thành chữ, trong thời gian trả phí, tối đa 10 lần một ngày. 4.4. Chức năng có thể đổi. Việc quan trọng được nêu trong dịch vụ."]],
      ["5. Giá và thanh toán", ["5.1. Nhật ký miễn phí và không giới hạn thời gian. 5.2. Tuần miễn phí 7 ngày kể từ lần đầu mở tab, không phải từ lúc đăng ký. 5.3. Sau đó phải trả phí. Giá nằm trên tab trước khi trả (ví dụ 150 rúp cho 30 ngày; có thể có 3 tháng và 1 năm). 5.4. Trên web, thanh toán qua YooKassa. Người điều hành không nhận và không lưu dữ liệu thẻ. 5.5. Nếu MAX cho trả bằng tiền của nền tảng, quy tắc và giá nằm ở bản đó. 5.6. Quyền mở sau khi thanh toán được xác nhận và kéo dài đúng thời hạn đã trả. Gia hạn được ghi trước khi trả. 5.7. Biên lai theo pháp luật Liên bang Nga."]],
      ["6. Hoàn tiền", ["6.1. Nếu tiền đã chuyển mà Tuần không mở vì lỗi kỹ thuật, người điều hành mở quyền hoặc trả lại số tiền. 6.2. Chỉ viết tới " + MAIL + ": email hoặc id MAX, số tiền và ngày. Trả lời trong tối đa 10 ngày làm việc. 6.3. Phần thời gian đã dùng không được hoàn, trừ khi quyền không được cấp do lỗi của người điều hành. 6.4. Tin qua bot và ứng dụng nhắn tin không được xem xét."]],
      ["7. Ghi chú của bạn", ["7.1. Ghi chú là của bạn. Không bán, không công bố và không chuyển cho quảng cáo. 7.2. Bạn cấp giấy phép đơn giản không độc quyền chỉ để lưu, hiện, lập tóm tắt tuần và nhắc. 7.3. Bạn chịu trách nhiệm về nội dung, không đưa dữ liệu người khác khi chưa đồng ý và không đưa nội dung bị cấm. 7.4. Đây không phải cứu hộ khẩn cấp. Khi khủng hoảng, hãy liên hệ chuyên gia của bạn hoặc số 112."]],
      ["8. Xóa", ["8.1. Bạn có thể ngừng bất cứ lúc nào. 8.2. Trang xóa, khi bạn đã vào, xóa ghi chú, lối vào và dữ liệu gắn với tài khoản. 8.3. Nếu không vào được, viết tới " + MAIL + " và nói email hoặc id MAX. 8.4. Nếu vi phạm, quyền có thể bị giới hạn và bạn được báo qua email."]],
      ["9. Điều cấm", ["9.1. Không chia sẻ quyền vào, không thu dữ liệu bằng công cụ tự động, không mở nhật ký của người khác, không vòng qua giới hạn, không đưa nội dung trái luật và không dùng dịch vụ để gửi thư, quảng cáo hoặc spam."]],
      ["10. Không phải dịch vụ y tế", ["10.1. Between không phải dịch vụ y tế hay trị liệu tâm lý, không chẩn đoán và không kê đơn. Tóm tắt Tuần không thay chuyên gia. 10.2. Quyết định trị liệu là của bạn cùng chuyên gia của bạn."]],
      ["11. Thay đổi", ["11.1. Bản mới được đăng trên trang này kèm ngày. 11.2. Tiếp tục dùng là chấp nhận bản đó."]],
      ["12. Trách nhiệm", ["12.1. Dịch vụ được cung cấp như hiện có. Không bảo đảm chạy liên tục. Người điều hành không chịu trách nhiệm về ghi chú của bạn hay hoàn cảnh trị liệu. 12.2. Trách nhiệm tài chính giới hạn ở khoản thanh toán gần nhất, trừ khi pháp luật Liên bang Nga quy định khác."]],
      ["13. Luật và tranh chấp", ["13.1. Áp dụng pháp luật Liên bang Nga. 13.2. Trước khi ra tòa, gửi khiếu nại tới " + MAIL + ". Trả lời trong tối đa 10 ngày làm việc. 13.3. Tòa án theo quy tắc thẩm quyền."]],
      ["14. Danh tính và liên hệ", ["14.1. Chỉ viết tới " + MAIL + ". Tin qua bot và ứng dụng nhắn tin không được nhận. " + NAME + ", INN " + INN + ". Trang: between-journal.ru."]],
    ],
  ),
  ar: webDoc(
    "شروط استخدام Between",
    "نسخة 9 نوفمبر 2026",
    ["Between · between-journal.ru · تسري على الموقع ونسخة MAX", `المشغّلة: ${NAME}، عاملة لحسابها، INN ${INN}`],
    [
      ["1. الوثيقة", ["1.1. تنظّم هذه الشروط موقع between-journal.ru وتطبيق Between المصغّر في MAX. 1.2. لنسخة Telegram (البوت @BetweenJournalBot) وثائقها داخل تلك النسخة. هذه الشروط لا تسري على Telegram. 1.3. الشروط عرض عام من " + NAME + ". بدء الاستخدام قبول لها."]],
      ["2. المصطلحات", ["الخدمة: يوميات للمزاج والأفكار مع ملخص أسبوعي. نسخة الويب تُفتح في المتصفح. نسخة MAX تطبيق مصغّر في MAX. اليوميات: الملاحظات والمشاعر والمواضيع والتذكيرات. الأسبوع: الطيف والتكرار ومواضيع للنقاش مع مختص. المدة المدفوعة: الوقت الذي يبقى فيه الأسبوع مفتوحًا بعد الدفع."]],
      ["3. الحساب", ["3.1. الدخول برمز إلى البريد أو عبر MAX. 3.2. الخدمة لمن بلغ 18 عامًا. 3.3. تحافظون على بريدكم وحساب MAX. المشغّلة لا تسأل عن فقدان الملاحظات إذا دخل غيركم إلى الحساب. 3.4. شخص واحد وحساب واحد. لا يُنقل الدخول."]],
      ["4. عمل الخدمة", ["4.1. يمكن إمساك اليوميات. 4.2. يجمع الأسبوع الطيف والتكرار ومواضيع لطبيب نفسي أو معالج. 4.3. الصوت يتحول إلى نص فقط، في المدة المدفوعة، حتى 10 مرات في اليوم. 4.4. قد تتغير الوظائف، والمهم يظهر في الخدمة."]],
      ["5. السعر والدفع", ["5.1. اليوميات مجانية بلا حد زمني. 5.2. الأسبوع مجاني 7 أيام من أول فتح للتبويب لا من التسجيل. 5.3. بعده بمقابل. السعر على التبويب قبل الدفع (مثلًا 150 روبلًا لثلاثين يومًا، وقد تتاح 3 أشهر وسنة). 5.4. في الموقع الدفع عبر YooKassa. بيانات البطاقة لا تصل إلى المشغّلة ولا تُحفظ لديها. 5.5. إذا أتيح الدفع بأموال منصة MAX فالقواعد والسعر في تلك النسخة. 5.6. يُفتح الوصول بعد تأكيد الدفع ويمتد للمدة المدفوعة. التجديد مذكور قبل الدفع. 5.7. الإيصال وفق قانون الاتحاد الروسي."]],
      ["6. الاسترداد", ["6.1. إذا مر الدفع ولم يُفتح الأسبوع لخلل تقني، تفتح المشغّلة الوصول أو تعيد المبلغ. 6.2. راسلوا " + MAIL + " فقط: البريد أو معرّف MAX والمبلغ والتاريخ. الرد خلال 10 أيام عمل. 6.3. لا يُرد الجزء المستخدم من المدة إلا إذا لم يُمنح الوصول بخطأ المشغّلة. 6.4. رسائل البوتات وتطبيقات المراسلة لا تُنظر."]],
      ["7. ملاحظاتكم", ["7.1. الملاحظات لكم. لا تُباع ولا تُنشر ولا تُعطى للإعلان. 7.2. تمنحون ترخيصًا بسيطًا غير حصري فقط للحفظ والعرض وملخص الأسبوع والتذكير. 7.3. أنتم مسؤولون عن المحتوى ولا تدخلون بيانات الغير بلا رضا ولا محتوى محظورًا. 7.4. هذا ليس إسعافًا. في الأزمة راجعوا مختصكم أو الرقم 112."]],
      ["8. الحذف", ["8.1. يمكن التوقف في أي وقت. 8.2. صفحة الحذف وأنتم داخلون تمسح الملاحظات والدخول وبيانات الحساب. 8.3. إذا تعذر الدخول فاكتبوا إلى " + MAIL + " واذكروا البريد أو معرّف MAX. 8.4. عند المخالفة قد يُقيَّد الوصول مع إشعار بالبريد."]],
      ["9. الممنوع", ["9.1. يُمنع نقل الدخول وجمع البيانات آليًا وفتح يوميات الغير وتجاوز القيود وإدخال محتوى غير مشروع واستعمال الخدمة للإرسال والإعلان والرسائل المزعجة."]],
      ["10. ليست خدمة طبية", ["10.1. Between ليست خدمة طبية ولا علاجًا نفسيًا، ولا تشخّص ولا تصف علاجًا. ملخص الأسبوع لا يغني عن مختص. 10.2. قرار العلاج تأخذونه مع مختصكم."]],
      ["11. التعديل", ["11.1. النسخة الجديدة تُنشر في هذه الصفحة مع التاريخ. 11.2. استمرار الاستخدام قبول لها."]],
      ["12. المسؤولية", ["12.1. تُقدَّم الخدمة كما هي. لا ضمان لعمل بلا انقطاع. المشغّلة لا تسأل عن محتوى ملاحظاتكم ولا عن ظروف علاجكم. 12.2. المسؤولية المالية محدودة بآخر دفعة ما لم ينص قانون الاتحاد الروسي على غير ذلك."]],
      ["13. القانون والنزاع", ["13.1. يُطبق قانون الاتحاد الروسي. 13.2. قبل المحكمة أرسلوا مطالبة إلى " + MAIL + ". الرد خلال 10 أيام عمل. 13.3. المحكمة بحسب قواعد الاختصاص."]],
      ["14. البيانات والتواصل", ["14.1. راسلوا " + MAIL + " فقط. رسائل البوتات وتطبيقات المراسلة لا تُقبل. " + NAME + "، INN " + INN + ". الموقع: between-journal.ru."]],
    ],
  ),
  fa: webDoc(
    "شرایط استفاده از Between",
    "ویرایش ۹ نوامبر ۲۰۲۶",
    ["Between · between-journal.ru · برای سایت و نسخهٔ MAX", `گرداننده: ${NAME}، خویش‌فرما، INN ${INN}`],
    [
      ["1. سند", ["1.1. این شرایط سایت between-journal.ru و مینی‌اپ Between در MAX را تنظیم می‌کند. 1.2. نسخهٔ تلگرام (بات @BetweenJournalBot) سندهای خودش را در همان نسخه دارد. این شرایط به تلگرام نمی‌رسد. 1.3. شرایط پیشنهاد عمومی " + NAME + " است. شروع استفاده یعنی پذیرش."]],
      ["2. واژه‌ها", ["سرویس: دفتر حال و فکر با خلاصهٔ هفته. نسخهٔ وب در مرورگر باز می‌شود. نسخهٔ MAX مینی‌اپ در MAX است. دفتر: یادداشت، احساس، موضوع و یادآوری. هفته: طیف، تکرار و موضوع‌هایی برای گفتگو با متخصص. دورهٔ پولی: مدتی که هفته پس از پرداخت باز می‌ماند."]],
      ["3. حساب", ["3.1. ورود با کد ایمیل یا از راه MAX است. 3.2. سرویس برای ۱۸ سال به بالاست. 3.3. ایمیل و حساب MAX را خودتان نگه می‌دارید. گرداننده مسئول از دست رفتن یادداشت به‌خاطر ورود دیگری نیست. 3.4. یک نفر، یک حساب. دسترسی واگذار نمی‌شود."]],
      ["4. کار سرویس", ["4.1. دفتر را می‌توان نوشت. 4.2. هفته طیف، تکرار و موضوع را برای روان‌شناس یا روان‌درمانگر جمع می‌کند. 4.3. صدا فقط به متن تبدیل می‌شود، در دورهٔ پولی، تا ۱۰ بار در روز. 4.4. کارکردها ممکن است عوض شوند. تغییر مهم در خود سرویس گفته می‌شود."]],
      ["5. قیمت و پرداخت", ["5.1. دفتر رایگان است و مهلت ندارد. 5.2. هفته ۷ روز از اولین باز کردن برگه رایگان است، نه از ثبت‌نام. 5.3. بعد پولی است. قیمت پیش از پرداخت روی برگه است (مثلاً ۱۵۰ روبل برای ۳۰ روز؛ ۳ ماه و ۱ سال هم ممکن است). 5.4. در سایت پرداخت با YooKassa است. دادهٔ کارت به گرداننده نمی‌رسد و نگه داشته نمی‌شود. 5.5. اگر در MAX پرداخت با موجودی سکو باشد، قاعده و قیمت در همان نسخه است. 5.6. دسترسی پس از تأیید پرداخت برای تمام مدت پرداخت‌شده باز می‌شود. تمدید پیش از پرداخت نوشته می‌شود. 5.7. رسید طبق قانون فدراسیون روسیه است."]],
      ["6. بازپرداخت", ["6.1. اگر پول رفته و هفته به دلیل فنی باز نشده، گرداننده دسترسی را باز می‌کند یا مبلغ را برمی‌گرداند. 6.2. فقط به " + MAIL + " بنویسید: ایمیل یا شناسهٔ MAX، مبلغ و تاریخ. پاسخ تا ۱۰ روز کاری. 6.3. بخش استفاده‌شدهٔ دوره برنمی‌گردد، مگر دسترسی به تقصیر گرداننده داده نشده باشد. 6.4. پیام بات و پیام‌رسان بررسی نمی‌شود."]],
      ["7. یادداشت‌های شما", ["7.1. یادداشت‌ها مال شماست. فروخته، منتشر یا برای تبلیغ داده نمی‌شوند. 7.2. مجوز ساده و غیرانحصاری فقط برای نگهداری، نمایش، خلاصهٔ هفته و یادآوری می‌دهید. 7.3. مسئول متن خودتان هستید. دادهٔ دیگران را بی‌رضایت و محتوای ممنوع را ننویسید. 7.4. این کمک اضطراری نیست. در بحران به متخصص خود یا ۱۱۲ مراجعه کنید."]],
      ["8. حذف", ["8.1. هر وقت بخواهید می‌توانید دست بکشید. 8.2. صفحهٔ حذف، وقتی وارد شده‌اید، یادداشت، ورود و دادهٔ حساب را پاک می‌کند. 8.3. اگر نتوانستید وارد شوید به " + MAIL + " بنویسید و ایمیل یا شناسهٔ MAX را بگویید. 8.4. اگر شرایط نقض شود دسترسی محدود می‌شود و با ایمیل خبر داده می‌شود."]],
      ["9. ممنوعیت", ["9.1. دادن دسترسی، جمع خودکار داده، باز کردن دفتر دیگری، دور زدن محدودیت، گذاشتن محتوای غیرقانونی و استفاده برای ارسال، تبلیغ و هرزنامه ممنوع است."]],
      ["10. خدمت پزشکی نیست", ["10.1. Between خدمت پزشکی یا روان‌درمانی نیست، تشخیص نمی‌دهد و درمان تجویز نمی‌کند. خلاصهٔ هفته جای متخصص را نمی‌گیرد. 10.2. تصمیم درمان را با متخصص خودتان می‌گیرید."]],
      ["11. تغییر", ["11.1. ویرایش تازه با تاریخ در همین صفحه منتشر می‌شود. 11.2. ادامهٔ استفاده یعنی پذیرش."]],
      ["12. مسئولیت", ["12.1. سرویس همان‌گونه که هست داده می‌شود. کار بی‌وقفه تضمین نیست. گرداننده مسئول متن شما و شرایط درمان شما نیست. 12.2. مسئولیت مالی به آخرین پرداخت محدود است، مگر قانون فدراسیون روسیه جز این بگوید."]],
      ["13. قانون و اختلاف", ["13.1. قانون فدراسیون روسیه اعمال می‌شود. 13.2. پیش از دادگاه به " + MAIL + " مطالبه بفرستید. پاسخ تا ۱۰ روز کاری. 13.3. دادگاه طبق قاعدهٔ صلاحیت است."]],
      ["14. مشخصات و تماس", ["14.1. فقط به " + MAIL + " بنویسید. پیام بات و پیام‌رسان پذیرفته نمی‌شود. " + NAME + "، INN " + INN + ". سایت: between-journal.ru."]],
    ],
  ),
  hi: webDoc(
    "Between की उपयोग शर्तें",
    "9 नवंबर 2026 का संस्करण",
    ["Between · between-journal.ru · साइट और MAX संस्करण के लिए", `संचालिका: ${NAME}, स्व-नियोजित, INN ${INN}`],
    [
      ["1. दस्तावेज़", ["1.1. ये शर्तें between-journal.ru और MAX में Between मिनी ऐप को चलाती हैं. 1.2. Telegram संस्करण (बॉट @BetweenJournalBot) के अपने दस्तावेज़ उसी संस्करण में हैं. ये शर्तें Telegram पर नहीं लगतीं. 1.3. यह " + NAME + " का सार्वजनिक प्रस्ताव है. सेवा शुरू करना स्वीकार है."]],
      ["2. शब्द", ["सेवा: हफ़्ते के सार के साथ मूड और विचार की डायरी. वेब संस्करण ब्राउज़र में खुलता है. MAX संस्करण MAX का मिनी ऐप है. डायरी: नोट, भावना, विषय और याद. हफ़्ता: स्पेक्ट्रम, दोहराव और विशेषज्ञ से कहने योग्य विषय. सशुल्क अवधि: भुगतान के बाद हफ़्ता जितनी देर खुला रहता है."]],
      ["3. खाता", ["3.1. प्रवेश ईमेल कोड या MAX से होता है. 3.2. सेवा 18 वर्ष और उससे अधिक के लिए है. 3.3. ईमेल और MAX खाता आप संभालते हैं. किसी और के प्रवेश से नोट खो जाएँ तो संचालिका ज़िम्मेदार नहीं. 3.4. एक व्यक्ति, एक खाता. पहुँच बाँटी नहीं जाती."]],
      ["4. सेवा का काम", ["4.1. डायरी रखी जा सकती है. 4.2. हफ़्ता स्पेक्ट्रम, दोहराव और मनोवैज्ञानिक या चिकित्सक से कहने योग्य विषय जोड़ता है. 4.3. आवाज़ केवल पाठ बनती है, सशुल्क अवधि में, दिन में 10 बार तक. 4.4. सुविधाएँ बदल सकती हैं. ज़रूरी बात सेवा में दिखाई जाती है."]],
      ["5. कीमत और भुगतान", ["5.1. डायरी मुफ़्त है और समय से बँधी नहीं. 5.2. हफ़्ता टैब पहली बार खुलने से 7 दिन मुफ़्त है, पंजीकरण से नहीं. 5.3. फिर भुगतान है. कीमत भुगतान से पहले टैब पर है (उदाहरण, 30 दिन के 150 रूबल; 3 महीने और 1 वर्ष हो सकते हैं). 5.4. साइट पर भुगतान YooKassa से होता है. कार्ड का डेटा संचालिका नहीं लेती और नहीं रखती. 5.5. अगर MAX में मंच के धन से भुगतान हो, नियम और कीमत उसी संस्करण में हैं. 5.6. पहुँच पुष्टि के बाद खुलती है और चुकाई अवधि तक रहती है. नवीनीकरण भुगतान से पहले लिखा होता है. 5.7. रसीद रूसी संघ के क़ानून के अनुसार है."]],
      ["6. वापसी", ["6.1. पैसा चला गया और तकनीकी कारण से हफ़्ता न खुला, तो संचालिका पहुँच खोलती है या रकम लौटाती है. 6.2. केवल " + MAIL + " पर लिखें: ईमेल या MAX पहचान, रकम और तारीख. जवाब 10 कार्यदिवस तक. 6.3. बीती अवधि वापस नहीं होती, जब तक पहुँच संचालिका की गलती से न मिली हो. 6.4. बॉट और मैसेंजर के संदेश नहीं देखे जाते."]],
      ["7. आपके नोट", ["7.1. नोट आपके हैं. वे बिकते नहीं, छपते नहीं और विज्ञापन के लिए नहीं दिए जाते. 7.2. आप केवल रखने, दिखाने, हफ़्ते का सार बनाने और याद दिलाने के लिए साधारण अनन्य-रहित अनुमति देते हैं. 7.3. लेख की ज़िम्मेदारी आपकी है. दूसरों का डेटा बिना सहमति और मना किया लेख न डालें. 7.4. यह आपात सहायता नहीं. संकट में अपने विशेषज्ञ या 112 से बात करें."]],
      ["8. मिटाना", ["8.1. सेवा कभी भी छोड़ी जा सकती है. 8.2. प्रवेश के बाद मिटाने का पृष्ठ नोट, प्रवेश और खाते का डेटा मिटाता है. 8.3. प्रवेश न हो तो " + MAIL + " पर ईमेल या MAX पहचान लिखें. 8.4. शर्त टूटे तो पहुँच सीमित हो सकती है और ईमेल से बताया जाता है."]],
      ["9. मनाही", ["9.1. पहुँच बाँटना, डेटा अपने आप इकट्ठा करना, दूसरे की डायरी खोलना, सीमा तोड़ना, ग़ैरक़ानूनी लेख डालना और सेवा को प्रेषण, विज्ञापन या स्पैम के लिए इस्तेमाल करना मना है."]],
      ["10. यह चिकित्सा सेवा नहीं", ["10.1. Between चिकित्सा या मनोचिकित्सा सेवा नहीं, निदान नहीं करती और इलाज नहीं लिखती. हफ़्ते का सार विशेषज्ञ की जगह नहीं लेता. 10.2. चिकित्सा का फ़ैसला आप अपने विशेषज्ञ के साथ करते हैं."]],
      ["11. बदलाव", ["11.1. नया संस्करण तारीख के साथ इसी पृष्ठ पर छपता है. 11.2. आगे इस्तेमाल स्वीकार है."]],
      ["12. ज़िम्मेदारी", ["12.1. सेवा जैसी है वैसी दी जाती है. बिना रुके चलने की गारंटी नहीं. संचालिका आपके नोट और चिकित्सा की परिस्थितियों के लिए ज़िम्मेदार नहीं. 12.2. धन की ज़िम्मेदारी अंतिम भुगतान तक है, जब तक रूसी संघ का क़ानून और न कहे."]],
      ["13. क़ानून और विवाद", ["13.1. रूसी संघ का क़ानून लगता है. 13.2. अदालत से पहले " + MAIL + " पर दावा भेजें. जवाब 10 कार्यदिवस तक. 13.3. अदालत अधिकार के नियम से होती है."]],
      ["14. पहचान और संपर्क", ["14.1. केवल " + MAIL + " पर लिखें. बॉट और मैसेंजर के संदेश नहीं लिए जाते. " + NAME + ", INN " + INN + ". साइट: between-journal.ru."]],
    ],
  ),
  uz: webDoc(
    "Between’dan foydalanish shartlari",
    "2026-yil 9-noyabr tahriri",
    ["Between · between-journal.ru · sayt va MAX versiyasi uchun", `Operator: ${NAME}, o‘zini o‘zi band qilgan, INN ${INN}`],
    [
      ["1. Hujjat", ["1.1. Bu shartlar between-journal.ru sayti va MAX’dagi Between mini-ilovasini tartibga soladi. 1.2. Telegram versiyasi (bot @BetweenJournalBot) o‘z hujjatlariga ega. Bu shartlar Telegramga tatbiq etilmaydi. 1.3. Shartlar " + NAME + "ning ommaviy ofertasi. Foydalanishni boshlash qabul qilishdir."]],
      ["2. Atamalar", ["Xizmat: haftalik xulosa bilan kayfiyat va fikr kundaligi. Veb-versiya brauzerda ochiladi. MAX versiyasi MAX’dagi mini-ilova. Kundalik: yozuvlar, hislar, mavzular va eslatmalar. Hafta: spektr, takrorlar va mutaxassis bilan gaplashiladigan mavzular. Pulli davr: to‘lovdan keyin Hafta ochiq turadigan muddat."]],
      ["3. Hisob", ["3.1. Kirish pochta kodi yoki MAX orqali. 3.2. Xizmat 18 yoshdan katta shaxslar uchun. 3.3. Pochta va MAX hisobini o‘zingiz saqlaysiz. Boshqa odam kirib yozuvlar yo‘qolsa, operator javob bermaydi. 3.4. Bir kishi, bir hisob. Kirish berilmaydi."]],
      ["4. Xizmat ishi", ["4.1. Kundalik yuritiladi. 4.2. Hafta spektr, takror va psixolog yoki psixoterapevt bilan gaplashiladigan mavzularni yig‘adi. 4.3. Ovoz faqat matnga aylanadi, pulli davrda, kuniga 10 martagacha. 4.4. Vazifalar o‘zgarishi mumkin. Muhimi xizmatda aytiladi."]],
      ["5. Narx va to‘lov", ["5.1. Kundalik bepul va muddatsiz. 5.2. Hafta ro‘yxatdan emas, varaq birinchi ochilganidan 7 kun bepul. 5.3. Keyin pulli. Narx to‘lovdan oldin varaqda (masalan, 30 kun uchun 150 rubl; 3 oy va 1 yil bo‘lishi mumkin). 5.4. Saytda to‘lov YooKassa orqali. Karta ma’lumotini operator olmaydi va saqlamaydi. 5.5. MAX’da platforma mablag‘i bilan to‘lov bo‘lsa, qoida va narx o‘sha versiyada. 5.6. Kirish tasdiqdan keyin ochiladi va to‘langan muddat davom etadi. Uzaytirish to‘lovdan oldin yoziladi. 5.7. Chek Rossiya Federatsiyasi qonuniga muvofiq."]],
      ["6. Qaytarish", ["6.1. Pul o‘tib, Hafta texnik sababdan ochilmasa, operator kirishni ochadi yoki summani qaytaradi. 6.2. Faqat " + MAIL + " ga yozing: pochta yoki MAX identifikatori, summa va sana. Javob 10 ish kunigacha. 6.3. Ishlatilgan qism qaytarilmaydi, kirish operator aybi bilan berilmagan bo‘lmasa. 6.4. Bot va messenjer murojaatlari ko‘rilmaydi."]],
      ["7. Yozuvlaringiz", ["7.1. Yozuvlar sizniki. Sotilmaydi, e’lon qilinmaydi va reklama uchun berilmaydi. 7.2. Siz saqlash, ko‘rsatish, hafta xulosasi va eslatma uchun oddiy, mutlaq bo‘lmagan litsenziya berasiz. 7.3. Matn uchun o‘zingiz javob berasiz. Boshqalarning ma’lumotini roziligisiz va taqiqlangan kontentni kiritmaysiz. 7.4. Bu shoshilinch yordam emas. Inqirozda o‘z mutaxassisingizga yoki 112 ga murojaat qiling."]],
      ["8. O‘chirish", ["8.1. Xizmatni istalgan payt to‘xtatish mumkin. 8.2. Kirganingizda o‘chirish sahifasi yozuv, kirish va hisob ma’lumotini o‘chiradi. 8.3. Kira olmasangiz, " + MAIL + " ga pochta yoki MAX identifikatorini yozing. 8.4. Shart buzilsa kirish cheklanadi va pochta orqali aytiladi."]],
      ["9. Taqiq", ["9.1. Kirishni berish, ma’lumotni avtomatik yig‘ish, begona kundalikni ochish, cheklovni aylanib o‘tish, noqonuniy kontent kiritish va xizmatni xat, reklama va spam uchun ishlatish taqiqlanadi."]],
      ["10. Tibbiy xizmat emas", ["10.1. Between tibbiy yoki psixoterapiya xizmati emas, tashxis qo‘ymaydi va davolash yozmaydi. Hafta xulosasi mutaxassis o‘rnini bosmaydi. 10.2. Davolash qarorini mutaxassisingiz bilan birga qilasiz."]],
      ["11. O‘zgarish", ["11.1. Yangi tahrir sana bilan shu sahifada chiqadi. 11.2. Foydalanishda davom etish rozilikdir."]],
      ["12. Javobgarlik", ["12.1. Xizmat boricha beriladi. Uzluksiz ish kafolatlanmaydi. Operator yozuvlaringiz va terapiya holati uchun javob bermaydi. 12.2. Moliyaviy javobgarlik oxirgi to‘lov bilan cheklanadi, Rossiya Federatsiyasi qonuni boshqacha demasa."]],
      ["13. Huquq va nizo", ["13.1. Rossiya Federatsiyasi huquqi qo‘llanadi. 13.2. Suddan oldin " + MAIL + " ga da’vo yuboring. Javob 10 ish kunigacha. 13.3. Sud qonundagi qoidaga ko‘ra."]],
      ["14. Rekvizit va aloqa", ["14.1. Faqat " + MAIL + " ga yozing. Bot va messenjer qabul qilinmaydi. " + NAME + ", INN " + INN + ". Sayt: between-journal.ru."]],
    ],
  ),
};

export const PRIVACY_REST: Rest = {
  en: webDoc(
    "Privacy policy of Between",
    "Revision of 9 November 2026",
    ["Between · between-journal.ru · this policy covers the website and the MAX version", `Operator: ${NAME}, self-employed, INN ${INN}`],
    [
      ["1. General", [
        "1.1. This policy describes personal data processed on the Between website (between-journal.ru) and in the Between mini app in MAX (together, the Service), and the rights of the people that data is about.",
        "1.2. The policy follows Federal Law of 27 July 2006 No. 152-FZ on personal data.",
        "1.3. The Telegram version (the bot @BetweenJournalBot) has its own policy inside that version. This policy does not apply to Telegram.",
        `1.4. Questions about personal data go only to ${MAIL}. Messages through chat bots and messengers are not accepted.`,
      ]],
      ["2. Operator", [
        `2.1. The operator of personal data is ${NAME}, self-employed, INN ${INN}. Contact email: ${MAIL}.`,
      ]],
      ["3. Legal grounds", [
        "3.1. Processing rests on the contract (the terms of use), on your consent shown by starting to use the Service, and on the law of the Russian Federation, including Federal Law No. 54-FZ for receipts.",
        "3.2. Journal entries are voluntary. The Operator does not ask for health information and does not require it. You decide what the notes contain.",
      ]],
      ["4. What data", [
        "4.1. The data is:",
        "• account data: email for the website, and a MAX user id for MAX;",
        "• journal content: note text, marked feelings, session topics, sessions, reminders;",
        "• technical data: interface language, time zone, anonymous action counts, country from the IP address;",
        "• payment data: the fact of payment, the sum, the date, and how long the paid period lasts;",
        "• voice messages: the file is used only to become note text and is not kept;",
        "• support letters: the text, the sender's address, the platform, and the journal id.",
        "4.2. The country is read from the IP only for that request, to warn that Telegram from Russia may not open without a VPN, and it is not stored.",
        "4.3. The Operator does not receive or store card data. YooKassa processes it.",
      ]],
      ["5. Purposes", [
        "5.1. The purposes are:",
        "• keeping the journal and opening it on your device;",
        "• building the Week summary: the spectrum, what repeated, topics for the session;",
        "• reminders and contact inside the Service;",
        "• sign-in and account safety (confirmation codes);",
        "• taking payment, opening the paid period, issuing receipts;",
        "• answering support letters;",
        "• anonymous usage statistics to improve the Service.",
      ]],
      ["6. Models", [
        "6.1. To build the Week summary and to transcribe voice, note text may go to outside models through AI Tunnel, or through Gemini or Groq when the AI Tunnel key is not set.",
        "6.2. Notes are used only for the functions you asked for. The Operator does not use them to train its own models and does not pass them on for advertising.",
      ]],
      ["7. Who else receives data", [
        "7.1. The services involved are:",
        "• Upstash Redis: the database that holds the journal;",
        "• Vercel: the site infrastructure;",
        "• AI Tunnel, Gemini, Groq: text and voice transcription;",
        "• YooKassa: payments and receipts;",
        "• the mail service: letters (sign-in codes and support replies);",
        "• Yandex Metrika: anonymous visit counts on the public page (cookie);",
        "• PostHog (USA): anonymous funnel counts, without a name and without account ids.",
        "7.2. Some of these services are outside the Russian Federation, including in the USA. Cross-border transfer is only for the purposes in this policy and only as far as the Service needs.",
      ]],
      ["8. Cookies and analytics", [
        "8.1. The site uses cookies for sign-in and for anonymous statistics (Yandex Metrika, PostHog).",
        "8.2. You can limit cookies in the browser. Some functions may then work incorrectly.",
      ]],
      ["9. Security", [
        "9.1. Data is sent over a protected connection (HTTPS/TLS).",
        "9.2. Sign-in codes are stored in a protected form. The Operator's access to the journal is limited to support and maintenance.",
        "9.3. Outside services receive only what they need to do their job.",
      ]],
      ["10. How long, and deletion", [
        "10.1. Data is processed while you use the journal.",
        "10.2. The deletion page erases the notes, the sign-in, and the data tied to the account. Anonymous counts from past days stay, with nothing that points to you.",
        `10.3. Letters already sent to ${MAIL} stay in the support mailbox.`,
        "10.4. If you ask, the Operator confirms that the data was deleted.",
      ]],
      ["11. Your rights", [
        "11.1. You may ask what is processed, ask for correction, blocking, or deletion, withdraw consent, and challenge the Operator's actions.",
        "11.2. You delete the journal yourself on the deletion page while you are signed in.",
        `11.3. Other requests go by letter to ${MAIL}, with the email or MAX id you used. The answer takes up to 10 business days.`,
        "11.4. You may also apply to Roskomnadzor or to a court.",
      ]],
      ["12. Minors", [
        "12.1. The Service is for people over 18. Data of minors is not collected. If the Operator learns that a minor keeps the journal, the data is deleted.",
      ]],
      ["13. Changes", [
        "13.1. The Operator may change the policy. A new revision is published on this page with its date.",
      ]],
      ["14. Contact", [
        `14.1. Questions about personal data go only to ${MAIL}.`,
        `Operator details. ${NAME}, self-employed, INN ${INN}. Email: ${MAIL} (the only contact channel). Site: between-journal.ru.`,
      ]],
    ],
  ),
  uk: privacyUk(),
  es: privacyEs(),
  pt: privacyPt(),
  tr: privacyTr(),
  id: privacyId(),
  vi: privacyVi(),
  ar: privacyAr(),
  fa: privacyFa(),
  hi: privacyHi(),
  uz: privacyUz(),
};

function privacyUk(): LegalDoc {
  return webDoc("Політика конфіденційності сервісу Between", "Редакція від 9 листопада 2026 року", ["Сервіс Between · between-journal.ru · діє для вебверсії і версії в MAX", `Оператор: ${NAME}, самозайнята, ІПН ${INN}`], [
    ["1. Загальні положення", ["1.1. Політика описує персональні дані вебверсії between-journal.ru і мінізастосунку в MAX та права суб’єктів. 1.2. Вона складена за Федеральним законом від 27.07.2006 № 152-ФЗ «Про персональні дані». 1.3. Для Telegram (бот @BetweenJournalBot) діє окрема політика в тій версії. Ця політика на Telegram не поширюється. 1.4. Звернення лише на " + MAIL + ". Через ботів і месенджери їх не приймають."]],
    ["2. Оператор", ["2.1. Оператор — самозайнята " + NAME + ", ІПН " + INN + ". Пошта: " + MAIL + "."]],
    ["3. Підстави", ["3.1. Підстави: договір (умови використання), згода початком користування і вимоги законодавства Російської Федерації, включно із законом № 54-ФЗ щодо чеків. 3.2. Записи добровільні. Відомостей про здоров’я оператор не запитує і не вимагає."]],
    ["4. Які дані", ["4.1. Пошта для входу на сайті, ідентифікатор MAX, текст нотаток, почуття, теми, сеанси, нагадування, мова, часовий пояс, знеособлені лічильники, країна за IP, факт оплати, сума, дата і строк, голос лише для тексту і без зберігання файлу, листи підтримки з текстом, адресою, платформою й ідентифікатором. 4.2. Країну за IP дивляться лише в момент запиту, щоб попередити про Telegram з Росії без VPN, і не зберігають. 4.3. Дані карток обробляє ЮKassa, оператор їх не отримує і не зберігає."]],
    ["5. Цілі", ["5.1. Зберігати щоденник, збирати «Тиждень», нагадувати, забезпечувати вхід кодами, приймати платежі і чеки, відповідати на підтримку, рахувати знеособлену статистику."]],
    ["6. Моделі", ["6.1. Текст для «Тижня» і розшифрування голосу може йти в моделі через AI Tunnel або, якщо ключа немає, через Gemini чи Groq. 6.2. Записи лише для запитаних функцій. Для навчання власних моделей і для реклами їх не використовують."]],
    ["7. Кому передають", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, ЮKassa, пошта сервісу, Яндекс Метрика (cookie на публічній сторінці), PostHog у США без імені і без ідентифікаторів акаунта. 7.2. Частина сервісів за межами Російської Федерації, зокрема в США. Передача лише для цілей політики і в потрібному обсязі."]],
    ["8. Cookie", ["8.1. Cookie потрібні для входу і для знеособленої статистики (Яндекс Метрика, PostHog). 8.2. Їх можна обмежити в браузері, тоді частина функцій може працювати некоректно."]],
    ["9. Безпека", ["9.1. Передача через HTTPS/TLS. 9.2. Коди входу зберігаються захищено. Доступ оператора до щоденника обмежений підтримкою і обслуговуванням. 9.3. Стороннім сервісам іде лише потрібний обсяг."]],
    ["10. Строки і видалення", ["10.1. Поки ви користуєтеся щоденником. 10.2. Сторінка видалення стирає нотатки, вхід і пов’язані дані. Знеособлені лічильники лишаються без прив’язки до вас. 10.3. Листи на " + MAIL + " лишаються в пошті підтримки. 10.4. На прохання оператор підтверджує видалення."]],
    ["11. Права", ["11.1. Можна дізнатися про обробку, вимагати уточнення, блокування чи видалення, відкликати згоду і оскаржити дії. 11.2. Самостійно це робить сторінка видалення, поки ви ввійшли. 11.3. Інше — лист на " + MAIL + " із поштою або ідентифікатором MAX. Відповідь до 10 робочих днів. 11.4. Можна звернутися до Роскомнадзору або до суду."]],
    ["12. Неповнолітні", ["12.1. Сервіс для осіб старше 18 років. Дані неповнолітніх не збирають. Якщо стане відомо, що щоденник веде неповнолітній, дані видаляють."]],
    ["13. Зміни", ["13.1. Нова редакція публікується на цій сторінці з датою."]],
    ["14. Контакти", ["14.1. Питання щодо персональних даних лише на " + MAIL + ". " + NAME + ", ІПН " + INN + ". Сайт: between-journal.ru."]],
  ]);
}

function privacyEs(): LegalDoc {
  return webDoc("Política de privacidad de Between", "Edición del 9 de noviembre de 2026", ["Between · between-journal.ru · rige para el sitio y la versión en MAX", `Operadora: ${NAME}, autónoma, INN ${INN}`], [
    ["1. Disposiciones generales", ["1.1. Esta política describe los datos personales del sitio between-journal.ru y de la mini app en MAX, y los derechos de las personas. 1.2. Sigue la Ley federal del 27.07.2006 n.º 152-FZ sobre datos personales. 1.3. La versión de Telegram (bot @BetweenJournalBot) tiene su propia política en esa versión. Esta política no se aplica a Telegram. 1.4. Escriba solo a " + MAIL + ". No se aceptan mensajes por bots ni mensajeros."]],
    ["2. Operadora", ["2.1. La operadora es " + NAME + ", autónoma, INN " + INN + ". Correo: " + MAIL + "."]],
    ["3. Bases", ["3.1. Bases: el contrato (condiciones de uso), el consentimiento al empezar a usar el servicio y la ley de la Federación de Rusia, incluida la ley n.º 54-FZ sobre recibos. 3.2. Las notas son voluntarias. No se piden datos de salud ni se exigen."]],
    ["4. Qué datos", ["4.1. Correo de la web, id de MAX, texto de notas, sentimientos, temas, sesiones, recordatorios, idioma, zona horaria, conteos anónimos, país según la IP, hecho del pago, suma, fecha y plazo, voz solo para convertirla en texto sin guardar el archivo, y cartas de ayuda con texto, dirección, plataforma e id. 4.2. El país de la IP se mira solo en esa solicitud, para avisar de que Telegram desde Rusia puede no abrirse sin VPN, y no se guarda. 4.3. Los datos de tarjeta los trata YooKassa. La operadora no los recibe ni los guarda."]],
    ["5. Fines", ["5.1. Guardar el diario, armar Semana, recordar, asegurar el acceso con códigos, cobrar y emitir recibos, responder a ayuda y contar estadística anónima."]],
    ["6. Modelos", ["6.1. El texto para Semana y la voz puede ir a modelos por AI Tunnel o, si no hay clave, por Gemini o Groq. 6.2. Las notas solo sirven para lo que usted pidió. No se usan para entrenar modelos propios ni para publicidad."]],
    ["7. Quién más recibe datos", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, el correo del servicio, Yandex Metrika (cookie en la página pública) y PostHog en EE. UU. sin nombre ni identificadores de cuenta. 7.2. Parte de los servicios está fuera de la Federación de Rusia, también en EE. UU. La transferencia es solo para los fines de esta política y en la medida necesaria."]],
    ["8. Cookies", ["8.1. Hay cookies para el acceso y para estadística anónima (Yandex Metrika, PostHog). 8.2. Puede limitarlas en el navegador. Alguna función puede entonces fallar."]],
    ["9. Seguridad", ["9.1. La transmisión va por HTTPS/TLS. 9.2. Los códigos se guardan de forma protegida. El acceso de la operadora al diario se limita a ayuda y mantenimiento. 9.3. A otros servicios solo va lo necesario."]],
    ["10. Plazos y borrado", ["10.1. Mientras use el diario. 10.2. La página de eliminación borra notas, acceso y datos de la cuenta. Los conteos anónimos quedan sin vínculo con usted. 10.3. Las cartas a " + MAIL + " se quedan en el buzón de ayuda. 10.4. Si lo pide, la operadora confirma el borrado."]],
    ["11. Derechos", ["11.1. Puede informarse, pedir corrección, bloqueo o borrado, retirar el consentimiento e impugnar. 11.2. El borrado propio es la página de eliminación mientras haya entrado. 11.3. Lo demás, por carta a " + MAIL + " con el correo o el id de MAX. Respuesta en hasta 10 días hábiles. 11.4. También puede acudir a Roskomnadzor o a un tribunal."]],
    ["12. Menores", ["12.1. El servicio es para mayores de 18 años. No se recogen datos de menores. Si se sabe que un menor lleva el diario, los datos se borran."]],
    ["13. Cambios", ["13.1. La nueva edición se publica en esta página con la fecha."]],
    ["14. Contacto", ["14.1. Las preguntas sobre datos personales van solo a " + MAIL + ". " + NAME + ", INN " + INN + ". Sitio: between-journal.ru."]],
  ]);
}

function privacyPt(): LegalDoc {
  return webDoc("Política de privacidade do Between", "Edição de 9 de novembro de 2026", ["Between · between-journal.ru · vale para o site e a versão no MAX", `Operadora: ${NAME}, autônoma, INN ${INN}`], [
    ["1. Disposições gerais", ["1.1. Esta política descreve os dados pessoais do site between-journal.ru e do mini app no MAX, e os direitos das pessoas. 1.2. Segue a Lei federal de 27.07.2006 n.º 152-FZ sobre dados pessoais. 1.3. A versão no Telegram (bot @BetweenJournalBot) tem a própria política nessa versão. Esta política não se aplica ao Telegram. 1.4. Escreva só para " + MAIL + ". Mensagens por bots e mensageiros não são aceitas."]],
    ["2. Operadora", ["2.1. A operadora é " + NAME + ", autônoma, INN " + INN + ". E-mail: " + MAIL + "."]],
    ["3. Bases", ["3.1. Bases: o contrato (termos de uso), o consentimento ao começar a usar o serviço e a lei da Federação da Rússia, inclusive a lei n.º 54-FZ sobre recibos. 3.2. As notas são voluntárias. Dados de saúde não são pedidos nem exigidos."]],
    ["4. Quais dados", ["4.1. E-mail da web, id do MAX, texto das notas, sentimentos, temas, sessões, lembretes, idioma, fuso, contagens anônimas, país pelo IP, fato do pagamento, soma, data e prazo, voz só para virar texto sem guardar o arquivo, e cartas de ajuda com texto, endereço, plataforma e id. 4.2. O país do IP é lido só naquela solicitação, para avisar que o Telegram da Rússia pode não abrir sem VPN, e não é guardado. 4.3. Os dados do cartão ficam com a YooKassa. A operadora não os recebe nem os guarda."]],
    ["5. Fins", ["5.1. Guardar o diário, montar a Semana, lembrar, proteger a entrada com códigos, receber pagamentos e recibos, responder à ajuda e contar estatística anônima."]],
    ["6. Modelos", ["6.1. O texto da Semana e a voz podem ir a modelos pelo AI Tunnel ou, sem essa chave, pelo Gemini ou Groq. 6.2. As notas servem só para o que você pediu. Não treinam modelos próprios e não vão para publicidade."]],
    ["7. Quem mais recebe", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, a caixa do serviço, Yandex Metrika (cookie na página pública) e PostHog nos EUA, sem nome e sem identificadores de conta. 7.2. Parte dos serviços está fora da Federação da Rússia, inclusive nos EUA. A transferência é só para os fins desta política e na medida necessária."]],
    ["8. Cookies", ["8.1. Há cookies para a entrada e para estatística anônima (Yandex Metrika, PostHog). 8.2. Você pode limitá-los no navegador. Alguma função pode então falhar."]],
    ["9. Segurança", ["9.1. A transmissão usa HTTPS/TLS. 9.2. Os códigos ficam protegidos. O acesso da operadora ao diário se limita a ajuda e manutenção. 9.3. Outros serviços recebem só o necessário."]],
    ["10. Prazos e exclusão", ["10.1. Enquanto você usa o diário. 10.2. A página de exclusão apaga notas, entrada e dados da conta. Contagens anônimas ficam sem ligação com você. 10.3. Cartas para " + MAIL + " ficam na caixa de ajuda. 10.4. Se você pedir, a operadora confirma a exclusão."]],
    ["11. Direitos", ["11.1. Você pode saber o que é tratado, pedir correção, bloqueio ou exclusão, retirar o consentimento e contestar. 11.2. A exclusão própria é a página de exclusão enquanto houver sessão. 11.3. O resto vai por carta a " + MAIL + ", com o e-mail ou o id do MAX. Resposta em até 10 dias úteis. 11.4. Também é possível procurar o Roskomnadzor ou um tribunal."]],
    ["12. Menores", ["12.1. O serviço é para maiores de 18 anos. Dados de menores não são coletados. Se ficar sabido que um menor mantém o diário, os dados são apagados."]],
    ["13. Mudanças", ["13.1. A nova edição é publicada nesta página com a data."]],
    ["14. Contato", ["14.1. Perguntas sobre dados pessoais vão só para " + MAIL + ". " + NAME + ", INN " + INN + ". Site: between-journal.ru."]],
  ]);
}

function privacyTr(): LegalDoc {
  return webDoc("Between gizlilik politikası", "9 Kasım 2026 tarihli sürüm", ["Between · between-journal.ru · site ve MAX sürümü için geçerlidir", `İşleten: ${NAME}, serbest meslek, INN ${INN}`], [
    ["1. Genel", ["1.1. Politika, between-journal.ru sitesinde ve MAX mini uygulamasında işlenen kişisel verileri ve kişilerin haklarını anlatır. 1.2. 27.07.2006 tarihli 152-FZ sayılı kişisel veriler yasasına uygundur. 1.3. Telegram sürümünün (bot @BetweenJournalBot) kendi politikası o sürümün içindedir. Bu politika Telegram’a uygulanmaz. 1.4. Yalnızca " + MAIL + " adresine yazın. Bot ve mesajlaşma kabul edilmez."]],
    ["2. İşleten", ["2.1. İşleten " + NAME + ", serbest meslek, INN " + INN + ". E-posta: " + MAIL + "."]],
    ["3. Dayanak", ["3.1. Dayanak: sözleşme (kullanım koşulları), hizmete başlayarak verilen onay ve Rusya Federasyonu hukuku, fişler için 54-FZ dahil. 3.2. Kayıtlar isteğe bağlıdır. Sağlık bilgisi istenmez ve zorunlu tutulmaz."]],
    ["4. Hangi veriler", ["4.1. Web e-postası, MAX kimliği, not metni, duygular, konular, seanslar, anımsatmalar, dil, saat dilimi, anonim sayaçlar, IP’den ülke, ödemenin olup olmadığı, tutar, tarih ve süre, ses yalnızca metne çevirmek için ve dosya saklanmadan, destek mektubunun metni, adresi, platformu ve günlük kimliği. 4.2. IP ülkesi yalnızca o istekte, Rusya’dan Telegram’ın VPN’siz açılmayabileceğini söylemek için okunur ve saklanmaz. 4.3. Kart verisini YooKassa işler. İşleten almaz ve saklamaz."]],
    ["5. Amaçlar", ["5.1. Günlüğü saklamak, Haftayı kurmak, anımsatmak, kodlarla girişi korumak, ödeme ve fiş, desteğe yanıt ve anonim istatistik."]],
    ["6. Modeller", ["6.1. Hafta metni ve ses, AI Tunnel üzerinden ya da anahtar yoksa Gemini veya Groq üzerinden modellere gidebilir. 6.2. Kayıtlar yalnız istediğiniz işlev içindir. Kendi modelini eğitmek ve reklam için kullanılmaz."]],
    ["7. Başka kim alır", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, hizmetin postası, herkese açık sayfada Yandex Metrika (cookie) ve ABD’de PostHog, adsız ve hesap kimliksiz. 7.2. Hizmetlerin bir kısmı Rusya Federasyonu dışında, ABD dahil. Aktarım yalnız bu politikanın amaçları ve gereken ölçüde."]],
    ["8. Çerez", ["8.1. Çerezler giriş ve anonim istatistik içindir (Yandex Metrika, PostHog). 8.2. Tarayıcıda sınırlayabilirsiniz. Bazı işlevler o zaman bozuk çalışabilir."]],
    ["9. Güvenlik", ["9.1. İletim HTTPS/TLS iledir. 9.2. Giriş kodları korumalı tutulur. İşletenin günlüğe erişimi destek ve bakımla sınırlıdır. 9.3. Dış hizmetlere yalnız gereken gider."]],
    ["10. Süre ve silme", ["10.1. Günlüğü kullandığınız sürece. 10.2. Silme sayfası notları, girişi ve hesaba bağlı veriyi siler. Anonim sayaçlar size bağlanmadan kalır. 10.3. " + MAIL + " adresine varmış mektuplar destek kutusunda kalır. 10.4. İsterseniz işleten silmeyi doğrular."]],
    ["11. Haklar", ["11.1. İşlemeyi öğrenmek, düzeltme, engelleme ya da silme istemek, onayı geri almak ve itiraz etmek hakkınızdır. 11.2. Kendi silmeniz, giriş yapılmışken silme sayfasıdır. 11.3. Diğer istekler " + MAIL + " adresine, e-posta ya da MAX kimliğiyle. Yanıt en çok 10 iş günü. 11.4. Roskomnadzor’a ya da mahkemeye de başvurabilirsiniz."]],
    ["12. Reşit olmayanlar", ["12.1. Hizmet 18 yaşından büyükler içindir. Reşit olmayanın verisi toplanmaz. Günlüğü reşit olmayanın tuttuğu öğrenilirse veri silinir."]],
    ["13. Değişiklik", ["13.1. Yeni sürüm bu sayfada tarihle yayımlanır."]],
    ["14. İletişim", ["14.1. Kişisel veri soruları yalnız " + MAIL + " adresine. " + NAME + ", INN " + INN + ". Site: between-journal.ru."]],
  ]);
}

function privacyId(): LegalDoc {
  return webDoc("Kebijakan privasi Between", "Revisi 9 November 2026", ["Between · between-journal.ru · berlaku untuk situs dan versi MAX", `Penyelenggara: ${NAME}, pekerja mandiri, INN ${INN}`], [
    ["1. Umum", ["1.1. Kebijakan ini menjelaskan data pribadi di situs between-journal.ru dan mini app di MAX, serta hak orang yang bersangkutan. 1.2. Disusun menurut Undang-Undang Federal 27.07.2006 No. 152-FZ tentang data pribadi. 1.3. Versi Telegram (bot @BetweenJournalBot) punya kebijakan sendiri di versi itu. Kebijakan ini tidak berlaku untuk Telegram. 1.4. Tulis hanya ke " + MAIL + ". Pesan lewat bot dan pengirim pesan tidak diterima."]],
    ["2. Penyelenggara", ["2.1. Penyelenggara adalah " + NAME + ", pekerja mandiri, INN " + INN + ". Email: " + MAIL + "."]],
    ["3. Dasar", ["3.1. Dasarnya: kontrak (ketentuan penggunaan), persetujuan dengan mulai memakai layanan, dan hukum Federasi Rusia, termasuk undang-undang No. 54-FZ untuk tanda terima. 3.2. Catatan bersifat sukarela. Data kesehatan tidak diminta dan tidak diwajibkan."]],
    ["4. Data apa", ["4.1. Email web, id MAX, teks catatan, perasaan, topik, sesi, pengingat, bahasa, zona waktu, hitungan anonim, negara dari IP, fakta pembayaran, jumlah, tanggal dan jangka, suara hanya untuk dijadikan teks tanpa menyimpan berkas, serta surat bantuan berisi teks, alamat, platform, dan id. 4.2. Negara dari IP dibaca hanya pada permintaan itu, untuk memperingatkan bahwa Telegram dari Rusia mungkin tidak terbuka tanpa VPN, dan tidak disimpan. 4.3. Data kartu diproses YooKassa. Penyelenggara tidak menerimanya dan tidak menyimpannya."]],
    ["5. Tujuan", ["5.1. Menyimpan jurnal, menyusun Minggu, mengingatkan, menjaga masuk dengan kode, menerima pembayaran dan tanda terima, menjawab bantuan, dan menghitung statistik anonim."]],
    ["6. Model", ["6.1. Teks Minggu dan suara dapat dikirim ke model lewat AI Tunnel, atau lewat Gemini atau Groq jika kunci itu tidak ada. 6.2. Catatan hanya untuk fungsi yang Anda minta. Tidak dipakai melatih model sendiri dan tidak diberikan untuk iklan."]],
    ["7. Siapa lagi yang menerima", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, kotak layanan, Yandex Metrika (cookie di halaman publik), dan PostHog di AS tanpa nama dan tanpa id akun. 7.2. Sebagian layanan berada di luar Federasi Rusia, termasuk di AS. Pemindahan hanya untuk tujuan kebijakan ini dan sebatas yang diperlukan."]],
    ["8. Cookie", ["8.1. Cookie dipakai untuk masuk dan statistik anonim (Yandex Metrika, PostHog). 8.2. Anda dapat membatasinya di peramban. Sebagian fungsi bisa lalu terganggu."]],
    ["9. Keamanan", ["9.1. Pengiriman lewat HTTPS/TLS. 9.2. Kode masuk disimpan secara terlindungi. Akses penyelenggara ke jurnal terbatas pada bantuan dan pemeliharaan. 9.3. Layanan luar hanya menerima yang diperlukan."]],
    ["10. Jangka waktu dan penghapusan", ["10.1. Selama Anda memakai jurnal. 10.2. Halaman penghapusan menghapus catatan, masuk, dan data akun. Hitungan anonim tetap tanpa kaitan dengan Anda. 10.3. Surat yang sudah sampai di " + MAIL + " tetap di kotak bantuan. 10.4. Jika diminta, penyelenggara mengonfirmasi penghapusan."]],
    ["11. Hak", ["11.1. Anda dapat mengetahui pemrosesan, meminta perbaikan, pemblokiran, atau penghapusan, menarik persetujuan, dan menyanggah. 11.2. Penghapusan sendiri ada di halaman penghapusan saat Anda masuk. 11.3. Permintaan lain dikirim ke " + MAIL + " dengan email atau id MAX. Jawaban paling lama 10 hari kerja. 11.4. Anda juga dapat menghubungi Roskomnadzor atau pengadilan."]],
    ["12. Anak", ["12.1. Layanan untuk orang di atas 18 tahun. Data anak tidak dikumpulkan. Jika diketahui jurnal dipegang anak, data dihapus."]],
    ["13. Perubahan", ["13.1. Edisi baru dipublikasikan di halaman ini beserta tanggalnya."]],
    ["14. Kontak", ["14.1. Pertanyaan tentang data pribadi hanya ke " + MAIL + ". " + NAME + ", INN " + INN + ". Situs: between-journal.ru."]],
  ]);
}

function privacyVi(): LegalDoc {
  return webDoc("Chính sách quyền riêng tư của Between", "Bản ngày 9 tháng 11 năm 2026", ["Between · between-journal.ru · áp dụng cho trang web và bản MAX", `Người điều hành: ${NAME}, tự kinh doanh, INN ${INN}`], [
    ["1. Quy định chung", ["1.1. Chính sách này mô tả dữ liệu cá nhân trên between-journal.ru và mini app trong MAX, cùng quyền của người có dữ liệu. 1.2. Soạn theo Luật liên bang ngày 27.07.2006 số 152-FZ về dữ liệu cá nhân. 1.3. Bản Telegram (bot @BetweenJournalBot) có chính sách riêng trong bản đó. Chính sách này không áp dụng cho Telegram. 1.4. Chỉ viết tới " + MAIL + ". Tin qua bot và ứng dụng nhắn tin không được nhận."]],
    ["2. Người điều hành", ["2.1. Người điều hành là " + NAME + ", tự kinh doanh, INN " + INN + ". Email: " + MAIL + "."]],
    ["3. Căn cứ", ["3.1. Căn cứ: hợp đồng (điều khoản sử dụng), sự đồng ý khi bắt đầu dùng dịch vụ, và pháp luật Liên bang Nga, kể cả luật số 54-FZ về biên lai. 3.2. Ghi chú là tự nguyện. Thông tin sức khỏe không được hỏi và không bị bắt buộc."]],
    ["4. Dữ liệu nào", ["4.1. Email trên web, id MAX, nội dung ghi chú, cảm xúc, chủ đề, buổi, lời nhắc, ngôn ngữ, múi giờ, số đếm ẩn danh, quốc gia theo IP, việc đã trả, số tiền, ngày và thời hạn, giọng nói chỉ để thành chữ và không giữ tệp, thư hỗ trợ gồm nội dung, địa chỉ, nền tảng và mã nhật ký. 4.2. Quốc gia theo IP chỉ được đọc ở lần yêu cầu đó, để báo Telegram từ Nga có thể không mở nếu không có VPN, và không được lưu. 4.3. Dữ liệu thẻ do YooKassa xử lý. Người điều hành không nhận và không lưu."]],
    ["5. Mục đích", ["5.1. Giữ nhật ký, lập Tuần, nhắc, giữ lối vào bằng mã, nhận thanh toán và biên lai, trả lời hỗ trợ, và đếm thống kê ẩn danh."]],
    ["6. Mô hình", ["6.1. Nội dung cho Tuần và giọng nói có thể được gửi tới mô hình qua AI Tunnel, hoặc qua Gemini hay Groq khi chưa có khóa đó. 6.2. Ghi chú chỉ để làm việc bạn yêu cầu. Không dùng để huấn luyện mô hình riêng và không chuyển cho quảng cáo."]],
    ["7. Ai khác nhận được", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, hộp thư của dịch vụ, Yandex Metrika (cookie trên trang công khai) và PostHog ở Mỹ, không tên và không mã tài khoản. 7.2. Một phần dịch vụ nằm ngoài Liên bang Nga, kể cả ở Mỹ. Việc chuyển chỉ vì mục đích của chính sách này và trong mức cần thiết."]],
    ["8. Cookie", ["8.1. Cookie dùng cho lối vào và thống kê ẩn danh (Yandex Metrika, PostHog). 8.2. Bạn có thể hạn chế cookie trên trình duyệt. Một số chức năng có thể khi đó chạy không đúng."]],
    ["9. An toàn", ["9.1. Dữ liệu đi qua HTTPS/TLS. 9.2. Mã đăng nhập được giữ ở dạng được bảo vệ. Quyền của người điều hành với nhật ký chỉ để hỗ trợ và bảo trì. 9.3. Dịch vụ bên ngoài chỉ nhận phần cần thiết."]],
    ["10. Thời hạn và xóa", ["10.1. Trong lúc bạn dùng nhật ký. 10.2. Trang xóa sẽ xóa ghi chú, lối vào và dữ liệu gắn với tài khoản. Số đếm ẩn danh của những ngày trước vẫn còn, không gắn với bạn. 10.3. Thư đã tới " + MAIL + " vẫn nằm trong hộp hỗ trợ. 10.4. Nếu bạn yêu cầu, người điều hành xác nhận đã xóa."]],
    ["11. Quyền", ["11.1. Bạn có thể biết việc xử lý, yêu cầu sửa, chặn hoặc xóa, rút sự đồng ý và khiếu nại. 11.2. Tự xóa bằng trang xóa khi bạn đã vào. 11.3. Yêu cầu khác gửi tới " + MAIL + ", kèm email hoặc id MAX. Trả lời trong tối đa 10 ngày làm việc. 11.4. Bạn cũng có thể liên hệ Roskomnadzor hoặc tòa án."]],
    ["12. Người chưa thành niên", ["12.1. Dịch vụ dành cho người trên 18 tuổi. Dữ liệu của người chưa thành niên không được thu. Nếu biết nhật ký do người chưa thành niên giữ, dữ liệu bị xóa."]],
    ["13. Thay đổi", ["13.1. Bản mới được đăng trên trang này kèm ngày."]],
    ["14. Liên hệ", ["14.1. Câu hỏi về dữ liệu cá nhân chỉ gửi tới " + MAIL + ". " + NAME + ", INN " + INN + ". Trang: between-journal.ru."]],
  ]);
}

function privacyAr(): LegalDoc {
  return webDoc("سياسة خصوصية Between", "نسخة 9 نوفمبر 2026", ["Between · between-journal.ru · تسري على الموقع ونسخة MAX", `المشغّلة: ${NAME}، عاملة لحسابها، INN ${INN}`], [
    ["1. أحكام عامة", ["1.1. تصف السياسة البيانات الشخصية في موقع between-journal.ru وتطبيق MAX، وحقوق أصحابها. 1.2. وُضعت وفق القانون الاتحادي الصادر في 27.07.2006 رقم 152-FZ بشأن البيانات الشخصية. 1.3. لنسخة Telegram (البوت @BetweenJournalBot) سياستها داخل تلك النسخة. هذه السياسة لا تسري على Telegram. 1.4. راسلوا " + MAIL + " فقط. رسائل البوتات وتطبيقات المراسلة لا تُقبل."]],
    ["2. المشغّلة", ["2.1. المشغّلة هي " + NAME + "، عاملة لحسابها، INN " + INN + ". البريد: " + MAIL + "."]],
    ["3. الأسس", ["3.1. الأسس: العقد (شروط الاستخدام)، والموافقة ببدء الاستخدام، ومتطلبات قانون الاتحاد الروسي بما فيها القانون رقم 54-FZ بشأن الإيصالات. 3.2. السجلات طوعية. لا تُطلب بيانات الصحة ولا تُشترط."]],
    ["4. أي بيانات", ["4.1. بريد الويب، ومعرّف MAX، ونص الملاحظات، والمشاعر، والمواضيع، والجلسات، والتذكيرات، واللغة، والمنطقة الزمنية، والعدادات المجهولة، والبلد من عنوان IP، وواقعة الدفع والمبلغ والتاريخ والمدة، والصوت لتحويله إلى نص دون حفظ الملف، ورسائل الدعم بنصها وعنوانها والمنصة والمعرّف. 4.2. يُقرأ البلد من IP في لحظة الطلب فقط للتحذير من أن Telegram من روسيا قد لا يفتح بلا VPN، ولا يُخزَّن. 4.3. بيانات البطاقة تعالجها YooKassa. المشغّلة لا تستلمها ولا تخزنها."]],
    ["5. الأغراض", ["5.1. حفظ اليوميات، وتكوين الأسبوع، والتذكير، وتأمين الدخول بالرموز، وقبول الدفع والإيصالات، والرد على الدعم، وإحصاء مجهول."]],
    ["6. النماذج", ["6.1. قد يذهب نص الأسبوع والصوت إلى نماذج عبر AI Tunnel أو عبر Gemini أو Groq إذا لم يوجد المفتاح. 6.2. تُستخدم السجلات فقط للوظائف التي طلبتموها. لا تُستخدم لتدريب نماذج خاصة ولا تُنقل للإعلان."]],
    ["7. من غيركم يستلمها", ["7.1. Upstash Redis وVercel وAI Tunnel وGemini وGroq وYooKassa وبريد الخدمة وYandex Metrika (cookie في الصفحة العامة) وPostHog في الولايات المتحدة بلا اسم وبلا معرّفات حساب. 7.2. بعض الخدمات خارج الاتحاد الروسي، ومنها في الولايات المتحدة. النقل للأغراض المذكورة وبالقدر اللازم."]],
    ["8. ملفات الارتباط", ["8.1. تُستخدم ملفات الارتباط للدخول وللإحصاء المجهول (Yandex Metrika وPostHog). 8.2. يمكن تقييدها في المتصفح، وقد تتعطل بعض الوظائف."]],
    ["9. الأمان", ["9.1. النقل عبر HTTPS/TLS. 9.2. رموز الدخول تُحفظ بشكل محمي. وصول المشغّلة إلى اليوميات مقصور على الدعم والصيانة. 9.3. الخدمات الأخرى لا تأخذ إلا اللازم."]],
    ["10. المدد والحذف", ["10.1. ما دمتم تستخدمون اليوميات. 10.2. صفحة الحذف تمسح الملاحظات والدخول وبيانات الحساب. العدادات المجهولة تبقى بلا ربط بكم. 10.3. الرسائل التي وصلت إلى " + MAIL + " تبقى في صندوق الدعم. 10.4. عند الطلب تؤكد المشغّلة الحذف."]],
    ["11. الحقوق", ["11.1. يحق لكم معرفة المعالجة وطلب التصحيح أو الحجب أو الحذف وسحب الموافقة والطعن. 11.2. الحذف الذاتي في صفحة الحذف وأنتم داخلون. 11.3. سائر الطلبات برسالة إلى " + MAIL + " مع البريد أو معرّف MAX. الرد خلال 10 أيام عمل. 11.4. يحق لكم أيضًا مراجعة Roskomnadzor أو المحكمة."]],
    ["12. القاصرون", ["12.1. الخدمة لمن تجاوز 18 عامًا. بيانات القاصرين لا تُجمع. إذا عُلم أن قاصرًا يمسك اليوميات تُحذف البيانات."]],
    ["13. التغيير", ["13.1. النسخة الجديدة تُنشر في هذه الصفحة مع التاريخ."]],
    ["14. التواصل", ["14.1. أسئلة البيانات الشخصية إلى " + MAIL + " فقط. " + NAME + "، INN " + INN + ". الموقع: between-journal.ru."]],
  ]);
}

function privacyFa(): LegalDoc {
  return webDoc("سیاست حریم خصوصی Between", "ویرایش ۹ نوامبر ۲۰۲۶", ["Between · between-journal.ru · برای سایت و نسخهٔ MAX", `گرداننده: ${NAME}، خویش‌فرما، INN ${INN}`], [
    ["1. کلیات", ["1.1. این سیاست داده‌های شخصی سایت between-journal.ru و مینی‌اپ MAX و حقوق اشخاص را می‌گوید. 1.2. مطابق قانون فدرال ۲۷٫۰۷٫۲۰۰۶ شمارهٔ ۱۵۲-FZ دربارهٔ داده‌های شخصی است. 1.3. نسخهٔ تلگرام (بات @BetweenJournalBot) سیاست خودش را در همان نسخه دارد. این سیاست به تلگرام نمی‌رسد. 1.4. فقط به " + MAIL + " بنویسید. پیام بات و پیام‌رسان پذیرفته نمی‌شود."]],
    ["2. گرداننده", ["2.1. گرداننده " + NAME + "، خویش‌فرما، INN " + INN + " است. ایمیل: " + MAIL + "."]],
    ["3. مبناها", ["3.1. مبنا: قرارداد (شرایط استفاده)، رضایت با شروع استفاده، و قانون فدراسیون روسیه از جمله قانون شمارهٔ ۵۴-FZ برای رسید. 3.2. یادداشت‌ها داوطلبانه‌اند. دادهٔ سلامت خواسته و الزام نمی‌شود."]],
    ["4. چه داده‌هایی", ["4.1. ایمیل وب، شناسهٔ MAX، متن یادداشت، احساس، موضوع، جلسه، یادآوری، زبان، منطقهٔ زمانی، شمارندهٔ بی‌نام، کشور از IP، وقوع پرداخت و مبلغ و تاریخ و مدت، صدا فقط برای تبدیل به متن بدون نگهداری فایل، و نامهٔ پشتیبانی با متن، نشانی، سکو و شناسه. 4.2. کشور از IP فقط در همان درخواست خوانده می‌شود تا هشدار دهد تلگرام از روسیه ممکن است بدون VPN باز نشود، و ذخیره نمی‌شود. 4.3. دادهٔ کارت را YooKassa پردازش می‌کند. گرداننده آن را نمی‌گیرد و نگه نمی‌دارد."]],
    ["5. هدف‌ها", ["5.1. نگهداری دفتر، ساختن هفته، یادآوری، امنیت ورود با کد، دریافت پرداخت و رسید، پاسخ به پشتیبانی و آمار بی‌نام."]],
    ["6. مدل‌ها", ["6.1. متن هفته و صدا ممکن است از راه AI Tunnel، یا اگر کلید نباشد از راه Gemini یا Groq، به مدل‌ها برود. 6.2. یادداشت فقط برای کاری است که خواسته‌اید. برای آموزش مدل خود و برای تبلیغ به کار نمی‌رود."]],
    ["7. چه کس دیگری می‌گیرد", ["7.1. Upstash Redis، Vercel، AI Tunnel، Gemini، Groq، YooKassa، صندوق سرویس، Yandex Metrika (cookie در صفحهٔ عمومی) و PostHog در آمریکا، بدون نام و بدون شناسهٔ حساب. 7.2. بخشی از سرویس‌ها بیرون فدراسیون روسیه است، از جمله در آمریکا. انتقال فقط برای هدف‌های این سیاست و به اندازهٔ لازم است."]],
    ["8. کوکی", ["8.1. کوکی برای ورود و آمار بی‌نام است (Yandex Metrika و PostHog). 8.2. در مرورگر می‌توانید آن را محدود کنید. بخشی از کارکرد ممکن است آن‌گاه درست کار نکند."]],
    ["9. امنیت", ["9.1. انتقال با HTTPS/TLS است. 9.2. کدهای ورود محافظت‌شده نگه داشته می‌شوند. دسترسی گرداننده به دفتر به پشتیبانی و نگهداری محدود است. 9.3. سرویس‌های بیرونی فقط آنچه لازم است می‌گیرند."]],
    ["10. مدت و حذف", ["10.1. تا وقتی از دفتر استفاده می‌کنید. 10.2. صفحهٔ حذف یادداشت، ورود و دادهٔ حساب را پاک می‌کند. شمارنده‌های بی‌نام بدون پیوند به شما می‌مانند. 10.3. نامه‌ای که به " + MAIL + " رسیده در صندوق پشتیبانی می‌ماند. 10.4. اگر بخواهید گرداننده حذف را تأیید می‌کند."]],
    ["11. حقوق", ["11.1. می‌توانید از پردازش باخبر شوید، اصلاح، مسدودسازی یا حذف بخواهید، رضایت را پس بگیرید و اعتراض کنید. 11.2. حذف به‌دست خودتان در صفحهٔ حذف است، وقتی وارد شده‌اید. 11.3. درخواست‌های دیگر با نامه به " + MAIL + " و ذکر ایمیل یا شناسهٔ MAX. پاسخ تا ۱۰ روز کاری. 11.4. می‌توانید به Roskomnadzor یا دادگاه هم مراجعه کنید."]],
    ["12. خردسالان", ["12.1. سرویس برای بالای ۱۸ سال است. دادهٔ خردسال جمع نمی‌شود. اگر معلوم شود دفتر را خردسال می‌نویسد، داده حذف می‌شود."]],
    ["13. تغییر", ["13.1. ویرایش تازه با تاریخ در همین صفحه منتشر می‌شود."]],
    ["14. تماس", ["14.1. پرسش دادهٔ شخصی فقط به " + MAIL + ". " + NAME + "، INN " + INN + ". سایت: between-journal.ru."]],
  ]);
}

function privacyHi(): LegalDoc {
  return webDoc("Between की गोपनीयता नीति", "9 नवंबर 2026 का संस्करण", ["Between · between-journal.ru · साइट और MAX संस्करण के लिए", `संचालिका: ${NAME}, स्व-नियोजित, INN ${INN}`], [
    ["1. सामान्य", ["1.1. यह नीति between-journal.ru और MAX मिनी ऐप में संसाधित व्यक्तिगत डेटा और लोगों के अधिकार बताती है. 1.2. यह 27.07.2006 के संघीय क़ानून संख्या 152-FZ, व्यक्तिगत डेटा पर, के अनुसार है. 1.3. Telegram संस्करण (बॉट @BetweenJournalBot) की अपनी नीति उसी संस्करण में है. यह नीति Telegram पर नहीं लगती. 1.4. केवल " + MAIL + " पर लिखें. बॉट और मैसेंजर के संदेश नहीं लिए जाते."]],
    ["2. संचालिका", ["2.1. संचालिका " + NAME + " हैं, स्व-नियोजित, INN " + INN + ". ईमेल: " + MAIL + "."]],
    ["3. आधार", ["3.1. आधार: अनुबंध (उपयोग शर्तें), सेवा शुरू करने से सहमति, और रूसी संघ का क़ानून, रसीद के लिए क़ानून संख्या 54-FZ सहित. 3.2. नोट स्वैच्छिक हैं. स्वास्थ्य की जानकारी नहीं माँगी जाती और ज़रूरी नहीं ठहराई जाती."]],
    ["4. कौन सा डेटा", ["4.1. वेब का ईमेल, MAX पहचान, नोट का पाठ, भावना, विषय, सत्र, याद, भाषा, समय क्षेत्र, बिना नाम की गिनती, IP से देश, भुगतान का तथ्य, रकम, तारीख और अवधि, आवाज़ केवल पाठ बनाने के लिए और फ़ाइल रखे बिना, तथा सहायता पत्र का पाठ, पता, प्लेटफ़ॉर्म और पहचान. 4.2. IP से देश केवल उसी अनुरोध पर देखा जाता है, यह बताने के लिए कि रूस से Telegram बिना VPN नहीं खुल सकता, और अलग से नहीं रखा जाता. 4.3. कार्ड का डेटा YooKassa संसाधित करती है. संचालिका उसे नहीं लेती और नहीं रखती."]],
    ["5. उद्देश्य", ["5.1. डायरी रखना, हफ़्ता बनाना, याद दिलाना, कोड से प्रवेश सुरक्षित रखना, भुगतान और रसीद, सहायता का जवाब, और बिना नाम की गिनती."]],
    ["6. मॉडल", ["6.1. हफ़्ते का पाठ और आवाज़ AI Tunnel से, या वह कुंजी न हो तो Gemini या Groq से, मॉडल के पास जा सकते हैं. 6.2. नोट केवल आपके माँगे काम के लिए हैं. अपनी मॉडल की ट्रेनिंग और विज्ञापन के लिए नहीं."]],
    ["7. और किसे मिलता है", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, सेवा का डाकखाना, सार्वजनिक पृष्ठ पर Yandex Metrika (cookie), और अमेरिका का PostHog, नाम और खाता पहचान के बिना. 7.2. कुछ सेवाएँ रूसी संघ के बाहर हैं, अमेरिका में भी. स्थानांतरण केवल इस नीति के उद्देश्य और ज़रूरी मात्रा में है."]],
    ["8. कुकी", ["8.1. कुकी प्रवेश और बिना नाम की गिनती के लिए है (Yandex Metrika, PostHog). 8.2. ब्राउज़र में उन्हें सीमित कर सकते हैं. तब कुछ काम ग़लत चल सकते हैं."]],
    ["9. सुरक्षा", ["9.1. डेटा HTTPS/TLS से जाता है. 9.2. प्रवेश कोड सुरक्षित रूप में रखे जाते हैं. संचालिका की पहुँच सहायता और रखरखाव तक है. 9.3. बाहरी सेवाओं को केवल ज़रूरी हिस्सा जाता है."]],
    ["10. अवधि और मिटाना", ["10.1. जब तक आप डायरी इस्तेमाल करते हैं. 10.2. मिटाने का पृष्ठ नोट, प्रवेश और खाते का डेटा मिटाता है. पिछले दिनों की बिना नाम की गिनती आपसे बिना जुड़े रह जाती है. 10.3. " + MAIL + " तक पहुँचा पत्र सहायता के डाकखाने में रहता है. 10.4. माँगने पर संचालिका मिटाने की पुष्टि करती है."]],
    ["11. अधिकार", ["11.1. आप प्रसंस्करण जान सकते हैं, सुधार, रोक या मिटाने को कह सकते हैं, सहमति वापस ले सकते हैं और आपत्ति कर सकते हैं. 11.2. स्वयं मिटाना प्रवेश के बाद मिटाने के पृष्ठ पर होता है. 11.3. बाकी अनुरोध " + MAIL + " पर पत्र से, ईमेल या MAX पहचान के साथ. जवाब 10 कार्यदिवस तक. 11.4. Roskomnadzor या अदालत में भी जा सकते हैं."]],
    ["12. अवयस्क", ["12.1. सेवा 18 वर्ष से अधिक के लिए है. अवयस्क का डेटा नहीं लिया जाता. यदि पता चले कि डायरी अवयस्क रखता है, डेटा मिटा दिया जाता है."]],
    ["13. बदलाव", ["13.1. नया संस्करण तारीख के साथ इसी पृष्ठ पर छपता है."]],
    ["14. संपर्क", ["14.1. व्यक्तिगत डेटा के प्रश्न केवल " + MAIL + " पर. " + NAME + ", INN " + INN + ". साइट: between-journal.ru."]],
  ]);
}

function privacyUz(): LegalDoc {
  return webDoc("Between maxfiylik siyosati", "2026-yil 9-noyabr tahriri", ["Between · between-journal.ru · sayt va MAX versiyasi uchun", `Operator: ${NAME}, o‘zini o‘zi band qilgan, INN ${INN}`], [
    ["1. Umumiy", ["1.1. Siyosat between-journal.ru sayti va MAX mini-ilovasidagi shaxsiy ma’lumotlarni va shaxslar huquqini tasvirlaydi. 1.2. U 27.07.2006 yildagi 152-FZ-son shaxsiy ma’lumotlar to‘g‘risidagi federal qonunga muvofiq. 1.3. Telegram versiyasi (bot @BetweenJournalBot) o‘z siyosatiga ega. Bu siyosat Telegramga tatbiq etilmaydi. 1.4. Faqat " + MAIL + " ga yozing. Bot va messenjer qabul qilinmaydi."]],
    ["2. Operator", ["2.1. Operator — " + NAME + ", o‘zini o‘zi band qilgan, INN " + INN + ". Pochta: " + MAIL + "."]],
    ["3. Asoslar", ["3.1. Asoslar: shartnoma (foydalanish shartlari), foydalanishni boshlash bilan rozilik va Rossiya Federatsiyasi qonunchiligi, cheklar bo‘yicha 54-FZ qonuni bilan. 3.2. Yozuvlar ixtiyoriy. Sog‘liq haqida ma’lumot so‘ralmaydi va talab qilinmaydi."]],
    ["4. Qanday ma’lumot", ["4.1. Veb pochta, MAX identifikatori, yozuv matni, hislar, mavzular, seanslar, eslatmalar, til, vaqt mintaqasi, ismsiz hisoblagichlar, IP bo‘yicha mamlakat, to‘lov fakti, summa, sana va muddat, ovoz faqat matnga aylantirish uchun va fayl saqlanmasdan, yordam xati matni, manzili, platformasi va identifikatori. 4.2. IP bo‘yicha mamlakat faqat o‘sha so‘rovda, Rossiyadan Telegram VPN’siz ochilmasligi mumkinligini aytish uchun o‘qiladi va saqlanmaydi. 4.3. Karta ma’lumotini YooKassa qayta ishlaydi. Operator olmaydi va saqlamaydi."]],
    ["5. Maqsadlar", ["5.1. Kundalikni saqlash, Haftani yig‘ish, eslatish, kod bilan kirishni himoyalash, to‘lov va chek, yordamga javob va ismsiz statistika."]],
    ["6. Modellar", ["6.1. Hafta matni va ovoz AI Tunnel orqali yoki kalit bo‘lmasa Gemini yoki Groq orqali modellarga borishi mumkin. 6.2. Yozuvlar faqat so‘ragan vazifangiz uchun. O‘z modelini o‘qitish va reklama uchun ishlatilmaydi."]],
    ["7. Yana kim oladi", ["7.1. Upstash Redis, Vercel, AI Tunnel, Gemini, Groq, YooKassa, xizmat pochta qutisi, ommaviy sahifada Yandex Metrika (cookie) va AQShdagi PostHog, ismsiz va hisob identifikatorisiz. 7.2. Xizmatlarning bir qismi Rossiya Federatsiyasidan tashqarida, jumladan AQShda. O‘tkazish faqat siyosat maqsadlari va kerakli hajmda."]],
    ["8. Cookie", ["8.1. Cookie kirish va ismsiz statistika uchun (Yandex Metrika, PostHog). 8.2. Brauzerda cheklash mumkin. Ayrim vazifalar unda noto‘g‘ri ishlashi mumkin."]],
    ["9. Xavfsizlik", ["9.1. Uzatish HTTPS/TLS orqali. 9.2. Kirish kodlari himoyalangan holda saqlanadi. Operatorning kundalikka kirishi yordam va xizmat ko‘rsatish bilan cheklanadi. 9.3. Tashqi xizmatlarga faqat keraklisi boradi."]],
    ["10. Muddat va o‘chirish", ["10.1. Kundalikdan foydalanganingizcha. 10.2. O‘chirish sahifasi yozuv, kirish va hisob ma’lumotini o‘chiradi. O‘tgan kunlarning ismsiz hisoblagichlari sizga bog‘lanmagan holda qoladi. 10.3. " + MAIL + " ga yetgan xat yordam qutisida qoladi. 10.4. So‘rasangiz, operator o‘chirishni tasdiqlaydi."]],
    ["11. Huquqlar", ["11.1. Qayta ishlash haqida bilish, tuzatish, bloklash yoki o‘chirishni so‘rash, rozilikni qaytarib olish va e’tiroz bildirish mumkin. 11.2. O‘zingiz o‘chirish — kirganingizda o‘chirish sahifasi. 11.3. Qolgani " + MAIL + " ga xat, pochta yoki MAX identifikatori bilan. Javob 10 ish kunigacha. 11.4. Roskomnadzor yoki sudga ham murojaat qilish mumkin."]],
    ["12. Voyaga yetmaganlar", ["12.1. Xizmat 18 yoshdan katta shaxslar uchun. Voyaga yetmaganlarning ma’lumoti yig‘ilmaydi. Kundalikni voyaga yetmagan yuritayotgani ma’lum bo‘lsa, ma’lumot o‘chiriladi."]],
    ["13. O‘zgarish", ["13.1. Yangi tahrir sana bilan shu sahifada chiqadi."]],
    ["14. Aloqa", ["14.1. Shaxsiy ma’lumot savollari faqat " + MAIL + " ga. " + NAME + ", INN " + INN + ". Sayt: between-journal.ru."]],
  ]);
}
