import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react';

const isControl = (target: EventTarget) =>
  target instanceof Element &&
  Boolean(target.closest('button, a, input, select, textarea, [role="button"]'));

export function useLiveMode(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const wanted = useRef(false);
  const hadFullscreen = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const tap = useRef<{ x: number; y: number; time: number } | null>(null);
  const down = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouch = useRef(-Infinity);

  function exit() {
    wanted.current = false;
    setLive(false);
    tap.current = null;
    if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => {});
  }

  function toggle() {
    if (wanted.current) return exit();
    if (!enabled) return;
    wanted.current = true;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setLive(true);
    root.current?.querySelector<HTMLElement>('.song-viewer')?.focus({ preventScroll: true });
    // Keep the viewport-filling layout when the browser lacks or denies fullscreen.
    try {
      void root.current
        ?.requestFullscreen?.()
        .then(() => {
          if (!wanted.current && document.fullscreenElement === root.current)
            void document.exitFullscreen().catch(() => {});
        })
        .catch(() => {});
    } catch {
      /* The CSS live view remains available. */
    }
  }

  useEffect(() => {
    if (!live) previousFocus.current?.focus({ preventScroll: true });
  }, [live]);

  useEffect(() => {
    const element = root.current;
    const changed = () => {
      if (document.fullscreenElement === element) hadFullscreen.current = true;
      else if (hadFullscreen.current) {
        hadFullscreen.current = false;
        exit();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && wanted.current) exit();
    };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('keydown', keydown);
    return () => {
      wanted.current = false;
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', keydown);
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  function cancelTap() {
    down.current = null;
    tap.current = null;
  }
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    if (!event.isPrimary || isControl(event.target)) return cancelTap();
    down.current = { x: event.clientX, y: event.clientY, time: performance.now() };
  }
  function onPointerMove(event: PointerEvent) {
    if (
      down.current &&
      Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) > 12
    )
      cancelTap();
  }
  function onPointerUp(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    const now = performance.now();
    lastTouch.current = now;
    const start = down.current;
    down.current = null;
    if (!event.isPrimary || !start || now - start.time > 300 || isControl(event.target)) {
      tap.current = null;
      return;
    }
    const previous = tap.current;
    if (
      previous &&
      now - previous.time < 350 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 30
    ) {
      event.preventDefault();
      tap.current = null;
      window.getSelection()?.removeAllRanges();
      toggle();
    } else tap.current = { x: event.clientX, y: event.clientY, time: now };
  }
  function onDoubleClick(event: MouseEvent) {
    if (performance.now() - lastTouch.current < 700 || isControl(event.target)) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    toggle();
  }

  return {
    root,
    live,
    toggle,
    gestures: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancelTap,
      onDoubleClick,
      onScrollCapture: cancelTap,
    },
  };
}
