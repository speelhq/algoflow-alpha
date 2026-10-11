// A case is shown by its inputs, `n = 15` or `a = 3, b = 9, c = 5`, with
// values written as the blocks write them.
import { t } from "@/i18n/t";
import type { Data, Id } from "@/lang/types";
import { dataText } from "@/ui/chart/text";

export function caseText(inputs: Record<Id, Data>): string {
  return Object.entries(inputs)
    .map(([name, value]) => t("problem.assignment", { name, value: dataText(value) }))
    .join(t("chart.listSeparator"));
}
