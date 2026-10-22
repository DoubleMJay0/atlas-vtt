import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
  children: React.ReactNode;
}

/**
 * A titled part of the sidebar that folds away by its title, so the parts below come up. Folded
 * content stays mounted and hidden: the style gallery keeps its thumbnails for when it opens.
 */
export function SettingsSection({ title, children }: SettingsSectionProps): React.JSX.Element {
  const id = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(true);
  return (
    <section className="atlas-dungeon-section" aria-labelledby={id}>
      <h3 className="atlas-dungeon-section__title">
        <button
          type="button"
          id={id}
          className="atlas-dungeon-section__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((shown) => !shown)}
        >
          <ChevronRight className="atlas-dungeon-section__chevron" aria-hidden="true" />
          <span>{title}</span>
        </button>
      </h3>
      <div id={bodyId} className="atlas-dungeon-section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
