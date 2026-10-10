// The 52 px header of the Problems, Playground, and Modules pages: the app name, the
// three page tabs, and Help. It has no JA/EN switch while `en.json` is the only catalog.
import { useState } from "react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { HelpDialog } from "./HelpDialog";
import { routeHash, type Route } from "./route";

type Tab = "problems" | "playground" | "modules";
const TABS: ReadonlyArray<{ tab: Tab; route: Route }> = [
  { tab: "problems", route: { page: "problems" } },
  { tab: "playground", route: { page: "playground" } },
  { tab: "modules", route: { page: "modules" } },
];

export function Header({ current }: { current: Tab }) {
  const [help, setHelp] = useState(false);
  return (
    <header className="flex h-13 shrink-0 items-center gap-8 border-b px-6" data-testid="header">
      <span className="text-lg font-semibold">{t("app.name")}</span>
      <nav aria-label={t("app.nav.label")} className="flex h-full items-stretch gap-6">
        {TABS.map(({ tab, route }) => (
          <a
            key={tab}
            href={routeHash(route)}
            aria-current={tab === current ? "page" : undefined}
            className={cn(
              "flex items-center border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground",
              tab === current && "border-foreground font-medium text-foreground",
            )}
          >
            {t(`app.nav.${tab}`)}
          </a>
        ))}
      </nav>
      <Button
        variant="outline"
        size="icon"
        className="ml-auto"
        aria-label={t("app.help.open")}
        onClick={() => setHelp(true)}
      >
        {t("app.help.glyph")}
      </Button>
      <HelpDialog open={help} onOpenChange={setHelp} />
    </header>
  );
}
