import type { ComponentProps, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BlogCta } from '../components/BlogCta.tsx';
import { BlogShell } from '../components/BlogShell.tsx';
import { RelatedGuides } from '../components/RelatedGuides.tsx';
import NotFoundPage from './NotFoundPage.tsx';
import { BLOG_POSTS, blogPost } from '../lib/blog.ts';
import { blogPostingJsonLd, formatBlogDate, readingLabel, relatedPosts } from '../lib/blog-frontmatter.ts';

function BlogLink({ href, children, ...rest }: ComponentProps<'a'>): ReactNode {
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
    return <Link to={href}>{children}</Link>;
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function BlogTable(props: ComponentProps<'table'>) {
  return (
    <div className="blog-table-scroll">
      <table {...props} />
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = blogPost(slug);
  if (!post) return <NotFoundPage />;

  const Content = post.Component;
  const related = relatedPosts(BLOG_POSTS, post.slug);

  return (
    <BlogShell
      title={post.title}
      description={post.description}
      path={post.path}
      ogType="article"
      jsonLd={blogPostingJsonLd(post)}
    >
      <div className="wrap blog-layout">
        <article className="blog-card blog-article">
          <Link className="blog-back" to="/blog">
            All guides
          </Link>
          <p className="kicker kicker-blue">Guide</p>
          <h1>{post.title}</h1>
          <p className="blog-meta">
            <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
            <span className="cluster-badge">{post.cluster}</span>
            <span>{readingLabel(post.minutes)}</span>
          </p>
          <div className="blog-copy">
            <Content components={{ a: BlogLink, table: BlogTable }} />
          </div>
          <BlogCta />
          <RelatedGuides posts={related} />
        </article>
        <aside className="blog-aside">
          <BlogCta compact />
        </aside>
      </div>
    </BlogShell>
  );
}
