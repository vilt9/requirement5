import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Page, Panel, Dim, ErrorText } from '../components/UI';
import { api } from '../utils/api';

// Public cohort analytics. Four heat-triangles read from /api/analytics: signup
// retention, activity intensity, economy health, and creator-vs-collector
// retention. Each cell colours by value so the shape reads at a glance without
// reading a single number.

// Short label for a week key ("2026-W28" → "W28").
const shortWeek = (w) => (w ? w.split('-W')[1] ? `W${w.split('-W')[1]}` : w : '');
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Gold wash whose opacity tracks intensity 0..1 — the shared heat scale.
const heat = (t) => `rgba(232, 180, 85, ${0.06 + Math.max(0, Math.min(1, t)) * 0.85})`;

// A cohort triangle: rows are signup weeks, columns are absolute weeks. `cell`
// turns a cohort + column week into { text, title, t (0..1 heat), muted }.
const Triangle = ({ cohorts, weeks, cell, rowLabel }) => {
  if (!cohorts.length) return <Dim>No cohorts yet.</Dim>;
  // Only show columns from the first cohort's birth onward.
  const firstWeek = cohorts[0].cohort_week;
  const cols = weeks.filter(w => w >= firstWeek);
  return (
    <Scroll>
      <Grid>
        <thead>
          <tr>
            <th className="corner">cohort</th>
            {cols.map(w => <th key={w}>{shortWeek(w)}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(c => (
            <tr key={c.cohort_week}>
              <th className="row">
                {shortWeek(c.cohort_week)} <Dim>· {rowLabel ? rowLabel(c) : `${c.size}`}</Dim>
              </th>
              {cols.map(w => {
                if (w < c.cohort_week) return <td key={w} className="empty" />;
                const cd = cell(c, w);
                return (
                  <td
                    key={w}
                    title={cd.title}
                    className={cd.muted ? 'muted' : ''}
                    style={{ background: cd.muted ? 'transparent' : heat(cd.t) }}
                  >
                    {cd.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Grid>
    </Scroll>
  );
};

// The activities the intensity view breaks out, in the order they render. `kind`
// matches the backend's ACTIVITY_KINDS keys on each cohort's `kinds` map.
const ACTIVITIES = [
  { key: 'draw', label: 'Draws', noun: 'draws' },
  { key: 'reroll', label: 'Rerolls', noun: 'rerolls' },
  { key: 'save', label: 'Saves', noun: 'saves' },
  { key: 'star', label: 'Stars', noun: 'stars' },
  { key: 'create', label: 'Card creates', noun: 'creates' }
];

const Section = ({ title, blurb, children }) => (
  <Panel>
    <H2>{title}</H2>
    <Blurb>{blurb}</Blurb>
    {children}
  </Panel>
);

const Analytics = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/analytics').then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <Page><Panel><ErrorText>{error}</ErrorText></Panel></Page>;
  if (!data) return <Page><Panel><Dim>Loading…</Dim></Panel></Page>;

  const { weeks, totals, usage, retention, economy, segments } = data;

  return (
    <Page>
      <Panel>
        <H1>Analytics</H1>
        <Blurb>Grouped by signup week. Aggregate only, no names.</Blurb>
        <Stats>
          <Stat><b>{totals.users}</b><span>players</span></Stat>
          <Stat><b>{totals.creators}</b><span>creators</span></Stat>
          <Stat><b>{totals.collectors}</b><span>collectors</span></Stat>
          <Stat><b>{totals.publicCards}</b><span>public cards</span></Stat>
          <Stat><b>{Math.round(totals.circulating).toLocaleString()}</b><span>/t26 circulating</span></Stat>
        </Stats>
      </Panel>

      <Section title="Usage · weekly" blurb="Actions per week.">
        <UsageTable usage={usage} weeks={weeks} />
      </Section>

      <Section title="1 · Retention" blurb="Share of each signup week still active.">
        <Triangle
          cohorts={retention.cohorts}
          weeks={weeks}
          rowLabel={c => `${c.size}`}
          cell={(c, w) => {
            const a = c.active[w] || 0;
            return {
              text: a ? `${pct(a, c.size)}%` : '·',
              t: a / c.size,
              muted: a === 0,
              title: `${shortWeek(c.cohort_week)} cohort in ${shortWeek(w)}: ${a}/${c.size} active`
            };
          }}
        />
      </Section>

      <Section title="2 · Activity intensity" blurb="Actions per active player, one grid per activity. The grids sum to the total.">
        {ACTIVITIES.map((act, i) => (
          <div key={act.key}>
            <SubHead style={i ? { marginTop: 14 } : undefined}>{act.label}</SubHead>
            <IntensityTriangle cohorts={retention.cohorts} weeks={weeks} kind={act.key} noun={act.noun} />
          </div>
        ))}
      </Section>

      <Section title="3 · Economy health" blurb="Median balance · red = share in debt.">
        <EconTriangle cohorts={economy.cohorts} weeks={weeks} />
      </Section>

      <Section title="4 · Creators vs collectors" blurb="Retention by behaviour.">
        <SubHead>Creators <Dim>· {totals.creators}</Dim></SubHead>
        <Triangle
          cohorts={segments.creator.cohorts}
          weeks={weeks}
          cell={(c, w) => {
            const a = c.active[w] || 0;
            return { text: a ? `${pct(a, c.size)}%` : '·', t: a / c.size, muted: a === 0,
              title: `${a}/${c.size} creators active` };
          }}
        />
        <SubHead style={{ marginTop: 14 }}>Collectors <Dim>· {totals.collectors}</Dim></SubHead>
        <Triangle
          cohorts={segments.collector.cohorts}
          weeks={weeks}
          cell={(c, w) => {
            const a = c.active[w] || 0;
            return { text: a ? `${pct(a, c.size)}%` : '·', t: a / c.size, muted: a === 0,
              title: `${a}/${c.size} collectors active` };
          }}
        />
      </Section>
    </Page>
  );
};

// One activity's intensity triangle: for a single kind, the number is that
// activity's actions per active player (kinds[kind][w] / active[w]). Heat scales
// to this grid's own busiest cell, so a low-volume activity (creates) still
// reads as a trend instead of washing out next to a high-volume one (draws).
const IntensityTriangle = ({ cohorts, weeks, kind, noun }) => {
  const cols = weeks.filter(w => cohorts.length && w >= cohorts[0].cohort_week);
  let max = 0;
  for (const c of cohorts) {
    for (const w of cols) {
      const a = c.active[w] || 0;
      if (a) max = Math.max(max, (c.kinds?.[kind]?.[w] || 0) / a);
    }
  }
  return (
    <Triangle
      cohorts={cohorts}
      weeks={weeks}
      rowLabel={c => `${c.size}`}
      cell={(c, w) => {
        const a = c.active[w] || 0;
        const n = c.kinds?.[kind]?.[w] || 0;
        const per = a ? n / a : 0;
        return {
          text: per ? per.toFixed(1) : '·',
          t: max ? per / max : 0,
          muted: per === 0,
          title: `${shortWeek(w)}: ${n} ${noun} across ${a} active`
        };
      }}
    />
  );
};

// Economy triangle is its own thing: median balance as the number, debt share
// as a red wash, so a cohort sliding into the red lights up.
const EconTriangle = ({ cohorts, weeks }) => {
  if (!cohorts.length) return <Dim>No cohorts yet.</Dim>;
  const cols = weeks.filter(w => w >= cohorts[0].cohort_week);
  const byWeek = (c) => Object.fromEntries(c.series.map(s => [s.week, s]));
  return (
    <Scroll>
      <Grid>
        <thead>
          <tr>
            <th className="corner">cohort</th>
            {cols.map(w => <th key={w}>{shortWeek(w)}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(c => {
            const map = byWeek(c);
            return (
              <tr key={c.cohort_week}>
                <th className="row">{shortWeek(c.cohort_week)} <Dim>· {c.size}</Dim></th>
                {cols.map(w => {
                  if (w < c.cohort_week) return <td key={w} className="empty" />;
                  const s = map[w];
                  if (!s) return <td key={w} className="muted" />;
                  const debtShare = s.members ? s.inDebt / s.members : 0;
                  return (
                    <td
                      key={w}
                      title={`${shortWeek(w)}: median ${s.median} /t26 · ${s.inDebt}/${s.members} in debt · ${s.atFloor} at floor`}
                      // Median is the number; debt share is a red wash. Light text
                      // (not the grids' dark ink) so it reads on the near-black
                      // cells where the cohort is solvent and the wash is faint.
                      style={{ background: `rgba(255, 107, 107, ${0.12 + debtShare * 0.72})`, color: s.median < 0 ? '#ffd9d9' : 'var(--amber-text)' }}
                    >
                      {Math.round(s.median)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </Grid>
    </Scroll>
  );
};

// Weekly usage: generate clicks (logged-in / out), saves, cards created. Rows
// are metrics, columns are weeks; each cell heat-shades against its own row's
// peak so a row reads as a trend regardless of the others' scale.
const UsageTable = ({ usage, weeks }) => {
  const rows = [
    { key: 'gin', label: 'Generate · logged-in', series: usage.generate.in, total: usage.totals.generateIn },
    { key: 'gout', label: 'Generate · logged-out', series: usage.generate.out, total: usage.totals.generateOut },
    { key: 'saves', label: 'Card saves', series: usage.saves, total: usage.totals.saves },
    { key: 'created', label: 'Cards created', series: usage.created, total: usage.totals.created }
  ];
  // Only weeks where something happened, so the table doesn't sprawl.
  const cols = weeks.filter(w => rows.some(r => (r.series[w] || 0) > 0));
  if (!cols.length) return <Dim>No usage yet.</Dim>;
  return (
    <Scroll>
      <Grid>
        <thead>
          <tr>
            <th className="corner">metric</th>
            {cols.map(w => <th key={w}>{shortWeek(w)}</th>)}
            <th className="total">Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const peak = Math.max(1, ...cols.map(w => r.series[w] || 0));
            return (
              <tr key={r.key}>
                <th className="row">{r.label}</th>
                {cols.map(w => {
                  const v = r.series[w] || 0;
                  return (
                    <td key={w} className={v ? '' : 'muted'} style={{ background: v ? heat(v / peak) : 'transparent' }}>
                      {v || '·'}
                    </td>
                  );
                })}
                <td className="total">{r.total}</td>
              </tr>
            );
          })}
        </tbody>
      </Grid>
    </Scroll>
  );
};

const H1 = styled.h1`
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--white); margin: 0 0 6px;
`;
const H2 = styled.h2`font-size: 15px; margin: 0 0 4px; color: var(--white);`;
const Blurb = styled.p`margin: 0 0 12px; color: var(--amber-dim); max-width: 620px; font-size: 11px;`;
const SubHead = styled.div`font-size: 12px; color: var(--amber-text); margin-bottom: 6px;`;

const Stats = styled.div`
  display: flex; flex-wrap: wrap; gap: 18px; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--panel-border);
`;
const Stat = styled.div`
  display: flex; flex-direction: column;
  b { color: var(--gold-bright); font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  span { color: var(--amber-dim); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
`;

const Scroll = styled.div`overflow-x: auto; margin: 0 -4px; padding: 0 4px;`;
const Grid = styled.table`
  border-collapse: collapse;
  font-size: 10px;
  th, td {
    padding: 3px 5px; text-align: center; min-width: 34px;
    border: 1px solid rgba(156, 138, 104, 0.14);
  }
  th.corner { text-align: left; color: var(--amber-dim); }
  th { color: var(--amber-dim); font-weight: 500; white-space: nowrap; }
  th.row { text-align: left; color: var(--amber-text); white-space: nowrap; }
  td { color: #140d03; font-weight: 700; font-variant-numeric: tabular-nums; }
  td.empty { background: transparent; border-color: transparent; }
  td.muted { color: var(--amber-dim); font-weight: 400; background: transparent; }
  .total { color: var(--gold-bright); font-weight: 700; background: transparent; border-left: 1px solid var(--panel-border); }
`;

export default Analytics;
