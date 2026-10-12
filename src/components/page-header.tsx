import { IconChip } from "./brand";
import { SECTIONS, type SectionKey } from "./sections";

export function PageHeader({
  section,
  title,
  description,
  children,
}: {
  section?: SectionKey;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const s = section ? SECTIONS[section] : undefined;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {s && <IconChip icon={s.icon} tone={s.tone} size="lg" sticker className="hidden sm:inline-flex" />}
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{title ?? s?.title}</h1>
          {(description ?? s?.tagline) && <p className="text-muted-foreground">{description ?? s?.tagline}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
