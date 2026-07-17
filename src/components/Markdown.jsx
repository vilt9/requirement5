// A small, dependency-free Markdown renderer — just enough for our own static
// legal docs (headings, paragraphs, bold/italic/code, links, ordered/unordered
// lists, tables, blockquotes, horizontal rules). Not a general-purpose parser:
// it handles the shapes our .md files actually use and nothing more.
import styled from 'styled-components';

// Inline formatting: **bold**, *italic*, `code`, [text](url). Returns an array
// of strings and React elements. Order matters — links first so their bracketed
// text isn't eaten by the emphasis passes.
const inline = (text, keyBase) => {
  const nodes = [];
  let rest = String(text);
  let i = 0;
  const patterns = [
    { re: /\[([^\]]+)\]\(([^)]+)\)/, render: (m, k) => {
        const url = m[2];
        const external = /^https?:\/\//i.test(url);
        return <a key={k} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[1]}</a>;
      } },
    { re: /\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k}>{m[1]}</strong> },
    { re: /`([^`]+)`/, render: (m, k) => <code key={k}>{m[1]}</code> },
    { re: /\*([^*]+)\*/, render: (m, k) => <em key={k}>{m[1]}</em> }
  ];

  while (rest) {
    let best = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) best = { p, m };
    }
    if (!best) { nodes.push(rest); break; }
    if (best.m.index > 0) nodes.push(rest.slice(0, best.m.index));
    nodes.push(best.p.render(best.m, `${keyBase}-${i++}`));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return nodes;
};

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export default function Markdown({ source }) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { blocks.push(<hr key={key++} />); i++; continue; }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      const Tag = `h${Math.min(level, 4)}`;
      blocks.push(<Tag key={key++}>{inline(h[2], key)}</Tag>);
      i++;
      continue;
    }

    // Table: a header row of pipes followed by a |---|---| separator
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1].trim())) {
      const header = splitRow(trimmed);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      blocks.push(
        <TableWrap key={key++}>
          <table>
            <thead><tr>{header.map((c, ci) => <th key={ci}>{inline(c, `${key}h${ci}`)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `${key}r${ri}c${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(<ul key={key++}>{items.map((it, ii) => <li key={ii}>{inline(it, `${key}u${ii}`)}</li>)}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(<ol key={key++}>{items.map((it, ii) => <li key={ii}>{inline(it, `${key}o${ii}`)}</li>)}</ol>);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoted = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(<blockquote key={key++}>{inline(quoted.join(' '), `${key}q`)}</blockquote>);
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-structural lines
    const para = [];
    while (i < lines.length && lines[i].trim() &&
      !/^(#{1,6}\s|[-*]\s|\d+\.\s|>|\|)/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={key++}>{inline(para.join(' '), `${key}p`)}</p>);
  }

  return <Prose>{blocks}</Prose>;
}

const Prose = styled.div`
  text-align: left;
  line-height: 1.65;
  color: var(--amber-text);
  font-size: 13px;

  h1 { font-size: 22px; margin: 0 0 6px; }
  h2 { font-size: 16px; margin: 22px 0 6px; }
  h3 { font-size: 14px; margin: 16px 0 4px; }
  h4 { font-size: 13px; margin: 12px 0 4px; color: var(--gold-bright); }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  a { color: var(--gold-bright); text-decoration: underline; }
  code { background: var(--field-bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  hr { border: none; border-top: 1px solid var(--panel-border); margin: 20px 0; }
  strong { color: var(--white); }
  blockquote {
    margin: 10px 0;
    padding: 6px 12px;
    border-left: 2px solid var(--gold);
    background: var(--panel);
    color: var(--amber-dim);
  }
`;

const TableWrap = styled.div`
  overflow-x: auto;
  margin: 12px 0;

  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid var(--panel-border); padding: 6px 8px; text-align: left; vertical-align: top; }
  th { color: var(--white); background: var(--panel); }
`;
