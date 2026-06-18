import { state } from './state.js';
import { render, save } from './main.js';

export function initDrag(e, handle) {
  const row = handle.closest('tr, .grid-card');
  state.dragSrcId = row.dataset.id;
  row.classList.add('dragging');

  const onMove = e2 => {
    const target = document.elementFromPoint(e2.clientX, e2.clientY);
    const targetRow = target ? target.closest('tr[data-id], .grid-card[data-id]') : null;
    document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
    if (targetRow && targetRow.dataset.id !== state.dragSrcId) {
      targetRow.classList.add('drag-over');
    }
  };

  const onUp = e2 => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    row.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));

    const target = document.elementFromPoint(e2.clientX, e2.clientY);
    const targetRow = target ? target.closest('tr[data-id], .grid-card[data-id]') : null;
    if (targetRow && targetRow.dataset.id !== state.dragSrcId) {
      reorderShots(state.dragSrcId, targetRow.dataset.id);
    }
    state.dragSrcId = null;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export function initTouchDrag(e, handle) {
  e.preventDefault();
  const row = handle.closest('tr, .grid-card');
  state.dragSrcId = row.dataset.id;
  row.classList.add('dragging');

  const onMove = e2 => {
    const touch = e2.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetRow = target ? target.closest('tr[data-id], .grid-card[data-id]') : null;
    document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
    if (targetRow && targetRow.dataset.id !== state.dragSrcId) {
      targetRow.classList.add('drag-over');
    }
  };

  const onEnd = e2 => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    row.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));

    const touch = e2.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetRow = target ? target.closest('tr[data-id], .grid-card[data-id]') : null;
    if (targetRow && targetRow.dataset.id !== state.dragSrcId) {
      reorderShots(state.dragSrcId, targetRow.dataset.id);
    }
    state.dragSrcId = null;
  };

  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

export function reorderShots(srcId, targetId) {
  const srcIdx = state.shots.findIndex(s => s.id === srcId);
  const tgtIdx = state.shots.findIndex(s => s.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  const [moved] = state.shots.splice(srcIdx, 1);
  state.shots.splice(tgtIdx, 0, moved);
  save(); render();
}
