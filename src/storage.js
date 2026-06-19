import { dom } from './dom.js';
import { state, LS_PROJECTS_KEY, LS_KEY, LS_TITLE_KEY, uid } from './state.js';
import { putProject } from './db.js';
import { syncRequest } from './sync.js';

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


let saveTimeout = null;

export function saveProjects() {
  try {
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(state.projectsList));
    if (state.syncPasscode) {
      syncRequest('save_list', state.projectsList);
    }
  } catch(e) {}
}

export function save() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(doSave, 500);
}

export async function doSave() {
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
