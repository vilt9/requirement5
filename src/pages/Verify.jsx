import styled from 'styled-components';

// Reached only from the unmarked dot in the footer. A QECBIT_P origin-verification
// record. Everything readable is written in the Stem — the JSON keys are the only
// latin, left as machine hints. The @font-face is pinned to the ogham range, so the
// marks render as marks and nothing latin is touched.
const HEADER = '᚛ᚂᚍᚂ ᚂᚋᚌ ᚂᚋᚄ ᚂᚋᚃ ᚂᚌᚂ ᚂᚍᚋ ᚂᚄᚎ ᚂᚍᚁ ᚁᚋᚁ ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚎ ᚂᚌᚂ ᚂᚌᚍ ᚁᚋᚁ ᚂᚍᚍ ᚂᚋᚌ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚍ ᚂᚌᚂ ᚂᚋᚄ ᚂᚋᚂ ᚂᚍᚋ ᚂᚌᚂ ᚂᚌᚎ ᚂᚌᚍ᚜';
const FOOTER = '᚛ᚂᚋᚋ ᚂᚌᚎ ᚁᚋᚁ ᚂᚌᚍ ᚂᚌᚎ ᚂᚍᚋ ᚁᚋᚁ ᚂᚋᚂ ᚂᚌᚍ ᚂᚍᚄ ᚂᚍᚎ ᚂᚋᚌ ᚂᚍᚃ ᚁᚋᚁ ᚂᚌᚂ ᚂᚌᚍ ᚁᚋᚁ ᚂᚋᚌ ᚂᚋᚂ ᚂᚍᚃ ᚂᚍᚋ ᚂᚌᚁ ᚁᚋᚁ ᚂᚍᚄ ᚂᚋᚄ ᚂᚍᚃ ᚂᚌᚂ ᚂᚍᚁ ᚂᚍᚋ᚜';
const BLOB = `{
  "protocol": "QECBIT_P",
  "check": "᚛ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚎ ᚂᚌᚂ ᚂᚌᚍ᚜",
  "origin": "᚛ᚂᚍᚃ ᚂᚋᚌ ᚂᚍᚂ ᚂᚍᚌ ᚂᚌᚂ ᚂᚍᚃ ᚂᚋᚌ ᚂᚌᚌ ᚂᚋᚌ ᚂᚌᚍ ᚂᚍᚋ ᚁᚍᚌ ᚁᚌᚍ ᚂᚋᚄ ᚂᚌᚎ ᚂᚌᚌ᚜",
  "authority": "᚛ᚂᚍᚃ ᚁᚍᚌ ᚂᚋᚄ᚜",
  "status": "᚛ᚂᚍᚍ ᚂᚋᚌ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚍ ᚂᚌᚂ ᚂᚋᚌ ᚂᚋᚋ᚜",
  "fingerprint": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "issued": "2026-07-14T09:31:04Z",
  "serial": "0142-7F3A-9C0E-2B61",
  "seal": "᚛ᚂᚍᚂ ᚂᚋᚌ ᚂᚋᚄ ᚂᚋᚃ ᚂᚌᚂ ᚂᚍᚋ ᚂᚄᚎ ᚂᚍᚁ ᚁᚋᚁ ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚎ ᚂᚌᚂ ᚂᚌᚍ ᚁᚋᚁ ᚂᚍᚍ ᚂᚋᚌ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚍ ᚂᚌᚂ ᚂᚋᚌ ᚂᚋᚋ ᚁᚌᚍ ᚁᚋᚁ ᚂᚍᚃ ᚂᚋᚌ ᚂᚍᚂ ᚂᚍᚌ ᚂᚌᚂ ᚂᚍᚃ ᚂᚋᚌ ᚂᚌᚌ ᚂᚋᚌ ᚂᚌᚍ ᚂᚍᚋ ᚁᚍᚌ ᚁᚌᚍ ᚂᚋᚄ ᚂᚌᚎ ᚂᚌᚌ ᚁᚋᚁ ᚂᚌᚂ ᚂᚍᚄ ᚁᚋᚁ ᚂᚍᚋ ᚂᚌᚁ ᚂᚋᚌ ᚁᚋᚁ ᚂᚍᚃ ᚁᚍᚌ ᚂᚋᚄ ᚁᚋᚁ ᚂᚋᚂ ᚂᚍᚌ ᚂᚍᚋ ᚂᚌᚁ ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚍᚋ ᚂᚎᚂ ᚁᚌᚍ᚜"
}`;

const Verify = () => (
  <Page>
    <Hero>{HEADER}</Hero>
    <pre>{BLOB}</pre>
    <Foot>{FOOTER}</Foot>
  </Page>
);

const Page = styled.div`
  min-height: calc(100vh - 46px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: var(--ink);
  padding: 44px 22px;

  pre {
    margin: 0;
    width: 100%;
    max-width: 560px;
    padding: 16px 18px;
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    background: var(--field-bg);
    font-family: 'R5 Stem', var(--font-mono);
    letter-spacing: 0;
    font-size: 13px;
    line-height: 1.8;
    color: var(--amber-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;

const Hero = styled.div`
  font-family: 'R5 Stem', var(--font-mono);
  letter-spacing: 0;
  font-size: 26px;
  color: var(--gold-bright);
  width: 100%;
  max-width: 560px;
  text-align: center;
  overflow-wrap: anywhere;
`;

const Foot = styled.div`
  font-family: 'R5 Stem', var(--font-mono);
  letter-spacing: 0;
  font-size: 13px;
  color: var(--amber-dim);
  width: 100%;
  max-width: 560px;
  text-align: center;
  overflow-wrap: anywhere;
`;

export default Verify;
