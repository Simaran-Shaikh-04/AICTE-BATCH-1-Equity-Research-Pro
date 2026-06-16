import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface SetupPanelProps {
  onComplete: (apiKey: string) => void;
  hasServerKey: boolean;
}

export default function SetupPanel({ onComplete, hasServerKey }: SetupPanelProps) {
  const [key, setKey]   = useState('');
  const [show, setShow] = useState(false);

  const handleSubmit = () => {
    if (hasServerKey) { onComplete(''); return; }
    if (key.trim().length > 10) onComplete(key.trim());
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-void)',
    }}>
      <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--accent-green-dim)',
              border: '1px solid var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              Equity Research Pro
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Institutional-grade equity analysis for Indian listed companies
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
        }}>
          {hasServerKey ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--accent-green-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 6,
                color: 'var(--text-primary)',
              }}>
                Server Key Detected
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                A Gemini API key has been configured on the server. You can begin analysis immediately.
              </p>
              <button
                onClick={handleSubmit}
                className="proceed-btn"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Launch App
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--accent-amber-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 4,
                color: 'var(--text-primary)',
              }}>
                Gemini API Key
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                Enter your Google Gemini 2.5 Flash API key. It stays in your browser session only and is never stored on any server.{' '}
                <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
                  style={{ color: 'var(--accent-green)' }}>
                  Get one free →
                </a>
              </p>

              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 7,
              }}>
                API Key
              </label>

              <div style={{ position: 'relative', marginBottom: 16 }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="AIza..."
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 14px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 9,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShow(s => !s)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                  }}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSubmit}
                  disabled={key.trim().length < 10}
                  className="proceed-btn"
                >
                  Save Key
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          Supports Banking · NBFC · IT · Pharma · FMCG · Auto · Metal · Infra · Energy
        </p>
      </div>
    </div>
  );
}