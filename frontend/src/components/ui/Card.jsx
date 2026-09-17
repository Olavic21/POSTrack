import React from 'react';

export function Card({ children, className = '', padding = true, hover = false, ...props }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', actions, title, subtitle }) {
  return (
    <div className={`card-header flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {title ? <h3 className="text-sm font-bold tracking-tight text-slate-900">{title}</h3> : null}
        {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
        {children && !title ? children : null}
        {title && children ? <div className="mt-1">{children}</div> : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = '', padding = true }) {
  return <div className={`${padding ? 'card-body' : ''} ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}

export default Card;
