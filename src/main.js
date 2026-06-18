import { dom, $ } from './dom.js';
import { state, PRESETS, createShot, createBlock, LS_KEY, LS_TITLE_KEY, LS_PROJECTS_KEY, LS_LAST_PROJ_KEY, LS_THEME_KEY, LS_PRESET_KEY, LS_RATIO_KEY, LS_GRID_VIS_KEY, uid, GROUP_MODES, clearSelection } from './state.js';
import { cascadeSchedule, formatDuration, formatOverrun, parseDuration, formatTime } from './schedule.js';
import { renderTable, renderGrid, hideContextMenu, initTableDelegation } from './render-table.js';
import { renderSettings } from './render-settings.js';
import { renderTimeline } from './timeline.js';
import { loadAutocomplete, extractAutocompleteFromShots } from './autocomplete.js';
import { exportCSV } from './csv.js';
import { initPWA } from './pwa.js';
import { getProject, putProject, deleteProject } from './db.js';

  // ── Title Auto-Resize ──────────────────────────
  // Binary-search the largest font-size that keeps text in one line.
  const TITLE_MIN = 13;
  const TITLE_MAX = 28;

  export function fitTitleFont() {
    const el = dom.projectTitle;
    let lo = TITLE_MIN, hi = TITLE_MAX, best = TITLE_MIN;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      el.style.fontSize = mid + 'px';
      if (el.scrollWidth <= el.offsetWidth) {
        best = mid; lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = best + 'px';
  }

  // Observe width changes (toolbar resize)
  new ResizeObserver(fitTitleFont).observe(dom.projectTitle);
  dom.projectTitle.addEventListener('input', fitTitleFont);

  // ── Responsive Preset Layout ───────────────────
  const BASE_ROW_FACTOR = 0.088; // fraction of dom.tableWrap height for M preset

  // Sizes are derived from the live dom.tableWrap height × preset scale,
  // so they reflow automatically when the window is resized.
  export function computePresetSizes() {
    const wrapper = state.viewMode === 'grid' ? dom.gridWrap : dom.tableWrap;
    const ch = wrapper.clientHeight || Math.round(window.innerHeight * 0.65);
    const scale = PRESETS[state.currentPreset].scale;
    const rowH  = Math.max(30, Math.round(ch * BASE_ROW_FACTOR * scale));
    const thumbSz = Math.max(20, Math.min(rowH - 6, Math.round(rowH * 0.78)));
    return { rowH, thumbSz };
  }

  export function applyPresetLayout() {
    const { rowH, thumbSz } = computePresetSizes();
    const scale = PRESETS[state.currentPreset].scale;

    if (state.viewMode === 'grid') {
      document.documentElement.style.setProperty('--board-scale', scale);
      document.documentElement.style.setProperty('--grid-font-sz', Math.max(10, Math.min(13, Math.round(30 * 0.28 * Math.sqrt(scale)))) + 'px');
      return;
    }

    if (state.viewMode !== 'list') return;
    
    // Use a 1.6 aspect ratio for width so thumbnails are appropriately cinematic and much larger
    const thumbW = Math.round(thumbSz * 1.6);
    
    // Auto-expand storyboard column to fit thumbnail
    const storyboardCol = document.querySelector('.col-storyboard');
    if (storyboardCol) storyboardCol.style.width = Math.max(68, thumbW + 12) + 'px';

    dom.shotBody.querySelectorAll('tr[data-id]').forEach(tr => {
      const isBlock = tr.classList.contains('block-row');
      tr.style.height = (isBlock ? Math.max(30, Math.round(rowH * 0.7)) : rowH) + 'px';
      const thumb = tr.querySelector('.storyboard-cell img, .storyboard-cell .placeholder');
      if (thumb) {
        if (thumb.tagName === 'IMG') {
          thumb.style.maxWidth  = thumbW + 'px';
          thumb.style.maxHeight = thumbSz + 'px';
        } else {
          thumb.style.width  = thumbW + 'px';
          thumb.style.height = thumbSz + 'px';
        }
      }
    });
  }

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

  // ── Preset Control ─────────────────────────────
  export function applyPreset(key) {
    state.currentPreset = key;
    document.querySelectorAll('#presetCtrl button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === key);
    });
    applyPresetLayout();
    saveLayout();
  }

  document.getElementById('presetCtrl').addEventListener('click', e => {
    const btn = e.target.closest('button[data-preset]');
    if (!btn) return;
    applyPreset(btn.dataset.preset);
  });

  // ── Board Aspect Ratio ─────────────────────────
  export function applyBoardRatio() {
    document.documentElement.style.setProperty('--board-ratio', state.boardRatio);
    if (dom.boardRatioSelect) {
      dom.boardRatioSelect.value = state.boardRatio;
    }
  }

  if (dom.boardRatioSelect) {
    dom.boardRatioSelect.addEventListener('change', e => {
      state.boardRatio = e.target.value;
      localStorage.setItem(LS_RATIO_KEY, state.boardRatio);
      applyBoardRatio();
    });
  }

  // ── Layout Persistence ─────────────────────────
  export function saveLayout() {
    try {
      localStorage.setItem(LS_PRESET_KEY, state.currentPreset);
    } catch(e) { /* ignore */ }
  }

  export function loadLayout() {
    try {
      const pr = localStorage.getItem(LS_PRESET_KEY);
      if (pr && PRESETS[pr]) {
        state.currentPreset = pr;
        document.querySelectorAll('#presetCtrl button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.preset === pr);
        });
      }
    } catch(e) { /* ignore */ }
  }

  export function loadGridVis() {
    try {
      const vis = localStorage.getItem(LS_GRID_VIS_KEY);
      if (vis) {
        state.gridVisibility = { ...state.gridVisibility, ...JSON.parse(vis) };
      }
      if (dom.toggleGridHeader) dom.toggleGridHeader.checked = state.gridVisibility.header;
      if (dom.toggleGridLocation) dom.toggleGridLocation.checked = state.gridVisibility.location;
      if (dom.toggleGridSchedule) dom.toggleGridSchedule.checked = state.gridVisibility.schedule;
      if (dom.toggleGridDescription) dom.toggleGridDescription.checked = state.gridVisibility.description;
      if (dom.toggleGridCastProps) dom.toggleGridCastProps.checked = state.gridVisibility.castProps;
      if (dom.toggleGridTech) dom.toggleGridTech.checked = state.gridVisibility.tech;
    } catch(e) { /* ignore */ }
  }

  export function saveGridVis() {
    state.gridVisibility = {
      header: dom.toggleGridHeader.checked,
      location: dom.toggleGridLocation.checked,
      schedule: dom.toggleGridSchedule.checked,
      description: dom.toggleGridDescription.checked,
      castProps: dom.toggleGridCastProps.checked,
      tech: dom.toggleGridTech.checked
    };
    localStorage.setItem(LS_GRID_VIS_KEY, JSON.stringify(state.gridVisibility));
    render();
  }

  // ── Filtering ──────────────────────────────────
  export function getFilteredShots() {
    return state.shots;
  }


  export function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Drag & Drop (mouse) ────────────────────────
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

  // ── Drag & Drop (touch) ────────────────────────
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

  function reorderShots(srcId, targetId) {
    const srcIdx = state.shots.findIndex(s => s.id === srcId);
    const tgtIdx = state.shots.findIndex(s => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = state.shots.splice(srcIdx, 1);
    state.shots.splice(tgtIdx, 0, moved);
    save(); render();
  }

  // ── Stats ──────────────────────────────────────
  export function updateStats() {
    const filtered = getFilteredShots();
    
    const scenes = new Set();
    let shotCount = 0;
    let blockCount = 0;
    
    filtered.forEach(s => {
      if (s.kind === 'block') {
        blockCount++;
      } else {
        shotCount++;
        if (s.num && s.num.trim() !== '') {
          scenes.add(s.num.trim().toUpperCase());
        }
      }
    });

    $('statScenes').textContent = scenes.size;
    $('statShots').textContent = shotCount;
    $('statBlocks').textContent = blockCount;
    let totalMin = 0;
    filtered.forEach(s => {
      const d = parseDuration(s.duration);
      if (d > 0) totalMin += d;
    });
    $('statDuration').textContent = formatDuration(totalMin);

    // Wrap time = last end time
    const lastShot = state.shots[state.shots.length - 1];
    const lastSched = lastShot ? state.scheduleMap[lastShot.id] : null;
    const wrapEl = $('statWrap');
    wrapEl.textContent = (lastSched && lastSched.endMin >= 0) ? formatTime(lastSched.endMin) : '--:--';

    // Total overrun (in minutes)
    let totalOverrunMin = 0;
    Object.values(state.scheduleMap).forEach(sc => { totalOverrunMin += (sc.overrunMin || 0); });
    const overrunEl = $('statOverrun');
    overrunEl.textContent = formatOverrun(totalOverrunMin) || '00:00';
    overrunEl.classList.toggle('overrun-val', totalOverrunMin > 0);

    // Scene Summary Panel
    const panel = $('sceneSummaryPanel');
    if (Object.keys(state.groupTotals).length > 0) {
      panel.innerHTML = Object.entries(state.groupTotals)
        .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([num, data]) => `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:4px; background:${data.bg}; color:${data.color}; border:1px solid ${data.color}">Sc ${num}: ${formatDuration(data.min)}</span>`)
        .join('');
    } else {
      panel.innerHTML = '<span style="color:var(--text-2)">No numbered scenes.</span>';
    }
  }

  // ── Toolbar & Buttons ──────────────────────────
  $('btnAddRow').addEventListener('click', () => {
    const lastShot = [...state.shots].reverse().find(s => s.kind === 'shot');
    let defaultNum = '1';
    let defaultShot = '1';
    if (lastShot) {
      defaultNum = lastShot.num || '1';
      const shotsInScene = state.shots.filter(s => s.kind === 'shot' && s.num === defaultNum);
      if (shotsInScene.length > 0) {
        let maxShotVal = 0;
        shotsInScene.forEach(s => {
          const val = parseInt(s.shot, 10);
          if (!isNaN(val) && val > maxShotVal) {
            maxShotVal = val;
          }
        });
        defaultShot = String(maxShotVal + 1);
      } else {
        defaultShot = '1';
      }
    }
    state.shots.push(createShot({ num: defaultNum, shot: defaultShot }));
    save(); render();
    if (state.viewMode === 'list') {
      dom.tableWrap.scrollTop = dom.tableWrap.scrollHeight;
    } else {
      dom.settingsView.scrollTop = dom.settingsView.scrollHeight;
    }
  });

  $('btnAddBlock').addEventListener('click', () => {
    state.shots.push(createBlock());
    save(); cascadeSchedule(); render();
    if (state.viewMode === 'list') {
      dom.tableWrap.scrollTop = dom.tableWrap.scrollHeight;
    } else {
      dom.settingsView.scrollTop = dom.settingsView.scrollHeight;
    }
  });


  $('btnNewProject').addEventListener('click', async () => {
    const pid = uid();
    state.projectsList.unshift({ id: pid, title: 'Untitled Project', updatedAt: Date.now(), count: 0 });
    saveProjects();
    await loadProject(pid);
    seedDefaults();
  });

  $('projectGrid').addEventListener('click', async e => {
    const dupBtn = e.target.closest('.pc-dup');
    if (dupBtn) {
      e.stopPropagation();
      const idToDup = dupBtn.dataset.dup;
      const pToDup = state.projectsList.find(p => p.id === idToDup);
      if (pToDup) {
        try {
          const newPid = uid();
          let oldShots = [];
          if (idToDup === state.currentProjectId) {
            oldShots = [...state.shots];
          } else {
            const fromDb = await getProject(idToDup);
            if (Array.isArray(fromDb)) {
              oldShots = fromDb;
            } else {
              const raw = localStorage.getItem('sl-project-' + idToDup);
              if (raw) oldShots = JSON.parse(raw);
            }
          }
          const clonedShots = oldShots.map(s => ({...s, id: uid()}));
          
          state.projectsList.unshift({ id: newPid, title: pToDup.title + ' (Copy)', updatedAt: Date.now(), count: clonedShots.length });
          saveProjects();
          
          await putProject(newPid, clonedShots);
          renderHome();
        } catch(err) {
          console.error('Duplicate failed:', err);
        }
      }
      return;
    }

    const delBtn = e.target.closest('.pc-del');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.del;
      if (confirm('Delete this project? This cannot be undone.')) {
        state.projectsList = state.projectsList.filter(p => p.id !== id);
        saveProjects();
        localStorage.removeItem('sl-project-' + id);
        deleteProject(id);
        if (state.currentProjectId === id) localStorage.removeItem(LS_LAST_PROJ_KEY);
        renderHome();
      }
      return;
    }
    
    const card = e.target.closest('.project-card');
    if (card) {
      loadProject(card.dataset.id);
    }
  });

  $('btnHome').addEventListener('click', () => {
    save();
    state.currentProjectId = null;
    localStorage.removeItem(LS_LAST_PROJ_KEY);
    renderHome();
  });

  $('btnToggleSummary').addEventListener('click', () => {
    const p = $('sceneSummaryPanel');
    const isHidden = p.style.display === 'none';
    p.style.display = isHidden ? 'flex' : 'none';
    $('btnToggleSummary').classList.toggle('active', !isHidden);
  });

  $('btnGroupMode').addEventListener('click', () => {
    const idx = GROUP_MODES.indexOf(state.currentGroupMode);
    state.currentGroupMode = GROUP_MODES[(idx + 1) % GROUP_MODES.length];
    const btn = $('btnGroupMode');
    if (state.currentGroupMode === 'none') {
      btn.textContent = '⊞ Group';
      btn.classList.remove('active');
    } else {
      const label = state.currentGroupMode === 'location' ? 'Location' : state.currentGroupMode === 'movement' ? 'Movement' : 'Scene';
      btn.textContent = `⊞ Group: ${label}`;
      btn.classList.add('active');
    }
    render();
  });

  // ── Bulk Actions ───────────────────────────────
  $('btnBulkClear')?.addEventListener('click', () => {
    state.selectedIds.clear();
    updateSelectionUI();
    render();
  });

  $('btnBulkDelete')?.addEventListener('click', () => {
    if (!confirm(`Delete ${state.selectedIds.size} selected items?`)) return;
    state.shots = state.shots.filter(s => !state.selectedIds.has(s.id));
    state.selectedIds.clear();
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
    
    state.selectedIds.clear();
    newShots.forEach(s => state.selectedIds.add(s.id));
    save();
    render();
  });
  $('btnViewMode').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'list' ? 'grid' : 'list';
    $('btnViewMode').innerHTML = state.viewMode === 'list' ? '▦ Grid' : '▤ List';
    render();
  });

  $('btnViewToggle').addEventListener('click', () => {
    renderSettings();
    dom.settingsView.showModal();
  });

  $('btnExportCSV').addEventListener('click', exportCSV);

  $('btnThemeToggle').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.theme;
    const next = current === 'light' ? '' : 'light';
    if (next) {
      root.dataset.theme = 'light';
      localStorage.setItem(LS_THEME_KEY, 'light');
      document.querySelector('meta[name="color-scheme"]').content = 'light';
    } else {
      delete root.dataset.theme;
      localStorage.setItem(LS_THEME_KEY, 'dark');
      document.querySelector('meta[name="color-scheme"]').content = 'dark';
    }
  });

  // ── Print ──────────────────────────────────────
  $('btnPrint').addEventListener('click', () => {
    $('printTitle').textContent = dom.projectTitle.textContent.trim() || 'Untitled Project';
    $('printDate').textContent  = new Date().toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    window.print();
  });
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      $('btnPrint').click();
    }
  });

  // Restore theme
  {
    const saved = localStorage.getItem(LS_THEME_KEY);
    if (saved === 'light') {
      document.documentElement.dataset.theme = 'light';
    }
  }

  // Title contenteditable events
  dom.projectTitle.addEventListener('blur', () => { save(); fitTitleFont(); });
  dom.projectTitle.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); dom.projectTitle.blur(); }
  });
  dom.projectTitle.addEventListener('paste', e => {
    // Paste as plain text only
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // ── Persistence ────────────────────────────────
  export function saveProjects() {
    try {
      localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(state.projectsList));
    } catch(e) {}
  }

  export function migrateLegacyData() {
    try {
      const p = localStorage.getItem(LS_PROJECTS_KEY);
      if (p) state.projectsList = JSON.parse(p);
    } catch(e) {}
    
    const raw = localStorage.getItem(LS_KEY);
    if (raw && state.projectsList.length === 0) {
      const oldTitle = localStorage.getItem(LS_TITLE_KEY) || 'Legacy Project';
      const pid = uid();
      localStorage.setItem('sl-project-' + pid, raw);
      let legacyShots = [];
      try { legacyShots = JSON.parse(raw); } catch(e){}
      state.projectsList.push({ id: pid, title: oldTitle, updatedAt: Date.now(), count: legacyShots.length });
      saveProjects();
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TITLE_KEY);
    }
  }

  export async function save() {
    if (!state.currentProjectId) return;
    try {
      await putProject(state.currentProjectId, state.shots);
      const p = state.projectsList.find(x => x.id === state.currentProjectId);
      if (p) {
        p.title = dom.projectTitle.textContent.trim() || 'Untitled Project';
        p.updatedAt = Date.now();
        p.count = state.shots.length;
        saveProjects();
      }
    } catch(e) {
      console.error('IndexedDB save failed:', e);
    }
  }

  export async function loadProject(id) {
    state.currentProjectId = id;
    try {
      let rawShots = null;
      // Check localStorage first (migration)
      const lsRaw = localStorage.getItem('sl-project-' + id);
      if (lsRaw) {
        rawShots = JSON.parse(lsRaw);
        await putProject(id, rawShots);
        localStorage.removeItem('sl-project-' + id);
      } else {
        rawShots = await getProject(id);
      }
      
      if (rawShots) {
        state.shots = rawShots;
        let sceneShotCounters = {};
        state.shots.forEach(s => {
          if (s.callTime === undefined) s.callTime = '';
          // Migrate legacy shotType → movement
          if (s.movement === undefined) {
            s.movement = s.shotType ? s.shotType.toUpperCase() : 'STATIC';
          }
          delete s.shotType;
          if (s.shotSize === undefined) s.shotSize = '';
          if (s.lens === undefined) s.lens = '';
          
          if (s.kind === 'shot') {
            if (s.shot === undefined) {
              const sceneKey = s.num || '_';
              sceneShotCounters[sceneKey] = (sceneShotCounters[sceneKey] || 0) + 1;
              s.shot = String(sceneShotCounters[sceneKey]);
            }
          } else {
            s.shot = '';
          }
        });
        extractAutocompleteFromShots();
      } else {
        state.shots = [];
      }
      const p = state.projectsList.find(x => x.id === id);
      dom.projectTitle.textContent = p ? p.title : 'Untitled Project';
    } catch(e) {
      console.error('Failed to load project from IndexedDB:', e);
      state.shots = [];
      dom.projectTitle.textContent = 'Untitled Project';
    }
    
    localStorage.setItem(LS_LAST_PROJ_KEY, id);
    $('homeView').style.display = 'none';
    $('editorView').style.display = 'flex';
    
    state.currentStoryboardId = null;
    state.dragSrcId = null;
    state.contextRowId = null;
    hideContextMenu();
    clearSelection();
    updateSelectionUI();
    
    render();
    requestAnimationFrame(fitTitleFont);
  }

  export function renderHome() {
    $('editorView').style.display = 'none';
    $('homeView').style.display = 'flex';
    
    const grid = $('projectGrid');
    if (state.projectsList.length === 0) {
      grid.innerHTML = `<div style="color:var(--text-2); grid-column: 1/-1;">No projects yet. Click "+ New Project" to start.</div>`;
      return;
    }
    
    const sorted = [...state.projectsList].sort((a,b) => b.updatedAt - a.updatedAt);
    grid.innerHTML = sorted.map(p => `
      <div class="project-card" data-id="${p.id}">
        <div class="pc-title">${esc(p.title || 'Untitled')}</div>
        <div class="pc-meta">${p.count} items · Last edited: ${new Date(p.updatedAt).toLocaleDateString()}</div>
        <button class="pc-dup" data-dup="${p.id}" title="Duplicate Project">📄</button>
        <button class="pc-del" data-del="${p.id}" title="Delete Project">🗑</button>
      </div>
    `).join('');
  }

  export function seedDefaults() {
    state.shots = [
      createShot({ num: '1', shot: '1', movement: 'STATIC', shotSize: 'WIDE', characters: 'Alex', location: 'EXT. Rooftop', notes: 'Wide establishing shot of skyline at dusk', duration: '00:05', callTime: '07:00' }),
      createShot({ num: '2', shot: '2', movement: 'HANDHELD', shotSize: 'CU', characters: 'Alex, Sam', location: 'INT. Kitchen', notes: 'Close-up dialogue, over-the-shoulder', props: 'Coffee mug, newspaper', duration: '00:30' }),
      createShot({ num: '3', shot: '3', movement: 'DOLLY', shotSize: 'MS', characters: 'Sam', location: 'EXT. Rooftop', notes: 'Tracking shot following character to edge', duration: '01:20', priority: 'high' }),
    ];
    dom.projectTitle.textContent = 'Untitled Project';
    save();
  }

  // ── Render Orchestrator ────────────────────────
  export function render() {
    cascadeSchedule();
    renderTimeline();

    if (state.viewMode === 'grid') {
      dom.tableWrap.classList.add('hidden');
      dom.tableWrap.style.display = 'none';
      dom.gridWrap.classList.remove('hidden');
      dom.gridWrap.style.display = '';
      dom.gridSettingsBar.style.display = 'flex';
      renderGrid();
    } else {
      dom.gridWrap.classList.add('hidden');
      dom.gridWrap.style.display = 'none';
      dom.tableWrap.classList.remove('hidden');
      dom.tableWrap.style.display = '';
      dom.gridSettingsBar.style.display = 'none';
      renderTable();
    }
    applyPresetLayout();
  }

  // ── Init ───────────────────────────────────────
  loadLayout();
  loadGridVis();
  
  [dom.toggleGridHeader, dom.toggleGridLocation, dom.toggleGridSchedule, dom.toggleGridDescription, dom.toggleGridCastProps, dom.toggleGridTech].forEach(t => {
    if (t) t.addEventListener('change', saveGridVis);
  });
  const loadedRatio = localStorage.getItem(LS_RATIO_KEY);
  if (loadedRatio) state.boardRatio = loadedRatio;
  applyBoardRatio();
  
  initTableDelegation();
  migrateLegacyData();
  loadAutocomplete();
  
  const lastId = localStorage.getItem(LS_LAST_PROJ_KEY);
  if (lastId && state.projectsList.find(p => p.id === lastId)) {
    loadProject(lastId);
  } else {
    renderHome();
  }

  // ResizeObserver: reflow preset sizes whenever the table container changes size
  new ResizeObserver(() => applyPresetLayout()).observe(dom.tableWrap);

