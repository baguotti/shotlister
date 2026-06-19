import { dom, $ } from './dom.js';


export const state = {
  projectsList: [], currentProjectId: null, shots: [], viewMode: 'list', currentGroupMode: 'none',
  contextRowId: null, dragSrcId: null, currentStoryboardId: null, lbShotIds: [], lbIndex: -1,
  selectedIds: new Set(),
  currentPreset: 'M', boardRatio: 'auto', acSets: { characters: new Set(), location: new Set(), props: new Set(), shotSize: new Set(), lens: new Set(), movement: new Set() },
  scheduleMap: {}, groupTotals: {},
  gridVisibility: { header: true, location: true, schedule: true, description: true, castProps: true, tech: true },
  syncPasscode: null, syncStatus: 'offline' // 'offline' | 'syncing' | 'synced' | 'error'
};

export function setProjectsList(val) { state.projectsList = val; }
export function setCurrentProjectId(val) { state.currentProjectId = val; }
export function setShots(val) { state.shots = val; }
export function setViewMode(val) { state.viewMode = val; }
export function setCurrentGroupMode(val) { state.currentGroupMode = val; }
export function setContextRowId(val) { state.contextRowId = val; }
export function setDragSrcId(val) { state.dragSrcId = val; }
export function setCurrentStoryboardId(val) { state.currentStoryboardId = val; }
export function setLbShotIds(val) { state.lbShotIds = val; }
export function setLbIndex(val) { state.lbIndex = val; }
export function setCurrentPreset(val) { state.currentPreset = val; }
export function setBoardRatio(val) { state.boardRatio = val; }
export function setAcSets(val) { state.acSets = val; }
export function setScheduleMap(val) { state.scheduleMap = val; }
export function setGroupTotals(val) { state.groupTotals = val; }
export function setGridVisibility(val) { state.gridVisibility = val; }
export function setSyncPasscode(val) { state.syncPasscode = val; }
export function setSyncStatus(val) { state.syncStatus = val; }

export function clearSelection() {
  state.selectedIds.clear();
}

  // ── Constants ──────────────────────────────────
  export const MOVEMENT_TYPES = ['STATIC','HANDHELD','DOLLY','CRANE','DRONE'];
  export const SHOT_SIZES = ['ECU','CU','MCU','MS','WIDE','EWS'];
  export const LENS_OPTIONS = ['18mm','24mm','35mm','50mm','85mm'];
  export const PRIORITY_CYCLE = ['off','low','medium','high'];
  export const LS_KEY = 'sl-data';
  export const LS_TITLE_KEY = 'sl-title';
  export const LS_PROJECTS_KEY = 'sl-projects';
  export const LS_LAST_PROJ_KEY = 'sl-last-project';
  export const LS_THEME_KEY = 'sl-color-scheme';
  export const LS_PRESET_KEY = 'sl-preset';
  export const LS_RATIO_KEY = 'sl-ratio';
  export const LS_VIEW_MODE_KEY = 'sl-view-mode';
  export const LS_GRID_VIS_KEY = 'sl-grid-vis';
  export const LS_SYNC_CODE_KEY = 'sl-sync-code';
  
  export const LS_AC_CHARS = 'sl-ac-characters';
  export const LS_AC_LOCS = 'sl-ac-location';
  export const LS_AC_PROPS = 'sl-ac-props';
  export const LS_AC_SHOTSIZE = 'sl-ac-shotsize';
  export const LS_AC_LENS = 'sl-ac-lens';
  export const LS_AC_MOVEMENT = 'sl-ac-movement';
  
  // Presets: proportional scale factors (M = 1.0 baseline).
  // Actual px values are computed live from the container height.
  export const PRESETS = {
    S:  { scale: 0.72 },
    M:  { scale: 1.0  },
    L:  { scale: 1.55 },
    XL: { scale: 2.3  },
  };


  export const SCENE_COLORS = [
    'var(--scene-color-0)', 'var(--scene-color-1)', 'var(--scene-color-2)', 'var(--scene-color-3)',
    'var(--scene-color-4)', 'var(--scene-color-5)', 'var(--scene-color-6)', 'var(--scene-color-7)',
    'var(--scene-color-8)', 'var(--scene-color-9)', 'var(--scene-color-10)', 'var(--scene-color-11)'
  ];
  export const SCENE_BGS = [
    'var(--scene-bg-0)', 'var(--scene-bg-1)', 'var(--scene-bg-2)', 'var(--scene-bg-3)',
    'var(--scene-bg-4)', 'var(--scene-bg-5)', 'var(--scene-bg-6)', 'var(--scene-bg-7)',
    'var(--scene-bg-8)', 'var(--scene-bg-9)', 'var(--scene-bg-10)', 'var(--scene-bg-11)'
  ];

  export function getSceneGroup(numStr) {
    if (!numStr) return null;
    const match = String(numStr).match(/^(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const idx = Math.abs(num - 1) % SCENE_COLORS.length;
    return { numStr: match[1], border: SCENE_COLORS[idx], bg: SCENE_BGS[idx] };
  }

  export function getNextShotNumber(sceneNum, shots) {
    if (!sceneNum) return '1';
    const shotsInScene = shots.filter(s => s.kind === 'shot' && s.num === sceneNum);
    if (shotsInScene.length === 0) return '1';
    let maxVal = 0;
    shotsInScene.forEach(s => {
      const val = parseInt(s.shot, 10);
      if (!isNaN(val) && val > maxVal) maxVal = val;
    });
    return String(maxVal + 1);
  }

  export const GROUP_MODES = ['none', 'location', 'movement', 'scene', 'characters', 'shotSize'];

  // ── Helpers ────────────────────────────────────
  export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  export function createShot(overrides = {}) {
    return {
      id: uid(),
      kind: 'shot',
      num: '',
      shot: '',
      priority: 'off',
      storyboard: '',
      movement: 'STATIC',
      shotSize: '',
      lens: '',
      characters: '',
      location: '',
      description: '',
      notes: '',
      props: '',
      duration: '',
      callTime: '',      // HH:MM — manually set anchor, empty = inherit
      ...overrides
    };
  }

  export function createBlock(overrides = {}) {
    return {
      id: uid(),
      kind: 'block',
      num: '',
      blockType: 'PREP',
      label: '',
      duration: '',
      callTime: '',
      description: '',
      notes: '',
      ...overrides
    };
  }

