"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useState, type ReactNode } from "react";

type Choice<Value extends string> = { value: Value; label: ReactNode; color?: string; dir?: "ltr" | "rtl" };

export function FieldSelect<Value extends string>({ label, showLabel, value, options, onChange, required, triggerClassName, leadingIcon, onOpenChange }: {
  label: string;
  showLabel?: boolean;
  value: Value;
  options: Choice<Value>[];
  onChange: (value: Value) => void;
  required?: boolean;
  triggerClassName?: string;
  leadingIcon?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const attachTrigger = useCallback((node: HTMLButtonElement | null) => {
    setDialog(node?.closest<HTMLElement>("dialog, [role='dialog']") ?? null);
  }, []);

  return (
    <Select.Root<Value> items={options} value={value} required={required} modal={false} onOpenChange={onOpenChange}
      onValueChange={next => { if (next !== null) onChange(next); }}>
      {showLabel && <label className="mb-2 block text-sm" htmlFor={id}>{label}</label>}
      <Select.Trigger ref={attachTrigger} id={id} aria-label={label}
        className={triggerClassName ?? `field-select-trigger${showLabel ? " w-full" : ""}`}>
        {leadingIcon}
        <Select.Value className="min-w-0 truncate" />
        <Select.Icon className="field-select-chevron"><ChevronDown aria-hidden size={15} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal container={dialog ?? undefined}>
        <Select.Positioner className="field-select-positioner" align="start" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className="field-select-popup">
            <Select.List aria-label={label}>
              {options.map(option => (
                <Select.Item key={option.value} value={option.value} className="field-select-option">
                  {option.color && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: option.color }} />}
                  <Select.ItemText dir={option.dir}>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ms-auto shrink-0"><Check aria-hidden size={16} /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
