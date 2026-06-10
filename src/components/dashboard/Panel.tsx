import { ReactNode } from "react";

// Shared glassmorphism wrapper for every card.
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-4 flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-2 mb-3">
          <div>
            {title && (
              <h2 className="text-xs uppercase tracking-widest text-ink-3 font-medium">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-ink-3 text-xs mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}
