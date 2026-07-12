import { dom, $, customPrompt } from './dom.js';
import { ICON_DUP, ICON_EXP, ICON_DEL } from './icons.js';
import { state, PRESETS, createShot, createBlock, LS_KEY, LS_TITLE_KEY, LS_PROJECTS_KEY, LS_LAST_PROJ_KEY, LS_THEME_KEY, LS_PRESET_KEY, LS_RATIO_KEY, LS_VIEW_MODE_KEY, LS_GRID_VIS_KEY, LS_TABLE_VIS_KEY, LS_SYNC_CODE_KEY, LS_LIST_PRESETS_KEY, uid, GROUP_MODES, clearSelection, getNextShotNumber, setShots } from './state.js';
import { esc } from './utils.js';
import { cascadeSchedule, formatDuration, formatOverrun, parseDuration, formatTime } from './schedule.js';
import { renderTable, renderGrid, hideContextMenu, initTableDelegation } from './render-table.js';
import { renderSettings } from './render-settings.js';
import { renderTimeline } from './timeline.js';
import { loadAutocomplete, extractAutocompleteFromShots, buildAutocompleteSets } from './autocomplete.js';
import { initPWA } from './pwa.js';
import { getProject, putProject, deleteProject, putImage, getImage } from './db.js';
import { initDrag, initTouchDrag, reorderShots } from './drag-drop.js';
import { initBulkActions, updateSelectionUI } from './bulk-actions.js';
import { initSyncListeners, initSyncAndLoad, syncRequest } from './sync.js';
import { save, saveProjects, migrateLegacyData } from './storage.js';
import { initTooltips } from './tooltip.js';
import { onRender, render } from './events.js';

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

// ── Global ResizeObserver ──────────────────────
export const globalObserver = new ResizeObserver(entries => {
  for (let entry of entries) {
    if (entry.target === dom.projectTitle) {
      if (titleRaf) cancelAnimationFrame(titleRaf);
      titleRaf = requestAnimationFrame(fitTitleFont);
    }
    if (entry.target === dom.tableWrap || entry.target === dom.gridWrap) {
      applyPresetLayout();
    }
  }
});

// Observe width changes (toolbar resize)
globalObserver.observe(dom.projectTitle);
let titleRaf = null;
dom.projectTitle.addEventListener('input', () => {
  if (titleRaf) cancelAnimationFrame(titleRaf);
  titleRaf = requestAnimationFrame(fitTitleFont);
});

// ── Responsive Preset Layout ───────────────────
const BASE_ROW_FACTOR = 0.088; // fraction of dom.tableWrap height for M preset

// Sizes are derived from the live dom.tableWrap height × preset scale,
// so they reflow automatically when the window is resized.
export function computePresetSizes() {
  const wrapper = state.viewMode === 'grid' ? dom.gridWrap : dom.tableWrap;
  const ch = wrapper.clientHeight || Math.round(window.innerHeight * 0.65);
  const scale = PRESETS[state.currentPreset].scale;
  const rowH = Math.max(30, Math.round(ch * BASE_ROW_FACTOR * scale));
  const thumbSz = rowH;
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

  let ratioVal = 1.6;
  if (state.boardRatio) {
    const parts = state.boardRatio.split('/');
    if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
      ratioVal = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      ratioVal = parseFloat(state.boardRatio) || 1.6;
    }
  }

  const thumbW = Math.round(thumbSz * ratioVal);

  // Auto-expand storyboard column to fit thumbnail exactly
  const storyboardCol = document.querySelector('.col-storyboard');
  if (storyboardCol) {
    if (state.currentPreset === 'XS') {
      storyboardCol.style.width = '32px';
    } else {
      storyboardCol.style.width = Math.max(68, thumbW) + 'px';
    }
  }

  dom.shotBody.querySelectorAll('tr[data-id]').forEach(tr => {
    const isBlock = tr.classList.contains('block-row');
    tr.style.height = (isBlock ? Math.max(30, Math.round(rowH * 0.7)) : rowH) + 'px';
    const thumb = tr.querySelector('.storyboard-cell img, .storyboard-cell .placeholder');
    if (thumb) {
      // Clear any old inline dimensions so CSS completely controls the object-fit covering
      thumb.style.maxWidth = '';
      thumb.style.maxHeight = '';
      thumb.style.width = '';
      thumb.style.height = '';
    }
  });
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
    localStorage.setItem(LS_VIEW_MODE_KEY, state.viewMode);
  } catch (e) { /* ignore */ }
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
    const vm = localStorage.getItem(LS_VIEW_MODE_KEY);
    if (vm === 'list' || vm === 'grid') {
      state.viewMode = vm;
      $('btnViewMode').innerHTML = state.viewMode === 'list' ? '▦ Grid' : '▤ List';
    }
  } catch (e) { /* ignore */ }
}

