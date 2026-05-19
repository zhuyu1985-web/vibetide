import { ReactNode } from "react";

export default function DataCollectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
