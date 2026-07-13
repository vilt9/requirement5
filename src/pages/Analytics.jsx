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

  const { weeks, totals, retention, economy, segments } = data;

  return (
    <Page>
      <Panel>
        <H1>Analytics</H1>
        <Blurb>
          Public cohort view of Requirement5. Every player is grouped by the week
          they joined; each row tracks that group over the weeks that follow.
          Aggregate counts only — no names, no per-user data.
        </Blurb>
        <Stats>
          <Stat><b>{totals.users}</b><span>players</span></Stat>
          <Stat><b>{totals.creators}</b><span>creators</span></Stat>
          <Stat><b>{totals.collectors}</b><span>collectors</span></Stat>
          <Stat><b>{totals.publicCards}</b><span>public cards</span></Stat>
          <Stat><b>{Math.round(totals.circulating).toLocaleString()}</b><span>/t26 circulating</span></Stat>
        </Stats>
      </Panel>

      <Section
        title="1 · Retention"
        blurb="Of each week's new players, how many came back and did anything (drew, saved, published, starred) in a later week. Darker = a bigger share still active."
      >
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

      <Section
        title="2 · Activity intensity"
        blurb="Not just who came back, but how hard they played: average actions per active player that week. Darker = more actions each."
      >
        <Triangle
          cohorts={retention.cohorts}
          weeks={weeks}
          rowLabel={c => `${c.size}`}
          cell={(c, w) => {
            const a = c.active[w] || 0;
            const e = c.events[w] || 0;
            const per = a ? e / a : 0;
            return {
              text: a ? per.toFixed(1) : '·',
              t: per / 6, // ~6 actions/week reads as full heat
              muted: a === 0,
              title: `${shortWeek(w)}: ${e} actions across ${a} active`
            };
          }}
        />
      </Section>

      <Section
        title="3 · Economy health"
        blurb="Each cohort's money over time — median balance, and the share of the group underwater. Red tint = more of the cohort in debt."
      >
        <EconTriangle cohorts={economy.cohorts} weeks={weeks} />
      </Section>

      <Section
        title="4 · Creators vs collectors"
        blurb="Retention split by behaviour. Creators have published a card; collectors have only saved others'. Do makers or curators stick around longer?"
      >
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
  td.muted { color: var(--amber-dim); font-weight: 400; }
`;

export default Analytics;
