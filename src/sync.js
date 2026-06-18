import { state, LS_SYNC_CODE_KEY, LS_LAST_PROJ_KEY } from './state.js';
import { dom } from './dom.js';
import { getProject } from './db.js';
import { renderHome, saveProjects, loadProject } from './main.js';

export async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function updateSyncStatus(status) {
  state.syncStatus = status;
  const text = status === 'offline' ? 'Offline Mode' 
             : status === 'syncing' ? 'Syncing...' 
             : status === 'synced' ? 'Synced' 
             : 'Sync Error';
  if (dom.syncStatusTextHome) dom.syncStatusTextHome.textContent = text;
  if (dom.syncStatusTextEditor) dom.syncStatusTextEditor.textContent = text;
}

export async function syncRequest(action, payload = null) {
  if (!state.syncPasscode) return null;
  try {
    updateSyncStatus('syncing');
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passcode: state.syncPasscode,
        action,
        payload
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    updateSyncStatus('synced');
    return data;
  } catch(err) {
    console.error('Sync request failed:', err);
    updateSyncStatus('error');
    return null;
  }
}

export async function connectAndSync(passcode) {
  try {
    const hashed = await hashPasscode(passcode);
    state.syncPasscode = hashed;
    localStorage.setItem(LS_SYNC_CODE_KEY, hashed);
    dom.syncDisconnect.style.display = 'inline-block';
    
    const remoteList = await syncRequest('get_list');
    if (remoteList === null) {
      alert('Failed to connect to sync server. Check configuration.');
      return;
    }
    
    const localList = state.projectsList;
    const mergedMap = new Map();
    
    remoteList.forEach(p => mergedMap.set(p.id, p));
    
    const localOnlyOrNewer = [];
    localList.forEach(p => {
      const remote = mergedMap.get(p.id);
      if (!remote || p.updatedAt > remote.updatedAt) {
        mergedMap.set(p.id, p);
        localOnlyOrNewer.push(p);
      }
    });
    
    state.projectsList = Array.from(mergedMap.values());
    saveProjects();
    
    for (const p of localOnlyOrNewer) {
      const shots = await getProject(p.id);
      if (shots) {
        await syncRequest('save_project', { projectId: p.id, shots });
      }
    }
    
    await syncRequest('save_list', state.projectsList);
    renderHome();
  } catch(err) {
    console.error('connectAndSync error:', err);
    updateSyncStatus('error');
  }
}

export function initSyncListeners() {
  const openSyncModal = () => {
    dom.syncPasscodeInput.value = '';
    dom.syncModal.showModal();
  };

  dom.btnSyncSettingsHome.addEventListener('click', openSyncModal);
  dom.btnSyncSettingsEditor.addEventListener('click', openSyncModal);

  dom.syncCancel.addEventListener('click', () => {
    dom.syncModal.close();
  });

  dom.syncSubmit.addEventListener('click', async () => {
    const passcode = dom.syncPasscodeInput.value.trim();
    if (!passcode) {
      alert('Please enter a passcode.');
      return;
    }
    dom.syncModal.close();
    await connectAndSync(passcode);
  });

  dom.syncDisconnect.addEventListener('click', () => {
    if (confirm('Disconnect from Cloud Sync? Your data will remain locally, but will no longer sync.')) {
      state.syncPasscode = null;
      state.syncStatus = 'offline';
      localStorage.removeItem(LS_SYNC_CODE_KEY);
      dom.syncDisconnect.style.display = 'none';
      updateSyncStatus('offline');
      dom.syncModal.close();
      renderHome();
    }
  });
}

export async function initSyncAndLoad() {
  const savedSyncCode = localStorage.getItem(LS_SYNC_CODE_KEY);
  if (savedSyncCode) {
    state.syncPasscode = savedSyncCode;
    dom.syncDisconnect.style.display = 'inline-block';
    updateSyncStatus('syncing');
    
    const remoteList = await syncRequest('get_list');
    if (remoteList) {
      const mergedMap = new Map();
      remoteList.forEach(p => mergedMap.set(p.id, p));
      state.projectsList.forEach(p => {
        const remote = mergedMap.get(p.id);
        if (!remote || p.updatedAt > remote.updatedAt) {
          mergedMap.set(p.id, p);
        }
      });
      state.projectsList = Array.from(mergedMap.values());
      saveProjects();
      updateSyncStatus('synced');
    } else {
      updateSyncStatus('error');
    }
  }
  
  const lastId = localStorage.getItem(LS_LAST_PROJ_KEY);
  if (lastId && state.projectsList.find(p => p.id === lastId)) {
    await loadProject(lastId);
  } else {
    renderHome();
  }
}
