import { useEffect, useRef, type ReactNode } from 'react';
import { X, GripVertical, Music2, ListMusic, MicVocal } from 'lucide-react';
import type { SongType } from './model';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  // bla bla
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { moveItem } from './model';
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Music2 size={30} />
      </span>
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: (id: string, index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id)
          onReorder(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div role="list" className="sortable-list">
          {ids.map((id, i) => (
            <SortableRow
              key={id}
              id={id}
              disabled={ids.length < 2}
              onMove={(direction) => onReorder(moveItem(ids, i, i + direction))}
            >
              {children(id, i)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
function SortableRow({
  id,
  children,
  onMove,
  disabled,
}: {
  id: string;
  children: ReactNode;
  onMove: (direction: number) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`sortable-row ${isDragging ? 'dragging' : ''}`}
      onKeyDown={(e) => {
        if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onMove(e.key === 'ArrowUp' ? -1 : 1);
        }
      }}
    >
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Reorder song"
        title="Drag to reorder. Keyboard: Space then arrows, or Ctrl + Up / Down."
      >
        <GripVertical size={18} />
      </button>
      {children}
    </div>
  );
}
export const SONG_TYPES: {
  value: SongType;
  label: string;
  icon: typeof Music2;
  color: string;
}[] = [
  { value: 'song', label: 'Song', icon: Music2, color: 'indigo' },
  { value: 'medley', label: 'Medley', icon: ListMusic, color: 'violet' },
  { value: 'artist', label: 'Artist', icon: MicVocal, color: 'teal' },
];
export const songTypeMeta = (type?: string | null) =>
  SONG_TYPES.find((t) => t.value === type) ?? SONG_TYPES[0];
export function TypeIcon({ type, size = 17 }: { type?: string | null; size?: number }) {
  const { icon: Icon, color } = songTypeMeta(type);
  return <Icon size={size} className={`type-icon ${color}`} />;
}
export function dateLabel(date?: string | null) {
  return date
    ? new Date(date.length === 10 ? `${date}T12:00:00` : date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No date set';
}
