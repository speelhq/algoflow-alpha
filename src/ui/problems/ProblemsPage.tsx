// One section per study plan, in plan order; the status marks and plan counts come from
// progress.
import { challengesOf, getChallenge, PLANS, type Challenge, type Plan } from "@/challenges";
import { planAction, type Status } from "@/challenges/next";
import { localized, t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { solvedCount, statusOf, useProgress, type Progress } from "@/store/progress";
import { Header } from "@/ui/app/Header";
import { routeHash } from "@/ui/app/route";
import { useTitle } from "@/ui/hooks/useTitle";
import { buttonVariants } from "@/ui/primitives/button";

export function ProblemsPage() {
  useTitle(t("problems.title"));
  const entries = useProgress((s) => s.entries);
  return (
    <div className="flex h-full flex-col">
      <Header current="problems" />
      <main className="flex-1 overflow-y-auto px-6 py-4" data-testid="problems">
        {PLANS.map((plan) => (
          <PlanSection key={plan.id} plan={plan} entries={entries} />
        ))}
      </main>
    </div>
  );
}

function PlanSection({ plan, entries }: { plan: Plan; entries: Progress }) {
  const { problems } = plan;
  const status: Status = (id) => statusOf(entries, id);
  const action = planAction(problems, status);
  const solved = solvedCount(entries, problems);
  const next = action && getChallenge(action.id);
  return (
    <section className="mb-6" data-testid={`plan-${plan.id}`}>
      <div className="flex items-center gap-4 rounded-xl border bg-muted/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{localized(plan.title)}</h2>
          <p className="text-sm text-muted-foreground">{localized(plan.description)}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          {t("problems.solved", { n: solved, m: problems.length })}
        </span>
        {action && (
          <a
            href={routeHash({ page: "problem", id: action.id })}
            className={buttonVariants({
              variant: action.kind === "continue" ? "default" : "outline",
            })}
          >
            {action.kind === "continue" && next
              ? t("problems.continue", { title: localized(next.title) })
              : t("problems.start")}
          </a>
        )}
      </div>
      <ul className="mt-1">
        {challengesOf(plan).map((challenge) => (
          <ProblemRow key={challenge.id} challenge={challenge} mark={status(challenge.id)} />
        ))}
      </ul>
    </section>
  );
}

/** Status mark, title, difficulty, topic tags; the row opens the Problem page. */
function ProblemRow({ challenge, mark }: { challenge: Challenge; mark: ReturnType<Status> }) {
  return (
    <li className="border-b">
      <a
        href={routeHash({ page: "problem", id: challenge.id })}
        className="grid grid-cols-[2rem_1fr_8rem_20rem] items-center gap-2 px-2 py-1.5 hover:bg-muted/60"
        data-testid={`problem-${challenge.id}`}
      >
        <span
          role="img"
          aria-label={t(`problems.status.${mark ?? "untouched"}`)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full border text-sm",
            mark === "solved" && "border-solved bg-solved text-solved-foreground",
            mark === "attempted" && "border-attempted text-attempted",
          )}
        >
          {mark ? t(`problems.mark.${mark}`) : ""}
        </span>
        <span>{localized(challenge.title)}</span>
        <span className="text-sm text-muted-foreground">
          {t(`problems.difficulty.${challenge.difficulty}`)}
        </span>
        <span className="flex flex-wrap gap-1">
          {challenge.topics.map((topic) => (
            <span key={topic} className="rounded-full border px-2 text-xs text-muted-foreground">
              {t(`problems.topic.${topic}`)}
            </span>
          ))}
        </span>
      </a>
    </li>
  );
}
