import * as React from "react";

export type Key = "Tab" | "Enter" | "Click";
export type ValidationResult = undefined | string; // undefined == OK

export interface Props {
  initialStateEditing?: boolean;
  initialValue: string;
  onSave: (val: string, key: Key) => ValidationResult;
  onCancel?: () => void;
}

export function EditField({
  initialStateEditing,
  initialValue,
  onSave,
  onCancel
}: Props) {
  const [value, setValue] = React.useState(initialValue);
  const [prevInitialValue, setPrevInitialValue] = React.useState(initialValue);
  const [editing, setEditing] = React.useState(initialStateEditing); // should we check if this changes?
  const divRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  if (prevInitialValue !== initialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
  }

  const cancel = () => {
    setValue(initialValue);
    setEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  // hook to catch all clicks elsewhere while editing, and focus input initially
  React.useEffect(() => {
    if (editing) {
      inputRef.current.focus();
      inputRef.current.select();
      const onClick = (e: MouseEvent) => {
        if (divRef.current && !divRef.current.contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      };
      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }
  }, [editing]);

  const save = (key: Key) => {
    const validate = onSave(value, key);
    if (validate !== undefined) {
      alert(`Invalid input: ${validate}`);
      return;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Enter":
      case "Tab":
        save(e.key);
        e.preventDefault();
        break;
      case "Esc":
      case "Escape":
        cancel();
        e.preventDefault();
        break;
    }
  };

  if (editing) {
    return (
      <div
        className="editfield"
        onClick={e => e.stopPropagation()}
        ref={divRef}
      >
        <span className="editfield_shadow">
          {value}
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            ref={inputRef}
          />
        </span>
        <button className="editbutton" onClick={cancel}>
          ❌
        </button>
        <button className="editbutton" onClick={() => save("Click")}>
          💾
        </button>
      </div>
    );
  } else {
    return (
      <div className="editfield">
        <span className="edittext">{value}</span>
        <button
          className="editbutton begineditbutton"
          onClick={() => setEditing(true)}
        >
          ✏️
        </button>
        <button className="editbutton" disabled>
          💾
        </button>
      </div>
    );
  }
}
