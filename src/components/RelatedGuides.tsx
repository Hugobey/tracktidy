import { Link } from 'react-router-dom';

type Guide = {
  slug: string;
  path: string;
  title: string;
  cluster: string;
};

export function RelatedGuides({ posts }: { posts: Guide[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-guides" data-testid="related-guides">
      <h2 id="related-guides">Related guides</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link to={post.path}>
              <span className="cluster-badge">{post.cluster}</span>
              <span className="related-title">{post.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
