import React, { useState, useEffect, useRef, useMemo } from 'react';
import SetupPanel from './components/SetupPanel';
import Sidebar from './components/Sidebar';
import UploadPanel from './components/UploadPanel';
import Dashboard from './components/Dashboard';
import RatiosPanel from './components/RatiosPanel';
import MDAPanel from './components/MDAPanel';
import ChatPanel from './components/ChatPanel';
import ForensicPanel from './components/ForensicPanel';
import { AppView, YearSlot, Sector, FinancialData } from './lib/types';
import { scoreAll, ScoredData } from './lib/scoring';

/* ─── Ticker tape data ───────────────────────────────────────────────────────── */
const TICKS = [
  { sym: 'NIFTY50',   val: '22,641.50', chg: '+0.52%', up: true  },
  { sym: 'SENSEX',    val: '74,382',    chg: '+0.48%', up: true  },
  { sym: 'HDFCBANK',  val: '₹1,741',   chg: '+1.24%', up: true  },
  { sym: 'ICICIBANK', val: '₹1,289',   chg: '+0.87%', up: true  },
  { sym: 'SBIN',      val: '₹843',     chg: '-0.43%', up: false },
  { sym: 'RELIANCE',  val: '₹2,941',   chg: '+0.31%', up: true  },
  { sym: 'INFY',      val: '₹1,482',   chg: '-0.67%', up: false },
  { sym: 'TCS',       val: '₹3,812',   chg: '+0.22%', up: true  },
  { sym: 'KOTAKBANK', val: '₹1,921',   chg: '+0.61%', up: true  },
  { sym: 'AXISBANK',  val: '₹1,198',   chg: '-0.19%', up: false },
];

export type ToastFn = (msg: string, type?: 'success' | 'error' | '') => void;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const CURRENT_YEAR = new Date().getFullYear();

