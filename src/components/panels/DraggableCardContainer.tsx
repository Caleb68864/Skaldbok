import React, { useRef, useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

export interface PanelItem {
  key: string;
  element: React.ReactNode;
}

export interface DraggableCardContainerProps {
  panels: PanelItem[];
  cardOrder: string[];
  panelVisibility: Record<string, boolean>;
  isEditMode: boolean;
  onOrderChange: (newOrder: string[]) => void;
}

interface DragState {
  activeIndex: number;     // index in orderedPanels
  startY: number;
  currentY: number;
  targetIndex: number;
  pointerId: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Sort panels by cardOrder, appending any unknown panels at the end
 * in their original array order.
 */
function sortPanels(panels: PanelItem[], cardOrder: string[]): PanelItem[] {
  const orderMap = new Map(cardOrder.map((key, idx) => [key, idx]));
  const inOrder: PanelItem[] = [];
  const notInOrder: PanelItem[] = [];

  for (const panel of panels) {
    if (orderMap.has(panel.key)) {
      inOrder.push(panel);
    } else {
      notInOrder.push(panel);
    }
  }

  inOrder.sort((a, b) => (orderMap.get(a.key) ?? 0) - (orderMap.get(b.key) ?? 0));

  return [...inOrder, ...notInOrder];
}

/**
 * Move item from one index to another in array.
 */
function reorder<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

// ============================================================
// Component
// ============================================================

const DraggableCardContainer: React.FC<DraggableCardContainerProps> = ({
  panels,
  cardOrder,
  panelVisibility,
  isEditMode,
  onOrderChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Track the live target index in a ref so pointer events can read it without stale closure
  const dragStateRef = useRef<DragState | null>(null);

  // 1. Sort panels by cardOrder, append unlisted ones at the end
  const sorted = sortPanels(panels, cardOrder);

  // 2. Filter out hidden panels (but keep them in order array)
  const visiblePanels = sorted.filter(
    (p) => panelVisibility[p.key] !== false
  );

  // ----------------------------------------------------------
  // Drag mechanics
  // ----------------------------------------------------------

  const getTargetIndex = useCallback(
    (clientY: number, activeIndex: number): number => {
      if (!containerRef.current) return activeIndex;

      const rects: { top: number; bottom: number; mid: number }[] = [];
      visiblePanels.forEach((p) => {
        const el = itemRefs.current.get(p.key);
        if (el) {
          const rect = el.getBoundingClientRect();
          rects.push({ top: rect.top, bottom: rect.bottom, mid: (rect.top + rect.bottom) / 2 });
        } else {
          rects.push({ top: 0, bottom: 0, mid: 0 });
        }
      });

      let target = activeIndex;
      for (let i = 0; i < rects.length; i++) {
        if (i === activeIndex) continue;
        if (i < activeIndex && clientY < rects[i].mid) {
          target = i;
          break;
        }
        if (i > activeIndex && clientY > rects[i].mid) {
          target = i;
        }
      }
      return target;
    },
    [visiblePanels]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, panelIndex: number) => {
      e.preventDefault();
      (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);

      const state: DragState = {
        activeIndex: panelIndex,
        startY: e.clientY,
        currentY: e.clientY,
        targetIndex: panelIndex,
        pointerId: e.pointerId,
      };
      dragStateRef.current = state;
      setDragState(state);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const ds = dragStateRef.current;
      if (!ds || e.pointerId !== ds.pointerId) return;

      const newTarget = getTargetIndex(e.clientY, ds.activeIndex);
      const updated: DragState = {
        ...ds,
        currentY: e.clientY,
        targetIndex: newTarget,
      };
      dragStateRef.current = updated;
      setDragState(updated);
    },
    [getTargetIndex]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const ds = dragStateRef.current;
      if (!ds || e.pointerId !== ds.pointerId) return;

      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);

      if (ds.activeIndex !== ds.targetIndex) {
        const reordered = reorder(visiblePanels, ds.activeIndex, ds.targetIndex);
        onOrderChange(reordered.map((p) => p.key));
      }

      dragStateRef.current = null;
      setDragState(null);
    },
    [visiblePanels, onOrderChange]
  );

  // ----------------------------------------------------------
  // Compute per-panel visual offsets during drag
  // ----------------------------------------------------------

  const getShiftStyle = (index: number): React.CSSProperties => {
    if (!dragState) return {};
    const { activeIndex, targetIndex } = dragState;
    if (index === activeIndex) return {}; // handled separately

    // Get the dragged item's element height for shift calculation
    const draggedEl = itemRefs.current.get(visiblePanels[activeIndex]?.key ?? '');
    const draggedHeight = draggedEl ? draggedEl.offsetHeight + 8 : 80; // 8 = gap

    if (activeIndex < targetIndex) {
      // Dragging downward: items between activeIndex+1 and targetIndex shift up
      if (index > activeIndex && index <= targetIndex) {
        return { transform: `translateY(-${draggedHeight}px)`, transition: 'transform 0.15s ease' };
      }
    } else if (activeIndex > targetIndex) {
      // Dragging upward: items between targetIndex and activeIndex-1 shift down
      if (index >= targetIndex && index < activeIndex) {
        return { transform: `translateY(${draggedHeight}px)`, transition: 'transform 0.15s ease' };
      }
    }

    return { transform: 'translateY(0)', transition: 'transform 0.15s ease' };
  };

  const getDraggedStyle = (): React.CSSProperties => {
    if (!dragState) return {};
    const dy = dragState.currentY - dragState.startY;
    return {
      transform: `translateY(${dy}px) scale(1.02)`,
      transition: 'box-shadow 0.1s ease',
      zIndex: 100,
      position: 'relative',
    };
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="draggable-card-container flex flex-col gap-4"
    >
      {visiblePanels.map((panel, index) => {
        const isDragging = dragState?.activeIndex === index;

        return (
          <div
            key={panel.key}
            ref={(el) => {
              if (el) itemRefs.current.set(panel.key, el);
              else itemRefs.current.delete(panel.key);
            }}
            className={[
              'draggable-panel-wrapper',
              isDragging ? 'panel-dragging' : '',
              dragState && !isDragging ? 'panel-shifting' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={isDragging ? getDraggedStyle() : getShiftStyle(index)}
          >
            {isEditMode && (
              <button
                className="drag-handle"
                aria-label="Drag to reorder panel"
                onPointerDown={(e) => handlePointerDown(e, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                tabIndex={0}
              >
                <span aria-hidden="true">⠿</span>
              </button>
            )}
            <div className="draggable-panel-content flex-1">
              {panel.element}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraggableCardContainer;
