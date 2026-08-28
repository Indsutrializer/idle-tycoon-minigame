import type { Store } from '../store';
import { el } from './dom';
import { GLYPHS, type GlyphName } from './icons';

interface Plot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PLOTS: Record<string, Plot> = {
  A: { x: 60, y: 80, w: 130, h: 130 },
  B: { x: 240, y: 80, w: 130, h: 130 },
  C: { x: 420, y: 80, w: 130, h: 130 },
  D: { x: 150, y: 250, w: 130, h: 130 },
};

const VIEW_W = 580;
const VIEW_H = 410;

const ACCENT: Record<string, GlyphName> = {
  solar: 'solar',
  wind: 'wind',
  refinery: 'refinery',
  lab: 'lab',
};

const OUT_FULL: Record<string, string> = {
  money: 'Credits (CRD)',
  energy: 'Energy (ENR)',
  research: 'Research (RES)',
};

const PRODUCERS = ['collector', 'wind_turbine'];
const CONSUMERS = ['refinery', 'lab'];

export function mountMap(store: Store): HTMLElement {
  const root = el('section', { class: 'map' });
  const header = el('div', { class: 'pane-title' }, 'SITE PLAN — SITE ALPHA');
  const wrap = el('div', { class: 'map-scroll' });
  root.append(header, wrap);
  let lastGen = -1;

  store.subscribe(() => {
    if (store.gen === lastGen) return;
    lastGen = store.gen;
    render();
  });
  render();

  function render(): void {
    const { state } = store;

    const defs = `
      <defs>
        <pattern id="mapgrid" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--fainter)"/>
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--line)"/>
        </marker>
        <clipPath id="plotclip"><rect x="-8" y="-8" width="150" height="150"/></clipPath>
      </defs>`;

    const frame = `
      <rect class="map-frame" width="${VIEW_W}" height="${VIEW_H}" fill="url(#mapgrid)"/>
      <g class="dim">
        ${ticksLeft()}
        ${ticksTop()}
        <path d="M28 28H${VIEW_W - 30}" class="dimline"/>
        <path d="M28 28V${VIEW_H - 30}" class="dimline"/>
        <line x1="28" y1="${VIEW_H - 30}" x2="${VIEW_W - 30}" y2="${VIEW_H - 30}" class="dimline"/>
        <line x1="${VIEW_W - 30}" y1="28" x2="${VIEW_W - 30}" y2="${VIEW_H - 30}" class="dimline"/>
      </g>`;

    const cross = `
      <g class="cross">
        <line x1="${VIEW_W / 2}" y1="24" x2="${VIEW_W / 2}" y2="${VIEW_H - 24}" stroke-dasharray="2 10"/>
        <line x1="24" y1="${VIEW_H / 2}" x2="${VIEW_W - 24}" y2="${VIEW_H / 2}" stroke-dasharray="2 10"/>
      </g>`;

    const compass = `
      <g class="compass" data-tip="Compass — plan orientation, north up." transform="translate(${VIEW_W - 44},44)">
        <circle r="16"/>
        <path d="M0 -11 L3 0 L0 11 L-3 0z" class="n"/>
        <text y="-22" text-anchor="middle" class="dimlabel">N</text>
      </g>`;

    const plots: string[] = [];
    for (const b of store.config.buildings) {
      const plot = PLOTS[b.plot];
      if (!plot) continue;
      plots.push(renderPlot(b, plot, state.unlocked[b.id] === true, state.buildings[b.id] ?? 0));
    }

    const flows = renderFlows(state);
    const cajetin = `
      <g class="cajetin" data-tip="Title block — project, drawing, scale and sheet for this plan." transform="translate(${VIEW_W - 186},${VIEW_H - 66})">
        <rect width="166" height="48" />
        <text x="8" y="16">IDLE TYCOON</text>
        <text x="8" y="30">DWG 01 — SITE ALPHA</text>
        <text x="8" y="42">SCALE 1:100 · SHEET 1/1</text>
      </g>`;

    const siteTitle = `
      <text class="maptitle" x="30" y="16" data-tip="Site 01 — top-down plan view of the operation.">SITE 01 — PLAN VIEW</text>`;

    wrap.innerHTML = `
      <svg class="mapboard" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="Site map">
        ${defs}
        ${frame}
        ${cross}
        ${siteTitle}
        ${plots.join('')}
        ${flows}
        ${compass}
        ${cajetin}
      </svg>`;
  }

  function renderPlot(
    b: { id: string; name: string; short: string; icon: string; output: string; plot: string },
    p: Plot,
    unlocked: boolean,
    level: number,
  ): string {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const active = unlocked && level > 0;
    const glyph = ACCENT[b.icon] ?? 'solar';
    const out = OUT_LABEL[b.output as keyof typeof OUT_LABEL] ?? '';

    let tip: string;
    let body = '';
    if (active) {
      tip = `${b.name} — plot ${b.plot}, LVL ${level}. Produces ${OUT_FULL[b.output]}; hover the panel on the left for exact rates.`;
      const hatch = diag(p, level);
      body = `
        <rect class="plot plot--active" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>
        ${hatch}
        <g transform="translate(${cx - 30},${cy - 34}) scale(2.5)" class="plot-icon level-${Math.min(level, 6)}">${GLYPHS[glyph]}</g>
        <text class="plot-level" x="${cx}" y="${p.y + p.h - 8}" text-anchor="middle">LVL ${level}</text>`;
    } else if (unlocked) {
      tip = `${b.name} — plot ${b.plot}. Unlocked and standing by: build it in the Production panel.`;
      body = `<rect class="plot plot--idle" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>
        <text class="plot-empty" x="${cx}" y="${cy + 4}" text-anchor="middle">STANDBY</text>`;
    } else {
      tip = `${b.name} — plot ${b.plot}. Reserved: not available until it is unlocked in the Technology Plan.`;
      body = `<rect class="plot plot--reserved" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>
        <text class="plot-empty" x="${cx}" y="${cy}" text-anchor="middle">AREA</text>
        <text class="plot-empty" x="${cx}" y="${cy + 14}" text-anchor="middle">RESERVED</text>`;
    }

    return `
      <g class="plotg" data-tip="${tip}">
        ${body}
        <g class="plot-corners">
          ${corner(p.x, p.y)}${corner(p.x + p.w, p.y)}${corner(p.x, p.y + p.h)}${corner(p.x + p.w, p.y + p.h)}
        </g>
        <text class="plot-label" x="${cx}" y="${p.y - 14}" text-anchor="middle">PLOT ${b.plot} — ${b.short.toUpperCase()}${out ? ` · ${out}` : ''}</text>
      </g>`;
  }

  function renderFlows(state: Store['state']): string {
    const paths: string[] = [];
    for (const prod of PRODUCERS) {
      const defP = store.config.buildings.find((b) => b.id === prod);
      if (!defP || (state.buildings[prod] ?? 0) <= 0) continue;
      const a = PLOTS[defP.plot];
      if (!a) continue;
      for (const cons of CONSUMERS) {
        const defC = store.config.buildings.find((b) => b.id === cons);
        if (!defC || (state.buildings[cons] ?? 0) <= 0) continue;
        const z = PLOTS[defC.plot];
        if (!z) continue;
        const x1 = a.x + a.w + 2;
        const y1 = a.y + a.h / 2;
        const x2 = z.x - 2;
        const y2 = z.y + z.h / 2;
        const my = (y1 + y2) / 2;
        paths.push(
          `<path class="flow" data-tip="${defP.name} sends energy to ${defC.name} (dashed animated line)." d="M${x1},${y1} C${x1 + 26},${my} ${x2 - 26},${my} ${x2},${y2}" marker-end="url(#arrow)"/>`,
        );
      }
    }
    return paths.join('');
  }

  function corner(x: number, y: number): string {
    return `<path class="corner-a" d="M${x - 5},${y} H${x + 5} M${x},${y - 5} V${y + 5}"/>`;
  }

  function diag(p: Plot, level: number): string {
    const sets = Math.min(4, Math.ceil(level / 2));
    const rows: string[] = [];
    for (let i = 0; i < sets; i++) {
      const lines = Array.from({ length: 11 }, (_, k) => {
        const sx = i * 14 + k * 17 - 14;
        return `<line x1="${sx}" y1="${p.h}" x2="${sx + 12}" y2="0"/>`;
      }).join('');
      rows.push(`<g clip-path="url(#plotclip)" class="hatch c${i + 1}">${lines}</g>`);
    }
    return `<g transform="translate(${p.x},${p.y})">${rows.join('')}</g>`;
  }

  return root;

  function ticksLeft(): string {
    let out = '';
    for (let y = 28; y < VIEW_H - 22; y += 26) {
      const major = (y - 28) % 130 === 0;
      out += `<line x1="${major ? 34 : 30}" y1="${y}" x2="40" y2="${y}" class="tick ${major ? 'maj' : ''}"/>`;
    }
    return out;
  }

  function ticksTop(): string {
    let out = '';
    for (let x = 28; x < VIEW_W - 22; x += 26) {
      const major = (x - 28) % 130 === 0;
      out += `<line x1="${x}" y1="${major ? 34 : 30}" x2="${x}" y2="40" class="tick ${major ? 'maj' : ''}"/>`;
    }
    return out;
  }
}

const OUT_LABEL = {
  money: 'CRD',
  energy: 'ENR',
  research: 'RES',
};