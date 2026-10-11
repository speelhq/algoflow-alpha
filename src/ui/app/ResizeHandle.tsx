// The handle between the panel and the canvas, which resizes the panel's width. The parent
// decides the sign of the delta.
import { useRef, type PointerEvent } from "react";

type Props = {
  label: string;
  testId: string;
  /** Current width of the panel this handle controls, captured at drag start. */
  size: number;
  /** Receives the width at drag start and the pointer's horizontal delta since then. */
  onResize: (startSize: number, delta: number) => void;
};

export function ResizeHandle({ label, testId, size, onResize }: Props) {
  const drag = useRef<{ origin: number; size: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { origin: event.clientX, size };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !event.isPrimary) return;
    onResize(drag.current.size, event.clientX - drag.current.origin);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-testid={testId}
      className="w-1 shrink-0 cursor-col-resize touch-none bg-border transition-colors select-none hover:bg-ring"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
