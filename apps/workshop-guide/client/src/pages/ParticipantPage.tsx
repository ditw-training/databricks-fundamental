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
  EmptyMedia,
  EmptyTitle,
  Progress,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { ArrowLeft, ArrowRight, CodeXml, Database, ListChecks, Lock, Route } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  sortGuides,
  workshopLabel,
  workshopShortLabel,
  workshopTopic,
  TRACKS,
  type Guide,
  type LockedGuide,
  type Track,
} from '../../../shared/guide-schema';
import { Markdown } from '../components/Markdown';
import { NotebookLocation } from '../components/NotebookLocation';
import { ResetProgress } from '../components/ResetProgress';
import { StatusDot } from '../components/StatusDot';
import { StepPane } from '../components/StepPane';
import { useI18n } from '../i18n/context';
import { stepTypeLabel } from '../lib/labels';
import { useTrack } from '../lib/track';
import { useParticipantProgress, type ParticipantRow } from '../lib/progress';
import { formatAgo, parseTs, toStatus } from '../lib/status';
import { clearStoredPrefix, stepKey } from '../lib/storage';
import type { UnlockItem, UnlockView } from '../lib/unlock';

interface Props {
  guides: Guide[];
  locked: LockedGuide[];
  unlock: UnlockView;
  email: string;
  isTrainer: boolean;
}

export function ParticipantPage({ guides, locked, unlock, email, isTrainer }: Props) {
  const [params, setParams] = useSearchParams();
  const wsParam = params.get('ws');
  const guide = guides.find((g) => g.id === wsParam);
  const lockedGuide = locked.find((g) => g.id === wsParam);
  // Trainers see every item open; their home page marks the ones participants still see locked.
  const lockedForParticipants = (id: string) => {
    const row = unlock.rows?.[id as UnlockItem];
    return isTrainer && row !== undefined && !row.on;
  };

  // Inside a workshop the trainer has just locked (or a link to a locked one).
  if (lockedGuide) return <LockedNotice guide={lockedGuide} onBack={() => setParams({})} />;
  if (!guide) {
    return (
      <WorkshopPicker
        guides={guides}
        locked={locked}
        quizOpen={unlock.open('quiz')}
        lockedForParticipants={lockedForParticipants}
        unknown={wsParam}
        onPick={(id) => setParams({ ws: id })}
      />
    );
  }
  return <WorkshopView key={guide.id} guide={guide} email={email} />;
}

/** Shown in place of a workshop that is locked for the participant. */
function LockedNotice({ guide, onBack }: { guide: LockedGuide; onBack: () => void }) {
  const { lang, m } = useI18n();
  return (
    <Empty className="mx-auto mt-8 max-w-xl rounded-xl border" role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock aria-hidden />
        </EmptyMedia>
        <EmptyTitle>
          {workshopLabel(guide, lang)}: {m.lockedNowTitle}
        </EmptyTitle>
        <EmptyDescription>{m.lockedNowText}</EmptyDescription>
      </EmptyHeader>
      <Button type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> {m.backToWorkshops}
      </Button>
    </Empty>
  );
}

function LockedCard({ title }: { title: string }) {
  const { m } = useI18n();
  return (
    // self-start: keeps its own height next to a tall open card.
    <Card className="self-start border-dashed bg-muted/30" aria-label={`${title}: ${m.lockedBadge}`}>
      <CardHeader>
        {/* The lock icon and the sentence say "locked"; the aria-label above carries the word. */}
        <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{m.lockedText}</p>
      </CardContent>
    </Card>
  );
}

/** Card title; for trainers also a badge while participants still see the item locked. */
function ItemTitle({ title, trainerLocked }: { title: string; trainerLocked: boolean }) {
  const { m } = useI18n();
  return (
    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
      {title}
      {trainerLocked && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          <Lock aria-hidden /> {m.lockedForParticipants}
        </Badge>
      )}
    </CardTitle>
  );
}

type PickerItem = { kind: 'guide'; guide: Guide } | { kind: 'locked'; guide: LockedGuide };

