import { useCallback, useEffect, useRef, useState } from 'react';
import { createPenLatch, type PenLatch } from '../../features/notes/ink/penLatch';
import { strokeBounds, type Stroke, type StrokePage, type StrokePoint } from '../../features/notes/ink/strokeModel';

/**
 * Bounded overscan (page units, roughly px) rendered above and below the
 * visible viewport so committed-layer redraws on scroll are rare. This is
 * added to the *viewport* height to size the canvas — never to the full page
 * height, which can exceed the browser's per-axis canvas cap on a long page.
 */
const OVERSCAN_PX = 600;

/** How far down the visible viewport (as a fraction) a stroke must reach before the page grows. */
const EXTEND_THRESHOLD_FRACTION = 0.7;

/** Page-height growth increment applied once a stroke crosses the extend threshold. */
const PAGE_EXTEND_PX = 800;

const DEFAULT_TOOL: Stroke['tool'] = 'pen';
const DEFAULT_COLOR = '#1a1a1a';
const DEFAULT_WIDTH = 2;

/** Props for {@link InkPad}. */
export interface InkPadProps {
  /** The persisted stroke data for this page. InkPad renders it; it does not own storage. */
  page: StrokePage;
  /** Called once per completed stroke, in page coordinates. */
  onStrokeCommit: (stroke: Stroke) => void;
  /** Called when the user requests undo of the most recent committed stroke. */
  onUndo?: () => void;
  /** Active drawing tool. Defaults to `'pen'`. */
  tool?: Stroke['tool'];
  /** Active stroke color. Defaults to a near-black. */
  color?: string;
  /** Active stroke width, in page units. Defaults to `2`. */
  width?: number;
  /** Visible viewport width, in page units (CSS px). */
  viewportWidth: number;
  /** Visible viewport height, in page units (CSS px). */
  viewportHeight: number;
  /**
   * Called when a stroke crosses the auto-grow threshold and the page needs
   * more room below the pen. InkPad does not persist `pageHeight` itself.
   */
  onPageHeightChange?: (nextHeight: number) => void;
  className?: string;
}

interface InProgressStroke {
  pointerId: number;
  tool: Stroke['tool'];
  color: string;
  width: number;
  points: StrokePoint[];
}

/**
 * Reads every point of a pointer event, using coalesced events for smooth
 * high-frequency stylus sampling where the browser supports it.
 */
function collectPointerEvents(e: PointerEvent): PointerEvent[] {
  const getCoalesced = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents;
  if (typeof getCoalesced === 'function') {
    const coalesced = getCoalesced.call(e);
    if (coalesced && coalesced.length > 0) return coalesced;
  }
  return [e];
}

function toStrokePoint(e: PointerEvent, rect: DOMRect, tileOffsetY: number): StrokePoint {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top + tileOffsetY;
  const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;
  return [x, y, pressure];
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, offsetY: number): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  const [firstX, firstY] = stroke.points[0];
  ctx.moveTo(firstX, firstY - offsetY);
  for (let i = 1; i < stroke.points.length; i++) {
    const [x, y] = stroke.points[i];
    ctx.lineTo(x, y - offsetY);
  }
  if (stroke.points.length === 1) {
    // A tap with no drag: draw a dot so a single-point stroke is still visible.
    ctx.lineTo(firstX + 0.01, firstY - offsetY + 0.01);
  }
  ctx.stroke();
  ctx.restore();
}

function strokeIntersectsTile(stroke: Stroke, tileTop: number, tileBottom: number): boolean {
  const bounds = strokeBounds(stroke);
  return bounds.maxY >= tileTop && bounds.minY <= tileBottom;
}

/**
 * DOM half of Approach B handwriting ink: pointer capture, pen/touch routing
 * (delegated entirely to {@link createPenLatch}), stroke tessellation, and
 * the tiled two-canvas render.
 *
 * @remarks
 * Owns neither persistence nor recognition — it takes a {@link StrokePage} in
 * and emits stroke commits out via `onStrokeCommit`.
 *
 * `touch-action: none` is set inline on the two canvas elements only, never
 * on a wrapper — see `writePadHandwriting.test.ts`, which guards the
 * unrelated `WritePad` text-entry path against this same setting leaking
 * onto a shared ancestor.
 */
