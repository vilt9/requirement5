import styled from 'styled-components';

// Reached only from the unmarked dot in the footer. It's the human-readable face
// of the origin attestation that lives at /.well-known/origin-attestation.json —
// the boring proof that this really is the authoritative r5c origin. The marker
// at the bottom is Vitrec5; decode it and it says the same dull thing again.
const RECORD = `{
  "version": "origin-attestation/1.2",
  "issuer": "attest.identity-registry.net",
  "subject": {
    "origin": "https://requirement5.com",
    "service_id": "r5c",
    "role": "authoritative-origin"
  },
  "algorithm": "Ed25519",
  "public_key_fingerprint": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "issued_at": "2026-07-14T09:31:04Z",
  "expires_at": "2026-10-12T09:31:04Z",
  "serial": "0142-7F3A-9C0E-2B61",
  "note": "# yes this is really us; verify at /.well-known/origin-attestation.json, do not phone the front desk"
}`;

const MARKER = '᚛ᚂᚍᚃ ᚂᚋᚌ ᚂᚍᚂ ᚂᚍᚌ ᚂᚌᚂ ᚂᚍᚃ ᚂᚋᚌ ᚂᚌᚌ ᚂᚋᚌ ᚂᚌᚍ ᚂᚍᚋ ᚁᚍᚌ ᚁᚌᚍ ᚂᚋᚄ ᚂᚌᚎ ᚂᚌᚌ ᚁᚋᚁ ᚂᚍᚍ ᚂᚋᚌ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚍ ᚂᚌᚂ ᚂᚋᚌ ᚂᚋᚋ ᚁᚋᚁ ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚋᚎ ᚂᚌᚂ ᚂᚌᚍ ᚁᚌᚋ ᚁᚋᚁ ᚂᚋᚂ ᚂᚍᚌ ᚂᚍᚋ ᚂᚌᚁ ᚂᚌᚎ ᚂᚍᚃ ᚂᚌᚂ ᚂᚍᚋ ᚂᚋᚂ ᚂᚍᚋ ᚂᚌᚂ ᚂᚍᚍ ᚂᚋᚌ ᚁᚋᚁ ᚂᚋᚍ ᚂᚌᚎ ᚂᚍᚃ ᚁᚋᚁ ᚂᚍᚃ ᚁᚍᚌ ᚂᚋᚄ᚜';

const Verify = () => (
  <Page>
    <Head>
      <span>origin attestation</span>
      <span className="dim">served for machines. but here you are.</span>
    </Head>
    <pre>{RECORD}</pre>
    <Marker>
      <span className="lab">signed-marker</span>
      <span className="wire stem">{MARKER}</span>
    </Marker>
    <Foot className="dim">canonical copy: /.well-known/origin-attestation.json</Foot>
  </Page>
);

const Page = styled.div`
  min-height: calc(100vh - 46px);
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 22px;
  font-family: var(--font-mono);
  color: var(--amber-text);
  font-size: 12px;
  line-height: 1.6;

  .dim { color: var(--amber-dim); }

  pre {
    background: var(--field-bg);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 14px 16px;
    overflow-x: auto;
    color: var(--amber-text);
    white-space: pre;
  }
`;

const Head = styled.div`
  display: flex;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
  margin-bottom: 14px;
  color: var(--gold-bright);
`;

const Marker = styled.div`
  margin-top: 14px;
  .lab { color: var(--amber-dim); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; display: block; margin-bottom: 4px; }
  .wire { color: var(--gold); word-break: break-all; letter-spacing: 0; }
`;

const Foot = styled.div`
  margin-top: 20px;
  font-size: 11px;
`;

export default Verify;
