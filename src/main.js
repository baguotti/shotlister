import { dom, $ } from './dom.js';
import { state, PRESETS, createShot, createBlock, LS_KEY, LS_TITLE_KEY, LS_PROJECTS_KEY, LS_LAST_PROJ_KEY, LS_THEME_KEY, LS_PRESET_KEY, LS_RATIO_KEY, LS_VIEW_MODE_KEY, LS_GRID_VIS_KEY, LS_SYNC_CODE_KEY, uid, GROUP_MODES, clearSelection, setProjectsList, setCurrentProjectId, setShots, setViewMode, setCurrentGroupMode, setContextRowId, setDragSrcId, setCurrentStoryboardId, setCurrentPreset, setBoardRatio, setGridVisibility } from './state.js';
import { cascadeSchedule, formatDuration, formatOverrun, parseDuration, formatTime } from './schedule.js';
import { renderTable, renderGrid, hideContextMenu, initTableDelegation } from './render-table.js';
import { renderSettings } from './render-settings.js';
import { renderTimeline } from './timeline.js';
import { loadAutocomplete, extractAutocompleteFromShots } from './autocomplete.js';
import { initPWA } from './pwa.js';
import { getProject, putProject, deleteProject } from './db.js';
import { initDrag, initTouchDrag, reorderShots } from './drag-drop.js';
import { initBulkActions, updateSelectionUI } from './bulk-actions.js';
import { initSyncListeners, initSyncAndLoad, syncRequest } from './sync.js';

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


  // ── Preset Control ─────────────────────────────
  export function applyPreset(key) {
    setCurrentPreset(key);
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
      setBoardRatio(e.target.value);
      localStorage.setItem(LS_RATIO_KEY, state.boardRatio);
      applyBoardRatio();
    });
  }

  // ── Layout Persistence ─────────────────────────
  export function saveLayout() {
    try {
      localStorage.setItem(LS_PRESET_KEY, state.currentPreset);
      localStorage.setItem(LS_VIEW_MODE_KEY, state.viewMode);
    } catch(e) { /* ignore */ }
  }

  export function loadLayout() {
    try {
      const pr = localStorage.getItem(LS_PRESET_KEY);
      if (pr && PRESETS[pr]) {
        setCurrentPreset(pr);
        document.querySelectorAll('#presetCtrl button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.preset === pr);
        });
      }
      const vm = localStorage.getItem(LS_VIEW_MODE_KEY);
      if (vm === 'list' || vm === 'grid') {
        setViewMode(vm);
        $('btnViewMode').innerHTML = state.viewMode === 'list' ? '▦ Grid' : '▤ List';
      }
    } catch(e) { /* ignore */ }
  }

  export function loadGridVis() {
    try {
      const vis = localStorage.getItem(LS_GRID_VIS_KEY);
      if (vis) {
        setGridVisibility({ ...state.gridVisibility, ...JSON.parse(vis) });
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
    setGridVisibility({
      header: dom.toggleGridHeader.checked,
      location: dom.toggleGridLocation.checked,
      schedule: dom.toggleGridSchedule.checked,
      description: dom.toggleGridDescription.checked,
      castProps: dom.toggleGridCastProps.checked,
      tech: dom.toggleGridTech.checked
    });
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


  $('btnNewBlank').addEventListener('click', async () => {
    const pid = uid();
    state.projectsList.unshift({ id: pid, title: 'Untitled Project', updatedAt: Date.now(), count: 0 });
    saveProjects();
    await loadProject(pid);
    dom.projectTitle.textContent = 'Untitled Project';
    save();
  });

  $('btnNewTemplate').addEventListener('click', async () => {
    const pid = uid();
    state.projectsList.unshift({ id: pid, title: 'Untitled Project', updatedAt: Date.now(), count: 0 });
    saveProjects();
    await loadProject(pid);
    seedDefaults();
  });

  $('btnImportHome')?.addEventListener('click', () => {
    $('importHomeInput').click();
  });

  $('importHomeInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const pid = uid();
        const title = data.title || 'Imported Project';
        const count = data.shots ? data.shots.length : 0;
        
        state.projectsList.unshift({ id: pid, title, updatedAt: Date.now(), count });
        saveProjects();
        
        const rawShots = data.shots || [];
        await putProject(pid, rawShots);
        
        renderHome();
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
      $('importHomeInput').value = '';
    };
    reader.readAsText(file);
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
    const expBtn = e.target.closest('.pc-exp');
    if (expBtn) {
      e.stopPropagation();
      const idToExp = expBtn.dataset.exp;
      const pToExp = state.projectsList.find(p => p.id === idToExp);
      if (pToExp) {
        try {
          let oldShots = [];
          if (idToExp === state.currentProjectId) {
            oldShots = [...state.shots];
          } else {
            const fromDb = await getProject(idToExp);
            if (Array.isArray(fromDb)) {
              oldShots = fromDb;
            } else {
              const raw = localStorage.getItem('sl-project-' + idToExp);
              if (raw) oldShots = JSON.parse(raw);
            }
          }

          // Build local acSets from the shots
          const localAcSets = { characters: [], location: [], props: [], shotSize: [], lens: [], movement: [] };
          const charsSet = new Set();
          const locsSet = new Set();
          const propsSet = new Set();
          const sizeSet = new Set();
          const lensSet = new Set();
          const moveSet = new Set();

          const SHOT_SIZES = ['ECU','CU','MCU','MS','WIDE','EWS'];
          const LENS_OPTIONS = ['18mm','24mm','35mm','50mm','85mm'];
          const MOVEMENT_TYPES = ['STATIC','HANDHELD','DOLLY','CRANE','DRONE'];

          oldShots.forEach(s => {
            if (s.location) {
              const val = s.location.trim();
              if (val) locsSet.add(val);
            }
            if (s.characters) {
              s.characters.split(',').forEach(part => {
                const val = part.trim();
                if (val) charsSet.add(val);
              });
            }
            if (s.props) {
              s.props.split(',').forEach(part => {
                const val = part.trim();
                if (val) propsSet.add(val);
              });
            }
            if (s.shotSize && !SHOT_SIZES.includes(s.shotSize)) {
              sizeSet.add(s.shotSize);
            }
            if (s.lens && !LENS_OPTIONS.includes(s.lens)) {
              lensSet.add(s.lens);
            }
            if (s.movement && !MOVEMENT_TYPES.includes(s.movement)) {
              moveSet.add(s.movement);
            }
          });

          localAcSets.characters = Array.from(charsSet);
          localAcSets.location = Array.from(locsSet);
          localAcSets.props = Array.from(propsSet);
          localAcSets.shotSize = Array.from(sizeSet);
          localAcSets.lens = Array.from(lensSet);
          localAcSets.movement = Array.from(moveSet);

          const data = {
            title: pToExp.title || 'shotlist',
            shots: oldShots,
            acSets: localAcSets
          };

          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.title + '.json';
          a.click();
          URL.revokeObjectURL(url);
        } catch(err) {
          console.error('Export failed:', err);
        }
      }
      return;
    }

    const delBtn = e.target.closest('.pc-del');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.del;
      if (confirm('Delete this project? This cannot be undone.')) {
        setProjectsList(state.projectsList.filter(p => p.id !== id));
        saveProjects();
        localStorage.removeItem('sl-project-' + id);
        deleteProject(id);
        if (state.syncPasscode) {
          syncRequest('delete_project', { projectId: id });
        }
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
    setCurrentProjectId(null);
    localStorage.removeItem(LS_LAST_PROJ_KEY);
    renderHome();
  });

  $('btnToggleSummary').addEventListener('click', () => {
    const p = $('sceneSummaryPanel');
    const isHidden = p.style.display === 'none';
    p.style.display = isHidden ? 'flex' : 'none';
    $('btnToggleSummary').classList.toggle('active', !isHidden);
  });

  document.querySelectorAll('#dropGroup .dropdown-content .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setCurrentGroupMode(e.target.dataset.group);
      const labelMap = {
        'none': 'Group',
        'scene': 'Group: Scene',
        'location': 'Group: Loc',
        'movement': 'Group: Move',
        'characters': 'Group: Cast',
        'shotSize': 'Group: Size'
      };
      $('btnDropGroup').textContent = `⊞ ${labelMap[state.currentGroupMode] || 'Group'} ▾`;
      render();
    });
  });

  initBulkActions();
  $('btnViewMode').addEventListener('click', () => {
    setViewMode(state.viewMode === 'list' ? 'grid' : 'list');
    $('btnViewMode').innerHTML = state.viewMode === 'list' ? '▦ Grid' : '▤ List';
    try { localStorage.setItem(LS_VIEW_MODE_KEY, state.viewMode); } catch(e) {}
    render();
  });

  $('btnCustomEntries').addEventListener('click', () => {
    renderSettings();
    dom.settingsView.showModal();
  });

  // ── Dropdown click-to-open logic ───────────────
  function initDropdown(dropId) {
    const drop = $(dropId);
    const toggle = drop.querySelector('.dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drop.classList.contains('open');
      // close all first
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      if (!isOpen) drop.classList.add('open');
    });
    // clicking any item inside closes the dropdown
    drop.querySelector('.dropdown-content').addEventListener('click', () => {
      drop.classList.remove('open');
    });
  }
  initDropdown('dropNewProject');
  initDropdown('dropGroup');
  initDropdown('dropSettings');
  // click anywhere outside closes all dropdowns
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  });

  $('btnExport').addEventListener('click', () => {
    const data = {
      title: dom.projectTitle.textContent.trim() || 'shotlist',
      shots: state.shots,
      acSets: {}
    };
    for (const [k, v] of Object.entries(state.acSets)) {
      data.acSets[k] = Array.from(v);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.title + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('btnImport').addEventListener('click', () => {
    dom.importInput.click();
  });

  dom.importInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.title) dom.projectTitle.textContent = data.title;
        if (data.shots) setShots(data.shots);
        if (data.acSets) {
          for (const [k, v] of Object.entries(data.acSets)) {
            if (Array.isArray(v)) state.acSets[k] = new Set(v);
          }
        }
        save();
        render();
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
      dom.importInput.value = '';
    };
    reader.readAsText(file);
  });

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
      if (state.syncPasscode) {
        syncRequest('save_list', state.projectsList);
      }
    } catch(e) {}
  }

  export function migrateLegacyData() {
    try {
      const p = localStorage.getItem(LS_PROJECTS_KEY);
      if (p) setProjectsList(JSON.parse(p));
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
      if (state.syncPasscode) {
        syncRequest('save_project', { projectId: state.currentProjectId, shots: state.shots });
      }
    } catch(e) {
      console.error('IndexedDB save failed:', e);
    }
  }

  export async function loadProject(id) {
    setCurrentProjectId(id);
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

      if (state.syncPasscode) {
        const remoteShots = await syncRequest('get_project', { projectId: id });
        if (remoteShots) {
          rawShots = remoteShots;
          await putProject(id, rawShots);
        }
      }
      
      if (rawShots) {
        setShots(rawShots);
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
        setShots([]);
      }
      const p = state.projectsList.find(x => x.id === id);
      dom.projectTitle.textContent = p ? p.title : 'Untitled Project';
    } catch(e) {
      console.error('Failed to load project from IndexedDB:', e);
      setShots([]);
      dom.projectTitle.textContent = 'Untitled Project';
    }
    
    localStorage.setItem(LS_LAST_PROJ_KEY, id);
    $('homeView').style.display = 'none';
    $('editorView').style.display = 'flex';
    
    setCurrentStoryboardId(null);
    setDragSrcId(null);
    setContextRowId(null);
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
        <div class="pc-meta">${p.count} items · Last edited: ${new Date(p.updatedAt).toLocaleDateString()} ${new Date(p.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
        <button class="pc-dup" data-dup="${p.id}" title="Duplicate project"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
        <button class="pc-exp" data-exp="${p.id}" title="Export project"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
        <button class="pc-del" data-del="${p.id}" title="Delete project"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
      </div>
    `).join('');
  }

  export function seedDefaults() {
    setShots([
      createBlock({ blockType: 'CUSTOM', label: 'CREW CALL / SETUP', duration: '', callTime: '09:00' }),
      // Scene 1: Cafe - Alice & Bob
      createShot({ num: '1', shot: '1', priority: 'medium', location: 'Cafe', characters: 'Alice, Bob', description: 'Wide master shot of Alice and Bob discussing the mystery map', props: 'Old map, coffee cups', duration: '0:15', shotSize: 'WIDE', movement: 'STATIC' }),
      createShot({ num: '1', shot: '2', priority: 'low', location: 'Cafe', characters: 'Alice', description: 'Close up on Alice as she reveals the secret location', props: 'Old map', duration: '0:10', shotSize: 'CU', lens: '50mm', movement: 'STATIC' }),
      createShot({ num: '1', shot: '3', priority: 'low', location: 'Cafe', characters: 'Bob', description: 'Reaction close up on Bob, looking shocked', props: 'Coffee cup', duration: '0:08', shotSize: 'CU', lens: '85mm', movement: 'STATIC' }),
      
      createBlock({ blockType: 'CUSTOM', label: 'LOCATION MOVE / SETUP', duration: '0:20' }),
      
      // Scene 2: Park - Bob alone
      createShot({ num: '2', shot: '1', priority: 'high', location: 'Park', characters: 'Bob', description: 'Tracking shot of Bob walking along the path, searching', props: 'Mobile phone', duration: '0:15', shotSize: 'MCU', lens: '35mm', movement: 'HANDHELD' }),
      createShot({ num: '2', shot: '2', priority: 'medium', location: 'Park', characters: 'Bob', description: 'Insert shot of Bob finding the marked tree', props: 'Compass', duration: '0:05', shotSize: 'ECU', lens: '85mm', movement: 'STATIC' }),
      
      createBlock({ blockType: 'LUNCH', label: 'LUNCH BREAK', duration: '1:00' }),
      
      // Scene 3: Cafe - Alice waiting
      createShot({ num: '3', shot: '1', priority: 'medium', location: 'Cafe', characters: 'Alice', description: 'Medium shot of Alice pacing near the window, checking her watch', props: 'Wristwatch', duration: '0:10', shotSize: 'MS', lens: '35mm', movement: 'DOLLY' }),
      createShot({ num: '3', shot: '2', priority: 'low', location: 'Cafe', characters: 'Alice', description: 'Tight close up on Alice looking anxious', props: '', duration: '0:07', shotSize: 'CU', lens: '50mm', movement: 'STATIC' })
    ]);
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
  if (loadedRatio) setBoardRatio(loadedRatio);
  applyBoardRatio();
  
  initTableDelegation();
  migrateLegacyData();
  loadAutocomplete();

  initSyncListeners();
  initSyncAndLoad();

  // ResizeObserver: reflow preset sizes whenever the table container changes size
  new ResizeObserver(() => applyPresetLayout()).observe(dom.tableWrap);
