import { state, clearSelection, uid, setShots, getShot } from './state.js';
import { dom, $ } from './dom.js';
import { render } from './events.js';
import { save } from './storage.js';

export function updateSelectionUI() {
  const bar = $('bulkActionBar');
  if (!bar) return;
  const count = state.selectedIds.size;
  if (count > 0) {
    $('bulkCount').textContent = `${count} selected`;
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
  
  // Sync Select All checkbox in header
  const selectAll = $('selectAll');
  if (selectAll) {
    selectAll.checked = count > 0 && count === state.shots.length;
    selectAll.indeterminate = count > 0 && count < state.shots.length;
  }
}

export function applyBulkEdit(id, field, val) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.forEach(selectedId => {
      const s = getShot(selectedId);
      if (s) s[field] = val;
    });
  } else {
    const shot = getShot(id);
    if (shot) shot[field] = val;
  }
  if (field === 'duration' || field === 'callTime') {
    state.scheduleDirty = true;
  }
}

export function initBulkActions() {
  $('btnBulkClear')?.addEventListener('click', () => {
    clearSelection();
    updateSelectionUI();
    document.querySelectorAll('tr.selected, .grid-card.selected').forEach(el => {
      el.classList.remove('selected');
      const cb = el.querySelector('.row-checkbox');
      if (cb) cb.checked = false;
    });
  });

  $('btnBulkDelete')?.addEventListener('click', () => {
    if (!confirm(`Delete ${state.selectedIds.size} selected items?`)) return;
    setShots(state.shots.filter(s => !state.selectedIds.has(s.id)));
    clearSelection();
    save();
    render();
  });

  $('btnBulkDuplicate')?.addEventListener('click', () => {
    const toDuplicate = state.shots.filter(s => state.selectedIds.has(s.id));
    let lastIdx = -1;
    toDuplicate.forEach(s => {
      const idx = state.shots.findIndex(x => x.id === s.id);
      if (idx > lastIdx) lastIdx = idx;
    });
    
    const newShots = toDuplicate.map(s => {
      return { ...s, id: uid() };
    });

    const updatedShots = [...state.shots];
    if (lastIdx !== -1) {
      updatedShots.splice(lastIdx + 1, 0, ...newShots);
    } else {
      updatedShots.push(...newShots);
    }
    setShots(updatedShots);
    
    clearSelection();
    newShots.forEach(s => state.selectedIds.add(s.id));
    save();
    render();
  });
}
