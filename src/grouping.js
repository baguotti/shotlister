import { state, getSceneGroup } from './state.js';
import { ICON_GRP_LOC, ICON_GRP_MOV, ICON_GRP_SCN, ICON_GRP_CHR, ICON_GRP_SZE } from './icons.js';

export function getGroupInfo(s) {
  let key = '';
  let icon = '';

  if (state.currentGroupMode === 'location') {
    key = s.location || '(No Location)';
    icon = ICON_GRP_LOC;
  } else if (state.currentGroupMode === 'movement') {
    key = s.kind === 'block' ? 'Blocks' : (s.movement || '(No Movement)');
    icon = ICON_GRP_MOV;
  } else if (state.currentGroupMode === 'scene') {
    const group = getSceneGroup(s.num);
    key = group ? `Scene ${group.numStr}` : '(No Scene)';
    icon = ICON_GRP_SCN;
  } else if (state.currentGroupMode === 'characters') {
    key = s.kind === 'block' ? 'Blocks' : (s.characters || '(No Characters)');
    icon = ICON_GRP_CHR;
  } else if (state.currentGroupMode === 'shotSize') {
    key = s.kind === 'block' ? 'Blocks' : (s.shotSize || '(No Shot Size)');
    icon = ICON_GRP_SZE;
  }

  return { key, icon };
}
