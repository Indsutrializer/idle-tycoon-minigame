import { exchangeRateFor, marketReference } from '../core/engine';
import { fmtRate } from '../format';
import type { Store } from '../store';
import { el, fmtErr } from './dom';
import { showToast } from './toast';

const CODE: Record<string, string> = {
  money: 'CRD',
  energy: 'ENR',
  research: 'RES',
};

const OUT_FULL: Record<string, string> = {
  money: 'Credits (CRD)',
  energy: 'Energy (ENR)',
  research: 'Research (RES)',
};

function rateLabel(from: string, to: string, rate: number): string {
  const by = rate >= 1 ? [1, Math.round(rate)] : [Math.round(1 / rate), 1];
  return `${by[0]} ${CODE[from]} \u2192 ${by[1]} ${CODE[to]}`;
}

export function mountExchange(store: Store): HTMLElement {
  const root = el('section', { class: 'exchangepane' });
  const header = el('div', { class: 'pane-title' }, 'TRANSACTION DESK');
  header.dataset.tip =
    'TRANSACTION DESK — exchange resources at live market rates, re-priced from your production conversion. The buy/sell spread means round-trips never pay.';
  const list = el('div', { class: 'card-list' });
  root.append(header, list);
  store.subscribe(render);
  render();

  function render(): void {
    const cards: string[] = [];
    for (const r of store.config.resources) {
      if (r.id === 'money') continue;
      const sell = exchangeRateFor(store.state, store.config, r.id, 'money');
      const buy = exchangeRateFor(store.state, store.config, 'money', r.id);
      if (sell == null && buy == null) continue;
      const sellMax = store.maxExchange(r.id, 'money');
      const buyMax = store.maxExchange('money', r.id);
      const sellTxt = sell == null ? 'no sell route' : rateLabel(r.id, 'money', sell);
      const buyTxt = buy == null ? 'no buy route' : rateLabel('money', r.id, buy);
      const ref = marketReference(store.state, store.config, r.id);
      const refTxt = ref > 0 ? ` market ref ${fmtRate(ref)} CRD` : '';
      const sellTip = `Sell ${OUT_FULL[r.id]} for Credits below your own production rate${refTxt}. A lossy but always-available way to bootstrap Credits out of what you already produce.`;
      const buyTip = `Buy ${OUT_FULL[r.id]} with Credits at a premium${refTxt}. Buy/sell rates keep a spread, so round-trips never pay.`;
      cards.push(`
        <article class="card card--exch">
          <div class="card-row" data-tip="Transaction Desk routes for ${OUT_FULL[r.id]}. All trades go through Credits; rates re-price in real time from the live production conversion.">
            <span class="card-cod">${CODE[r.id]}</span>
            <span class="kv">${sellTxt} · ${buyTxt}</span>
          </div>
          <div class="card-actions">
            <button class="btn" data-action="exch" data-arg="${r.id}:money:${sellMax}" data-tip="${sellTip}" ${sellMax >= 1 ? '' : 'disabled'}>SELL +${sellMax}</button>
            <button class="btn" data-action="exch" data-arg="money:${r.id}:${buyMax}" data-tip="${buyTip}" ${buyMax >= 1 ? '' : 'disabled'}>BUY +${buyMax}</button>
          </div>
        </article>`);
    }
    list.innerHTML = cards.join('');
  }

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
    if (!target) return;
    const action = target.dataset.action;
    const arg = target.dataset.arg ?? '';
    if (action !== 'exch') return;
    const [from, to, amtRaw] = arg.split(':');
    const err = store.exchange(from ?? '', to ?? '', Number(amtRaw ?? 0));
    if (err) showToast(fmtErr(err), 'error');
  });

  return root;
}