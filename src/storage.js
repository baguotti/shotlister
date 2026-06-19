import { dom } from './dom.js';
import { state, LS_PROJECTS_KEY } from './state.js';
import { putProject } from './db.js';

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

export function syncRequest(action, payload) {
  if (!state.syncPasscode) return Promise.resolve(null);
  state.syncStatus = 'syncing';
  const st = document.getElementById('syncStatus');
  if (st) st.className = 'sync-status syncing';

  return fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, passcode: state.syncPasscode, payload })
  }).then(r => r.json()).then(data => {
    if (data.error) throw new Error(data.error);
    state.syncStatus = 'synced';
    if (st) st.className = 'sync-status synced';
    setTimeout(() => {
      if (state.syncStatus === 'synced') {
        state.syncStatus = 'offline';
        if (st) st.className = 'sync-status offline';
      }
    }, 2000);
    return data.data;
  }).catch(err => {
    console.error('Sync failed:', err);
    state.syncStatus = 'error';
    if (st) st.className = 'sync-status error';
    return null;
  });
}
