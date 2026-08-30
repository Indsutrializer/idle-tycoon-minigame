import { buildingCost, buildingRate, bulkCost } from '../core/engine';
import { fmtAmount, fmtRate } from '../format';
import type { Store } from '../store';
import { el, fmtErr } from './dom';
import { buildingIcon } from './icons';
import { showToast } from './toast';

const LEVEL_CODE: Record<string, string> = {
  collector: 'COL',
  refinery: 'REF',
  wind_turbine: 'TUR',
  lab: 'LAB',
};

const OUT: Record<string, string> = {
  money: 'CRD',
  energy: 'ENR',
  research: 'RES',
};

const OUT_FULL: Record<string, string> = {
  money: 'Credits (CRD)',
  energy: 'Energy (ENR)',
  research: 'Research (RES)',
};

const CODE_TIP: Record<string, string> = {
  collector: 'COL = Solar Collector. Converts irradiance into grid energy.',
  refinery: 'REF = Refinery. Refines energy into export credits.',
  wind_turbine: 'TUR = Wind Turbine. Reinforces the power supply with wind.',
  lab: 'LAB = Laboratory. Consumes energy to produce research.',
};

export function mountPanel(store: Store): HTMLElement {
  const root = el('section', { class: 'panel' });
  const header = el('div', { class: 'pane-title' }, 'PRODUCTION UNITS');
  const list = el('div', { class: 'card-list' });
  root.append(header, list);
  store.subscribe(render);
  render();

  function render(): void {
    const { state, rates } = store;
    const cards = store.config.buildings.map((b) => {
      const level = state.buildings[b.id] ?? 0;
      const unlocked = state.unlocked[b.id] === true;
      const pr = rates.perBuilding[b.id];

      if (!unlocked) {
        return `<article class="card card--locked" data-building="${b.id}">
          <header class="card-h">
            <span class="card-cod" data-tip="${CODE_TIP[b.id]} Locked — unlock it in the Technology Plan.">${LEVEL_CODE[b.id]}</span>
            <span class="card-name">${b.name}</span>
          </header>
          <div class="card-lock" data-tip="This area is reserved: the unit is not available yet. Unlock it in the Technology Plan (right pane).">RESERVED AREA<br/>REQUIRES TECH PLAN</div>
        </article>`;
      }

      const grid = OUT[b.output];
      const cost = buildingCost(b, level);
      const affordable = Math.floor(state.resources.money ?? 0) >= cost;
      const maxQty = store.maxBuyQty(b.id);
      const mult = (pr?.mult ?? 1) > 1 ? ` ×${fmtRate(pr!.mult)}` : '';

      const curOut = pr?.output ?? 0;
      const curRate = buildingRate(b, level);
      const gain = pr && curRate > 0 ? b.perLevelRate * (curOut / curRate) : b.perLevelRate;
      const nextOut = curOut + gain;
      const cost10 = bulkCost(b, level, 10);
      const costMax = bulkCost(b, level, maxQty);
      const tipBuy = `Upgrade level ${level} → ${level + 1}. OUTPUT ${fmtRate(curOut)} → ${fmtRate(nextOut)} ${grid}/s (+${fmtRate(gain)} ${grid}/s per level). Cost ${fmtAmount(cost)} CRD.`;
      const tip10 = `Upgrade 10 levels in one purchase. OUTPUT +${fmtRate(gain * 10)} ${grid}/s. Block cost ${fmtAmount(cost10)} CRD — needs to be affordable as a block.`;
      const tipMax = `Upgrade up to ${maxQty} level${maxQty === 1 ? '' : 's'} at once. OUTPUT +${fmtRate(gain * maxQty)} ${grid}/s. Total cost ${fmtAmount(costMax)} CRD.`;

      let flow = '';
      if (b.input) {
        const inRate = pr?.inputUsed ?? 0;
        const starved = (pr?.scale ?? 1) < 0.999;
        flow = `<div class="card-row" data-tip="Consumed per second in ${OUT_FULL[b.input.resource]}. 'shortage' means output is reduced because supply is below demand."><span>INPUT</span><span class="kv${starved ? ' warn' : ''}">${fmtRate(inRate)} ${OUT[b.input.resource]}/s${starved ? ' · shortage' : ''}</span></div>`;
      }

      return `<article class="card" data-building="${b.id}">
        <header class="card-h">
          <span class="card-cod" data-tip="${CODE_TIP[b.id]}">${LEVEL_CODE[b.id]}</span>
          <span class="card-name">${b.name}</span>
          <span class="card-icon">${buildingIcon(b.id, 30)}</span>
        </header>
        <div class="card-row" data-tip="Working level of ${b.name}. Each level adds the base output again; cost grows with each level."><span>LEVEL</span><span class="kv lvl">${level}</span></div>
        <div class="card-row" data-tip="Produced per second in ${OUT_FULL[b.output]}; the ×n multiplier comes from upgrades in the Technology Plan."><span>OUTPUT</span><span class="kv">+${fmtRate(pr?.output ?? 0)} ${grid}/s${mult}</span></div>
        ${flow}
        <div class="card-row" data-tip="Price in ${OUT_FULL.money} to add one level to this unit."><span>NEXT COST</span><span class="kv cost ${affordable ? '' : 'short'}">${fmtAmount(cost)} CRD</span></div>
        <div class="card-actions">
          <button class="btn" data-action="buy" data-arg="${b.id}:1" data-tip="${tipBuy}" ${affordable ? '' : 'disabled'}>×1</button>
          <button class="btn" data-action="buy10" data-arg="${b.id}:10" data-tip="${tip10}" ${store.maxBuyQty(b.id) >= 10 ? '' : 'disabled'}>×10</button>
          <button class="btn btn--max" data-action="buymax" data-arg="${b.id}" data-tip="${tipMax}" ${maxQty > 0 ? '' : 'disabled'}>MAX +${maxQty}</button>
        </div>
      </article>`;
    });
    list.innerHTML = cards.join('');
  }

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
    if (!target) return;
    const action = target.dataset.action;
    const arg = target.dataset.arg ?? '';
    const id = arg.split(':')[0];
    const qtyRaw = arg.split(':')[1];
    if (!id) return;
    const qty = action === 'buymax' ? store.maxBuyQty(id) : Number(qtyRaw || 1);
    const err = store.buy(id, qty);
    if (err) showToast(fmtErr(err), 'error');
  });

  return root;
}