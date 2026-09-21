import { useRef, useState, type PointerEvent } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { moveItem, type Doc } from './model';
import { dateLabel } from './components';

export function SessionSongList({
  songs,
  selectedId,
  canEdit,
  onSelect,
  onReorder,
  onRemove,
}: {
  songs: Doc[];
  selectedId?: string;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const ids = songs.map((song) => song.id);
  const suppressClick = useRef(0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 1000, tolerance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 10 } }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => {
        suppressClick.current = Infinity;
      }}
      onDragCancel={() => {
        suppressClick.current = Date.now() + 300;
      }}
      onDragEnd={({ active, over }) => {
        suppressClick.current = Date.now() + 300;
        if (canEdit && over && active.id !== over.id)
          onReorder(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div role="list" aria-label="Session songs" className="sortable-list session-song-list">
          {songs.map((song, index) => (
            <SessionSong
              key={song.id}
              song={song}
              index={index}
              selected={selectedId === song.id}
              canEdit={canEdit}
              canMove={songs.length > 1}
              onSelect={() => {
                if (Date.now() > suppressClick.current) onSelect(song.id);
              }}
              onRemove={() => {
                if (canEdit) onRemove(song.id);
              }}
              onMove={(direction) => {
                if (canEdit) onReorder(moveItem(ids, index, index + direction));
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SessionSong({
  song,
  index,
  selected,
  canEdit,
  canMove,
  onSelect,
  onRemove,
  onMove,
}: {
  song: Doc;
  index: number;
  selected: boolean;
  canEdit: boolean;
  canMove: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (direction: number) => void;
}) {
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: song.id, disabled: !canEdit || !canMove });
  const [offset, setOffset] = useState(0);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(0);
  function reset() {
    swipe.current = null;
    setOffset(0);
  }
  function start(event: PointerEvent) {
    if (!canEdit || !event.isPrimary || event.button !== 0) return reset();
    swipe.current = { x: event.clientX, y: event.clientY, moved: false };
  }
  function move(event: PointerEvent) {
    const initial = swipe.current;
    if (!initial || isDragging) return;
    const dx = event.clientX - initial.x,
      dy = event.clientY - initial.y;
    if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
      reset();
      return;
    }
    if (Math.abs(dx) > 10) initial.moved = true;
    if (initial.moved && Math.abs(dx) > Math.abs(dy) * 1.5) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setOffset(Math.min(0, Math.max(-160, dx)));
    }
  }
  function finish(event: PointerEvent) {
    const initial = swipe.current;
    if (initial?.moved || isDragging) suppressClick.current = Date.now() + 300;
    const dx = initial ? event.clientX - initial.x : 0;
    const dy = initial ? event.clientY - initial.y : 0;
    reset();
    if (canEdit && !isDragging && initial && dx < -80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = Date.now() + 300;
      onRemove();
    }
  }
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`session-song-row ${isDragging ? 'dragging' : ''}`}
    >
      {canEdit && (
        <div
          className={`swipe-remove ${offset <= -80 ? 'ready' : ''}`}
          style={{ opacity: offset < 0 ? 1 : 0 }}
          aria-hidden="true"
        >
          {offset <= -80 ? 'Release to remove' : 'Swipe to remove'}
        </div>
      )}
      <div
        className={`song-card ${selected ? 'active' : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset ? 'none' : 'transform 180ms ease',
        }}
      >
        <button
          ref={setActivatorNodeRef}
          className={`song-select ${canEdit ? 'gesture-enabled' : ''}`}
          {...(canEdit ? listeners : {})}
          aria-current={selected ? 'true' : undefined}
          aria-describedby={canEdit ? 'session-gesture-help' : undefined}
          title={
            canEdit
              ? 'Hold 1 second to move. Swipe left to remove. Keyboard: Ctrl + Up / Down to move; Delete to remove.'
              : undefined
          }
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={reset}
          onContextMenu={(event) => {
            if (canEdit) event.preventDefault();
          }}
          onClick={() => {
            if (Date.now() > suppressClick.current) onSelect();
          }}
          onKeyDown={(event) => {
            if (!canEdit) return;
            if (event.ctrlKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault();
              onMove(event.key === 'ArrowUp' ? -1 : 1);
            } else if (event.key === 'Delete') {
              event.preventDefault();
              onRemove();
            }
          }}
        >
          <span className="song-number">{String(index + 1).padStart(2, '0')}</span>
          <span>
            <strong>{song.title || 'Untitled'}</strong>
            <small>Updated {dateLabel(song.updated_at)}</small>
          </span>
        </button>
      </div>
    </div>
  );
}
