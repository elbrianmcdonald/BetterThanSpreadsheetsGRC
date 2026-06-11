"use client";

/**
 * Attendee pills input (Epic 18 — Story 18.3).
 *
 * Edits a `String[]` of attendees as removable pills with an enter/comma
 * separated text entry. Commits the array on each add/remove.
 */

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function AttendeePillsInput({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const parts = draft
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = Array.from(new Set([...value, ...parts]));
    onChange(next);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {name}
          {!disabled ? (
            <button
              type="button"
              onClick={() => remove(name)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
      {!disabled ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder="Add attendee…"
          className="h-7 w-32 flex-1 border-dashed text-xs"
        />
      ) : null}
    </div>
  );
}
