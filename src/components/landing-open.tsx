import { MESSENGER_CSS, MessengerButtons } from "@/components/landing-messengers";
import { LANDING_MAX_URL, LANDING_MAX_WEB_URL } from "@/lib/landing";

const CSS = `
${MESSENGER_CSS}
.between-open{min-height:100%;background:#07090d;color:#f3f6f4;color-scheme:only dark}
.between-open a{color:inherit}
`;

/** The page a phone camera opens from the landing QR. */
export function OpenFork() {
  return (
    <article className="between-open fixed inset-0 z-30 overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-10">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#5ee7c5] uppercase">Between</p>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight">Где открыть бота</h1>
        <p className="mt-4 text-base leading-relaxed text-[#a9b4ae]">
          Один дневник. Telegram или MAX. MAX открывается без VPN.
        </p>
        <div className="mt-8">
          <MessengerButtons maxHref={LANDING_MAX_URL} />
        </div>
        <p className="mt-5 text-sm text-[#74827b]">
          Если приложение не открылось,{" "}
          <a href={LANDING_MAX_WEB_URL} className="underline underline-offset-4">
            запустите MAX в браузере
          </a>
          .
        </p>
      </div>
    </article>
  );
}