export function updateGridAllState() {
  if (!dom.toggleGridAll) return;
  const toggles = [
    dom.toggleGridHeader,
    dom.toggleGridLocation,
    dom.toggleGridSchedule,
    dom.toggleGridDescription,
    dom.toggleGridCastProps,
    dom.toggleGridTech
  ];
  const allChecked = toggles.every(t => !t || t.checked);
  const someChecked = toggles.some(t => t && t.checked);
  dom.toggleGridAll.checked = allChecked;
  dom.toggleGridAll.indeterminate = someChecked && !allChecked;
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
    updateGridAllState();
  } catch (e) { /* ignore */ }
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
  updateGridAllState();
  render();
}

export function loadTableVis() {
  try {
    const vis = localStorage.getItem(LS_TABLE_VIS_KEY);
    if (vis) {
      state.tableVisibility = { ...state.tableVisibility, ...JSON.parse(vis) };
    }
    if (dom.tcPriority) dom.tcPriority.checked = state.tableVisibility.priority;
    if (dom.tcLocation) dom.tcLocation.checked = state.tableVisibility.location;
    if (dom.tcDescription) dom.tcDescription.checked = state.tableVisibility.description;
    if (dom.tcNotes) dom.tcNotes.checked = state.tableVisibility.notes;
    if (dom.tcCharacters) dom.tcCharacters.checked = state.tableVisibility.characters;
    if (dom.tcShotsize) dom.tcShotsize.checked = state.tableVisibility.shotsize;
    if (dom.tcLens) dom.tcLens.checked = state.tableVisibility.lens;
    if (dom.tcMovement) dom.tcMovement.checked = state.tableVisibility.movement;
    if (dom.tcProps) dom.tcProps.checked = state.tableVisibility.props;
    if (dom.tcDuration) dom.tcDuration.checked = state.tableVisibility.duration;
    if (dom.tcCalltime) dom.tcCalltime.checked = state.tableVisibility.calltime;
    if (dom.tcEndtime) dom.tcEndtime.checked = state.tableVisibility.endtime;
    if (dom.tcRunning) dom.tcRunning.checked = state.tableVisibility.running;
    applyTableVis();
  } catch (e) { /* ignore */ }
}

export function saveTableVis() {
  state.tableVisibility = {
    priority: dom.tcPriority.checked,
    location: dom.tcLocation.checked,
    description: dom.tcDescription.checked,
    notes: dom.tcNotes.checked,
    characters: dom.tcCharacters.checked,
    shotsize: dom.tcShotsize.checked,
    lens: dom.tcLens.checked,
    movement: dom.tcMovement.checked,
    props: dom.tcProps.checked,
    duration: dom.tcDuration.checked,
    calltime: dom.tcCalltime.checked,
    endtime: dom.tcEndtime.checked,
    running: dom.tcRunning.checked
  };
  localStorage.setItem(LS_TABLE_VIS_KEY, JSON.stringify(state.tableVisibility));
  applyTableVis();
}

export function loadListPresets() {
  try {
    const raw = localStorage.getItem(LS_LIST_PRESETS_KEY);
    if (raw) state.listPresets = JSON.parse(raw);
    else state.listPresets = {};
  } catch (e) {
    state.listPresets = {};
  }
}

export function saveListPresets() {
  localStorage.setItem(LS_LIST_PRESETS_KEY, JSON.stringify(state.listPresets));
}

