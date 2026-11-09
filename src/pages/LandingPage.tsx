import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppPreview } from '../components/AppPreview.tsx';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Button } from '../components/Button.tsx';
import { Logo } from '../components/Logo.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { UploadOverlay } from '../components/UploadOverlay.tsx';
import { stashPending } from '../lib/pendingFile.ts';
import { homeJsonLd, routeMeta } from '../lib/site.ts';

const home = routeMeta('/');

const STEPS = [
  {
    n: '01',
    title: 'Upload a track.',
    body: 'Drop one MP3. It stays on this computer.',
  },
  {
    n: '02',
    title: 'Analyze and clean its metadata.',
    body: 'Check the tags, fill what’s missing, and correct anything that’s wrong.',
  },
  {
    n: '03',
    title: 'Download your perfectly organized file.',
    body: 'The audio is not re-encoded. The name and the tags are updated.',
  },
];

const FEATURES = [
  {
    n: '01',
    title: 'Automatic metadata extraction',
    body: 'Artist, title, remix, album, genre, and any tempo or key already stored in the file.',
  },
  {
    n: '02',
    title: 'BPM and key detection',
    body: 'Tempo is measured from the audio when the tag is empty. Key is estimated and marked as an estimate.',
  },
  {
    n: '03',
    title: 'Custom filename formatting',
    body: 'Set a template and see the exact file name before anything is written.',
  },
  {
    n: '04',
    title: 'Quick editing and clean exports',
    body: 'Change a field, keep the rest of the tag, and download the MP3.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);

  function openUpload() {
    setUploadOpen(true);
  }

  return (
    <div className="page">
      <SiteHead title={home.title} description={home.description} path={home.path} jsonLd={homeJsonLd()} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <nav className="nav-links" aria-label="Page">
            <a href="#method">How it works</a>
            <a href="#capabilities">Features</a>
          </nav>
          <Button onClick={openUpload}>Clean your first track</Button>
        </div>
      </header>

      <main id="content">
        <section className="hero wrap" id="top">
          <div className="hero-copy">
            <p className="kicker kicker-blue enter d1">For DJ collections</p>
            <h1 className="enter d2">
              Your tracks.
              <br />
              <span className="accent">Perfectly organized.</span>
            </h1>
            <p className="lede enter d3">
              Clean metadata. Detect BPM. Rename your tracks. Get your music ready to play.
            </p>
            <div className="hero-actions enter d3">
              <Button onClick={openUpload}>Clean your first track</Button>
              <Button href="#method" variant="secondary">
                How it works
              </Button>
            </div>
            <p className="reassure enter d4">One track at a time. In the browser. No account.</p>
          </div>
          <AppPreview />
        </section>

        <section className="section" id="method">
          <div className="wrap">
            <p className="kicker kicker-blue">Process</p>
            <h2>Three steps. One file.</h2>
            <ol className="steps">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <span className="idx">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" id="capabilities">
          <div className="wrap">
            <p className="kicker kicker-blue">Capabilities</p>
            <h2>What one track can become.</h2>
            <ul className="features">
              {FEATURES.map((feature) => (
                <li key={feature.n} className="feature">
                  <span className="idx">{feature.n}</span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="start">
          <div className="wrap">
            <div className="closing">
              <h2>Get your music library in order.</h2>
              <p>Start with a single track.</p>
              <Button onClick={openUpload}>Clean your first track</Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      {uploadOpen ? (
        <UploadOverlay
          heading="p"
          onClose={() => setUploadOpen(false)}
          onFile={(file, extra) => {
            stashPending({ file, extra });
            navigate('/app');
          }}
        />
      ) : null}
    </div>
  );
}
