import { t } from "@/i18n/t";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";
import { PlaygroundPage } from "@/ui/playground/PlaygroundPage";
import { ProgramPage } from "@/ui/playground/ProgramPage";
import { ProblemPage } from "@/ui/problem/ProblemPage";
import { ProblemsPage } from "@/ui/problems/ProblemsPage";
import { StubPage } from "@/ui/stubs/StubPage";
import { useRoute, type Route } from "./route";

// Desktop browsers at 1280 px or more; narrower viewports show app.desktopOnly and no editor.
export function App() {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const route = useRoute();
  if (!desktop) {
    return (
      <div
        data-testid="desktop-only"
        className="flex h-screen items-center justify-center p-8 text-center text-muted-foreground"
      >
        {t("app.desktopOnly")}
      </div>
    );
  }
  return (
    <div data-testid="shell" className="h-screen w-screen bg-background text-foreground">
      <Page route={route} />
    </div>
  );
}

/** One page per route; the Modules page is a stub. */
function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "problems":
      return <ProblemsPage />;
    case "problem":
      return <ProblemPage key={route.id} id={route.id} />;
    case "playground":
      return <PlaygroundPage />;
    case "program":
      return <ProgramPage key={route.id} id={route.id} />;
    case "modules":
    case "module":
      return <StubPage />;
  }
}
