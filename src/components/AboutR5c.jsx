import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useScrollBloom } from '../utils/useScrollBloom';

const REPO_URL = 'https://github.com/vilt9/requirement5';
const DISCORD_URL = 'https://discord.gg/ywRCSATau3';

// The body of the transmission. Kept as data so the in-world terms below can be
// highlighted in one pass rather than hand-wrapped inline.
const PARAGRAPHS = [
  'Requirement5cards (R5c) is a project set up by Vilt9, the government of Nation Elgo, on the planet Umdo1. You know this planet, our home, as LHS 1140 b, a habitable exoplanet 48.8 lightyears from Earth.',
  'Umdo1 is suffering due to a rise in strict governance. Imagination is strictly controlled in all regions outside of Nation Elgo.',
  'Vilt9 is the last remaining government promoting imagination. However, our imagination is being depleted. Technology on Umdo1 is more advanced than it is on Earth, and strict governments use high-frequency electromagnetic waves to actively destroy imaginative thinking.',
  'We need supplies of imagination from Earth. Our scientists recently invented the Quantum Entangled Card Based Imagination Transport Protocol (QECBIT_P). This allows the transfer of imagination at 10^6 times the speed of light. This means those on Earth can now help us in the fight to preserve and grow imagination.',
  'You can help the resistance government Vilt9 by creating, generating and saving Requirement5cards. Please be as imaginative as you can. In exchange, we offer you our currency Slash_T2.6 (/t26 for short). When your species migrates to Umdo1, as we believe you will in Earth year 2082, recorded stocks of this currency will be given to their rightful owners.',
  'Please note that Slash_T is a currency branch that can be subject to self-correcting erosion. Erosion on the R5c platform is being prevented. This may change in the future.',
  'This is just the start of our collaborative resistance with Earth. We will be in touch with further information and adjustments to the R5c platform.'
];

// In-world terms that bloom to white while scrolling. Longest first so multi-word
// names match before any shorter name nested inside the same text.
const TERMS = [
  'Quantum Entangled Card Based Imagination Transport Protocol',
  'Requirement5',
  'Slash_T2.6',
  'Nation Elgo',
  'QECBIT_P',
  'Slash_T',
  'Vilt9',
  'Umdo1',
  '/t26'
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_RE = new RegExp(`(${[...TERMS].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})`, 'g');
const TERM_SET = new Set(TERMS);

// Split text on the terms and wrap each match so it can bloom on scroll.
const highlight = (text, active) =>
  text.split(TERM_RE).map((chunk, i) =>
    TERM_SET.has(chunk) ? <Term key={i} $active={active}>{chunk}</Term> : chunk
  );

// The in-world transmission behind R5c. Single source of truth — rendered on the
// About page and inside the "About Requirement5" disclosure on shared card pages.
// Running text, so it's left-aligned in a constrained column (house style).
const AboutR5c = () => {
  const scrolling = useScrollBloom();
  return (
    <Letter>
      {PARAGRAPHS.map((para, i) => <p key={i}>{highlight(para, scrolling)}</p>)}

      <Sign $active={scrolling}>
        LitronTevnaka8554,<br />
        Head of State Nation Elgo/Vilt9/32,482–present
      </Sign>
      <Dates>
        Dated:<br />
        45/04/32484 (<Term $active={scrolling}>Umdo1</Term>)<br />
        30/06/2026 (Earth)
      </Dates>

      <Rule />
      <p>
        <Term $active={scrolling}>QECBIT_P</Term> carries imagination in the five-carrier
        script of <Term $active={scrolling}>Nation Elgo</Term>. Learn to read it, and to
        write it, at <Link to="/language">Vitrec5</Link>.
      </p>
      <p>
        We have representatives on Earth aiding in our fight. Speak to them on{' '}
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>.
      </p>
      <p className="note">
        Bug reports and feature requests strengthen the protocol. The R5c platform is
        source-available — if you write code, open an issue or a pull request on{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>. Every
        fix and feature widens the channel and helps the cause.
      </p>
    </Letter>
  );
};

const Letter = styled.div`
  max-width: 460px;
  margin: 0 auto;
  text-align: left;
  font-family: var(--font-mono);
  color: var(--amber-text);
  font-size: 13px;
  line-height: 1.6;

  p { margin: 0 0 12px; }
  a { color: var(--gold-bright); }
  .note { color: var(--amber-dim); }
`;

// In-world terms: the surrounding colour at rest (so they blend in), blooming to
// white while the page scrolls (1.5s in) and easing back over 5s.
const Term = styled.span`
  color: ${p => (p.$active ? 'var(--white)' : 'inherit')};
  transition: color ${p => (p.$active ? '1.5s' : '5s')} ease;
`;

// Standard amber at rest; blooms to white while the page scrolls (1.5s in) and eases
// back over 5s — same mechanic as the in-world terms.
const Sign = styled.div`
  margin: 18px 0 0;
  color: ${p => (p.$active ? 'var(--white)' : 'var(--amber-text)')};
  line-height: 1.5;
  transition: color ${p => (p.$active ? '1.5s' : '5s')} ease;
`;

const Dates = styled.div`
  margin: 12px 0 0;
  color: var(--amber-dim);
  font-size: 12px;
  line-height: 1.6;
`;

const Rule = styled.hr`
  border: none;
  border-top: 1px solid var(--panel-border);
  margin: 18px 0;
`;

export default AboutR5c;
