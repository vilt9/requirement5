// The static legal pages (/terms, /privacy, /content-policy). Each is a Markdown
// file under src/legal, imported raw and rendered with our small Markdown
// component. One component serves all three — the route picks the doc.
import { Page, Panel } from '../components/UI';
import Markdown from '../components/Markdown';
import termsMd from '../legal/terms.md?raw';
import privacyMd from '../legal/privacy.md?raw';
import contentPolicyMd from '../legal/content-policy.md?raw';

const DOCS = {
  terms: termsMd,
  privacy: privacyMd,
  'content-policy': contentPolicyMd
};

export default function Legal({ doc }) {
  const source = DOCS[doc] || '# Not found';
  return (
    <Page>
      <Panel>
        <Markdown source={source} />
      </Panel>
    </Page>
  );
}
