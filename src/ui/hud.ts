import { GAME_CONFIG } from '../core/config';
import { fmtAmount, fmtRate } from '../format';
import type { Store } from '../store';
import { el } from './dom';
import { resourceIcon } from './icons';

const CODE: Record<string, string> = { money: 'CRD', energy: 'ENR', research: 'RES' };

export function mountHud(store: Store): HTMLElement {
  const root = el('div', { class: 'hud' });
  const brand = el('div', { class: 'hud-brand' }, 'IDLE TYCOON — SITE ALPHA');
  const bar = el('div', { class: 'hud-resources' });
  const refs = new Map<string, { amt: HTMLElement; rate: HTMLElement }>();

  for (const r of GAME_CONFIG.resources) {
    const res = el('div', { class: 'res' });
    const cod = el('span', { class: 'res-cod' }, CODE[r.id]);
    const amt = el('span', { class: 'res-amt' });
    const rate = el('span', { class: 'res-rate' });
    const ic = el('span', { class: 'res-ic' });
    ic.innerHTML = resourceIcon(r.id, 15);
    res.append(ic, cod, amt, rate);
    refs.set(r.id, { amt, rate });
    bar.append(res);
  }

  const badge = el('div', { class: 'badge-local' }, 'STATUS: LOCAL');
  root.append(brand, bar, badge);

  const update = () => {
    const { state, rates } = store;
    for (const r of GAME_CONFIG.resources) {
      const ref = refs.get(r.id);
      if (!ref) continue;
      const amount = Math.floor(state.resources[r.id] ?? 0);
      const net = rates.net[r.id] ?? 0;
      ref.amt.textContent = fmtAmount(amount);
      ref.rate.textContent = `${net >= 0 ? '+' : ''}${fmtRate(net)}/s`;
      ref.amt.classList.toggle('zero', amount <= 0 && net <= 0);
      ref.rate.classList.toggle('minus', net < 0);
    }
  };

  store.subscribe(update);
  update();
  return root;
}