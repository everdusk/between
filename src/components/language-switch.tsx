"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { LOCALES, type LocaleId } from "@/lib/i18n";
import { telegramSelection } from "@/lib/telegram";

export function LanguageSwitch({ inline = false }: { inline?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const label = LOCALES.find((item) => item.id === locale)?.label ?? locale;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLElement>("[aria-selected='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const choose = (id: LocaleId) => {
    telegramSelection();
    setLocale(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="glass inline-flex h-9 items-center gap-1.5 rounded-full pr-2.5 pl-3 text-xs font-medium text-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.97]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("language")}
        onClick={() => {
          telegramSelection();
          setOpen((value) => !value);
        }}
      >
        <Languages aria-hidden className="size-3.5 opacity-70" />
        <span className="max-w-24 truncate">{label}</span>
        <ChevronDown aria-hidden className="size-3 opacity-50" />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("language")}
          className={
            inline
              ? "glass-strong mt-2 max-h-60 w-full overflow-y-auto overscroll-contain rounded-2xl p-1"
              : "glass-strong absolute end-0 top-full z-20 mt-1.5 max-h-[min(18rem,calc(var(--vv-height,100dvh)-7.5rem))] w-max min-w-full overflow-y-auto overscroll-contain rounded-2xl p-1"
          }
        >
          {LOCALES.map((item) => {
            const selected = item.id === locale;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  dir={item.dir}
                  aria-selected={selected}
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-start text-sm whitespace-nowrap text-foreground outline-none hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98] ${selected ? "bg-foreground/10" : ""}`}
                  onClick={() => choose(item.id)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
