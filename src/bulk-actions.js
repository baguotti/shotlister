import { state, clearSelection, uid } from './state.js';
import { dom, $ } from './dom.js';
import { render, save } from './main.js';

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
      const s = state.shots.find(x => x.id === selectedId);
      if (s) s[field] = val;
    });
  } else {
    const shot = state.shots.find(s => s.id === id);
    if (shot) shot[field] = val;
  }
}

export function initBulkActions() {
  $('btnBulkClear')?.addEventListener('click', () => {
    clearSelection();
    updateSelectionUI();
    render();
  });

  $('btnBulkDelete')?.addEventListener('click', () => {
    if (!confirm(`Delete ${state.selectedIds.size} selected items?`)) return;
    state.shots = state.shots.filter(s => !state.selectedIds.has(s.id));
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

    if (lastIdx !== -1) {
      state.shots.splice(lastIdx + 1, 0, ...newShots);
    } else {
      state.shots.push(...newShots);
    }
    
    clearSelection();
    newShots.forEach(s => state.selectedIds.add(s.id));
    save();
    render();
  });
}
