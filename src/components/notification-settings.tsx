"use client";

import { useI18n } from "@/components/locale-provider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { NotifyPrefs } from "@/lib/types";

export function NotificationSettings({ notify, disabled, onSave }: {
  notify: NotifyPrefs;
  disabled?: boolean;
  onSave: (prefs: Omit<NotifyPrefs, "updatedAt">) => boolean;
}) {
  const { t } = useI18n();
  return <div className="divide-y divide-[color:var(--glass-border)]">
    <div className="py-3.5">
      <Switch label={t("pollToggle")} checked={notify.moodPolls} disabled={disabled}
        onChange={(event) => onSave({ ...notify, moodPolls: event.target.checked })} />
      {notify.moodPolls && <div className="mt-3">
        <p className="text-sm text-muted-foreground">{t("pollFrequency")}</p>
        <div role="group" aria-label={t("pollFrequency")} className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["evening", "three"] as const).map((frequency) => {
            const selected = (notify.moodFrequency ?? "three") === frequency;
            return <Button key={frequency} type="button" variant={selected ? "default" : "outline"}
              aria-pressed={selected} disabled={disabled} className="h-auto min-h-11 whitespace-normal"
              onClick={() => onSave({ ...notify, moodFrequency: frequency })}>
              {t(frequency === "evening" ? "pollEveningOnly" : "pollThreeTimes")}
            </Button>;
          })}
        </div>
      </div>}
    </div>
    <Switch className="py-3.5" label={t("nudgeToggle")} checked={notify.eveningNudge} disabled={disabled}
      onChange={(event) => onSave({ ...notify, eveningNudge: event.target.checked })} />
    <Switch className="py-3.5" label={t("serviceRemindersToggle")} checked={notify.serviceReminders !== false} disabled={disabled}
      onChange={(event) => onSave({ ...notify, serviceReminders: event.target.checked })} />
  </div>;
}
