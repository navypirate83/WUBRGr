/* =====================================================================
   THE PIECES OF THE BINDER WINDOWS
   - NameField: the name box with its "5 / 12" counter
   - SymbolChoices: the cover symbol (None, the colors, Colorless,
     Planeswalker, then the two-color symbols)
   - CoverChoices: the cover color (nine colors, then "Custom", which
     opens the device's own color chooser)
   Each choice is a radio button (only one in a group can be picked)
   wrapped in a label, so clicking the symbol or its name picks it.
   Used by the New binder and Binder properties windows.
   ===================================================================== */

import { useRef, useState, type Ref } from 'react';
import { COVER_COLORS, MANA_COLORS, NAME_LIMIT, isCustomCover } from '../../lib/binderStorage';
import { coverLook } from '../../lib/covers';
import styles from './BinderWindows.module.css';

/* ----- The name box ----- */

// "maxLength" stops typing past the limit, so the name always fits on
// one line of the cover's label. "required" stops the window's main
// button working while it's empty (left off where a blank name is fine).
// "label" is the heading above it ("Name" unless another is given).
export function NameField({ id, value, onChange, inputRef, label = 'Name', required = true }: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
  required?: boolean;
}) {
  return (
    <>
      <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
      <div className={styles.nameField}>
        <input
          id={id}
          ref={inputRef}
          className={styles.nameInput}
          type="text"
          maxLength={NAME_LIMIT}
          autoComplete="off"
          spellCheck={false}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {/* How many characters are used of the limit (read out as it changes) */}
        <span className={styles.nameCount} aria-live="polite">{value.length} / {NAME_LIMIT}</span>
      </div>
    </>
  );
}

/* ----- The cover symbol ----- */

// "value" is the picked symbol's code, or "" for None.
export function SymbolChoices({ group, legend, value, onChange }: {
  group: string;
  legend: string;
  value: string;
  onChange: (code: string) => void;
}) {
  // None first, then every symbol, split into the two groups
  const options = [{ code: '', name: 'None', short: 'None', group: 'single', symbol: null }, ...MANA_COLORS];

  // One choice: the radio button, the picture (or the empty "None"
  // circle) and the short name under it. Hovering shows the full name;
  // screen readers say both ("White and Blue, Azorius").
  const choice = (option: (typeof options)[number]) => (
    <label key={option.code} className={styles.choice} title={option.name}>
      <input
        type="radio"
        name={group}
        value={option.code}
        checked={value === option.code}
        onChange={() => onChange(option.code)}
        aria-label={option.short !== option.name ? `${option.name}, ${option.short}` : undefined}
      />
      {option.symbol
        ? <img className={styles.symbol} src={option.symbol} alt="" />
        : <span className={`${styles.symbol} ${styles.noSymbol}`} />}
      <span className={styles.choiceName}>{option.short}</span>
    </label>
  );

  return (
    <fieldset className={styles.choices}>
      <legend className={styles.text}>{legend}</legend>
      <div className={styles.colorGrid}>{options.filter((o) => o.group === 'single').map(choice)}</div>
      <p className={styles.groupTitle}>Two colors</p>
      <div className={`${styles.colorGrid} ${styles.twoColors}`}>
        {options.filter((o) => o.group === 'two').map(choice)}
      </div>
    </fieldset>
  );
}

/* ----- The cover color ----- */

// "value" is a cover color code ("gold"), or a custom color ("#3a7bd5").
export function CoverChoices({ group, value, onChange }: {
  group: string;
  value: string;
  onChange: (code: string) => void;
}) {
  // The color chooser's current color, and whether a custom color has
  // been picked yet (until then, "Custom" shows a rainbow)
  const [chooserColor, setChooserColor] = useState(isCustomCover(value) ? value : '#7a4fb3');
  const [customShown, setCustomShown] = useState(isCustomCover(value));
  const chooserRef = useRef<HTMLInputElement>(null);
  const customLook = coverLook(chooserColor);

  // Clicking "Custom" picks it and opens the color chooser. ("showPicker"
  // is the newer way to open it; older browsers use a pretend click.)
  function pickCustom() {
    onChange(chooserColor);
    try { chooserRef.current?.showPicker(); } catch { chooserRef.current?.click(); }
  }

  return (
    <fieldset className={styles.choices}>
      <legend className={styles.text}>Cover color</legend>
      <div className={styles.coverGrid}>
        {/* One round swatch per color, drawn just like the cover will be */}
        {COVER_COLORS.map((option) => {
          const look = coverLook(option.code);
          return (
            <label key={option.code} className={styles.choice} title={option.name}>
              <input
                type="radio"
                name={group}
                value={option.code}
                checked={value === option.code}
                onChange={() => onChange(option.code)}
              />
              <span className={`${styles.swatch} ${look.className}`} style={look.style} />
              <span className={styles.choiceName}>{option.name}</span>
            </label>
          );
        })}

        {/* "Custom": any color, from the device's own color chooser */}
        <label className={styles.choice} title="Pick any color">
          <input
            type="radio"
            name={group}
            value="custom"
            checked={isCustomCover(value)}
            onChange={() => {}}
            onClick={pickCustom}
            aria-label="Custom color (opens a color chooser)"
          />
          <span
            className={`${styles.swatch} ${customShown ? customLook.className : styles.rainbow}`}
            style={customShown ? customLook.style : undefined}
          />
          {/* The color chooser: invisible, but still on the page so it can
              be opened from code. tabIndex -1: the radio button is reached
              with the keyboard instead. */}
          <input
            ref={chooserRef}
            className={styles.colorInput}
            type="color"
            tabIndex={-1}
            aria-hidden="true"
            value={chooserColor}
            onChange={(event) => {
              setChooserColor(event.target.value);
              setCustomShown(true);
              onChange(event.target.value.toLowerCase());
            }}
          />
          <span className={styles.choiceName}>Custom</span>
        </label>
      </div>
    </fieldset>
  );
}
