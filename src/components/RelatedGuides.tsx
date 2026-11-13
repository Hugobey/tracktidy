import { Link } from 'react-router-dom';

type Guide = {
  slug: string;
  path: string;
  title: string;
  category: string;
};

export function RelatedGuides({ guides }: { guides: Guide[] }) {
  if (guides.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-guides" data-testid="related-guides">
      <h2 id="related-guides">Related guides</h2>
      <ul>
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link to={guide.path}>
              <span className="guide-pill">{guide.category}</span>
              <span className="related-title">{guide.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
