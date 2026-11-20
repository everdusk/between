import Image from "next/image";

/** The word inherits the surface's foreground, including the Telegram client theme. */
export function BrandLogo() {
  return <span dir="ltr" className="between-brand">
    <Image src="/between-mark.svg" width={228} height={238} alt="" unoptimized
      style={{ width: "1em", height: "auto", borderRadius: 0, flexShrink: 0 }} />
    <span>Between</span>
  </span>;
}
