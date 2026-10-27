import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Progress,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { ArrowRight, ListChecks, NotebookPen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Guide } from '../../../shared/guide-schema';
import { Markdown } from '../components/Markdown';
import { StatusDot } from '../components/StatusDot';
import { StepPane } from '../components/StepPane';
import { TYPE_LABEL } from '../lib/labels';
import { useParticipantProgress, type ParticipantRow } from '../lib/progress';
import { formatAgo, parseTs, toStatus } from '../lib/status';

export function ParticipantPage({ guides, email }: { guides: Guide[]; email: string }) {
  const [params, setParams] = useSearchParams();
  const wsParam = params.get('ws');
  const guide = guides.find((g) => g.id === wsParam) ?? (guides.length === 1 ? guides[0] : undefined);

  if (!guide) {
    return (
      <WorkshopPicker
        guides={guides}
        unknown={wsParam}
        onPick={(id) => setParams({ ws: id })}
      />
    );
  }
  return <WorkshopView key={guide.id} guide={guide} email={email} />;
}

function WorkshopPicker({ guides, unknown, onPick }: { guides: Guide[]; unknown: string | null; onPick: (id: string) => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Choose your workshop</h2>
        <p className="text-muted-foreground">
          Open the matching notebook next to this guide. You write and run the code there; this guide explains each step and shows
          your progress.
        </p>
      </div>
      {unknown && <p className="text-sm text-[var(--destructive)]">Workshop “{unknown}” does not exist. Pick one below.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => {
          const required = g.steps.filter((s) => !s.optional).length;
          return (
            <Card key={g.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{g.title}</CardTitle>
                <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3.5" aria-hidden /> {required} steps
                    {g.steps.length > required ? ` + ${g.steps.length - required} optional` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <NotebookPen className="size-3.5" aria-hidden /> {g.notebook.split('/').pop()}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <Markdown className="text-sm text-muted-foreground">{g.intro}</Markdown>
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={() => onPick(g.id)}>
                  Open {g.title.replace(/^Workshop\s*[—-]\s*/i, '')} <ArrowRight className="size-4" aria-hidden />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function newer(a: ParticipantRow | undefined, b: ParticipantRow | undefined) {
  if (!a) return b;
  if (!b) return a;
  return (parseTs(a.ts)?.getTime() ?? 0) >= (parseTs(b.ts)?.getTime() ?? 0) ? a : b;
}

function WorkshopView({ guide, email }: { guide: Guide; email: string }) {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [stepsOpen, setStepsOpen] = useState(false);
  const progress = useParticipantProgress(guide.id);
  const [local, setLocal] = useState<Record<string, ParticipantRow>>({});

  const rows = useMemo(() => {
    const byStep = new Map<string, ParticipantRow>();
    for (const r of progress.rows ?? []) byStep.set(r.step, r);
    for (const [step, r] of Object.entries(local)) byStep.set(step, newer(byStep.get(step), r) ?? r);
    return byStep;
  }, [progress.rows, local]);

  const stepIndex = Math.max(
    0,
    guide.steps.findIndex((s) => s.id === params.get('step')),
  );
  const step = guide.steps[stepIndex];

  const required = guide.steps.filter((s) => !s.optional);
  const passedRequired = required.filter((s) => toStatus(rows.get(s.id)?.status) === 'pass').length;
  const pct = required.length ? Math.round((passedRequired / required.length) * 100) : 0;

  const goTo = (id: string) => {
    setParams({ ws: guide.id, step: id });
    setStepsOpen(false);
    window.scrollTo({ top: 0 });
  };

  const stepList = (
    <nav aria-label="Workshop steps" className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            {passedRequired} / {required.length} steps passed
          </span>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} aria-label="Required steps passed" />
        <p className="text-xs text-muted-foreground">
          {progress.rows === null && !progress.error
            ? 'Loading your progress…'
            : progress.error
              ? 'Live status paused — retrying'
              : `Live · updated ${formatAgo(progress.updatedAt)}`}
        </p>
      </div>
      <ol className="flex flex-col gap-0.5">
        {guide.steps.map((s, i) => {
          const status = toStatus(rows.get(s.id)?.status);
          const active = s.id === step.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={active ? 'step' : undefined}
                className={`wg-steplink ${active ? 'wg-steplink-active' : ''}`}
              >
                <StatusDot status={status} />
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {TYPE_LABEL[s.type]}
                    {s.optional ? ' · optional' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{guide.title}</h2>
        <Badge variant="secondary" className="font-mono text-xs">
          {guide.notebook.split('/').pop()}
        </Badge>
        {isMobile && (
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setStepsOpen(true)}>
            <ListChecks className="size-4" aria-hidden /> Steps ({passedRequired}/{required.length})
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
        {!isMobile && (
          <aside className="wg-sidebar sticky top-4 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-xl border bg-card p-4">
            {stepList}
          </aside>
        )}
        <div className="min-w-0">
          {step ? (
            <StepPane
              key={`${guide.id}:${step.id}`}
              guide={guide}
              step={step}
              index={stepIndex}
              email={email}
              row={rows.get(step.id)}
              progressError={progress.error}
              onLocalResult={(r) => setLocal((prev) => ({ ...prev, [r.step]: r }))}
              onNavigate={goTo}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No steps</EmptyTitle>
                <EmptyDescription>This workshop has no steps yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <Sheet open={stepsOpen && isMobile} onOpenChange={setStepsOpen}>
        <SheetContent side="left" className="overflow-y-auto p-4">
          <SheetHeader className="px-0">
            <SheetTitle>{guide.title}</SheetTitle>
          </SheetHeader>
          {stepList}
        </SheetContent>
      </Sheet>
    </div>
  );
}
