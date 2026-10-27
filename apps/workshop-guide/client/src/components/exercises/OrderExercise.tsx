import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, useIsMobile } from '@databricks/appkit-ui/react';
import { ArrowDown, ArrowUp, GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { OrderStep } from '../../../../shared/guide-schema';
import { assembleOrder, checkOrder, seededShuffle, type OrderResult } from '../../lib/exercise';
import { useStoredState } from '../../lib/storage';
import { CopyButton } from '../CopyButton';

type ContainerId = 'pool' | 'answer';
interface Lists {
  pool: string[];
  answer: string[];
}

interface Props {
  step: OrderStep;
  storageKey: string;
  /** Called on every "Check order"; the parent counts attempts and records app-graded results. */
  onCheck: (result: OrderResult) => void;
  busy?: boolean;
  /** Where to paste the code in the notebook (shown next to Copy, notebook-checked steps only). */
  pasteHint?: ReactNode;
}

export function OrderExercise({ step, storageKey, onCheck, busy, pasteHint }: Props) {
  const isMobile = useIsMobile();
  const initial = useMemo<Lists>(
    () => ({ pool: seededShuffle(step.blocks.map((b) => b.id), step.id), answer: [] }),
    [step],
  );
  const [lists, setLists] = useStoredState<Lists>(storageKey, initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const codeById = useMemo(() => new Map(step.blocks.map((b) => [b.id, b.code])), [step.blocks]);

  // Guard against a stale stored layout after the guide changed.
  const valid =
    [...lists.pool, ...lists.answer].length === step.blocks.length &&
    [...lists.pool, ...lists.answer].every((id) => codeById.has(id));
  const current = valid ? lists : initial;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (next: Lists) => {
    setLists(next);
    setResult(null);
  };

  const containerOf = (id: string): ContainerId | null => {
    if (id === 'pool' || id === 'answer') return id;
    if (current.pool.includes(id)) return 'pool';
    if (current.answer.includes(id)) return 'answer';
    return null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    const item = String(active.id);
    const target = current[to];
    const overIndex = target.indexOf(String(over.id));
    const index = overIndex >= 0 ? overIndex : target.length;
    update({
      ...current,
      [from]: current[from].filter((id) => id !== item),
      [to]: [...target.slice(0, index), item, ...target.slice(index)],
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || from !== to) return;
    const list = current[from];
    const oldIndex = list.indexOf(String(active.id));
    const newIndex = list.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      update({ ...current, [from]: arrayMove(list, oldIndex, newIndex) });
    }
  };

  const moveTo = (id: string, to: ContainerId) => {
    const from = containerOf(id);
    if (!from || from === to) return;
    update({ ...current, [from]: current[from].filter((x) => x !== id), [to]: [...current[to], id] });
  };

  const nudge = (id: string, delta: -1 | 1) => {
    const list = current.answer;
    const i = list.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    update({ ...current, answer: arrayMove(list, i, j) });
  };

  const runCheck = () => {
    const r = checkOrder(step, current.answer);
    setResult(r);
    onCheck(r);
  };

  const firstLine = (id: string) => (codeById.get(id) ?? '').split('\n')[0].trim();

  return (
    <div className="space-y-3">
      {isMobile ? (
        <p className="text-sm text-muted-foreground">
          Tap <strong className="text-foreground">+</strong> to add a block to <strong className="text-foreground">Your solution</strong>,
          then use ↑ / ↓ to put the blocks in order and × to take one out.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Drag blocks into <strong className="text-foreground">Your solution</strong> and put them in order, or use the + / ↑ / ↓ / ×
          buttons. With the keyboard: focus a handle, press Space, move with the arrow keys, press Space again.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Stacked, not side by side: each code block gets the full width and keeps its line breaks. */}
        <div className="flex min-w-0 flex-col gap-4">
          <BlockList
            id="pool"
            title="Available blocks"
            ids={current.pool}
            codeById={codeById}
            emptyText="All blocks are in your solution."
            renderActions={(id) => (
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveTo(id, 'answer')} aria-label={`Add to solution: ${firstLine(id)}`}>
                <Plus className="size-4" aria-hidden />
              </Button>
            )}
          />
          <BlockList
            id="answer"
            title="Your solution"
            ids={current.answer}
            codeById={codeById}
            numbered
            emptyText="Drag blocks here."
            renderActions={(id, index) => (
              <>
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => nudge(id, -1)} aria-label={`Move up: ${firstLine(id)}`}>
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === current.answer.length - 1}
                  onClick={() => nudge(id, 1)}
                  aria-label={`Move down: ${firstLine(id)}`}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveTo(id, 'pool')} aria-label={`Remove from solution: ${firstLine(id)}`}>
                  <X className="size-4" aria-hidden />
                </Button>
              </>
            )}
          />
        </div>
        <DragOverlay>{activeId ? <BlockCard code={codeById.get(activeId) ?? ''} overlay /> : null}</DragOverlay>
      </DndContext>

      {result && (
        <div role="status" className={`wg-feedback ${result.pass ? 'wg-feedback-pass' : 'wg-feedback-fail'}`}>
          {result.message}
          {result.pass && step.check === 'notebook' && ' Copy the code to your notebook and run the check cell.'}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => update(initial)}>
          <RotateCcw className="size-4" aria-hidden /> Reset
        </Button>
        {step.check === 'notebook' && (
          <CopyButton
            text={assembleOrder(step, current.answer)}
            label="Copy to notebook"
            variant={result?.pass ? 'default' : 'outline'}
            disabled={current.answer.length === 0}
            title={current.answer.length === 0 ? 'Add blocks to your solution first' : undefined}
          />
        )}
        <Button type="button" onClick={runCheck} disabled={busy || current.answer.length === 0}>
          Check order
        </Button>
      </div>
      {pasteHint}
    </div>
  );
}

