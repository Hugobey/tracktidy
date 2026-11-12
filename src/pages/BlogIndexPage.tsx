import { Link } from 'react-router-dom';
import { BlogShell } from '../components/BlogShell.tsx';
import { BLOG_POSTS } from '../lib/blog.ts';
import { formatBlogDate, readingLabel } from '../lib/blog-frontmatter.ts';
import { BLOG_INDEX_DESCRIPTION, BLOG_INDEX_PATH, BLOG_INDEX_TITLE } from '../lib/site.ts';

export default function BlogIndexPage() {
  return (
    <BlogShell title={BLOG_INDEX_TITLE} description={BLOG_INDEX_DESCRIPTION} path={BLOG_INDEX_PATH}>
      <div className="wrap">
        <header className="blog-intro">
          <p className="kicker kicker-blue">Blog</p>
          <h1>Guides for the files you actually play.</h1>
          <p className="blog-intro-copy">{BLOG_INDEX_DESCRIPTION}</p>
        </header>
        {BLOG_POSTS.length === 0 ? (
          <p className="blog-intro-copy">No guides yet.</p>
        ) : (
          <ul className="blog-grid" data-testid="blog-grid">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <Link to={post.path}>
                  <span className="cluster-badge">{post.cluster}</span>
                  <h2>{post.title}</h2>
                  <p>{post.description}</p>
                  <p className="blog-meta">
                    <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                    <span>{readingLabel(post.minutes)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BlogShell>
  );
}
