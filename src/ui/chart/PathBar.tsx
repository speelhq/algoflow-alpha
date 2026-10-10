// Always present above the chart: `▾` lists the program's charts, then the path, one
// segment per chart. Both name `main` alone: the bar lists no function or class.
import { t } from "@/i18n/t";
import { Button } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";

export function PathBar() {
  return (
    <nav
      aria-label={t("chart.path")}
      className="flex h-11 shrink-0 items-center gap-2 border-b bg-muted/40 px-4"
      data-testid="path-bar"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label={t("chart.charts")} />}
        >
          {t("chart.chartsGlyph")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>{t("chart.main")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span
        className="rounded-md border bg-background px-2 py-0.5 text-sm font-medium"
        data-testid="path-segment"
      >
        {t("chart.main")}
      </span>
    </nav>
  );
}