interface BlockListProps {
  id: ContainerId;
  title: string;
  ids: string[];
  codeById: Map<string, string>;
  emptyText: string;
  numbered?: boolean;
  renderActions: (id: string, index: number) => ReactNode;
}

function BlockList({ id, title, ids, codeById, emptyText, numbered, renderActions }: BlockListProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal">({ids.length})</span>
      </h4>
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={`wg-droparea flex min-h-24 flex-col gap-1.5 rounded-lg border border-dashed p-2 ${isOver ? 'wg-droparea-over' : ''}`}
        >
          {ids.length === 0 && <li className="m-auto px-2 py-4 text-center text-sm text-muted-foreground">{emptyText}</li>}
          {ids.map((blockId, index) => (
            <SortableBlock key={blockId} id={blockId} code={codeById.get(blockId) ?? ''} index={numbered ? index + 1 : undefined}>
              {renderActions(blockId, index)}
            </SortableBlock>
          ))}
        </ol>
      </SortableContext>
    </section>
  );
}

function SortableBlock({ id, code, index, children }: { id: string; code: string; index?: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : undefined}>
      <BlockCard
        code={code}
        index={index}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="wg-handle"
            aria-label={`Drag block: ${code.split('\n')[0]}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
        actions={<span className="ml-auto flex shrink-0 items-center">{children}</span>}
      />
    </li>
  );
}

interface BlockCardProps {
  code: string;
  index?: number;
  overlay?: boolean;
  handle?: ReactNode;
  actions?: ReactNode;
}

function BlockCard({ code, index, overlay, handle, actions }: BlockCardProps) {
  return (
    <div className={`wg-block flex items-start gap-2 ${overlay ? 'wg-block-overlay' : ''}`}>
      {handle}
      {index !== undefined && <span className="wg-block-index">{index}</span>}
      <code className="wg-block-code">{code}</code>
      {actions}
    </div>
  );
}
