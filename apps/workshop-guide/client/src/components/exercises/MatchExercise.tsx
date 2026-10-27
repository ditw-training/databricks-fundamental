import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@databricks/appkit-ui/react';
import { Check, RotateCcw, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { MatchStep } from '../../../../shared/guide-schema';
import { checkMatch, seededShuffle, type MatchResult } from '../../lib/exercise';
import { useStoredState } from '../../lib/storage';

/** slot (pair index of the description) -> term (pair index of the term) */
type Assignment = Record<number, number | null>;

interface Props {
  step: MatchStep;
  storageKey: string;
  onCheck: (result: MatchResult) => void;
  busy?: boolean;
}

// No keyboard drag sensor here, so dnd-kit's default "press space to pick up" text would be wrong.
const MATCH_INSTRUCTIONS = {
  draggable: 'Press Enter to select this term, then choose a description and press Enter to place it. Mouse users can drag.',
};

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export function MatchExercise({ step, storageKey, onCheck, busy }: Props) {
  const n = step.pairs.length;
  const termOrder = useMemo(() => seededShuffle([...Array(n).keys()], `${step.id}:terms`), [n, step.id]);
  const slotOrder = useMemo(() => seededShuffle([...Array(n).keys()], `${step.id}:slots`), [n, step.id]);
  const [stored, setAssignment] = useStoredState<Assignment>(storageKey, {});
  const [selected, setSelected] = useState<number | null>(null);
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  // Drop entries that do not fit the current guide (it may have changed).
  const assignment: Assignment = {};
  for (const [slot, term] of Object.entries(stored)) {
    const s = Number(slot);
    if (s < n && term !== null && term < n) assignment[s] = term;
  }
  const placed = new Set(Object.values(assignment).filter((t): t is number => t !== null));
  const bank = termOrder.filter((t) => !placed.has(t));

  // Keyboard users select a term and then a description (buttons); a keyboard drag sensor
  // would swallow Enter/Space on those buttons.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const place = (term: number, slot: number | 'bank') => {
    const next: Assignment = {};
    for (const [s, t] of Object.entries(assignment)) if (t !== term) next[Number(s)] = t;
    if (slot !== 'bank') next[slot] = term; // a term already in the slot goes back to the bank
    setAssignment(next);
    setSelected(null);
    setResult(null);
  };

  const onDragStart = (e: DragStartEvent) => setActiveTerm(Number(String(e.active.id).slice(5)));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTerm(null);
    if (!over) return;
    const term = Number(String(active.id).slice(5));
    const target = String(over.id);
    place(term, target === 'bank' ? 'bank' : Number(target.slice(5)));
  };

  const runCheck = () => {
    const r = checkMatch(step, assignment);
    setResult(r);
    onCheck(r);
  };

  const allPlaced = placed.size === n;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag each term onto its description, or tap a term and then tap <strong className="text-foreground">Place here</strong>{' '}
        next to its description.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveTerm(null)}
        accessibility={{ screenReaderInstructions: MATCH_INSTRUCTIONS }}
      >
        <TermBank>
          {bank.length === 0 ? (
            <span className="px-2 py-1 text-sm text-muted-foreground">All terms placed.</span>
          ) : (
            bank.map((t) => (
              <TermChip
                key={t}
                term={t}
                label={step.pairs[t].left}
                selected={selected === t}
                onSelect={() => setSelected(selected === t ? null : t)}
              />
            ))
          )}
        </TermBank>

        <ul className="grid gap-2">
          {slotOrder.map((slot) => {
            const term = assignment[slot] ?? null;
            const verdict = result && term !== null ? result.slotCorrect[slot] : undefined;
            return (
              <Slot
                key={slot}
                slot={slot}
                description={step.pairs[slot].right}
                canPlace={selected !== null}
                onPlace={() => selected !== null && place(selected, slot)}
                verdict={verdict}
              >
                {term !== null ? (
                  <TermChip
                    term={term}
                    label={step.pairs[term].left}
                    selected={selected === term}
                    onSelect={() => setSelected(selected === term ? null : term)}
                    onRemove={() => place(term, 'bank')}
                  />
                ) : null}
              </Slot>
            );
          })}
        </ul>
        <DragOverlay>{activeTerm !== null ? <span className="wg-chip wg-chip-overlay">{step.pairs[activeTerm].left}</span> : null}</DragOverlay>
      </DndContext>

      {result && (
        <div role="status" className={`wg-feedback ${result.pass ? 'wg-feedback-pass' : 'wg-feedback-fail'}`}>
          {result.message}
          {!result.pass && ' Wrong pairs are marked; move them and check again.'}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAssignment({});
            setResult(null);
            setSelected(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reset
        </Button>
        <Button type="button" onClick={runCheck} disabled={busy || !allPlaced} title={allPlaced ? undefined : 'Place every term first'}>
          Check pairs
        </Button>
      </div>
    </div>
  );
}

function TermBank({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bank' });
  return (
    <div
      ref={setNodeRef}
      aria-label="Terms"
      role="group"
      className={`wg-droparea flex min-h-14 flex-wrap gap-2 rounded-lg border border-dashed p-2 ${isOver ? 'wg-droparea-over' : ''}`}
    >
      {children}
    </div>
  );
}

interface TermChipProps {
  term: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

function TermChip({ term, label, selected, onSelect, onRemove }: TermChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `term-${term}` });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`wg-chip ${selected ? 'wg-chip-selected' : ''} ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* aria-roledescription "draggable" is dropped: keyboard users select, they do not drag. */}
      <button
        {...attributes}
        aria-roledescription={undefined}
        {...listeners}
        type="button" className="wg-chip-label" aria-pressed={selected} onClick={onSelect}>
        {label}
      </button>
      {onRemove && (
        <button type="button" className="wg-chip-remove" onClick={onRemove} aria-label={`Move ${label} back to terms`}>
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

interface SlotProps {
  slot: number;
  description: string;
  canPlace: boolean;
  onPlace: () => void;
  verdict?: boolean;
  children?: ReactNode;
}

function Slot({ slot, description, canPlace, onPlace, verdict, children }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
  const tone = verdict === true ? 'wg-slot-pass' : verdict === false ? 'wg-slot-fail' : '';
  return (
    <li ref={setNodeRef} className={`wg-slot ${tone} ${isOver ? 'wg-droparea-over' : ''}`}>
      <div className="wg-slot-target">
        {/* Test truthiness, not `??`: a `false` child must still show the empty drop target. */}
        {children ? (
          children
        ) : (
          <button type="button" className="wg-slot-empty" disabled={!canPlace} onClick={onPlace} aria-label={`Place selected term on: ${description}`}>
            {canPlace ? 'Place here' : 'Drop a term'}
          </button>
        )}
        {children && canPlace && (
          <button type="button" className="wg-slot-swap" onClick={onPlace} aria-label={`Replace with selected term: ${description}`}>
            Swap
          </button>
        )}
      </div>
      <p className="text-sm leading-snug">{description}</p>
      {verdict !== undefined && (
        <span className="ml-auto shrink-0">
          {verdict ? <Check className="size-4 text-[var(--success)]" aria-hidden /> : <X className="size-4 text-[var(--destructive)]" aria-hidden />}
          <span className="sr-only">{verdict ? 'Correct' : 'Incorrect'}</span>
        </span>
      )}
    </li>
  );
}
