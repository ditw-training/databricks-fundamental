import {
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
import { ArrowRight, ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { workshopLabel, workshopShortLabel, workshopTopic, type Guide } from '../../../shared/guide-schema';
import { Markdown } from '../components/Markdown';
import { NotebookLocation } from '../components/NotebookLocation';
import { ResetProgress } from '../components/ResetProgress';
import { StatusDot } from '../components/StatusDot';
import { StepPane } from '../components/StepPane';
import { useI18n } from '../i18n/context';
import { typeLabel } from '../lib/labels';
import { useParticipantProgress, type ParticipantRow } from '../lib/progress';
import { formatAgo, parseTs, toStatus } from '../lib/status';
import { clearStoredPrefix, stepKey } from '../lib/storage';

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
  const { lang, m } = useI18n();
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{m.pickerTitle}</h2>
        <p className="text-muted-foreground">{m.pickerIntro}</p>
      </div>
      {unknown && <p className="text-sm text-[var(--destructive)]">{m.unknownWorkshop(unknown)}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => {
          const required = g.steps.filter((s) => !s.optional).length;
          return (
            <Card key={g.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{workshopLabel(g, lang)}</CardTitle>
                <CardDescription className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3.5" aria-hidden /> {m.stepCount(required, g.steps.length - required)}
                  </span>
                  <NotebookLocation guide={g} />
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <Markdown className="text-sm text-muted-foreground">{g.intro}</Markdown>
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={() => onPick(g.id)}>
                  {m.openWorkshop(workshopShortLabel(g, lang) ?? workshopTopic(g))} <ArrowRight className="size-4" aria-hidden />
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
  const { lang, m } = useI18n();
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [stepsOpen, setStepsOpen] = useState(false);
  const progress = useParticipantProgress(guide.id);
  const [local, setLocal] = useState<Record<string, ParticipantRow>>({});
  // After "Reset my progress": ignore polled rows requested before the reset.
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [resetGen, setResetGen] = useState(0);
  const label = workshopLabel(guide, lang);

  const rows = useMemo(() => {
    const byStep = new Map<string, ParticipantRow>();
    const stale = resetAt !== null && (progress.requestedAt === null || progress.requestedAt < resetAt);
    for (const r of stale ? [] : (progress.rows ?? [])) byStep.set(r.step, r);
    for (const [step, r] of Object.entries(local)) byStep.set(step, newer(byStep.get(step), r) ?? r);
    return byStep;
  }, [progress.rows, progress.requestedAt, resetAt, local]);

  const afterReset = () => {
    setLocal({});
    setResetAt(new Date());
    // Hint and attempt counters of this workshop start again; typed code is kept.
    clearStoredPrefix(stepKey(email, guide.id, '', '').replace(/::$/, ':'), [':hints', ':attempts']);
    setResetGen((n) => n + 1);
  };

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
    <nav aria-label={m.workshopSteps} className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{m.stepsPassed(passedRequired, required.length)}</span>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} aria-label={m.requiredPassed} />
        <p className="text-xs text-muted-foreground">
          {progress.rows === null && !progress.error
            ? m.progressLoading
            : progress.error
              ? m.progressPaused
              : m.progressLive(formatAgo(progress.updatedAt, undefined, lang))}
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
                  <span className="line-clamp-2 block" title={s.title}>
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {typeLabel(s.type, m)}
                    {s.optional ? ` · ${m.optional}` : ''}
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
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-lg font-semibold">{label}</h2>
          <NotebookLocation guide={guide} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ResetProgress workshop={guide.id} label={label} onReset={afterReset} />
          {isMobile && (
            <Button type="button" variant="outline" size="sm" onClick={() => setStepsOpen(true)}>
              <ListChecks className="size-4" aria-hidden /> {m.stepsButton(passedRequired, required.length)}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        {!isMobile && (
          <aside className="wg-sidebar sticky top-4 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-xl border bg-card p-4">
            {stepList}
          </aside>
        )}
        <div className="min-w-0">
          {step ? (
            <StepPane
              key={`${guide.id}:${step.id}:${resetGen}`}
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
                <EmptyTitle>{m.noStepsTitle}</EmptyTitle>
                <EmptyDescription>{m.noStepsText}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <Sheet open={stepsOpen && isMobile} onOpenChange={setStepsOpen}>
        <SheetContent side="left" className="overflow-y-auto p-4">
          <SheetHeader className="px-0">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          {stepList}
        </SheetContent>
      </Sheet>
    </div>
  );
}
