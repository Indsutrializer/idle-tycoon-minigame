import { fmtDuration } from './format';
import { createStore } from './store';
import { initTooltips } from './ui/dom';
import { mountAchievements } from './ui/achievements';
import { mountExchange } from './ui/exchange';
import { mountHud } from './ui/hud';
import { mountMap } from './ui/map';
import { mountPanel } from './ui/panel';
import { mountTechTree } from './ui/techTree';
import { showToast } from './ui/toast';

const store = createStore();
initTooltips();

document.getElementById('hud')!.append(mountHud(store));
document.getElementById('panel')!.append(mountPanel(store));
document.getElementById('mapview')!.append(mountMap(store));
document.getElementById('techview')!.append(mountTechTree(store), mountExchange(store), mountAchievements(store));

const status = document.getElementById('status')!;
const stCap = document.createElement('span');
const stOff = document.createElement('span');
const resetBtn = document.createElement('button');
const group = document.createElement('div');
group.className = 'st-group';
status.append(group, resetBtn);
group.append(stCap, stOff);
resetBtn.className = 'btn';
resetBtn.textContent = 'Reset site';
resetBtn.dataset.tip = 'Wipe all local progress and start a new game. This cannot be undone.';
resetBtn.addEventListener('click', () => {
  if (confirm('Discard local progress and start from scratch?')) {
    store.reset();
    showToast('Site reset.', 'info', 2600);
  }
});

const capMs = store.config.offline.maxHours * 3_600_000;
stCap.textContent = `AWAY MAX ${fmtDuration(capMs)}`;
stCap.dataset.tip =
  'AWAY MAX — the longest stay-away (offline) break that is simulated when you come back. Anything longer is capped.';

function paintStatus(): void {
  const cp = store.state.techs['quantum_core'] ? 2 : 1;
  stOff.textContent = `OFFLINE CAP ${fmtDuration(capMs * cp)}`;
  stOff.dataset.tip = `Current offline simulation limit: ${fmtDuration(capMs * cp)}. Doubled once Quantum Core is unlocked.`;
}
store.subscribe(paintStatus);
paintStatus();

const report = store.report;
if (report && report.appliedMs > 2000) {
  const parts = store.config.resources
    .filter((r) => (report.gains[r.id] ?? 0) > 0)
    .map((r) => `+${Math.floor(report.gains[r.id] ?? 0)} ${r.name}`);
  if (parts.length > 0) {
    const line = document.createElement('div');
    line.textContent = `AWAY REPORT — ${fmtDuration(report.appliedMs)}${report.capped ? ' (capped)' : ''}`;
    const gains = document.createElement('div');
    gains.textContent = parts.join(' · ');
    showToast([line, document.createElement('br'), gains], 'info', 9000);
  }
}

const TICK_MS = 250;
let tickCount = 0;
setInterval(() => {
  const now = Date.now();
  store.tick(now);
  tickCount++;
  if (tickCount % 60 === 0) store.persist();
}, TICK_MS);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.persist();
});
window.addEventListener('beforeunload', () => {
  store.tick(Date.now());
  store.persist();
});