"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

type Choice<T extends string> = { value: T; label: string };

export function FluidChoiceBar<T extends string>({ options, value, onChange, ariaLabel, mode = "tabs", compact = false }: {
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  mode?: "tabs" | "filter";
  compact?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const initializedRef = useRef(false);
  const optionSignature = options.map((option) => `${option.value}:${option.label}`).join("|");

  useLayoutEffect(() => {
    const bar = barRef.current;
    const indicator = indicatorRef.current;
    const selected = [...(bar?.querySelectorAll<HTMLButtonElement>(".fluid-choice") ?? [])].find((button) => button.dataset.value === value);
    if (!bar || !indicator || !selected) return;
    const barBounds = bar.getBoundingClientRect();
    const bounds = selected.getBoundingClientRect();
    indicator.style.transitionDuration = initializedRef.current ? "" : "0ms";
    indicator.style.left = `${bounds.left - barBounds.left + bar.scrollLeft}px`;
    indicator.style.top = `${bounds.top - barBounds.top + bar.scrollTop}px`;
    indicator.style.width = `${bounds.width}px`;
    indicator.style.height = `${bounds.height}px`;
    indicator.dataset.visible = "true";
    initializedRef.current = true;
  }, [value, optionSignature]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => {
      const selected = bar.querySelector<HTMLButtonElement>('.fluid-choice[data-active="true"]');
      const indicator = indicatorRef.current;
      if (!selected || !indicator) return;
      const barBounds = bar.getBoundingClientRect();
      const bounds = selected.getBoundingClientRect();
      indicator.style.transitionDuration = "0ms";
      indicator.style.left = `${bounds.left - barBounds.left + bar.scrollLeft}px`;
      indicator.style.top = `${bounds.top - barBounds.top + bar.scrollTop}px`;
      indicator.style.width = `${bounds.width}px`;
      indicator.style.height = `${bounds.height}px`;
    });
    observer.observe(bar);
    bar.querySelectorAll(".fluid-choice").forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [optionSignature]);

  return <div ref={barRef} className={`fluid-choice-bar${compact ? " fluid-choice-bar-compact" : ""}`} role={mode === "tabs" ? "tablist" : "group"} aria-label={ariaLabel} onKeyDown={(event) => {
    if (mode !== "tabs" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [...(barRef.current?.querySelectorAll<HTMLButtonElement>(".fluid-choice") ?? [])];
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0 || !buttons.length) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    onChange(options[next].value);
  }}>
    <span ref={indicatorRef} className="fluid-choice-indicator" aria-hidden="true" />
    {options.map((option) => <button key={option.value} type="button" className="fluid-choice" data-value={option.value} data-active={value === option.value} role={mode === "tabs" ? "tab" : undefined} tabIndex={mode === "tabs" && value !== option.value ? -1 : undefined} aria-selected={mode === "tabs" ? value === option.value : undefined} aria-pressed={mode === "filter" ? value === option.value : undefined} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