export function renderListPresets() {
  if (!dom.customListPresetsContainer) return;
  dom.customListPresetsContainer.innerHTML = '';
  for (const presetName of Object.keys(state.listPresets)) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'border: none; background: transparent; width: 100%; justify-content: space-between; padding: 6px 12px;';
    
    const label = document.createElement('span');
    label.textContent = presetName;
    label.style.pointerEvents = 'none';
    
    const del = document.createElement('span');
    del.innerHTML = '×';
    del.style.cssText = 'color: var(--text-2); pointer-events: auto; padding: 0 4px;';
    del.title = 'Delete preset';
    del.onclick = (e) => {
      e.stopPropagation();
      delete state.listPresets[presetName];
      saveListPresets();
      renderListPresets();
    };
    
    btn.appendChild(label);
    btn.appendChild(del);
    
    btn.onclick = () => {
      applyListPreset(presetName);
      const drop = dom.customListPresetsContainer.closest('.dropdown');
      if (drop) drop.classList.remove('open');
    };
    
    dom.customListPresetsContainer.appendChild(btn);
  }
}

export function applyTableVis() {
  if (dom.thPriority) dom.thPriority.style.display = state.tableVisibility.priority ? '' : 'none';
  if (dom.thLocation) dom.thLocation.style.display = state.tableVisibility.location ? '' : 'none';
  if (dom.thDescription) dom.thDescription.style.display = state.tableVisibility.description ? '' : 'none';
  if (dom.thNotes) dom.thNotes.style.display = state.tableVisibility.notes ? '' : 'none';
  if (dom.thCharacters) dom.thCharacters.style.display = state.tableVisibility.characters ? '' : 'none';
  if (dom.thShotsize) dom.thShotsize.style.display = state.tableVisibility.shotsize ? '' : 'none';
  if (dom.thLens) dom.thLens.style.display = state.tableVisibility.lens ? '' : 'none';
  if (dom.thMovement) dom.thMovement.style.display = state.tableVisibility.movement ? '' : 'none';
  if (dom.thProps) dom.thProps.style.display = state.tableVisibility.props ? '' : 'none';
  if (dom.thDuration) dom.thDuration.style.display = state.tableVisibility.duration ? '' : 'none';
  if (dom.thCalltime) dom.thCalltime.style.display = state.tableVisibility.calltime ? '' : 'none';
  if (dom.thEndtime) dom.thEndtime.style.display = state.tableVisibility.endtime ? '' : 'none';
  if (dom.thRunning) dom.thRunning.style.display = state.tableVisibility.running ? '' : 'none';
  render();
}

// ── Filtering ──────────────────────────────────





// ── Stats ──────────────────────────────────────
export function updateStats() {
  const filtered = state.shots;

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
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
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
  if (lastShot) defaultNum = lastShot.num || '1';
  let defaultShot = getNextShotNumber(defaultNum, state.shots);
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
        let oldShots = await getShotsForProject(idToDup);
        const clonedShots = [];
        const imageCopies = [];

        for (const s of oldShots) {
          const newId = uid();
          clonedShots.push({ ...s, id: newId });
          if (s.storyboard) {
            imageCopies.push((async () => {
              try {
                const imgData = await getImage(s.id);
                if (imgData) {
                  await putImage(newId, imgData);
                }
              } catch (e) {
                console.error(`Failed to copy storyboard image for shot ${s.id}:`, e);
              }
            })());
          }
        }

        await Promise.all(imageCopies);

        state.projectsList.unshift({ id: newPid, title: pToDup.title + ' (Copy)', updatedAt: Date.now(), count: clonedShots.length });
        saveProjects();

        await putProject(newPid, clonedShots);
        renderHome();
      } catch (err) {
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
        let oldShots = await getShotsForProject(idToExp);

        // Build local acSets from the shots
        const sets = buildAutocompleteSets(oldShots);
        const localAcSets = {
          characters: Array.from(sets.characters),
          location: Array.from(sets.location),
          props: Array.from(sets.props),
          shotSize: Array.from(sets.shotSize),
          lens: Array.from(sets.lens),
          movement: Array.from(sets.movement)
        };

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
      } catch (err) {
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
      state.projectsList = state.projectsList.filter(p => p.id !== id);
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
  state.currentProjectId = null;
  localStorage.removeItem(LS_LAST_PROJ_KEY);
  renderHome();
});

