import { LANDING_BOT_URL, LANDING_MAX_WEB_URL, LANDING_START_PARAM } from "@/lib/landing";

export const MESSENGER_CSS = `
.bl-pair{display:flex;flex-wrap:wrap;align-items:center;gap:.65rem}
.bl-msg{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;height:2.85rem;padding:0 1.05rem 0 .95rem;border-radius:999px;color:#fff;font-weight:650;font-size:.95rem;line-height:1;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 14px 28px -16px rgba(0,0,0,.75);text-decoration:none}
.bl-msg > span,.bl-msg > svg{position:relative;z-index:1}
.bl-tg{background-color:#2aabee;background-image:linear-gradient(118deg,rgba(143,240,188,.34),transparent 42%,rgba(94,231,197,.16) 100%)}
.bl-max{background-color:#5436c7;background-image:linear-gradient(118deg,rgba(143,240,188,.28),transparent 40%,rgba(196,168,255,.32) 100%)}
.bl-msg::before{content:"";position:absolute;inset:-20% -10%;z-index:0;background:linear-gradient(100deg,transparent 32%,rgba(143,240,188,.15) 42%,rgba(200,248,196,.72) 50%,rgba(126,182,240,.28) 58%,transparent 70%);transform:translateX(-125%);animation:bl-sheen 4.6s ease-in-out infinite}
.bl-max::before{animation-delay:1.4s}
.bl-msg:hover{filter:saturate(1.08) brightness(1.05)}
.bl-msg:active{transform:scale(.98)}
.bl-msg:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(94,231,197,.28)}
.bl-vpn{display:inline-flex;align-items:center;height:1.35rem;margin-left:.15rem;padding:0 .5rem;border-radius:999px;background:rgba(255,255,255,.2);font-size:.68rem;font-weight:650;letter-spacing:.01em}
.bl-msg-sm{height:2.3rem;padding:0 .8rem;font-size:.84rem}
.bl-msg-sm .bl-vpn{height:1.15rem;font-size:.62rem}
@keyframes bl-sheen{0%,14%{transform:translateX(-125%)}46%,100%{transform:translateX(125%)}}
@media (max-width:639px){
  .bl-pair:not(.bl-pair-bar){flex-direction:column;align-items:stretch}
  .bl-pair:not(.bl-pair-bar) .bl-msg{width:100%}
  .bl-pair-bar{flex-wrap:nowrap}
  .bl-pair-bar .bl-msg-sm{height:2.15rem;padding:0 .7rem;font-size:.78rem}
  .bl-pair-bar .bl-vpn{display:none}
}
@media (prefers-reduced-motion:reduce){
  .bl-msg::before{animation:none;transform:none;opacity:.45}
}
`;

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M5.1 3.1v9.8L13.2 8Z" fill="currentColor" />
    </svg>
  );
}

export function MessengerButtons({
  compact = false,
  maxHref = LANDING_MAX_WEB_URL,
}: {
  compact?: boolean;
  /** Phones that scanned the code open the MAX app. A click in the browser uses the web client. */
  maxHref?: string;
}) {
  const size = compact ? "bl-msg bl-msg-sm" : "bl-msg";
  return (
    <div className={compact ? "bl-pair bl-pair-bar" : "bl-pair"}>
      <a href={LANDING_BOT_URL} data-start={LANDING_START_PARAM} className={`${size} bl-tg`}>
        <PlayIcon />
        <span>{compact ? "Telegram" : "Открыть в Telegram"}</span>
      </a>
      <a href={maxHref} data-start={LANDING_START_PARAM} className={`${size} bl-max`}>
        <span>{compact ? "MAX" : "Открыть в MAX"}</span>
        <span className="bl-vpn">без VPN</span>
      </a>
    </div>
  );
}

export function QrCard({ svg }: { svg: string }) {
  return (
    <a href="/open" className="bl-qrcard">
      <span className="bl-qr" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />
      <span>
        <b>Наведите камеру</b>
        выберите, где открыть
        <br />
        Telegram или MAX
      </span>
    </a>
  );
}
