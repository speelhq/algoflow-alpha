// The node's name field: one line in the learner's words, stored trimmed.
import { useState } from "react";
import { t } from "@/i18n/t";
import { setStmtName, stmtName } from "@/lang/edit";
import type { Stmt } from "@/lang/types";
import { apply } from "./edits";

export function NameOfNode({ stmt }: { stmt: Stmt }) {
  const stored = stmt.name ?? "";
  const [draft, setDraft] = useState(stored);
  // An undo changes the stored name under the field.
  if (stmtName(draft) !== stored) setDraft(stored);
  return (
    <label className="flex h-9 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:border-selection">
      <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {t("editor.name")}
      </span>
      <input
        value={draft}
        placeholder={t("editor.nameHint")}
        aria-label={t("editor.name")}
        data-testid="node-name"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          const next = event.target.value.replace(/[\r\n]+/g, " ");
          setDraft(next);
          apply((p) => setStmtName(p, stmt.id, next), `${stmt.id}:name`);
        }}
      />
    </label>
  );
}