const updateZenIcon = (isZen) => {
  const icon = $('iconFullscreen');
  if (isZen) {
    if (icon) icon.innerHTML = '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>';
  } else {
    if (icon) icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
  }
};

$('btnFullscreen')?.addEventListener('click', () => {
  const isZen = document.body.classList.contains('zen-mode');
  if (!isZen) {
    document.body.classList.add('zen-mode');
    updateZenIcon(true);
    const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    if (req) req.call(document.documentElement).catch(() => { });
  } else {
    document.body.classList.remove('zen-mode');
    updateZenIcon(false);
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
      exit.call(document).catch(() => { });
    }
  }
});

const onFSChange = () => {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    document.body.classList.remove('zen-mode');
    updateZenIcon(false);
  }
};
document.addEventListener('fullscreenchange', onFSChange);
document.addEventListener('webkitfullscreenchange', onFSChange);

$('btnToggleSummary').addEventListener('click', () => {
  const p = $('sceneSummaryPanel');
  const isHidden = p.style.display === 'none';
  p.style.display = isHidden ? 'flex' : 'none';
  $('btnToggleSummary').classList.toggle('active', !isHidden);
});

document.querySelectorAll('#dropGroup .dropdown-content .btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    state.currentGroupMode = e.target.dataset.group;
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
  state.viewMode = state.viewMode === 'list' ? 'grid' : 'list';
  $('btnViewMode').innerHTML = state.viewMode === 'list' ? '▦ Grid' : '▤ List';
  try { localStorage.setItem(LS_VIEW_MODE_KEY, state.viewMode); } catch (e) { }
  render();
});

$('btnCustomEntries').addEventListener('click', () => {
  renderSettings();
  dom.settingsView.showModal();
});

// ── Dropdown click-to-open logic ───────────────
function initDropdown(dropId, closeOnClick = true) {
  const drop = $(dropId);
  if (!drop) return;
  const toggle = drop.querySelector('.dropdown-toggle');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = drop.classList.contains('open');
    // close all first
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) drop.classList.add('open');
  });
  if (closeOnClick) {
    drop.querySelector('.dropdown-content').addEventListener('click', () => {
      drop.classList.remove('open');
    });
  } else {
    drop.querySelector('.dropdown-content').addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}
initDropdown('dropNewProject');
initDropdown('dropGroup');
initDropdown('dropSettings');
initDropdown('dropListColumns');
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
function clearPrintFilters() {
  document.querySelectorAll('.print-hidden').forEach(el => el.classList.remove('print-hidden'));
}

function openPrintModal() {
  const container = $('printSceneOptions');
  if (!container) return;
  container.innerHTML = '';

  const sceneCounts = new Map();
  const sceneOrder = [];
  state.shots.forEach(s => {
    const num = s.num ? String(s.num).trim() : '';
    if (num) {
      if (!sceneCounts.has(num)) {
        sceneCounts.set(num, 0);
        sceneOrder.push(num);
      }
      if (s.kind === 'shot') {
        sceneCounts.set(num, sceneCounts.get(num) + 1);
      }
    }
  });

  const totalShots = state.shots.filter(s => s.kind === 'shot').length;

  const allLabel = document.createElement('label');
  allLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-1);';
  allLabel.innerHTML = `
    <input type="checkbox" id="printSelectAll" checked style="margin: 0; cursor: pointer;">
    <span style="font-weight: 600; color: var(--text-0);">ALL (Entire Project — ${totalShots} shots)</span>
  `;
  container.appendChild(allLabel);

  const sceneCheckboxes = [];

  sceneOrder.forEach(num => {
    const count = sceneCounts.get(num) || 0;
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-1);';
    lbl.innerHTML = `
      <input type="checkbox" class="print-scene-chk" value="${esc(num)}" checked style="margin: 0; cursor: pointer;">
      <span style="font-weight: 600; color: var(--text-0);">SCENE ${esc(num)} (${count} ${count === 1 ? 'shot' : 'shots'})</span>
    `;
    container.appendChild(lbl);

    const chk = lbl.querySelector('.print-scene-chk');
    sceneCheckboxes.push(chk);
  });

  const selectAllChk = allLabel.querySelector('#printSelectAll');

  selectAllChk.addEventListener('change', () => {
    const checked = selectAllChk.checked;
    sceneCheckboxes.forEach(chk => {
      chk.checked = checked;
    });
  });

  sceneCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const allChecked = sceneCheckboxes.every(c => c.checked);
      selectAllChk.checked = allChecked;
    });
  });

  const modal = $('printModal');
  if (modal) modal.showModal();
}

