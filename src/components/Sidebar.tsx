import React from 'react';
import { Upload, BarChart3, Percent, FileText, MessageSquare, ShieldAlert, Radio } from 'lucide-react';
import { AppView } from '../lib/types';

interface SidebarProps {
  view: AppView;
  onNavigate: (v: AppView) => void;
  hasData: boolean;
  companyName?: string;
}

const NAV = [
  { id: 'upload'    as AppView, label: 'Upload',        Icon: Upload },
  { id: 'dashboard' as AppView, label: 'Dashboard',     Icon: BarChart3,     requiresData: true },
  { id: 'ratios'    as AppView, label: 'Ratios',        Icon: Percent,       requiresData: true },
  { id: 'mda'       as AppView, label: 'MD&A Analysis', Icon: FileText,      requiresData: true },
  { id: 'chat'      as AppView, label: 'AI Analyst',    Icon: MessageSquare, requiresData: true },
  { id: 'forensic'  as AppView, label: 'Forensic',      Icon: ShieldAlert,   requiresData: true },
];

export default function Sidebar({ view, onNavigate, hasData, companyName }: SidebarProps) {
  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: 'var(--accent-green-dim)',
          border: '1px solid var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          Equity Pro
        </span>
      </div>

      {/* Company chip */}
      {companyName && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 3,
          }}>
            Analysing
          </div>
          <div style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--accent-green)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {companyName}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        {NAV.map(({ id, label, Icon, requiresData }) => {
          const disabled = !!(requiresData && !hasData);
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => !disabled && onNavigate(id)}
              disabled={disabled}
              className={`nav-btn${active ? ' active' : ''}`}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer — API Key */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <button
          className="nav-btn"
          onClick={() => onNavigate('setup')}
        >
          <Radio size={15} style={{ flexShrink: 0 }} />
          API Key
        </button>
      </div>
    </aside>
  );
}