/* ─── TickerBar ──────────────────────────────────────────────────────────────── */
function TickerBar() {
  const items = [...TICKS, ...TICKS].map((t, i) => (
    <span key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{t.sym}</span>
      <span style={{ color: 'var(--text-primary)' }}>{t.val}</span>
      <span className={t.up ? 'tick-up' : 'tick-dn'}>
        {t.up ? '▲' : '▼'} {t.chg}
      </span>
    </span>
  ));

  return (
    <div style={{
      height: 30,
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <div
        className="ticker-tape"
        style={{
          display: 'flex',
          gap: 36,
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '0 20px',
        }}
      >
        {items}
      </div>
    </div>
  );
}

/* ─── App ────────────────────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView]               = useState<AppView>('setup');
  const [userApiKey, setUserApiKey]   = useState('');
  const [hasServerKey, setHasServerKey] = useState(false);
  const [sector, setSector]           = useState<Sector>('General');
  const [slots, setSlots]             = useState<YearSlot[]>([
    { year: CURRENT_YEAR - 2, loading: false },
    { year: CURRENT_YEAR - 1, loading: false },
    { year: CURRENT_YEAR,     loading: false },
  ]);
  const [toast, setToast] = useState<{ msg: string; type: string; show: boolean }>({
    msg: '', type: '', show: false,
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast: ToastFn = (msg, type = '') => {
    setToast({ msg, type, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast(s => ({ ...s, show: false })),
      3200
    );
  };

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => { if (d.hasServerKey) setHasServerKey(true); })
      .catch(() => {});
  }, []);

  const handleSetupComplete = (key: string) => {
    setUserApiKey(key);
    setView('upload');
  };

  // FIX — onYearChange updates the year on the correct slot index
  const handleYearChange = (index: number, newYear: string) => {
    const parsed = parseInt(newYear, 10);
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2099) {
      setSlots(prev =>
        prev.map((s, i) => i === index ? { ...s, year: parsed } : s)
      );
    }
  };

  const handleExtract = async (slotIndex: number, file: File) => {
    const slot = slots[slotIndex];
    setSlots(prev =>
      prev.map((s, i) => i === slotIndex ? { ...s, file, loading: true, error: undefined } : s)
    );
    try {
      const base64 = await toBase64(file);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, filename: file.name, year: slot.year, sector, userApiKey }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const fd: FinancialData = { ...json, year: slot.year, sector };
      setSlots(prev =>
        prev.map((s, i) => i === slotIndex ? { ...s, data: fd, loading: false } : s)
      );
      showToast(`FY${slot.year} extracted successfully`, 'success');
    } catch (e: any) {
      setSlots(prev =>
        prev.map((s, i) => i === slotIndex ? { ...s, loading: false, error: e.message } : s)
      );
      showToast('Extraction failed: ' + e.message, 'error');
    }
  };

  const addSlot = () => {
    const minYear = Math.min(...slots.map(s => s.year));
    setSlots(prev => [{ year: minYear - 1, loading: false }, ...prev]);
  };

  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, j) => j !== i));

  // Sort loaded data ascending by year before scoring
  const loadedSlots = slots
    .filter(s => s.data)
    .sort((a, b) => a.year - b.year);

  // ── NEW: build PDF object-URLs for citation page links ──
  const fileUrls = useMemo(() => {
    const m: Record<number, string> = {};
    loadedSlots.forEach(s => { if (s.file) m[s.year] = URL.createObjectURL(s.file); });
    return m;
  }, [loadedSlots.map(s => `${s.year}:${s.file?.name || ''}`).join(',')]);

  // Cross-year unit reconciliation happens inside scoreAll(): it normalises any
  // year whose figures were extracted at the wrong unit scale (e.g. one report read
  // as "₹ in Crores" when it was a different unit), then scores oldest→newest so
  // each year sees the correct prior-year context for avg-equity ROE etc.
  const scoredData: ScoredData[] = scoreAll(loadedSlots.map(s => s.data!));

  const hasData     = scoredData.length > 0;
  const companyName = hasData ? scoredData[scoredData.length - 1].companyName : undefined;

  // ChatPanel should reason over the SAME unit-corrected figures shown on the
  // dashboard. scoredData extends FinancialData, so it carries the corrected
  // numbers (plus computed ratios/flags, which are useful context for the analyst).
  const loadedData: FinancialData[] = scoredData;

  if (view === 'setup') {
    return <SetupPanel onComplete={handleSetupComplete} hasServerKey={hasServerKey} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-void)' }}>
      <Sidebar
        view={view}
        onNavigate={setView}
        hasData={hasData}
        companyName={companyName}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TickerBar />

        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {view === 'upload' && (
            <UploadPanel
              slots={slots}
              sector={sector}
              onSectorChange={setSector}
              onExtract={handleExtract}
              onRemoveSlot={removeSlot}
              onAddSlot={addSlot}
              onProceed={() => setView('dashboard')}
              showToast={showToast}
              // FIX — onYearChange now wired up
              onYearChange={handleYearChange}
            />
          )}
          {view === 'dashboard' && hasData && (
            <Dashboard data={scoredData} fileUrls={fileUrls} userApiKey={userApiKey} />
          )}
          {view === 'ratios' && hasData && (
            <RatiosPanel data={scoredData} />
          )}
          {view === 'mda' && hasData && (
            <MDAPanel data={scoredData} userApiKey={userApiKey} />
          )}
          {view === 'chat' && hasData && (
            <ChatPanel data={loadedData} userApiKey={userApiKey} />
          )}
          {view === 'forensic' && hasData && (
            <ForensicPanel data={scoredData} />
          )}
          {!hasData && view !== 'upload' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  No data loaded yet
                </p>
                <button
                  onClick={() => setView('upload')}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 10,
                    background: 'var(--accent-green)',
                    color: '#000',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Upload Annual Reports
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`toast${toast.show ? ' show' : ''} ${toast.type}`}>{toast.msg}</div>
    </div>
  );
}