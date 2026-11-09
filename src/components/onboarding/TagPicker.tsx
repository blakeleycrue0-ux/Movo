"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { ToggleChip } from "@/components/ui/kit";
import { tagLabel } from "@/i18n";

/** Multi-select chips from suggestions plus free-form tags. */
export function TagPicker({ value, onChange, suggestions, max = 12, placeholder, addLabel }: {
  value: string[]; onChange: (v: string[]) => void; suggestions: string[]; max?: number; placeholder: string; addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const toggle = (tag: string) => onChange(value.includes(tag) ? value.filter((x) => x !== tag) : value.length >= max ? value : [...value, tag]);
  const add = () => {
    const tag = draft.trim().toLowerCase().slice(0, 32);
    if (tag && !value.includes(tag) && value.length < max) onChange([...value, tag]);
    setDraft("");
  };
  const custom = value.filter((v) => !suggestions.includes(v));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <ToggleChip key={s} selected={value.includes(s)} onToggle={() => toggle(s)} disabled={!value.includes(s) && value.length >= max}>
            {tagLabel(s)}
          </ToggleChip>
        ))}
        {custom.map((c) => (
          <button key={c} type="button" onClick={() => toggle(c)} aria-label={`Quitar ${c}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink bg-ink px-4 text-[15px] font-medium text-white">
            {tagLabel(c)} <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={32}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          aria-label={addLabel}
          className="h-11 flex-1 rounded-full border border-line-strong bg-card px-4 text-[16px] outline-none focus:border-ink" />
        <button type="button" onClick={add} disabled={!draft.trim()} aria-label={addLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-ink transition hover:bg-fill-strong disabled:opacity-40">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
