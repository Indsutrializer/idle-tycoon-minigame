import type { Nodeish } from './dom';
import { el } from './dom';

export function showToast(message: string | Nodeish[], kind: 'info' | 'error' = 'info', ttl = 5200): void {
  let root = document.getElementById('toast');
  if (!root) {
    root = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(root);
  }
  const item = el('div', { class: `toast ${kind}` }, message);
  root.append(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 400);
  }, ttl);
}