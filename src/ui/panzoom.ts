import { el } from './dom';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface PanZoomHandle {
  apply(): void;
  zoomBy(factor: number): void;
  reset(): void;
}

export interface PanZoomOptions {
  svg: SVGSVGElement;
  host: HTMLElement;
  baseW: number;
  baseH: number;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  zoomStep?: number;
  controls?: boolean;
}

interface Ptr {
  x: number;
  y: number;
}

export function setupPanZoom(o: PanZoomOptions): PanZoomHandle {
  const { svg, host, baseW, baseH } = o;
  const minScale = o.minScale ?? 1;
  const maxScale = o.maxScale ?? 24;
  const zoomStep = o.zoomStep ?? 1.28;
  const withControls = o.controls !== false;

  let scale = clamp(o.initialScale ?? 1, minScale, maxScale);
  let vx = 0;
  let vy = 0;

  const vw = (): number => baseW / scale;
  const vh = (): number => baseH / scale;

  function renderRect(): DOMRect {
    return svg.getBoundingClientRect();
  }

  const isRectZero = (r: DOMRect): boolean => r.width <= 0 || r.height <= 0;

  function renderScale(): number {
    const r = renderRect();
    if (isRectZero(r)) return 1;
    return Math.min(r.width / vw(), r.height / vh());
  }

  function clientFromContent(px: number, py: number): Ptr {
    const r = renderRect();
    if (isRectZero(r)) return { x: 0, y: 0 };
    const s = renderScale();
    const ox = (r.width - vw() * s) / 2;
    const oy = (r.height - vh() * s) / 2;
    return { x: r.left + ox + (px - vx) * s, y: r.top + oy + (py - vy) * s };
  }

  function contentFromClient(cx: number, cy: number): Ptr {
    const r = renderRect();
    if (isRectZero(r)) return { x: vx + vw() / 2, y: vy + vh() / 2 };
    const s = renderScale();
    const ox = (r.width - vw() * s) / 2;
    const oy = (r.height - vh() * s) / 2;
    return { x: vx + (cx - r.left - ox) / s, y: vy + (cy - r.top - oy) / s };
  }

  function clampPan(): void {
    if (vw() >= baseW) vx = 0;
    else vx = clamp(vx, 0, baseW - vw());
    if (vh() >= baseH) vy = 0;
    else vy = clamp(vy, 0, baseH - vh());
  }

  function apply(): void {
    clampPan();
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw()} ${vh()}`);
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
  }

  function zoomAt(fx: number, fy: number, factor: number): void {
    const next = clamp(scale * factor, minScale, maxScale);
    if (next === scale) return;
    const focus = contentFromClient(fx, fy);
    scale = next;
    const r = renderRect();
    const s = renderScale();
    const ox = (r.width - vw() * s) / 2;
    const oy = (r.height - vh() * s) / 2;
    vx = focus.x - (fx - r.left - ox) / s;
    vy = focus.y - (fy - r.top - oy) / s;
    apply();
  }

  function zoomBy(factor: number): void {
    const r = renderRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  function reset(): void {
    scale = o.initialScale ?? 1;
    vx = 0;
    vy = 0;
    apply();
  }

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.008 : 0.0012));
      zoomAt(e.clientX, e.clientY, factor);
    },
    { passive: false },
  );

  let suppressClick = false;
  svg.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        e.stopImmediatePropagation();
        suppressClick = false;
      }
    },
    true,
  );

  const pointers = new Map<number, Ptr>();
  let dragMoved = false;
  let pinching = false;
  let pinchBase = 0;
  let pinchMid: Ptr = { x: 0, y: 0 };

  const twoPointers = (): [Ptr, Ptr] | null => {
    if (pointers.size < 2) return null;
    const it = pointers.values();
    const a = it.next().value;
    const b = it.next().value;
    return a && b ? [a, b] : null;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    const before = pointers.get(e.pointerId)!;
    const moved = Math.hypot(e.clientX - before.x, e.clientY - before.y);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (moved > 2) dragMoved = true;

    const two = twoPointers();
    if (two) {
      if (!pinching) {
        pinching = true;
        pinchBase = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
        pinchMid = { x: (two[0].x + two[1].x) / 2, y: (two[0].y + two[1].y) / 2 };
      }
      const [pa, pb] = two;
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      const oldContent = contentFromClient(pinchMid.x, pinchMid.y);
      zoomAt(mid.x, mid.y, pinchBase > 0 ? dist / pinchBase : 1);
      const anchor = clientFromContent(oldContent.x, oldContent.y);
      const s = renderScale();
      vx += (mid.x - anchor.x) / s;
      vy += (mid.y - anchor.y) / s;
      pinchBase = dist;
      pinchMid = { ...mid };
      apply();
      return;
    }

    if (pointers.size === 1) {
      const prevC = contentFromClient(before.x, before.y);
      const curC = contentFromClient(e.clientX, e.clientY);
      vx += prevC.x - curC.x;
      vy += prevC.y - curC.y;
      apply();
    }
  };

  const endPointer = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    const had = pointers.size;
    pointers.delete(e.pointerId);
    if (had === 2) {
      pinchBase = 0;
      pinching = false;
    }
    if (pointers.size === 0) {
      svg.classList.remove('panning');
      if (dragMoved) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 250);
      }
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    endPointer(e);
    if (pointers.size === 0) {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      dragMoved = false;
    }
  };

  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    pinching = false;
    svg.classList.add('panning');
    if (pointers.size === 1) {
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }
  });

  let label: HTMLElement | null = null;

  if (withControls) {
    const zoomc = el('div', { class: 'zoomc' });
    const outBtn = el('button', { class: 'btn zoomc-btn', type: 'button' }, '−');
    outBtn.dataset.tip = 'Zoom out. Wheel over the board to zoom at the cursor.';
    outBtn.setAttribute('aria-label', 'Zoom out');
    label = el('span', { class: 'zoomc-val' }, '100%');
    label.dataset.tip = 'Current zoom relative to fit.';
    const inBtn = el('button', { class: 'btn zoomc-btn', type: 'button' }, '＋');
    inBtn.dataset.tip = 'Zoom in. Drag to pan the board.';
    inBtn.setAttribute('aria-label', 'Zoom in');
    const fitBtn = el('button', { class: 'btn zoomc-btn', type: 'button' }, 'FIT');
    fitBtn.dataset.tip = 'Fit the whole board back into view.';
    fitBtn.setAttribute('aria-label', 'Fit board');
    outBtn.addEventListener('click', () => zoomBy(1 / zoomStep));
    inBtn.addEventListener('click', () => zoomBy(zoomStep));
    fitBtn.addEventListener('click', reset);
    zoomc.append(outBtn, label, inBtn, fitBtn);
    host.append(zoomc);
  }

  apply();
  return { apply, zoomBy, reset };
}