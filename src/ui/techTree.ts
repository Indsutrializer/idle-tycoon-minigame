import { fmtAmount } from '../format';
import type { Store } from '../store';
import { el, fmtErr } from './dom';
import { showToast } from './toast';

const NODE_W = 210;
const NODE_H = 62;
const COL_W = 250;
const ROW_H = 96;
const PAD_X = 46;
const PAD_Y = 34;

const RTREE: Record<string, string> = {
  money: 'CRD',
  energy: 'ENR',
  research: 'RES',
};

export function mountTechTree(store: Store): HTMLElement {
  const root = el('section', { class: 'techpane' });
  const header = el('div', { class: 'pane-title' }, 'TECHNOLOGY PLAN');
  const wrap = el('div', { class: 'tech-scroll' });
  root.append(header, wrap);
  let lastGen = -1;

  store.subscribe(() => {
    if (store.gen === lastGen) return;
    lastGen = store.gen;
    render();
  });
  render();

  function render(): void {
    const techs = store.config.techs;
    const maxCol = Math.max(...techs.map((t) => t.tileX));
    const maxRow = Math.max(...techs.map((t) => t.tileY));
    const width = PAD_X + (maxCol + 1) * COL_W + 20;
    const height = PAD_Y + (maxRow + 2) * ROW_H;
    const cx = (t: { tileX: number }) => PAD_X + t.tileX * COL_W;
    const cy = (t: { tileY: number }) => PAD_Y + t.tileY * ROW_H;

    const colLabels: string[] = [];
    const cols = new Map<number, string>();
    for (const t of techs) cols.set(t.tileX, t.tree);
    for (const [idx, label] of cols) {
      colLabels.push(`<text class="tlabel" x="${PAD_X + idx * COL_W + NODE_W / 2}" y="18" text-anchor="middle">${label.toUpperCase()}</text>`);
    }

    const edges: string[] = [];
    for (const t of techs) {
      const px = cx(t) + NODE_W;
      const py = cy(t) + NODE_H / 2;
      for (const req of t.requires) {
        const parent = techs.find((x) => x.id === req);
        if (!parent) continue;
        const ex = cx(parent);
        const ey = cy(parent) + NODE_H / 2;
        edges.push(
          `<path class="tedge ${store.state.techs[t.id] ? 'on' : ''}" d="M${px},${py} C${px + 30},${py} ${ex - 30},${ey} ${ex},${ey}"/>`,
        );
      }
    }

    const nodes = techs.map((t) => {
      const unlocked = store.state.techs[t.id] === true;
      const ready = !unlocked && store.canUnlock(t.id);
      const cls = unlocked ? 'unlocked' : ready ? 'ready' : 'locked';
      const stateMark = unlocked ? '✓' : ready ? '▸' : '◻';
      const costCls = Math.floor(store.state.resources[t.cost.resource] ?? 0) >= t.cost.amount ? '' : 'short';
      const x = cx(t);
      const y = cy(t);
      return `<g class="tnode ${cls}" data-tech="${t.id}" transform="translate(${x},${y})">
        <rect class="tframe" width="${NODE_W}" height="${NODE_H}" rx="1"/>
        <line class="tcorner" x1="0" y1="0" x2="8" y2="0"/>
        <line class="tcorner" x1="0" y1="0" x2="0" y2="8"/>
        <rect class="tfill" x="7" y="7" width="${NODE_W - 14}" height="${NODE_H - 14}"/>
        <text class="tname" x="${NODE_W / 2}" y="24" text-anchor="middle">${t.name.toUpperCase()}</text>
        <text class="tcost ${costCls}" x="${NODE_W / 2}" y="42" text-anchor="middle">${fmtAmount(t.cost.amount)} ${RTREE[t.cost.resource]}</text>
        <text class="tmark" x="${NODE_W - 18}" y="20">${stateMark}</text>
      </g>`;
    });

    wrap.innerHTML = `
      <svg class="techboard" viewBox="0 0 ${width} ${height}" role="img" aria-label="Technology tree">
        <defs>
          <pattern id="techgrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--fainter)"/>
          </pattern>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#techgrid)"/>
        ${colLabels.join('')}
        ${edges.join('')}
        ${nodes.join('')}
      </svg>`;
  }

  wrap.addEventListener('click', (e) => {
    const g = (e.target as SVGElement).closest('g[data-tech]') as SVGGElement | null;
    if (!g) return;
    const id = g.dataset.tech!;
    if (store.state.techs[id]) return;
    if (!store.canUnlock(id)) {
      const t = store.config.techs.find((x) => x.id === id);
      if (t && (t.requires.some((r) => !store.state.techs[r]) || Math.floor(store.state.resources[t.cost.resource] ?? 0) < t.cost.amount)) {
        showToast('Blocked by the plan: missing prerequisites or resources.', 'info', 2600);
      }
      return;
    }
    const err = store.unlock(id);
    if (err) showToast(fmtErr(err), 'error');
  });

  return root;
}