import styled from 'styled-components';
import { Dim } from '../UI';

const REPO_CLI_URL = 'https://github.com/vilt9/requirement5/blob/main/cli/CLI.md';

// Shown when the creator picks "coding agent" over the manual customizer. The
// audience is a developer who drives an agent (Claude Code, Cursor, …), so this
// stays terse and points at the machine-readable surfaces the agent needs:
// install, token auth, the spec reference, and the publish→preview→update loop.
const CodingAgentGuide = () => (
  <Guide>
    <Dim className="who">
      For developers who build with coding agents (Claude Code, Cursor, and the
      like) — hand the CLI to your agent and let it design cards from a spec.
    </Dim>

    <p>
      <code>r5c</code> is a terminal client for this site. A card is a single
      JSON spec file — the agent writes it, publishes it, and looks at the result
      without ever opening this page. Everything below is built for automation:
      <code>--json</code> on every command, token auth, one file per card.
    </p>

    <Step>
      <h4>1 · Install</h4>
      <pre>{`npm install -g r5c
# or, no root:
curl -fsSL https://requirement5.com/install | sh`}</pre>
    </Step>

    <Step>
      <h4>2 · Authenticate</h4>
      <p className="lead">
        Interactive for you, or an <code>R5C_TOKEN</code> env var for the agent /
        CI. New accounts start with 50 /t26; publishing stakes 1–4.
      </p>
      <pre>{`r5c signup --username your_name
export R5C_TOKEN=…   # from ~/.r5c/config.json`}</pre>
    </Step>

    <Step>
      <h4>3 · Point the agent at the spec</h4>
      <p className="lead">
        This is the whole knowledge the agent needs — every visual knob, with
        ranges and defaults. Pipe it into context.
      </p>
      <pre>{`r5c help spec        # full spec reference
r5c template full    # a maximal example to edit`}</pre>
    </Step>

    <Step>
      <h4>4 · Publish, look, refine</h4>
      <p className="lead">
        <code>preview</code> writes PNGs the agent can actually see (one at rest,
        the rest mid-orbit with the holo awake), so it can iterate on its own.
      </p>
      <pre>{`r5c publish card.json --json   # prints the live URL + id
r5c preview <id> --out shots/  # stills to inspect
r5c update <id> card.json      # redesign, no new stake`}</pre>
    </Step>

    <Dim className="more">
      Full docs, agent recipes, and raw API notes:{' '}
      <a href={REPO_CLI_URL} target="_blank" rel="noopener noreferrer">CLI.md on GitHub</a>.
    </Dim>
  </Guide>
);

const Guide = styled.div`
  font-family: var(--font-mono);
  color: var(--amber-text);
  font-size: 12px;
  line-height: 1.6;
  text-align: left;

  .who {
    display: block;
    font-size: 11px;
    line-height: 1.5;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--panel-border);
  }

  p { margin: 0 0 12px; }
  .lead { margin: 0 0 8px; color: var(--amber-dim); }
  code { color: var(--gold-bright); }
  a { color: var(--gold-bright); }

  .more {
    display: block;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--panel-border);
    font-size: 11px;
  }
`;

const Step = styled.div`
  margin: 0 0 14px;

  h4 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--gold-bright);
  }

  pre {
    margin: 0;
    padding: 8px 10px;
    background: var(--field-bg);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--amber-text);
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export default CodingAgentGuide;
