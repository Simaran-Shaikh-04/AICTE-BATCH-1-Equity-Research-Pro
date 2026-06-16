import React from 'react';
import { ScoredData } from '../lib/scoring';
import { fmtRatio } from '../lib/format';

interface Props { data: ScoredData[]; }

// Group ratios into sections by what the key implies, so the table reads like a
// research sheet rather than one long undifferentiated list. Anything that does
// not match a group falls through to "Other".
const GROUPS: { title: string; match: (k: string) => boolean }[] = [
  { title: 'Profitability', match: k => /margin|roe|roce|roa|roaa|return|pat|ebitda|nim|yield/i.test(k) },
  { title: 'Leverage & Solvency', match: k => /debt|equity|leverage|interest cover|coverage|capital adequacy|car|gearing/i.test(k) },
  { title: 'Asset Quality (Banks)', match: k => /npa|provision|slippage|casa|advances|deposits/i.test(k) },
  { title: 'Efficiency & Working Capital', match: k => /dso|dpo|days|turnover|inventory|receivable|cfo|cost\/income|cost of funds/i.test(k) },
  { title: 'Growth', match: k => /growth|yoy|cagr/i.test(k) },
];

export default function RatiosPanel({ data }: Props) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>No data available. Upload annual reports to compute ratios.</div>;
  }

  const latest = data[data.length - 1];
  const allKeys = [...new Set(data.flatMap(d => Object.keys(d.ratios || {})))];

  // assign each key to the first matching group; leftovers → Other
  const used = new Set<string>();
  const sections = GROUPS.map(g => {
    const keys = allKeys.filter(k => !used.has(k) && g.match(k));
    keys.forEach(k => used.add(k));
    return { title: g.title, keys };
  }).filter(s => s.keys.length > 0);
  const other = allKeys.filter(k => !used.has(k));
  if (other.length) sections.push({ title: 'Other', keys: other });

  const cols = `2fr ${data.map(() => '1fr').join(' ')}`;

  return (
    <div className="animate-fade-in-up" style={{ padding: '28px 32px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
        Ratio Analysis
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>
        {latest.companyName} · {data.map(d => `FY${d.year}`).join(', ')} · computed from extracted financials
      </p>

      {allKeys.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          No ratios could be computed — too few core figures were extracted.
        </p>
      ) : (
        sections.map(sec => (
          <div key={sec.title} style={{ marginBottom: 22 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.08em', color: 'var(--accent-green)', marginBottom: 8,
            }}>
              {sec.title}
            </div>
            <div className="ratios-table">
              <div className="ratios-thead" style={{ gridTemplateColumns: cols }}>
                <div className="ratios-th">Metric</div>
                {data.map(d => <div key={d.year} className="ratios-th" style={{ textAlign: 'right' }}>FY{d.year}</div>)}
              </div>
              {sec.keys.map(k => (
                <div key={k} className="ratio-row" style={{ gridTemplateColumns: cols }}>
                  <div className="ratio-cell">{k}</div>
                  {data.map(d => (
                    <div key={d.year} className="ratio-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {fmtRatio(k, (d.ratios as any)?.[k])}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