$('btnPrint').addEventListener('click', (e) => {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  const drop = $('dropSettings');
  if (drop) drop.classList.remove('open');
  setTimeout(() => openPrintModal(), 50);
});

$('printModalClose')?.addEventListener('click', () => $('printModal')?.close());
$('printModalCancel')?.addEventListener('click', () => $('printModal')?.close());

$('printModalConfirm')?.addEventListener('click', (e) => {
  if (e && e.preventDefault) e.preventDefault();
  
  const selectAllChk = $('printSelectAll');
  const checkedChks = document.querySelectorAll('.print-scene-chk:checked');
  const allChks = document.querySelectorAll('.print-scene-chk');

  const printAll = selectAllChk && selectAllChk.checked;
  const modal = $('printModal');
  if (modal) modal.close();

  clearPrintFilters();

  const selectedScenes = new Set(Array.from(checkedChks).map(c => c.value));

  if (!printAll) {
    document.querySelectorAll('[data-scene]').forEach(el => {
      const sceneNum = el.dataset.scene ? String(el.dataset.scene).trim() : '';
      if (!selectedScenes.has(sceneNum)) {
        el.classList.add('print-hidden');
      }
    });
  }

  let titleSuffix = '';
  if (printAll || selectedScenes.size === allChks.length) {
    titleSuffix = '';
  } else if (selectedScenes.size === 1) {
    titleSuffix = ' — SCENE ' + Array.from(selectedScenes)[0];
  } else if (selectedScenes.size > 0) {
    titleSuffix = ' — SCENES ' + Array.from(selectedScenes).sort((a, b) => {
      const aNum = parseInt(a), bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    }).join(', ');
  } else {
    titleSuffix = ' — EMPTY';
  }

  $('printTitle').textContent = (dom.projectTitle.textContent.trim() || 'Untitled Project') + titleSuffix;
  $('printDate').textContent = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  setTimeout(() => {
    window.print();
    setTimeout(clearPrintFilters, 1500);
  }, 300);
});

window.addEventListener('afterprint', clearPrintFilters);

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    openPrintModal();
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
// Global paste handler to paste as plain text only for contenteditable elements
document.addEventListener('paste', e => {
  const target = e.target;
  if (target.closest('[contenteditable="true"]')) {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }
});

// ── Persistence ────────────────────────────────


