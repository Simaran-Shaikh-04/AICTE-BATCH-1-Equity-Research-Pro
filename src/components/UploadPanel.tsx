import React, { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { SECTORS, Sector, YearSlot } from '../lib/types';
import { ToastFn } from '../App';

interface UploadPanelProps {
  slots: YearSlot[];
  sector: Sector;
  onSectorChange: (s: Sector) => void;
  onExtract: (idx: number, file: File) => void;
  onRemoveSlot: (i: number) => void;
  onAddSlot: () => void;
  onProceed: () => void;
  showToast?: ToastFn;
  // FIX — prop now declared so App.tsx can pass handleYearChange
  onYearChange?: (index: number, year: string) => void;
}

const fmtCr = (v: number | null | undefined): string => {
  if (v == null || isNaN(Number(v))) return '—';
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L Cr`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${v.toFixed(1)} Cr`;
};

export default function UploadPanel({
  slots, sector, onSectorChange, onExtract, onRemoveSlot, onAddSlot, onProceed,
  onYearChange,
}: UploadPanelProps) {
  const [dragging, setDragging] = useState<number | null>(null);

  const handleDrop = useCallback((e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragging(null);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') onExtract(i, f);
  }, [onExtract]);

  const openPicker = (i: number) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.pdf';
    inp.onchange = e => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) onExtract(i, f);
    };
    inp.click();
  };

  const hasData = slots.some(s => s.data);
  const allIdle = slots.every(s => !s.loading);

  return (
    <div className="animate-fade-in-up" style={{ padding: '28px 32px' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 26,
        fontWeight: 700,
        marginBottom: 4,
        color: 'var(--text-primary)',
      }}>
        Upload Annual Reports
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>
        Upload PDF annual reports for up to 3 years. Gemini 2.5 Flash extracts financials automatically.
      </p>

      {/* Sector selector */}
      <span className="section-label">Company Sector</span>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 20,
      }}>
        {SECTORS.map(s => (
          <div
            key={s}
            onClick={() => onSectorChange(s)}
            className={`sector-pill${sector === s ? ' active' : ''}`}
          >
            {sector === s && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {s}
          </div>
        ))}
      </div>

      {/* Upload slots */}
      <span className="section-label">Annual Reports</span>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        marginBottom: 20,
      }}>
        {slots.map((slot, i) => (
          <div key={i}>
            {/* Slot header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                cursor: 'text',
              }}>
                FY&nbsp;
                <input
                  type="number"
                  defaultValue={slot.year}
                  min={2000}
                  max={2099}
                  onClick={e => e.stopPropagation()}
                  // FIX — was empty; now calls onYearChange with slot index and new value
                  onChange={e => onYearChange?.(i, e.target.value)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-bright)',
                    outline: 'none',
                    width: 52,
                    padding: '1px 2px',
                  }}
                />
              </label>

              {/* FIX — Consolidated / Standalone badge shown after extraction */}
              {slot.data && (
                <span style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: slot.data.isConsolidated === false
                    ? 'var(--accent-amber-dim)'
                    : 'var(--accent-green-dim)',
                  color: slot.data.isConsolidated === false
                    ? 'var(--accent-amber)'
                    : 'var(--accent-green)',
                }}>
                  {slot.data.isConsolidated === false ? '⚠ Standalone' : 'Consolidated ✓'}
                </span>
              )}

              {slots.length > 1 && (
                <button
                  onClick={() => onRemoveSlot(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Drop zone */}
            <div
              className={`drop-zone${slot.data ? ' loaded' : ''}${slot.error ? ' error' : ''}${dragging === i ? ' dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(i); }}
              onDragLeave={() => setDragging(null)}
              onDrop={e => handleDrop(e, i)}
              onClick={() => !slot.loading && openPicker(i)}
            >
              {slot.loading ? (
                <>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--accent-green-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg className="animate-spin-slow" width="18" height="18" viewBox="0 0 24 24"
                      fill="none" stroke="var(--accent-green)" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Extracting via Gemini 2.5 Flash…
                  </div>
                </>
              ) : slot.data ? (
                <>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--accent-green-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="var(--accent-green)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {slot.data.companyName || 'Report loaded'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    FY{slot.year} extracted
                  </div>
                  <div style={{
                    fontSize: 10,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'var(--accent-green-dim)',
                    color: 'var(--accent-green)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {fmtCr(slot.data.revenue)} revenue
                  </div>
                </>
              ) : slot.error ? (
                <>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--accent-red-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="var(--accent-red)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--accent-red)' }}>{slot.error}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to retry</div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FileText size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Drop PDF or click</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Annual Report FY{slot.year}</div>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Add slot */}
        {slots.length < 3 && allIdle && (
          <div>
            <div style={{ height: 26 }} />
            <button
              onClick={onAddSlot}
              style={{
                width: '100%',
                minHeight: 148,
                borderRadius: 'var(--radius-md)',
                border: '1.5px dashed var(--border)',
                background: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 11,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-green)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Year
            </button>
          </div>
        )}
      </div>

      {/* Proceed button */}
      <button
        className="proceed-btn"
        disabled={!hasData}
        onClick={onProceed}
      >
        View Dashboard
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}