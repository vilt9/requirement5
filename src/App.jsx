import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createGlobalStyle } from 'styled-components';
import { CardProvider } from './context/CardContext';
import { AuthProvider } from './context/AuthContext';
import Navigation from './components/Navigation/Navigation';
import GenerateGate from './pages/GenerateGate';
import Pool from './pages/Pool';
import Collection from './pages/Collection';
import UserCollection from './pages/UserCollection';
import CardCustomizer from './pages/CardCustomizer';
import Account from './pages/Account';
import ClaimAccount from './pages/ClaimAccount';
import ShareCard from './pages/ShareCard';
import CaptureCard from './pages/CaptureCard';
import About from './pages/About';
import './App.css';

// The design language (refreshed, after midjourney.com/medical): JetBrains Mono
// everywhere — warm amber body on pure black, white/gold headings, gold accents
// for links and primary actions. Tokens live in :root so the whole system
// reskins from one place.
const GlobalStyle = createGlobalStyle`
  /* Clear the fixed nav on desktop; on phones the nav is static (scrolls with
     the page), so reserving the height would just be blank space. */
  .app-main {
    margin-top: 46px;
    @media (max-width: 640px) {
      margin-top: 0;
    }
  }

  :root {
    /* Base values for mouse tracking */
    --mx: 50%;
    --my: 50%;
    --posx: 50%;
    --posy: 50%;
    --hyp: 0; /* Hypothenuse - distance from center */

    /* Cards shine base colors */
    --red: #f80e7b;
    --yel: #eedf10;
    --gre: #21e985;
    --blu: #0dbde9;
    --vio: #c929f1;

    /* UI palette */
    --gold: #e8b455;
    --gold-bright: #f8d488;
    --amber-text: #cdb185;
    --amber-dim: #9c8a68;
    --white: #ffffff;
    --ink: #000000;

    /* Surfaces */
    --panel: rgba(232, 180, 85, 0.05);
    --panel-hover: rgba(232, 180, 85, 0.12);
    --panel-border: rgba(156, 138, 104, 0.28);
    --field-bg: rgba(255, 255, 255, 0.04);

    /* Type — one font, everywhere. */
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    letter-spacing: 0.01em;
    background: var(--ink);
    color: var(--amber-text);
    overflow-x: hidden;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  #root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  h1, h2, h3, h4 {
    font-family: var(--font-mono);
    color: var(--white);
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }

  button {
    font-family: var(--font-mono);
  }

  ::selection {
    background: rgba(248, 212, 136, 0.25);
    color: var(--white);
  }

  a {
    color: var(--gold-bright);
    text-decoration: none;
  }

  a:hover {
    color: var(--white);
    text-decoration: underline;
    text-decoration-color: var(--white);
    text-underline-offset: 0.18em;
  }
`;

// Manually set the window.cardImagesData to be accessible by utility functions
window.cardImagesData = [
  {"bed_elephant": ["_1", "_2", "_3", "_4"]},
  {"blue_smoke_chairs": ["_1", "_2", "_3", "_4"]},
  {"colour_glass": ["_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8"]},
  {"dark_flowers": ["_1", "_2", "_3"]},
  {"digital_race": ["_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8"]},
  {"green_world": ["_1", "_2", "_3", "_4"]},
  {"monochrome_nature": ["_1", "_2", "_3", "_4"]},
  {"shell_dragons": ["_1", "_2", "_3", "_4"]},
  {"the_machine": ["_1", "_2", "_3", "_4"]},
  {"white_mushrooms": ["_1", "_2", "_3"]},
  {"wolf_toys": ["_1", "_2", "_3", "_4"]}
];

function App() {
  return (
    <AuthProvider>
      <CardProvider>
        <Router>
          <GlobalStyle />
          <div className="App">
            <Navigation />
            <main className="app-main">
              <Routes>
                <Route path="/" element={<GenerateGate />} />
                <Route path="/pool" element={<Pool />} />
                <Route path="/collection" element={<Collection />} />
                {/* Someone else's collection, read-only (from Discover) */}
                <Route path="/u/:username" element={<UserCollection />} />
                {/* The create flow (roll → design → publish). /customize is the
                    old path, kept as a redirect. */}
                <Route path="/create" element={<CardCustomizer />} />
                <Route path="/customize" element={<Navigate to="/create" replace />} />
                <Route path="/account" element={<Account />} />
                <Route path="/claim/:token" element={<ClaimAccount />} />
                <Route path="/about" element={<About />} />
                <Route path="/card/:id" element={<ShareCard />} />
                {/* A collector's copy of a card: same page, plus whose
                    collection it's in and what they paid. */}
                <Route path="/:username/card/:id" element={<ShareCard />} />
                <Route path="/capture/:id" element={<CaptureCard />} />
                {/* Unknown paths (incl. retired routes like /language) fall
                    back to Discover rather than a blank frame. */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </CardProvider>
    </AuthProvider>
  );
}

export default App;