function WorkshopPicker({
  guides,
  locked,
  quizOpen,
  lockedForParticipants,
  unknown,
  onPick,
}: {
  guides: Guide[];
  locked: LockedGuide[];
  quizOpen: boolean;
  lockedForParticipants: (id: string) => boolean;
  unknown: string | null;
  onPick: (id: string) => void;
}) {
  const { lang, m } = useI18n();
  const navigate = useNavigate();
  // Order of the day: I, II (open or locked), then III — Quiz.
  const items: PickerItem[] = sortGuides<Guide | LockedGuide>([...guides, ...locked]).map((g) =>
    'locked' in g ? { kind: 'locked', guide: g } : { kind: 'guide', guide: g }
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{m.pickerTitle}</h2>
        <p className="text-muted-foreground">{m.pickerIntro}</p>
      </div>
      {unknown && <p className="text-sm text-[var(--destructive)]">{m.unknownWorkshop(unknown)}</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          if (item.kind === 'locked') return <LockedCard key={item.guide.id} title={workshopLabel(item.guide, lang)} />;
          const g = item.guide;
          const required = g.steps.filter((s) => !s.optional).length;
          return (
            <Card key={g.id} className="flex flex-col">
              <CardHeader>
                <ItemTitle title={workshopLabel(g, lang)} trainerLocked={lockedForParticipants(g.id)} />
                <CardDescription className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3.5" aria-hidden /> {m.stepCount(required, g.steps.length - required)}
                  </span>
                  <NotebookLocation guide={g} />
                  {g.steps.some((s) => s.type === 'tracks') && (
                    <span className="inline-flex items-center gap-1">
                      <Route className="size-3.5" aria-hidden /> {m.pickerTrackHint}
                    </span>
                  )}
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
        {quizOpen ? (
          <Card className="flex flex-col">
            <CardHeader>
              <ItemTitle title={m.quizItemTitle} trainerLocked={lockedForParticipants('quiz')} />
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground">{m.quizItemIntro}</p>
            </CardContent>
            <CardFooter>
              <Button type="button" onClick={() => void navigate('/quiz')}>
                {m.openQuiz} <ArrowRight className="size-4" aria-hidden />
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <LockedCard title={m.quizItemTitle} />
        )}
      </div>
    </div>
  );
}

/** The row to show: a pass wins (a step counts once, in any track), else the newer row. */
function newer(a: ParticipantRow | undefined, b: ParticipantRow | undefined) {
  if (!a) return b;
  if (!b) return a;
  const aPass = toStatus(a.status) === 'pass';
  const bPass = toStatus(b.status) === 'pass';
  if (aPass !== bPass) return aPass ? a : b;
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
  const [track, setTrack, trackChosen] = useTrack(email, guide.id);
  const hasTracks = guide.steps.some((s) => s.type === 'tracks');

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
  const passedOptional = guide.steps.filter((s) => s.optional && toStatus(rows.get(s.id)?.status) === 'pass').length;

  const goTo = (id: string) => {
    setParams({ ws: guide.id, step: id });
    setStepsOpen(false);
    window.scrollTo({ top: 0 });
  };

  const stepList = (
    <nav aria-label={m.workshopSteps} className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            {m.stepsPassed(passedRequired, required.length)}
            {passedOptional > 0 && <span className="font-normal text-muted-foreground"> {m.optionalPassed(passedOptional)}</span>}
          </span>
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
                    {stepTypeLabel(s, m, track)}
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasTracks && <TrackSwitch track={track} onChange={setTrack} />}
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
          {hasTracks && !trackChosen ? (
            <TrackChooser onPick={setTrack} />
          ) : step ? (
            <StepPane
              key={`${guide.id}:${step.id}:${resetGen}`}
              guide={guide}
              step={step}
              index={stepIndex}
              email={email}
              track={track}
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

/** First entry to a workshop without a stored track: ask once, with what each track means. */
function TrackChooser({ onPick }: { onPick: (t: Track) => void }) {
  const { m } = useI18n();
  const options: { track: Track; icon: typeof Database; text: string }[] = [
    { track: 'sql', icon: Database, text: m.trackSqlDesc },
    { track: 'pyspark', icon: CodeXml, text: m.trackPysparkDesc },
  ];
  return (
    <section aria-labelledby="track-choose-title" className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="space-y-1">
        <h2 id="track-choose-title" className="text-2xl font-semibold tracking-tight">
          {m.trackChooseTitle}
        </h2>
        <p className="text-muted-foreground">{m.trackChooseIntro}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ track, icon: Icon, text }) => (
          <Card key={track} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="size-5 text-muted-foreground" aria-hidden /> {m.trackName(track)}
              </CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button type="button" onClick={() => onPick(track)}>
                {m.trackChooseButton(m.trackName(track))} <ArrowRight className="size-4" aria-hidden />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** SQL | PySpark (SPEC section 11): remembered per workshop, can be changed at any time. */
function TrackSwitch({ track, onChange }: { track: Track; onChange: (t: Track) => void }) {
  const { m } = useI18n();
  return (
    <div className="flex items-center gap-2" title={m.trackHelp}>
      <span className="text-xs text-muted-foreground" id="track-label">
        {m.track}
      </span>
      <div role="group" aria-labelledby="track-label" aria-describedby="track-help" className="inline-flex rounded-md border p-0.5">
        {TRACKS.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={t === track ? 'default' : 'ghost'}
            className="h-7 px-3"
            aria-pressed={t === track}
            onClick={() => onChange(t)}
          >
            {m.trackName(t)}
          </Button>
        ))}
      </div>
      <span id="track-help" className="sr-only">
        {m.trackHelp}
      </span>
    </div>
  );
}
