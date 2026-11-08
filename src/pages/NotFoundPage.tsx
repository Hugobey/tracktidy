import { Link, useLocation } from 'react-router-dom';
import { LegalLayout } from '../components/LegalLayout.tsx';

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <LegalLayout
      title="Page not found — TrackTidy"
      description="This TrackTidy page does not exist."
      path={location.pathname}
      index={false}
      kicker="404"
      heading="This page does not exist."
    >
      <p>The address may be mistyped, or the page may have moved.</p>
      <p className="legal-actions">
        <Link to="/">Back to the homepage</Link>
        <Link to="/app">Clean a track</Link>
      </p>
    </LegalLayout>
  );
}
