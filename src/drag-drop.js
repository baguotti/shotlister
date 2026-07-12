import { state, setShots, getShot } from './state.js';
import { render } from './events.js';
import { save } from './storage.js';
import { softRender } from './render-table.js';

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
  const updatedShots = [...state.shots];
  const [moved] = updatedShots.splice(srcIdx, 1);
  updatedShots.splice(tgtIdx, 0, moved);
  state.scheduleDirty = true;
  setShots(updatedShots);
  if (state.currentGroupMode !== 'none') {
    save(); render();
    return;
  }
  
  const srcRow = document.querySelector(`tr[data-id="${srcId}"]`);
  const tgtRow = document.querySelector(`tr[data-id="${targetId}"]`);
  if (srcRow && tgtRow) {
    if (srcIdx < tgtIdx) tgtRow.after(srcRow);
    else tgtRow.before(srcRow);
  }
  
  const srcCard = document.querySelector(`.grid-card[data-id="${srcId}"]`);
  const tgtCard = document.querySelector(`.grid-card[data-id="${targetId}"]`);
  if (srcCard && tgtCard) {
    if (srcIdx < tgtIdx) tgtCard.after(srcCard);
    else tgtCard.before(srcCard);
  }
  
  save(); softRender();
}

export function initTouchSwipe(e, row) {
  const touchStart = e.touches[0];
  const startX = touchStart.clientX;
  const startY = touchStart.clientY;
  let isSwiping = false;
  let directionDetermined = false;

  const onMove = e2 => {
    const touch = e2.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!directionDetermined) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isSwiping = true;
        directionDetermined = true;
      } else if (Math.abs(dy) > 10) {
        directionDetermined = true;
      }
    }

    if (isSwiping) {
      e2.preventDefault();
      row.style.transform = `translateX(${dx}px)`;
    }
  };

  const onEnd = e2 => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    row.style.transform = '';

    if (isSwiping) {
      const touch = e2.changedTouches[0];
      const dx = touch.clientX - startX;
      if (Math.abs(dx) > 150) {
        const shot = getShot(row.dataset.id);
        if (shot) {
          shot.archived = !shot.archived;
          save();
          render();
        }
      }
    }
  };

  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}
