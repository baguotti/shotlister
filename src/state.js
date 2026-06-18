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
  
  const TOTAL_COLS = 18;

  // Presets: proportional scale factors (M = 1.0 baseline).
  // Actual px values are computed live from the container height.
  export const PRESETS = {
    S:  { scale: 0.55 },
    M:  { scale: 1.0  },
    L:  { scale: 1.55 },
    XL: { scale: 2.3  },
  };


  export const SCENE_COLORS = [
    '#cbc4ef', '#efc4c4', '#efd4c4', '#efebc4',
    '#c4efce', '#c4dfef', '#c0f0e8', '#d6d6d6',
    '#efc4e9', '#efe3c4', '#cec4ef', '#c4efdd'
  ];
  export const SCENE_BGS = [
    'rgba(203, 196, 239, 0.12)', 'rgba(239, 196, 196, 0.12)', 'rgba(239, 212, 196, 0.12)', 'rgba(239, 235, 196, 0.12)',
    'rgba(196, 239, 206, 0.12)', 'rgba(196, 223, 239, 0.12)', 'rgba(192, 240, 232, 0.12)', 'rgba(214, 214, 214, 0.12)',
    'rgba(239, 196, 233, 0.12)', 'rgba(239, 227, 196, 0.12)', 'rgba(206, 196, 239, 0.12)', 'rgba(196, 239, 221, 0.12)'
  ];

  export function getSceneGroup(numStr) {
    if (!numStr) return null;
    const match = String(numStr).match(/^(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const idx = Math.abs(num - 1) % SCENE_COLORS.length;
    return { numStr: match[1], border: SCENE_COLORS[idx], bg: SCENE_BGS[idx] };
  }

  // ── State ──────────────────────────────────────
  
  
  
   // 'list' | 'card'
  export const GROUP_MODES = ['none', 'location', 'movement', 'scene'];
  
  
  
  
     // state.shots with images, in current rendered order
     // current index in state.lbShotIds

   // active preset key

  
  // Computed schedule — populated by cascadeSchedule()
  // Map of shot id → { callMin, endMin, overrunMin, isInherited }
  
  

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