export async function getShotsForProject(id) {
  if (id === state.currentProjectId) return [...state.shots];
  const fromDb = await getProject(id);
  if (Array.isArray(fromDb)) return fromDb;
  const raw = localStorage.getItem('sl-project-' + id);
  return raw ? JSON.parse(raw) : [];
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

    if (state.syncPasscode) {
      const remoteShots = await syncRequest('get_project', { projectId: id });
      if (remoteShots) {
        rawShots = remoteShots;
        await putProject(id, rawShots);
      }
    }

    if (rawShots) {
      // MIGRATION: move base64 images out of shot objects into IndexedDB
      let imagesMigrated = false;
      for (const s of rawShots) {
        if (typeof s.storyboard === 'string' && s.storyboard.startsWith('data:image/')) {
          await putImage(s.id, s.storyboard);
          if (state.syncPasscode) {
            await syncRequest('save_image', { imageId: s.id, dataUrl: s.storyboard });
          }
          s.storyboard = true;
          imagesMigrated = true;
        }
      }
      if (imagesMigrated) {
        await putProject(id, rawShots);
      }

      setShots(rawShots);
      let sceneShotCounters = {};
      state.shots.forEach(s => {
        if (s.callTime === undefined) s.callTime = '';
        // Migrate legacy shotType → movement
        if (s.movement === undefined) {
          s.movement = s.shotType ? s.shotType.toUpperCase() : '';
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
  } catch (e) {
    console.error('Failed to load project from IndexedDB:', e);
    setShots([]);
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

  state.scheduleDirty = true;
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

  const sorted = [...state.projectsList].sort((a, b) => b.updatedAt - a.updatedAt);
  grid.innerHTML = sorted.map(p => `
      <div class="project-card" data-id="${p.id}">
        <div class="pc-title">${esc(p.title || 'Untitled')}</div>
        <div class="pc-meta">${p.count} items · Last edited: ${new Date(p.updatedAt).toLocaleDateString()} ${new Date(p.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
        <button class="pc-dup" data-dup="${p.id}" title="Duplicate project">${ICON_DUP}</button>
        <button class="pc-exp" data-exp="${p.id}" title="Export project">${ICON_EXP}</button>
        <button class="pc-del" data-del="${p.id}" title="Delete project">${ICON_DEL}</button>
      </div>
    `).join('');
}

export function seedDefaults() {
  setShots([
    createBlock({ blockType: 'CUSTOM', label: 'CREW CALL / SETUP', duration: '', callTime: '09:00' }),
    // Scene 1: Cafe - Alice & Bob
    createShot({ num: '1', shot: '1', priority: 'medium', location: 'Cafe', characters: 'Alice, Bob', description: 'Wide master shot of Alice and Bob discussing the mystery map', props: 'Old map, coffee cups', duration: '0:15', shotSize: 'WIDE', movement: '' }),
    createShot({ num: '1', shot: '2', priority: 'low', location: 'Cafe', characters: 'Alice', description: 'Close up on Alice as she reveals the secret location', props: 'Old map', duration: '0:10', shotSize: 'CU', lens: '50mm', movement: '' }),
    createShot({ num: '1', shot: '3', priority: 'low', location: 'Cafe', characters: 'Bob', description: 'Reaction close up on Bob, looking shocked', props: 'Coffee cup', duration: '0:08', shotSize: 'CU', lens: '85mm', movement: '' }),

    createBlock({ blockType: 'CUSTOM', label: 'LOCATION MOVE / SETUP', duration: '0:20' }),

    // Scene 2: Park - Bob alone
    createShot({ num: '2', shot: '1', priority: 'high', location: 'Park', characters: 'Bob', description: 'Tracking shot of Bob walking along the path, searching', props: 'Mobile phone', duration: '0:15', shotSize: 'MCU', lens: '35mm', movement: 'HANDHELD' }),
    createShot({ num: '2', shot: '2', priority: 'medium', location: 'Park', characters: 'Bob', description: 'Insert shot of Bob finding the marked tree', props: 'Compass', duration: '0:05', shotSize: 'ECU', lens: '85mm', movement: '' }),

    createBlock({ blockType: 'LUNCH', label: 'LUNCH BREAK', duration: '1:00' }),

    // Scene 3: Cafe - Alice waiting
    createShot({ num: '3', shot: '1', priority: 'medium', location: 'Cafe', characters: 'Alice', description: 'Medium shot of Alice pacing near the window, checking her watch', props: 'Wristwatch', duration: '0:10', shotSize: 'MS', lens: '35mm', movement: 'DOLLY' }),
    createShot({ num: '3', shot: '2', priority: 'low', location: 'Cafe', characters: 'Alice', description: 'Tight close up on Alice looking anxious', props: '', duration: '0:07', shotSize: 'CU', lens: '50mm', movement: '' })
  ]);
  dom.projectTitle.textContent = 'Untitled Project';
  state.scheduleDirty = true;
  save();
  render();
}

// ── Render Orchestrator ────────────────────────
function renderAll() {
  if (state.scheduleDirty) {
    cascadeSchedule();
    state.scheduleDirty = false;
  }
  renderTimeline();

  if (state.viewMode === 'grid') {
    dom.tableWrap.classList.add('hidden');
    dom.tableWrap.style.display = 'none';
    dom.gridWrap.classList.remove('hidden');
    dom.gridWrap.style.display = '';
    dom.gridSettingsBar.style.display = 'flex';
    if (dom.listSettingsBar) dom.listSettingsBar.style.display = 'none';
    renderGrid();
  } else {
    dom.gridWrap.classList.add('hidden');
    dom.gridWrap.style.display = 'none';
    dom.tableWrap.classList.remove('hidden');
    dom.tableWrap.style.display = '';
    dom.gridSettingsBar.style.display = 'none';
    if (dom.listSettingsBar) dom.listSettingsBar.style.display = 'flex';
    renderTable();
  }
  applyPresetLayout();
}
onRender(renderAll);

// ── Init ───────────────────────────────────────
loadLayout();
loadGridVis();
loadTableVis();
loadListPresets();
renderListPresets();
initTooltips();

[dom.toggleGridHeader, dom.toggleGridLocation, dom.toggleGridSchedule, dom.toggleGridDescription, dom.toggleGridCastProps, dom.toggleGridTech].forEach(t => {
  if (t) t.addEventListener('change', saveGridVis);
});

if (dom.toggleGridAll) {
  dom.toggleGridAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    [
      dom.toggleGridHeader,
      dom.toggleGridLocation,
      dom.toggleGridSchedule,
      dom.toggleGridDescription,
      dom.toggleGridCastProps,
      dom.toggleGridTech
    ].forEach(t => {
      if (t) t.checked = isChecked;
    });
    saveGridVis();
  });
}

[
  dom.tcPriority, dom.tcLocation, dom.tcDescription, dom.tcNotes, dom.tcCharacters,
  dom.tcShotsize, dom.tcLens, dom.tcMovement, dom.tcProps, dom.tcDuration,
  dom.tcCalltime, dom.tcEndtime, dom.tcRunning
].forEach(t => {
  if (t) t.addEventListener('change', saveTableVis);
});

function applyListPreset(preset) {
  const allToggles = [
    dom.tcPriority, dom.tcLocation, dom.tcDescription, dom.tcNotes, dom.tcCharacters,
    dom.tcShotsize, dom.tcLens, dom.tcMovement, dom.tcProps, dom.tcDuration,
    dom.tcCalltime, dom.tcEndtime, dom.tcRunning
  ];
  
  if (state.listPresets && state.listPresets[preset]) {
    const savedState = state.listPresets[preset];
    allToggles.forEach(t => {
      if (t) {
        const key = t.id.replace('tc-', '');
        t.checked = !!savedState[key];
      }
    });
    saveTableVis();
    return;
  }
  
  let toCheck = [];
  if (preset === 'all') {
    toCheck = allToggles;
  }

  allToggles.forEach(t => {
    if (t) t.checked = toCheck.includes(t);
  });
  saveTableVis();
}

if (dom.btnPresetListAll) dom.btnPresetListAll.addEventListener('click', () => applyListPreset('all'));

if (dom.btnAddListPreset) {
  dom.btnAddListPreset.addEventListener('click', async () => {
    const drop = dom.btnAddListPreset.closest('.dropdown');
    if (drop) drop.classList.remove('open');
    
    const name = await customPrompt('Name your custom preset:');
    if (!name || !name.trim()) return;
    
    const presetName = name.trim();
    const currentState = {};
    const allToggles = [
      dom.tcPriority, dom.tcLocation, dom.tcDescription, dom.tcNotes, dom.tcCharacters,
      dom.tcShotsize, dom.tcLens, dom.tcMovement, dom.tcProps, dom.tcDuration,
      dom.tcCalltime, dom.tcEndtime, dom.tcRunning
    ];
    allToggles.forEach(t => {
      if (t) {
        const key = t.id.replace('tc-', '');
        currentState[key] = t.checked;
      }
    });
    
    state.listPresets[presetName] = currentState;
    saveListPresets();
    renderListPresets();
  });
}

const loadedRatio = localStorage.getItem(LS_RATIO_KEY);
if (loadedRatio) state.boardRatio = loadedRatio;
applyBoardRatio();

initTableDelegation();
migrateLegacyData();
loadAutocomplete();

initSyncListeners();
initSyncAndLoad();

// Observe table wrap to reflow preset sizes whenever the container changes size
globalObserver.observe(dom.tableWrap);
globalObserver.observe(dom.gridWrap);
