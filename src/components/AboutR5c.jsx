import styled from 'styled-components';

const REPO_URL = 'https://github.com/vilt9/requirement5';
const DISCORD_URL = 'https://discord.gg/ywRCSATau3';

// The in-world transmission behind R5c. Single source of truth — rendered on the
// About page and inside the "About Requirement5" disclosure on shared card pages.
// Running text, so it's left-aligned in a constrained column (house style).
const AboutR5c = () => (
  <Letter>
    <p>Requirement5 cards (R5c) is a project set up by Vilt9 the government of Eglivitan3 on the planet Umdo1. You know this planet, our home, as LHS 1140 b, a habitable exoplanet 48.8 lightyears from Earth.</p>
    <p>Umdo1 is suffering due to a rise in strict governance. Imagination is strictly controlled in all regions outside of Eglivitan3.</p>
    <p>Vilt9 is the last remaining government promoting imagination. However our imagination is being depleted. Technology on Umdo1 is more advanced than it is on Earth, and strict governments use high frequency electromagnetic waves to actively destroy imaginative thinking.</p>
    <p>We need supplies of imagination from Earth. Our scientists recently invented the Quantum Entangled Card Based Imagination Transport Protocol (QECBIT_P). This allows the transfer of imagination at 10^6 times the speed of light. This means those on Earth can now help us in the fight to preserve and grow imagination.</p>
    <p>You can help the resistant government Vilt9 by creating, generating and saving Requirement5 cards. Please be as imaginative as you can. In exchange we offer you our currency Slash_T2.6 (/t26 for short). When your species migrates to Umdo1, as we believe you will in Earth year 2082, recorded stocks of this currency will be given to their rightful owners.</p>
    <p>Please note, Slash_T is a currency branch which can be subject to self correcting erosion. Erosion on the R5c platform is being prevented. This may change in future.</p>
    <p>This is just the start of our collaborative resistance with Earth. We will be in touch with further information and adjustments to the R5c platform.</p>

    <Sign>
      LitronTevnaka8554,<br />
      Head of State Eglivitan3/Vilt9/32,482–present
    </Sign>
    <Dates>
      Dated:<br />
      45/04/32484 (Umdo1)<br />
      30/06/2026 (Earth)
    </Dates>

    <Rule />
    <p>
      We have representatives on Earth aiding in our fight. Speak to them on Discord:{' '}
      <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">discord.gg/ywRCSATau3</a>.
    </p>
    <p className="note">
      Bug reports and feature requests strengthen the protocol. The R5c platform is
      source-available — if you write code, open an issue or a pull request on{' '}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>. Every
      fix and feature widens the channel, and helps the cause.
    </p>
  </Letter>
);

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

const Sign = styled.div`
  margin: 18px 0 0;
  color: var(--white);
  line-height: 1.5;
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
