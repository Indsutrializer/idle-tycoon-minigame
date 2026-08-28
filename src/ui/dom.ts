export type Nodeish = Node | string | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Nodeish | Nodeish[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null) continue;
    node.append(c);
  }
  return node;
}

export function mount(root: HTMLElement, html: string): void {
  root.innerHTML = html;
}

export function fmtErr(code: string): string {
  switch (code) {
    case 'UNKNOWN_BUILDING':
      return 'Unit not on record at the site.';
    case 'LOCKED':
      return 'Unit not unlocked by the plan yet.';
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient credits for this construction.';
    case 'UNKNOWN_TECH':
      return 'Technology not on record.';
    case 'ALREADY_UNLOCKED':
      return 'Technology already applied.';
    case 'MISSING_PREREQUISITES':
      return 'Missing plan prerequisites.';
    case 'INSUFFICIENT_COST':
      return 'Insufficient resources for the plan.';
    default:
      return code;
  }
}

let tipEl: HTMLElement | null = null;
let currentTip: Element | null = null;

const SHOW_DELAY = 450;
const MOVE_TOL = 3;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let lastX = 0;
let lastY = 0;

export function initTooltips(): void {
  if (tipEl) return;
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.append(tip);
  tipEl = tip;

  const cancel = (): void => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
  };

  const place = (x: number, y: number): void => {
    const { innerWidth, innerHeight } = window;
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let px = x + 14;
    let py = y + 18;
    if (px + r.width + pad > innerWidth) px = x - r.width - 12;
    if (py + r.height + pad > innerHeight) py = y - r.height - 10;
    tip.style.left = `${px}px`;
    tip.style.top = `${py}px`;
  };

  const arm = (e: PointerEvent): void => {
    cancel();
    lastX = e.clientX;
    lastY = e.clientY;
    showTimer = setTimeout(() => {
      showTimer = null;
      if (!currentTip) return;
      const text = currentTip.getAttribute('data-tip');
      if (!text) return;
      tip.textContent = text;
      tip.classList.add('show');
      place(lastX, lastY);
    }, SHOW_DELAY);
  };

  const hide = (): void => {
    tip.classList.remove('show');
  };

  const over = (e: PointerEvent): void => {
    const t = (e.target as Element).closest('[data-tip]');
    if (t === currentTip) return;
    currentTip = t;
    if (t) {
      arm(e);
    } else {
      cancel();
      hide();
    }
  };

  const move = (e: PointerEvent): void => {
    if (tip.classList.contains('show')) {
      place(e.clientX, e.clientY);
      return;
    }
    if (!currentTip) return;
    const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (dist > MOVE_TOL) arm(e);
  };

  const out = (e: PointerEvent): void => {
    const to = e.relatedTarget as Element | null;
    if (to && to.closest('[data-tip]')) return;
    currentTip = null;
    cancel();
    hide();
  };

  document.addEventListener('pointerover', over);
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerout', out);
}