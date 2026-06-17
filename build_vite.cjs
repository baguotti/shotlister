const fs = require('fs');

const content = fs.readFileSync('src/app.js', 'utf-8');
const lines = content.split('\n');

const sections = {};
let current = "Main";
lines.forEach(line => {
  const m = line.match(/^\s*\/\/\s*──\s*(.*?)\s*─+/);
  if (m) current = m[1].trim();
  if (!sections[current]) sections[current] = [];
  sections[current].push(line);
});

const getSec = (names) => names.map(n => sections[n].join('\n')).join('\n');

let stateJs = getSec(['Constants', 'State', 'Helpers', 'Persistence', 'Add Row']);
stateJs = `
export const state = {
  projectsList: [], currentProjectId: null, shots: [], viewMode: 'list', currentGroupMode: 'none',
  contextRowId: null, dragSrcId: null, currentStoryboardId: null, lbShotIds: [], lbIndex: -1,
  currentPreset: 'M', acSets: { characters: new Set(), location: new Set(), props: new Set(), shotSize: new Set(), lens: new Set(), movement: new Set() },
  scheduleMap: {}, groupTotals: {}
};
export const dom = {};
` + stateJs
  .replace(/let projectsList = \[\];/, '')
  .replace(/let currentProjectId = null;/, '')
  .replace(/let shots = \[\];/, '')
  .replace(/let viewMode = 'list';/, '')
  .replace(/let currentGroupMode = 'none';/, '')
  .replace(/let contextRowId = null;/, '')
  .replace(/let dragSrcId = null;/, '')
  .replace(/let currentStoryboardId = null;/, '')
  .replace(/let lbShotIds = \[\];/, '')
  .replace(/let lbIndex\s*=\s*-1;/, '')
  .replace(/let currentPreset = 'M';/, '')
  .replace(/let acSets = \{[\s\S]*?\};\n/, '')
  .replace(/let scheduleMap = \{\};/, '')
  .replace(/let groupTotals = \{\};/, '')
  .replace(/const MOVEMENT_TYPES/g, 'export const MOVEMENT_TYPES')
  .replace(/const SHOT_SIZES/g, 'export const SHOT_SIZES')
  .replace(/const LENS_OPTIONS/g, 'export const LENS_OPTIONS')
  .replace(/const PRIORITY_CYCLE/g, 'export const PRIORITY_CYCLE')
  .replace(/const SCENE_COLORS/g, 'export const SCENE_COLORS')
  .replace(/const SCENE_BGS/g, 'export const SCENE_BGS')
  .replace(/const PRESETS/g, 'export const PRESETS')
  .replace(/const GROUP_MODES/g, 'export const GROUP_MODES')
  .replace(/function getSceneGroup/g, 'export function getSceneGroup')
  .replace(/function uid/g, 'export function uid')
  .replace(/function createShot/g, 'export function createShot')
  .replace(/function createBlock/g, 'export function createBlock')
  .replace(/function saveProjects/g, 'export function saveProjects')
  .replace(/function migrateLegacyData/g, 'export function migrateLegacyData')
  .replace(/function save\(/g, 'export function save(')
  .replace(/function loadProject/g, 'export function loadProject')
  .replace(/function seedDefaults/g, 'export function seedDefaults')
  .replace(/function renderHome/g, 'export function renderHome')
  .replace(/function btnAddRow/g, 'export function btnAddRow');

const timeHelpers = stateJs.match(/\/\/ Duration:[\s\S]*?(?=\/\/ ──)/)[0];
stateJs = stateJs.replace(timeHelpers, '');

let scheduleJs = timeHelpers + getSec(['Schedule Computation']);
scheduleJs = `import { state, getSceneGroup } from './state.js';\n` + scheduleJs
  .replace(/function parseDuration/g, 'export function parseDuration')
  .replace(/function formatDuration/g, 'export function formatDuration')
  .replace(/function isValidDuration/g, 'export function isValidDuration')
  .replace(/function normalizeDuration/g, 'export function normalizeDuration')
  .replace(/function normalizeTime/g, 'export function normalizeTime')
  .replace(/function parseTime/g, 'export function parseTime')
  .replace(/function formatTime/g, 'export function formatTime')
  .replace(/function isValidTime/g, 'export function isValidTime')
  .replace(/function formatOverrun/g, 'export function formatOverrun')
  .replace(/function cascadeSchedule/g, 'export function cascadeSchedule');

let autocompleteJs = `import { state, save } from './state.js';\nimport { render } from './main.js';\n` + getSec(['Autocomplete', 'Autocomplete UI'])
  .replace(/function loadAutocomplete/g, 'export function loadAutocomplete')
  .replace(/function saveAutocomplete/g, 'export function saveAutocomplete')
  .replace(/function extractAutocompleteValues/g, 'export function extractAutocompleteValues')
  .replace(/function showAutocomplete/g, 'export function showAutocomplete')
  .replace(/function hideAutocomplete/g, 'export function hideAutocomplete')
  .replace(/function handleAutocompleteKey/g, 'export function handleAutocompleteKey')
  .replace(/function bindAutocomplete/g, 'export function bindAutocomplete');

let lightboxJs = `import { state, dom, save } from './state.js';\nimport { render } from './main.js';\n` + getSec(['Lightbox'])
  .replace(/function getShotLabel/g, 'export function getShotLabel')
  .replace(/function openLightbox/g, 'export function openLightbox')
  .replace(/function closeLightbox/g, 'export function closeLightbox')
  .replace(/function navigateLightbox/g, 'export function navigateLightbox')
  .replace(/function updateLightboxUI/g, 'export function updateLightboxUI')
  .replace(/function replaceStoryboard/g, 'export function replaceStoryboard')
  .replace(/function deleteStoryboard/g, 'export function deleteStoryboard');

let timelineJs = `import { state, getSceneGroup, dom } from './state.js';\nimport { parseDuration, formatDuration, formatTime } from './schedule.js';\n` + getSec(['Timeline Bar'])
  .replace(/function renderTimeline/g, 'export function renderTimeline');

let renderCardsJs = `import { state, dom, getSceneGroup, save, PRIORITY_CYCLE } from './state.js';\nimport { parseDuration, formatDuration, formatTime, formatOverrun } from './schedule.js';\nimport { openLightbox } from './lightbox.js';\nimport { showContextMenu } from './render-table.js';\nimport { getFilteredShots, updateStats } from './main.js';\n` + getSec(['Render: Cards', 'Event Binding: Cards', 'Mobile Swipe-to-Delete'])
  .replace(/function renderCards/g, 'export function renderCards')
  .replace(/function bindCardEvents/g, 'export function bindCardEvents');

let renderTableJs = `import { state, dom, getSceneGroup, save, createShot, createBlock, PRIORITY_CYCLE, MOVEMENT_TYPES, SHOT_SIZES, LENS_OPTIONS } from './state.js';\nimport { parseDuration, formatDuration, formatTime, formatOverrun, isValidDuration, isValidTime, normalizeDuration, normalizeTime } from './schedule.js';\nimport { openLightbox } from './lightbox.js';\nimport { showAutocomplete, hideAutocomplete, handleAutocompleteKey } from './autocomplete.js';\nimport { render, getFilteredShots, updateStats, updateLocationFilter, esc } from './main.js';\n` + getSec(['Render: Table', 'Event Binding: Table', 'File Input (Storyboard)', 'Context Menu'])
  .replace(/function renderTable/g, 'export function renderTable')
  .replace(/function buildSelectOpts/g, 'export function buildSelectOpts')
  .replace(/function buildRow/g, 'export function buildRow')
  .replace(/function buildBlockRow/g, 'export function buildBlockRow')
  .replace(/function bindRowEvents/g, 'export function bindRowEvents')
  .replace(/function showContextMenu/g, 'export function showContextMenu')
  .replace(/function hideContextMenu/g, 'export function hideContextMenu')
  .replace(/function cmInsertAbove/g, 'export function cmInsertAbove')
  .replace(/function cmInsertBelow/g, 'export function cmInsertBelow')
  .replace(/function cmDuplicate/g, 'export function cmDuplicate')
  .replace(/function cmDelete/g, 'export function cmDelete');

let csvJs = `import { state } from './state.js';\nimport { formatTime, parseDuration } from './schedule.js';\nimport { getFilteredShots } from './main.js';\n` + getSec(['CSV Export'])
  .replace(/function exportCSV/g, 'export function exportCSV');

let pwaJs = getSec(['PWA: Manifest', 'PWA: Service Worker']);
pwaJs = `
export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => {
        console.warn('SW registration failed:', e);
      });
    });
  }
}
`;

let mainJs = `import { state, dom, save, loadProject, renderHome, saveProjects, migrateLegacyData, seedDefaults, PRESETS } from './state.js';
import { cascadeSchedule } from './schedule.js';
import { renderTable, hideContextMenu } from './render-table.js';
import { renderCards } from './render-cards.js';
import { renderTimeline } from './timeline.js';
import { loadAutocomplete, extractAutocompleteValues } from './autocomplete.js';
import { exportCSV } from './csv.js';
import { initPWA } from './pwa.js';

` + getSec(['DOM refs', 'Title Auto-Resize', 'Responsive Preset Layout', 'Preset Control', 'Layout Persistence', 'Filtering', 'Drag & Drop (mouse)', 'Drag & Drop (touch)', 'Stats', 'Toolbar & Buttons', 'Print', 'Render Orchestrator', 'Init'])
  .replace(/const \$ = id => document.getElementById\(id\);/g, 'export const $ = id => document.getElementById(id);')
  .replace(/function fitTitleFont/g, 'export function fitTitleFont')
  .replace(/function computePresetSizes/g, 'export function computePresetSizes')
  .replace(/function applyPresetLayout/g, 'export function applyPresetLayout')
  .replace(/function applyPreset\(/g, 'export function applyPreset(')
  .replace(/function saveLayout/g, 'export function saveLayout')
  .replace(/function loadLayout/g, 'export function loadLayout')
  .replace(/function getFilteredShots/g, 'export function getFilteredShots')
  .replace(/function updateLocationFilter/g, 'export function updateLocationFilter')
  .replace(/function esc/g, 'export function esc')
  .replace(/function updateStats/g, 'export function updateStats')
  .replace(/function render\(/g, 'export function render(')
  .replace(/\}\)\(\);/g, '');

const files = {
  'src/state.js': stateJs,
  'src/schedule.js': scheduleJs,
  'src/autocomplete.js': autocompleteJs,
  'src/lightbox.js': lightboxJs,
  'src/timeline.js': timelineJs,
  'src/render-cards.js': renderCardsJs,
  'src/render-table.js': renderTableJs,
  'src/csv.js': csvJs,
  'src/pwa.js': pwaJs,
  'src/main.js': mainJs
};

for (const [name, data] of Object.entries(files)) {
  let finalData = data;
  
  // Replace DOM refs in main.js declarations
  if (name === 'src/main.js') {
    finalData = finalData.replace(/const\s+(projectTitle|shotBody|cardGrid|tableWrap|contextMenu|fileInput|filterLocation|filterCharacter|filterPriority|lightbox|lbImg|lbLabel|lbClose|lbPrev|lbNext|lbBackdrop|lbReplace|lbDelete)\s*=\s*\$\('(.*?)'\);/g, "dom.$1 = $$('$2');");
  }

  const varsToPrefixDOM = ['projectTitle', 'shotBody', 'cardGrid', 'tableWrap', 'contextMenu', 'fileInput', 'filterLocation', 'filterCharacter', 'filterPriority', 'lightbox', 'lbImg', 'lbLabel', 'lbClose', 'lbPrev', 'lbNext', 'lbBackdrop', 'lbReplace', 'lbDelete'];
  varsToPrefixDOM.forEach(v => {
    finalData = finalData.replace(new RegExp(`(?<!\\.)\\b${v}\\b(?!=:)`, 'g'), `dom.${v}`);
  });

  const varsToPrefixState = ['shots', 'projectsList', 'currentProjectId', 'viewMode', 'currentGroupMode', 'contextRowId', 'dragSrcId', 'currentStoryboardId', 'lbShotIds', 'lbIndex', 'currentPreset', 'acSets', 'scheduleMap', 'groupTotals'];
  varsToPrefixState.forEach(v => {
    finalData = finalData.replace(new RegExp(`(?<!\\.)\\b${v}\\b(?!=:)`, 'g'), `state.${v}`);
  });

  // Fix import paths that were corrupted
  finalData = finalData.replace(/'\.\/dom\.lightbox\.js'/g, "'./lightbox.js'");
  
  // Fix state object declaration
  finalData = finalData.replace(/state\.projectsList: \[\]/, "projectsList: []");
  finalData = finalData.replace(/state\.currentProjectId: null/, "currentProjectId: null");
  finalData = finalData.replace(/state\.shots: \[\]/, "shots: []");
  finalData = finalData.replace(/state\.viewMode: 'list'/, "viewMode: 'list'");
  finalData = finalData.replace(/state\.currentGroupMode: 'none'/, "currentGroupMode: 'none'");
  finalData = finalData.replace(/state\.contextRowId: null/, "contextRowId: null");
  finalData = finalData.replace(/state\.dragSrcId: null/, "dragSrcId: null");
  finalData = finalData.replace(/state\.currentStoryboardId: null/, "currentStoryboardId: null");
  finalData = finalData.replace(/state\.lbShotIds: \[\]/, "lbShotIds: []");
  finalData = finalData.replace(/state\.lbIndex: -1/, "lbIndex: -1");
  finalData = finalData.replace(/state\.currentPreset: 'M'/, "currentPreset: 'M'");
  finalData = finalData.replace(/state\.acSets: \{/, "acSets: {");
  finalData = finalData.replace(/state\.scheduleMap: \{\}/, "scheduleMap: {}");
  finalData = finalData.replace(/state\.groupTotals: \{\}/, "groupTotals: {}");

  fs.writeFileSync(name, finalData);
}

console.log("All files written!");
