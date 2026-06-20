import { ThemeToggle } from "./theme-toggle.js";

export function PageHeader() {
  return (
    <header className="flex min-h-18 items-center justify-between">
      <a
        className="inline-flex items-center gap-2 text-[var(--text-label)] font-semibold text-foreground no-underline"
        href="/"
        aria-label="LumaLingo, início"
      >
        <span
          className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          L
        </span>
        LumaLingo
      </a>
      <ThemeToggle />
    </header>
  );
}
