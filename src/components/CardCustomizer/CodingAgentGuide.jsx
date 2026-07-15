import { useState } from 'react';
import styled from 'styled-components';
import { Dim } from '../UI';
// The skill + kickoff prompt are the canonical files that ship with the CLI —
// imported raw so the copy buttons hand out exactly what lives in the repo.
import skillMd from '../../../cli/agent/SKILL.md?raw';
import kickoffPrompt from '../../../cli/agent/kickoff-prompt.md?raw';

const REPO_CLI_URL = 'https://github.com/vilt9/requirement5/blob/main/cli/CLI.md';

// A labelled artifact the developer copies and hands to their agent. Shows a
// preview of the text and a copy button with a brief "copied" confirmation.
const CopyBlock = ({ title, blurb, content, copyLabel }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <Artifact>
      <div className="head">
        <h4>{title}</h4>
        <button type="button" onClick={copy}>{copied ? 'Copied ✓' : copyLabel}</button>
      </div>
      <p className="lead">{blurb}</p>
      <pre>{content}</pre>
    </Artifact>
  );
};

// Shown when the creator picks "coding agent" over the manual customizer. The
// audience is a developer who drives an agent (Claude Code, Cursor, …): first
// the two steps they run themselves (install, auth), then the two artifacts that
// get their agent up to speed — a drop-in skill, or a paste-anywhere prompt.
const CodingAgentGuide = () => (
  <Guide>
    <Dim className="who">
      For developers who build with coding agents (Claude Code, Cursor, and the
      like) — set the CLI up once, then hand your agent the briefing or prompt
      below and it designs cards on its own.
    </Dim>

    <p>
      <code>r5c</code> is a terminal client for this site. Your agent gambles a
      Rarity Value, shapes a private draft from a single JSON spec, previews the
      rendered result, and publishes it — all from the terminal, without ever
      opening this page.
    </p>

    <Step>
      <h4>1 · Install</h4>
      <pre>{`npm install -g r5c
# or, no root:
curl -fsSL https://requirement5.com/install | sh`}</pre>
    </Step>

    <Step>
      <h4>2 · Sign in</h4>
      <p className="lead">
        New accounts start with 50 /t26; making a card costs a small create fee.
        For an agent or CI, export the token so it can act headlessly.
      </p>
      <pre>{`r5c signup --username your_name --email you@example.com
export R5C_TOKEN=…   # from ~/.r5c/config.json`}</pre>
    </Step>

    <Divider>Get your agent up to speed</Divider>

    <CopyBlock
      title="A · Hand your agent the briefing"
      copyLabel="Copy briefing"
      blurb="One markdown file that teaches any agent the commands, the spec, and the begin→confirm-start→preview→publish loop. Drop it where your agent looks — Claude Code: .claude/skills/r5c/SKILL.md · Codex / Cursor / Gemini CLI & others: append to your AGENTS.md (the top frontmatter is only used by Claude Code; harmless elsewhere)."
      content={skillMd}
    />

    <CopyBlock
      title="B · Or paste a kickoff prompt"
      copyLabel="Copy prompt"
      blurb="Nothing to set up — paste this straight into any agent's chat (Claude Code, Codex, Cursor…) to have it install r5c, learn the spec from the CLI's own help, and build your first card, pausing before it spends any currency."
      content={kickoffPrompt}
    />

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

// Section break between "what you run" and "what you give the agent".
const Divider = styled.div`
  margin: 18px 0 12px;
  padding-top: 12px;
  border-top: 1px solid var(--panel-border);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--amber-dim);
`;

const Artifact = styled.div`
  margin: 0 0 14px;

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--gold-bright);
  }

  button {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 10px;
    border: 1px solid var(--gold);
    background: var(--gold);
    color: #140d03;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: var(--gold-bright); }
  }

  .lead { margin: 0 0 6px; color: var(--amber-dim); }

  pre {
    margin: 0;
    padding: 8px 10px;
    max-height: 150px;
    overflow-y: auto;
    background: var(--field-bg);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    font-size: 10px;
    line-height: 1.5;
    color: var(--amber-dim);
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export default CodingAgentGuide;
