import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Atmosphere } from './Atmosphere.tsx';
import { Button } from './Button.tsx';
import { Logo } from './Logo.tsx';
import { SiteFooter } from './SiteFooter.tsx';
import { SiteHead } from './SiteHead.tsx';
import { SiteNav } from './SiteNav.tsx';

type Props = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  kicker: string;
  heading: string;
  children: ReactNode;
};

export function LegalLayout({ title, description, path, index = true, kicker, heading, children }: Props) {
  return (
    <div className="page">
      <SiteHead title={title} description={description} path={path} index={index} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <SiteNav />
          <Button to="/app">Clean your first track</Button>
        </div>
      </header>
      <main id="content" className="legal-main">
        <article className="wrap legal-card">
          <p className="kicker kicker-blue">{kicker}</p>
          <h1>{heading}</h1>
          <div className="legal-copy">{children}</div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
