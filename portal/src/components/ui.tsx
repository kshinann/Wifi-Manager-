import { useState, type ReactNode } from "react";

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

const ACTION_TONE: Record<string, string> = {
  allowed: "good", allow: "good", warned: "warning", warn: "warning", blocked: "critical", block: "critical",
  active: "good", revoked: "critical",
};
const ACTION_ICON: Record<string, string> = { good: "✓", warning: "!", critical: "✕" };

/** Status badge: always icon + text, never color alone. */
export function StatusBadge({ value }: { value: string }) {
  const tone = ACTION_TONE[value] || "";
  return (
    <span className={`badge ${tone}`}>
      {ACTION_ICON[tone] && <span aria-hidden="true">{ACTION_ICON[tone]}</span>}
      {value}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="page-head">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="link" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <div className="alert" role="alert">{error}</div> : null;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