export function InkPad({
  page,
  onStrokeCommit,
  onUndo,
  tool = DEFAULT_TOOL,
  color = DEFAULT_COLOR,
  width = DEFAULT_WIDTH,
  viewportWidth,
  viewportHeight,
  onPageHeightChange,
  className,
}: InkPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement>(null);
  const wetCanvasRef = useRef<HTMLCanvasElement>(null);
  const penLatchRef = useRef<PenLatch>(createPenLatch());
  const activePointersRef = useRef<Set<number>>(new Set());
  const strokeRef = useRef<InProgressStroke | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Canvas height is bounded by the visible viewport plus overscan — never
  // by page height, which can exceed the browser's per-axis canvas cap.
  const canvasHeight = viewportHeight + OVERSCAN_PX * 2;
  const tileOffsetY = Math.max(0, scrollTop - OVERSCAN_PX);
  const tileTop = tileOffsetY;
  const tileBottom = tileOffsetY + canvasHeight;

  const redrawCommitted = useCallback(() => {
    const canvas = committedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of page.strokes) {
      if (strokeIntersectsTile(stroke, tileTop, tileBottom)) {
        drawStroke(ctx, stroke, tileOffsetY);
      }
    }
  }, [page.strokes, tileTop, tileBottom, tileOffsetY]);

  useEffect(() => {
    redrawCommitted();
  }, [redrawCommitted]);

  const clearWetLayer = useCallback(() => {
    const canvas = wetCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawWetStroke = useCallback(() => {
    const canvas = wetCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const current = strokeRef.current;
    if (!canvas || !ctx || !current || current.points.length === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStroke(ctx, current, tileOffsetY);
  }, [tileOffsetY]);

  const maybeExtendPage = useCallback(
    (maxYSeen: number) => {
      if (!onPageHeightChange) return;
      const threshold = tileOffsetY + viewportHeight * EXTEND_THRESHOLD_FRACTION;
      if (maxYSeen >= threshold) {
        const next = Math.max(page.pageHeight, maxYSeen + PAGE_EXTEND_PX);
        if (next > page.pageHeight) onPageHeightChange(next);
      }
    },
    [onPageHeightChange, page.pageHeight, tileOffsetY, viewportHeight],
  );

  const resetIfIdle = useCallback(() => {
    if (activePointersRef.current.size === 0) {
      strokeRef.current = null;
      clearWetLayer();
    }
  }, [clearWetLayer]);

  const discardInProgressStroke = useCallback(() => {
    strokeRef.current = null;
    clearWetLayer();
  }, [clearWetLayer]);

  const commitInProgressStroke = useCallback(() => {
    const current = strokeRef.current;
    strokeRef.current = null;
    clearWetLayer();
    if (!current || current.points.length === 0) return;
    onStrokeCommit({
      points: current.points,
      tool: current.tool,
      color: current.color,
      width: current.width,
    });
  }, [clearWetLayer, onStrokeCommit]);

  useEffect(() => {
    const wetCanvas = wetCanvasRef.current;
    if (!wetCanvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        // A React onPointerDown prop cannot guarantee a non-passive listener;
        // without a synchronous preventDefault here the pen starts a page
        // scroll/gesture instead of a stroke.
        e.preventDefault();
      }

      const accepted = penLatchRef.current.processEvent({
        pointerId: e.pointerId,
        pointerType: e.pointerType as 'pen' | 'touch' | 'mouse',
        phase: 'down',
        timestamp: e.timeStamp,
      });
      activePointersRef.current.add(e.pointerId);

      if (accepted) {
        wetCanvas.setPointerCapture(e.pointerId);
        const rect = wetCanvas.getBoundingClientRect();
        const points = collectPointerEvents(e).map((ev) => toStrokePoint(ev, rect, tileOffsetY));
        strokeRef.current = { pointerId: e.pointerId, tool, color, width, points };
        drawWetStroke();
      }

      resetIfIdle();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const accepted = penLatchRef.current.processEvent({
        pointerId: e.pointerId,
        pointerType: e.pointerType as 'pen' | 'touch' | 'mouse',
        phase: 'move',
        timestamp: e.timeStamp,
      });

      const current = strokeRef.current;
      if (accepted && current && current.pointerId === e.pointerId) {
        const rect = wetCanvas.getBoundingClientRect();
        const events = collectPointerEvents(e);
        let maxY = -Infinity;
        for (const ev of events) {
          const point = toStrokePoint(ev, rect, tileOffsetY);
          current.points.push(point);
          if (point[1] > maxY) maxY = point[1];
        }
        drawWetStroke();
        if (maxY > -Infinity) maybeExtendPage(maxY);
      }

      resetIfIdle();
    };

    const handlePointerUp = (e: PointerEvent) => {
      const accepted = penLatchRef.current.processEvent({
        pointerId: e.pointerId,
        pointerType: e.pointerType as 'pen' | 'touch' | 'mouse',
        phase: 'up',
        timestamp: e.timeStamp,
      });
      activePointersRef.current.delete(e.pointerId);

      const current = strokeRef.current;
      if (accepted && current && current.pointerId === e.pointerId) {
        commitInProgressStroke();
      }

      resetIfIdle();
    };

    const handlePointerCancel = (e: PointerEvent) => {
      penLatchRef.current.processEvent({
        pointerId: e.pointerId,
        pointerType: e.pointerType as 'pen' | 'touch' | 'mouse',
        phase: 'cancel',
        timestamp: e.timeStamp,
      });
      activePointersRef.current.delete(e.pointerId);

      const current = strokeRef.current;
      if (current && current.pointerId === e.pointerId) {
        discardInProgressStroke();
      }

      resetIfIdle();
    };

    wetCanvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    wetCanvas.addEventListener('pointermove', handlePointerMove, { passive: true });
    wetCanvas.addEventListener('pointerup', handlePointerUp, { passive: true });
    wetCanvas.addEventListener('pointercancel', handlePointerCancel, { passive: true });

    return () => {
      wetCanvas.removeEventListener('pointerdown', handlePointerDown);
      wetCanvas.removeEventListener('pointermove', handlePointerMove);
      wetCanvas.removeEventListener('pointerup', handlePointerUp);
      wetCanvas.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [
    tool,
    color,
    width,
    tileOffsetY,
    drawWetStroke,
    resetIfIdle,
    discardInProgressStroke,
    commitInProgressStroke,
    maybeExtendPage,
  ]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{ position: 'relative', width: viewportWidth, height: viewportHeight, overflowY: 'auto' }}
    >
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
        >
          Undo
        </button>
      )}
      <div style={{ position: 'relative', width: viewportWidth, height: Math.max(page.pageHeight, viewportHeight) }}>
        <canvas
          ref={committedCanvasRef}
          width={viewportWidth}
          height={canvasHeight}
          style={{
            position: 'absolute',
            left: 0,
            top: tileOffsetY,
            width: viewportWidth,
            height: canvasHeight,
            touchAction: 'none',
          }}
        />
        <canvas
          ref={wetCanvasRef}
          width={viewportWidth}
          height={canvasHeight}
          style={{
            position: 'absolute',
            left: 0,
            top: tileOffsetY,
            width: viewportWidth,
            height: canvasHeight,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
