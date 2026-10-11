/** Componentes de interface reutilizáveis. */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { formatNumberBR, parseDecimalBR } from '../../electrical/core/units';

export function Section({ title, icon, children, defaultOpen = true, right }: { title: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <h3 onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {icon}
        <span className="grow">{title}</span>
        {right && <span onClick={(e) => e.stopPropagation()}>{right}</span>}
      </h3>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <div className="field" title={hint}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/**
 * Campo numérico com unidade explícita. Aceita vírgula decimal.
 * `nullable` permite deixar vazio (valor desconhecido → null).
 */
export function NumberInput({
  value,
  onChange,
  unit,
  min,
  max,
  nullable = false,
  decimals = 3,
  placeholder,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  decimals?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const fmt = (v: number | null) => (v === null ? '' : formatNumberBR(v, decimals).replace(/\./g, ''));
  const [text, setText] = useState(fmt(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(fmt(value));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = () => {
    if (text.trim() === '') {
      if (nullable) {
        setInvalid(false);
        if (value !== null) onChange(null);
      } else {
        setInvalid(true);
      }
      return;
    }
    const v = parseDecimalBR(text);
    if (v === null || (min !== undefined && v < min) || (max !== undefined && v > max)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (v !== value) onChange(v);
  };
  return (
    <div className="unit-input">
      <input
        className={`input ${invalid ? 'invalid' : ''}`}
        value={text}
        placeholder={placeholder ?? (nullable ? 'não informado' : '')}
        disabled={disabled}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        title={invalid ? `Valor inválido${min !== undefined ? ` (mín. ${min})` : ''}${max !== undefined ? ` (máx. ${max})` : ''}` : undefined}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="input"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onChange(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="select"
      value={value === null ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {value === null && <option value="">— desconhecido —</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Modal({ title, icon, onClose, children, footer, narrow }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; narrow?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          {icon}
          <span className="grow">{title}</span>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Fechar">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Kv({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="kv">
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function fmt(v: number | null | undefined, unit: string, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <span className="muted">desconhecido</span>;
  return `${formatNumberBR(v, d)} ${unit}`;
}
