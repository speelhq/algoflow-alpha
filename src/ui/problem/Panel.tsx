// The left region: the `Problem`, `Result`, and `Python` tabs (no `Problem` without a
// challenge), resizable
// from 280 px to half the viewport, collapsible to a 40 px rail; width and state persist.
import type { Challenge } from "@/challenges";
import { t } from "@/i18n/t";
import { tabsOf, useEditor, type PanelTab } from "@/store/editor";
import { panelWidth, useLayout } from "@/store/layout";
import { ResizeHandle } from "@/ui/app/ResizeHandle";
import { useViewportWidth } from "@/ui/hooks/useViewportWidth";
import { Button } from "@/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { ProblemTab } from "./ProblemTab";
import { PythonTab } from "./PythonTab";
import { ResultTab } from "./ResultTab";

export function Panel({ challenge }: { challenge?: Challenge }) {
  const tabs = tabsOf(challenge !== undefined);
  const isPanelTab = (value: unknown): value is PanelTab => tabs.some((tab) => tab === value);
  const tab = useEditor((s) => s.tab);
  const setTab = useEditor((s) => s.setTab);
  const panel = useLayout((s) => s.panel);
  const collapsed = useLayout((s) => s.collapsed);
  const setPanel = useLayout((s) => s.setPanel);
  const setCollapsed = useLayout((s) => s.setCollapsed);
  const width = panelWidth(panel, useViewportWidth());

  if (collapsed) {
    return (
      <aside
        aria-label={t("problem.panel.label")}
        className="flex w-10 shrink-0 flex-col items-center border-r py-2"
        data-testid="panel"
        data-collapsed
      >
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("problem.panel.expand")}
          onClick={() => setCollapsed(false)}
        >
          {t("problem.panel.expandGlyph")}
        </Button>
      </aside>
    );
  }

  return (
    <>
      <aside
        aria-label={t("problem.panel.label")}
        className="flex min-h-0 shrink-0 flex-col"
        style={{ width }}
        data-testid="panel"
      >
        <Tabs
          value={tab}
          onValueChange={(value) => isPanelTab(value) && setTab(value)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex h-11 shrink-0 items-center border-b px-3">
            <TabsList variant="line">
              {tabs.map((name) => (
                <TabsTrigger key={name} value={name} data-testid={`tab-${name}`}>
                  {t(`problem.tabs.${name}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              variant="outline"
              size="icon-sm"
              className="ml-auto"
              aria-label={t("problem.panel.collapse")}
              onClick={() => setCollapsed(true)}
            >
              {t("problem.panel.collapseGlyph")}
            </Button>
          </div>
          {challenge && (
            <TabsContent value="problem" className="min-h-0 overflow-y-auto p-4">
              <ProblemTab challenge={challenge} />
            </TabsContent>
          )}
          <TabsContent value="result" className="min-h-0 overflow-y-auto p-4">
            <ResultTab challenge={challenge} />
          </TabsContent>
          <TabsContent value="python" className="min-h-0 overflow-y-auto p-4">
            <PythonTab />
          </TabsContent>
        </Tabs>
      </aside>
      <ResizeHandle
        label={t("problem.panel.resize")}
        testId="panel-resize"
        size={width}
        onResize={(start, delta) => setPanel(start + delta, window.innerWidth)}
      />
    </>
  );
}
