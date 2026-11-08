type Props = {
  title: string;
  children: string;
  testId?: string;
  className?: string;
};

export function ErrorBanner({ title, children, testId, className }: Props) {
  return (
    <div className={className ? `error-banner ${className}` : 'error-banner'} role="alert" data-testid={testId}>
      <p className="error-kicker">{title}</p>
      <p>{children}</p>
    </div>
  );
}
