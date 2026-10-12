// Always present above the chart: the path, one segment per chart; `main` alone while a program
// has no chart of a function.
import { t } from "@/i18n/t";

export function PathBar() {
  return (
    <nav
      aria-label={t("chart.path")}
      className="flex h-11 shrink-0 items-center gap-2 border-b bg-muted/40 px-4"
      data-testid="path-bar"
    >
      <span
        className="rounded-md border bg-background px-2 py-0.5 text-sm font-medium"
        data-testid="path-segment"
      >
        {t("chart.main")}
      </span>
    </nav>
  );
}
