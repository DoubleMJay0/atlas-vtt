import React, { useId } from 'react';
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

interface SettingsSectionProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsSection({ title, actions, children }: SettingsSectionProps): React.JSX.Element {
  const id = useId();
  return (
    <section className="atlas-dungeon-section" aria-labelledby={id}>
      <header className="atlas-dungeon-section__header">
        <h3 id={id} className="atlas-dungeon-section__title">{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}
