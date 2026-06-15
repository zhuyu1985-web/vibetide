import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, leading, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-2">
          {leading}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
