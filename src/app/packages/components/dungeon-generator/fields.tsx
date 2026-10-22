import React, { useEffect, useId, useState } from 'react';
import { ToggleSwitch } from '../primitives/Toggle';
import { Select, type SelectOption } from '../primitives/Select';

/** Small labelled controls of the generator's settings column. */

interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, value, onChange, disabled = false }: SwitchRowProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="atlas-dungeon-field atlas-dungeon-field--switch">
      <span id={id} className="atlas-dungeon-field__label">{label}</span>
      <ToggleSwitch size="s" value={value} onChange={() => onChange(!value)} labelledBy={id} disabled={disabled} />
    </div>
  );
}

interface SelectRowProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  layer?: HTMLElement | null;
}

export function SelectRow<T extends string>({ label, value, options, onChange, layer = null }: SelectRowProps<T>): React.JSX.Element {
  const id = useId();
  return (
    <div className="atlas-dungeon-field">
      <span id={id} className="atlas-dungeon-field__label">{label}</span>
      <Select value={value} options={options} onChange={onChange} labelledBy={id} layer={layer} />
    </div>
  );
}

interface NumberInputProps {
  value: number;
  limits: readonly [number, number];
  step: number;
  onChange: (value: number) => void;
  labelledBy: string;
}

/** A number typed freely and taken once it is one within its limits; leaving the field holds it within them. */
export function NumberInput({ value, limits, step, onChange, labelledBy }: NumberInputProps): React.JSX.Element {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const [min, max] = limits;
  const take = (raw: string, leaving: boolean): void => {
    const parsed = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(parsed)) {
      if (leaving) setText(String(value));
      return;
    }
    const held = Math.min(max, Math.max(min, parsed));
    if (held !== parsed && !leaving) return;
    if (held !== value) onChange(held);
    if (leaving) setText(String(held));
  };
  return (
    <input
      type="number"
      className="atlas-dungeon-field__number"
      aria-labelledby={labelledBy}
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(event) => { setText(event.target.value); take(event.target.value, false); }}
      onBlur={(event) => take(event.target.value, true)}
    />
  );
}

interface NumberRowProps extends Omit<NumberInputProps, 'labelledBy'> {
  label: string;
}

export function NumberRow({ label, ...input }: NumberRowProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="atlas-dungeon-field">
      <span id={id} className="atlas-dungeon-field__label">{label}</span>
      <NumberInput {...input} labelledBy={id} />
    </div>
  );
}

interface ColourRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColourRow({ label, value, onChange }: ColourRowProps): React.JSX.Element {
  const id = useId();
  return (
    <label className="atlas-dungeon-field atlas-dungeon-field--colour">
      <span id={id} className="atlas-dungeon-field__label">{label}</span>
      <span className="atlas-dungeon-field__hex">{value}</span>
      <input type="color" className="atlas-dungeon-field__colour" aria-labelledby={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

interface SettingsSectionProps {
  title: string;
  /** Focused by the section's shortcut. */
  sectionRef?: React.Ref<HTMLElement>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsSection({ title, sectionRef, actions, children }: SettingsSectionProps): React.JSX.Element {
  const id = useId();
  return (
    <section ref={sectionRef} className="atlas-dungeon-section" aria-labelledby={id} tabIndex={-1}>
      <header className="atlas-dungeon-section__header">
        <h3 id={id} className="atlas-dungeon-section__title">{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}
