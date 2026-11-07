import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet';
  className?: string;
  to?: string;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({
  children,
  variant = 'primary',
  className,
  to,
  href,
  type = 'button',
  disabled,
  onClick,
}: Props) {
  const cls = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  if (to) {
    return (
      <Link className={cls} to={to} onClick={onClick}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
