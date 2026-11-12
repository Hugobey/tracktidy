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
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | null;
  children: ReactNode;
};

export function BlogShell({ title, description, path, ogType = 'website', jsonLd = null, children }: Props) {
  return (
    <div className="page">
      <SiteHead title={title} description={description} path={path} ogType={ogType} jsonLd={jsonLd} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <SiteNav current="blog" />
          <Button to="/app">Clean your first track</Button>
        </div>
      </header>
      <main id="content" className="blog-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
