import styled from 'styled-components';
import { Page, Panel } from '../components/UI';
import AboutR5c from '../components/AboutR5c';

// The standing "what is this" page. The transmission lives in AboutR5c so the
// same text appears here and in the card-page disclosure.
const About = () => (
  <Page>
    <Panel>
      {/* The mark is black-on-white artwork; inverted it drops onto the black
          page as a light emblem. */}
      <Logo src="/r5c_logo.png" alt="Requirement5" />
      <Heading>About Requirement5</Heading>
      <AboutR5c />
    </Panel>
  </Page>
);

const Logo = styled.img`
  display: block;
  width: 160px;
  height: auto;
  margin: 4px auto 8px;
  filter: invert(1);
  opacity: 0.92;
`;

const Heading = styled.h1`
  max-width: 460px;
  margin: 4px auto 16px;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: var(--white);
`;

export default About;
