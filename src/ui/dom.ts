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