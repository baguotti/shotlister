import { dom, $ } from './dom.js';


export const state = {
  projectsList: [], currentProjectId: null, shots: [], viewMode: 'list', currentGroupMode: 'none',
  contextRowId: null, dragSrcId: null, currentStoryboardId: null, lbShotIds: [], lbIndex: -1,
  selectedIds: new Set(),
  currentPreset: 'M', boardRatio: 'auto', acSets: { characters: new Set(), location: new Set(), props: new Set(), shotSize: new Set(), lens: new Set(), movement: new Set() },
  scheduleMap: {}, groupTotals: {},
  gridVisibility: { header: true, location: true, schedule: true, description: true, castProps: true, tech: true }
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
  export const LS_GRID_VIS_KEY = 'sl-grid-vis';
  
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
    '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#84cc16', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#14b8a6', '#f59e0b'
  ];
  export const SCENE_BGS = [
    'rgba(139, 92, 246, 0.12)', 'rgba(236, 72, 153, 0.12)', 'rgba(244, 63, 94, 0.12)', 'rgba(249, 115, 22, 0.12)',
    'rgba(234, 179, 8, 0.12)', 'rgba(132, 204, 22, 0.12)', 'rgba(16, 185, 129, 0.12)', 'rgba(6, 182, 212, 0.12)',
    'rgba(59, 130, 246, 0.12)', 'rgba(99, 102, 241, 0.12)', 'rgba(20, 184, 166, 0.12)', 'rgba(245, 158, 11, 0.12)'
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
      notes: '',
      ...overrides
    };
  }

