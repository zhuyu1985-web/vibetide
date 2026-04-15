interface ChapterHeaderProps {
  number: string;
  title: string;
  subtitle?: string;
}

export function ChapterHeader({ number, title, subtitle }: ChapterHeaderProps) {
  return (
    <div className="mt-8 mb-6">
      <div className="text-xs font-bold tracking-[3px] text-primary/60 uppercase mb-2">
        {number}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}
