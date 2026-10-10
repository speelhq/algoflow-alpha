// The Modules page: the shared header over a placeholder.
import { t } from "@/i18n/t";
import { Header } from "@/ui/app/Header";
import { useTitle } from "@/ui/hooks/useTitle";

export function StubPage() {
  const page = "modules";
  const title = t("modules.title");
  useTitle(title);
  return (
    <div className="flex h-full flex-col">
      <Header current={page} />
      <main className="px-6 py-4" data-testid={page}>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground">{t("modules.stub")}</p>
      </main>
    </div>
  );
}
