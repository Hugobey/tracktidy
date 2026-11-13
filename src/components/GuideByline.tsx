import { authorInitials, formatGuideDate, readingLabel } from '../lib/guide-frontmatter.ts';

type Props = {
  author: string;
  role: string;
  date: string;
  minutes: number;
};

export function GuideByline({ author, role, date, minutes }: Props) {
  return (
    <div className="guide-byline" data-testid="guide-byline">
      <span className="guide-avatar" aria-hidden="true">
        {authorInitials(author)}
      </span>
      <div className="guide-byline-id">
        <p className="guide-author">{author}</p>
        {role ? <p className="guide-role">{role}</p> : null}
      </div>
      <p className="guide-byline-meta">
        <time dateTime={date}>{formatGuideDate(date)}</time>
        <span>{readingLabel(minutes)}</span>
      </p>
    </div>
  );
}
