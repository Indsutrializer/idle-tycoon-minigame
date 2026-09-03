import { GAME_CONFIG } from '../core/config';
import { fmtAmount, fmtRate } from '../format';
import type { Store } from '../store';
import { el } from './dom';
import { resourceIcon } from './icons';

const CODE: Record<string, string> = { money: 'CRD', energy: 'ENR', research: 'RES' };

const TIP: Record<string, string> = {
  money:
    'CRD — Credit. The site currency: earned by refining energy, spent on construction and the Technology Plan, and tradable at the Transaction Desk.',
  energy:
    'ENR — Energy. Produced by collectors and turbines; consumed by refineries and laboratories to keep them running, and tradable at the Transaction Desk.',
  research:
    'RES — Research. Produced by laboratories; spent to unlock technologies in the Technology Plan, and tradable at the Transaction Desk.',
};

const BRAND_TIP =
  'Idle Tycoon — idle simulation of a mining operation, drawn as a construction blueprint. Codes are explained when you hover over them.';

const LOCAL_TIP =
  'STATUS: LOCAL — the game saves only to this device (browser localStorage). No account and no sync.';

const ACH_TIP =
  'ACHIEVEMENTS — progress milestones that grant permanent bonuses. Claimed achievements boost your production.';

export function mountHud(store: Store): HTMLElement {
  const root = el('div', { class: 'hud' });
  const brand = el('div', { class: 'hud-brand' }, 'IDLE TYCOON — SITE ALPHA');
  brand.dataset.tip = BRAND_TIP;
  const bar = el('div', { class: 'hud-resources' });
  const refs = new Map<string, { amt: HTMLElement; rate: HTMLElement }>();

  for (const r of GAME_CONFIG.resources) {
    const res = el('div', { class: 'res' });
    res.dataset.tip = TIP[r.id];
    const cod = el('span', { class: 'res-cod' }, CODE[r.id]);
    const amt = el('span', { class: 'res-amt' });
    const rate = el('span', { class: 'res-rate' });
    const ic = el('span', { class: 'res-ic' });
    ic.innerHTML = resourceIcon(r.id, 15);
    res.append(ic, cod, amt, rate);
    refs.set(r.id, { amt, rate });
    bar.append(res);
  }

  const achBadge = el('div', { class: 'badge-ach' });
  achBadge.dataset.tip = ACH_TIP;

  const badge = el('div', { class: 'badge-local' }, 'STATUS: LOCAL');
  badge.dataset.tip = LOCAL_TIP;
  root.append(brand, bar, achBadge, badge);

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

    const total = GAME_CONFIG.achievements.length;
    const claimed = GAME_CONFIG.achievements.filter((a) => state.achievementClaimed[a.id]).length;
    achBadge.textContent = `ACH ${claimed}/${total}`;
  };

  store.subscribe(update);
  store.subscribeAchievement(() => {
    achBadge.classList.remove('glow');
    void achBadge.offsetWidth;
    achBadge.classList.add('glow');
  });
  update();
  return root;
}