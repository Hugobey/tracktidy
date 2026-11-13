import { Link } from 'react-router-dom';

type Props = {
  /** The homepage uses in-page anchors. Other pages link back to those sections. */
  home?: boolean;
  current?: 'guides';
};

export function SiteNav({ home = false, current }: Props) {
  return (
    <nav className="nav-links" aria-label="Page">
      {home ? <a href="#method">How it works</a> : <Link to="/#method">How it works</Link>}
      {home ? <a href="#capabilities">Features</a> : <Link to="/#capabilities">Features</Link>}
      <Link to="/guides" aria-current={current === 'guides' ? 'page' : undefined}>
        Guides
      </Link>
    </nav>
  );
}
