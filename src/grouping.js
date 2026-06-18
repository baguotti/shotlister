import { state, getSceneGroup } from './state.js';

export function getGroupInfo(s) {
  let key = '';
  let icon = '';

  if (state.currentGroupMode === 'location') {
    key = s.location || '(No Location)';
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; position: relative; top: -1px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  } else if (state.currentGroupMode === 'movement') {
    key = s.kind === 'block' ? 'Blocks' : (s.movement || '(No Movement)');
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; position: relative; top: -1px;"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`;
  } else if (state.currentGroupMode === 'scene') {
    const group = getSceneGroup(s.num);
    key = group ? `Scene ${group.numStr}` : '(No Scene)';
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; position: relative; top: -1px;"><path d="M4 18h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"/><path d="m2 10 20-4"/><path d="m7 5 3 4"/><path d="m12 4 3 4"/><path d="m17 3 3 4"/><path d="m2 14 20-4"/></svg>`;
  } else if (state.currentGroupMode === 'characters') {
    key = s.kind === 'block' ? 'Blocks' : (s.characters || '(No Characters)');
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; position: relative; top: -1px;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  } else if (state.currentGroupMode === 'shotSize') {
    key = s.kind === 'block' ? 'Blocks' : (s.shotSize || '(No Shot Size)');
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; position: relative; top: -1px;"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`;
  }

  return { key, icon };
}
