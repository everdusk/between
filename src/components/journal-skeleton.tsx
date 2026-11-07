"use client";

import { useI18n } from "@/components/locale-provider";

function Bar({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** The journal frame while the account or the notes are still arriving. */
export function JournalSkeleton() {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="status" aria-label={t("loading")}>
      <Bar className="h-4 w-24 rounded-full" />
      <Bar className="h-10 w-2/3 rounded-2xl" />
      <div className="glass space-y-4 rounded-3xl p-5">
        <Bar className="h-3 w-28 rounded-full" />
        <Bar className="h-8 w-1/2 rounded-2xl" />
        <Bar className="h-16 w-full rounded-2xl" />
        <Bar className="h-16 w-full rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Bar className="h-24 rounded-3xl" />
        <Bar className="h-24 rounded-3xl" />
      </div>
      <Bar className="h-28 rounded-3xl" />
    </div>
  );
}

/** The week, in the same shape, before the notes and the pattern are ready. */
export function WeekSkeleton() {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="status" aria-label={t("opening")}>
      <div className="space-y-2 px-2 pt-1">
        <Bar className="h-3 w-16 rounded-full" />
        <Bar className="h-9 w-48 rounded-2xl" />
      </div>
      <div className="glass-strong space-y-4 rounded-3xl p-5">
        <Bar className="h-3 w-28 rounded-full" />
        <Bar className="h-10 w-3/4 rounded-2xl" />
        <Bar className="h-2.5 w-full rounded-full" />
        <Bar className="h-24 w-full rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Bar className="h-24 rounded-3xl" />
        <Bar className="h-24 rounded-3xl" />
      </div>
      <div className="glass space-y-3 rounded-3xl p-5">
        <Bar className="h-5 w-36 rounded-full" />
        <Bar className="h-4 w-full rounded-full" />
        <Bar className="h-4 w-2/3 rounded-full" />
      </div>
    </div>
  );
}
