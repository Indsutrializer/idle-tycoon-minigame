import { ACHIEVEMENTS } from '../core/config';
import { checkCondition } from '../core/achievements';
import { fmtAmount } from '../format';
import type { AchievementCondition, AchievementDef, AchievementEffect, PlayerState } from '../core/types';
import type { Store } from '../store';
import { el } from './dom';
import { showToast } from './toast';

const RES_CODE: Record<string, string> = { money: 'CRD', energy: 'ENR', research: 'RES' };

function formatCondition(cond: AchievementCondition): string {
  switch (cond.type) {
    case 'resource_total':
      return `Produce ${fmtAmount(cond.amount)} ${RES_CODE[cond.resource]} total`;
    case 'building_count':
      return cond.building
        ? `Own ${cond.amount} ${cond.building}`
        : `Own ${cond.amount} buildings`;
    case 'building_level':
      return `Reach ${cond.building} level ${cond.amount}`;
    case 'tech_count':
      return `Unlock ${cond.amount} technologies`;
    case 'all_techs':
      return 'Unlock all technologies';
    case 'trades_done':
      return `Complete ${cond.amount} trades`;
  }
}

function formatReward(reward: AchievementEffect): string {
  switch (reward.t) {
    case 'building_output':
      return reward.building
        ? `+${Math.round((reward.multiplier - 1) * 100)}% ${reward.building} output`
        : `+${Math.round((reward.multiplier - 1) * 100)}% output`;
    case 'building_cost':
      return `${Math.round((reward.multiplier - 1) * 100)}% building cost`;
    case 'tech_cost':
      return `${Math.round((reward.multiplier - 1) * 100)}% tech cost`;
    case 'trade_rate':
      return `+${Math.round((reward.multiplier - 1) * 100)}% trade rates`;
    case 'global_output':
      return `+${Math.round((reward.multiplier - 1) * 100)}% global output`;
  }
}

function getProgress(cond: AchievementCondition, state: PlayerState): number {
  switch (cond.type) {
    case 'resource_total':
      return Math.min(1, (state.stats.earned[cond.resource] ?? 0) / cond.amount);
    case 'building_count': {
      let total = 0;
      for (const id of Object.keys(state.buildings)) {
        if (cond.building && id !== cond.building) continue;
        total += state.buildings[id] ?? 0;
      }
      return Math.min(1, total / cond.amount);
    }
    case 'building_level':
      return Math.min(1, (state.buildings[cond.building] ?? 0) / cond.amount);
    case 'tech_count': {
      let count = 0;
      for (const id of Object.keys(state.techs)) {
        if (state.techs[id]) count++;
      }
      return Math.min(1, count / cond.amount);
    }
    case 'all_techs': {
      let unlocked = 0;
      for (const id of Object.keys(state.techs)) {
        if (state.techs[id]) unlocked++;
      }
      return Math.min(1, unlocked / 10);
    }
    case 'trades_done':
      return Math.min(1, (state.stats.totalTrades ?? 0) / cond.amount);
  }
}

export function mountAchievements(store: Store): HTMLElement {
  const root = el('section', { class: 'achpane' });
  const header = el('div', { class: 'pane-title ach-header' });
  root.append(header);
  const list = el('div', { class: 'card-list ach-list' });
  root.append(list);
  store.subscribe(render);
  store.subscribeAchievement(onUnlock);
  render();

  function onUnlock(ids: string[]): void {
    for (const id of ids) {
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      if (ach && ach.visible) {
        showToast(`Achievement unlocked: ${ach.name}`, 'info', 5200);
      } else {
        showToast('New hidden achievement unlocked!', 'info', 5200);
      }
    }
    render();
  }

  function render(): void {
    const { state } = store;
    const total = ACHIEVEMENTS.length;
    const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
    const claimed = ACHIEVEMENTS.filter((a) => state.achievementClaimed[a.id]).length;
    header.textContent = `ACHIEVEMENTS — ${claimed}/${total}`;

    const cards = ACHIEVEMENTS.map((ach) => {
      const isUnlocked = state.achievements[ach.id] === true;
      const isClaimed = state.achievementClaimed[ach.id] === true;
      const progress = getProgress(ach.condition, state);
      const pct = Math.floor(progress * 100);

      if (!ach.visible && !isUnlocked) {
        return `<article class="card card--locked card--ach">
          <header class="card-h">
            <span class="card-cod">???</span>
            <span class="card-name">???</span>
          </header>
          <div class="card-row"><span>CONDITION</span><span class="kv">???</span></div>
          <div class="card-row"><span>REWARD</span><span class="kv">???</span></div>
          <div class="card-row"><span>PROGRESS</span><span class="kv">???</span></div>
        </article>`;
      }

      const name = isUnlocked && ach.name === '???' ? 'Hidden Achievement' : ach.name;
      const cond = isUnlocked ? formatCondition(ach.condition) : ach.visible ? formatCondition(ach.condition) : '???';
      const reward = isUnlocked ? formatReward(ach.reward) : ach.visible ? formatReward(ach.reward) : '???';
      const progressText = isClaimed ? '✓ CLAIMED' : isUnlocked ? 'READY' : `${pct}%`;
      const cls = isClaimed ? 'card--claimed' : isUnlocked ? 'card--ready' : '';

      const claimBtn = isUnlocked && !isClaimed
        ? `<button class="btn btn--claim" data-claim="${ach.id}">CLAIM</button>`
        : '';

      const progressCls = isClaimed ? 'ach-prog--done' : isUnlocked ? 'ach-prog--ready' : '';

      return `<article class="card card--ach ${cls}">
        <header class="card-h">
          <span class="card-cod">${isClaimed ? '✓' : isUnlocked ? '▸' : '◻'}</span>
          <span class="card-name">${name}</span>
        </header>
        <div class="card-row"><span>CONDITION</span><span class="kv">${cond}</span></div>
        <div class="card-row"><span>REWARD</span><span class="kv">${reward}</span></div>
        <div class="card-row"><span>PROGRESS</span><span class="kv ${progressCls}">${progressText}</span></div>
        ${claimBtn ? `<div class="card-actions">${claimBtn}</div>` : ''}
      </article>`;
    });

    list.innerHTML = cards.join('');
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-claim]') as HTMLButtonElement | null;
    if (!btn) return;
    const id = btn.dataset.claim!;
    const err = store.claimAchievement(id);
    if (err === null) {
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      if (ach) showToast(`Reward claimed: ${formatReward(ach.reward)}`, 'info', 4200);
    }
  });

  return root;
}
