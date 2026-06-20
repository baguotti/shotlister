export const $ = id => document.getElementById(id);

export const dom = {
  projectTitle: $('projectTitle'),
  shotBody: $('shotBody'),
  settingsView: $('settingsView'),
  btnViewMode: $('btnViewMode'),
  btnImport: $('btnImport'),
  btnExport: $('btnExport'),
  importInput: $('importInput'),
  gridSettingsBar: $('gridSettingsBar'),
  listSettingsBar: $('listSettingsBar'),
  
  // Grid Toggles
  toggleGridHeader: $('toggleGridHeader'),
  toggleGridLocation: $('toggleGridLocation'),
  toggleGridSchedule: $('toggleGridSchedule'),
  toggleGridDescription: $('toggleGridDescription'),
  toggleGridCastProps: $('toggleGridCastProps'),
  toggleGridTech: $('toggleGridTech'),
  
  // Table Toggles
  tcPriority: $('tc-priority'),
  tcLocation: $('tc-location'),
  tcDescription: $('tc-description'),
  tcNotes: $('tc-notes'),
  tcCharacters: $('tc-characters'),
  tcShotsize: $('tc-shotsize'),
  tcLens: $('tc-lens'),
  tcMovement: $('tc-movement'),
  tcProps: $('tc-props'),
  tcDuration: $('tc-duration'),
  tcCalltime: $('tc-calltime'),
  tcEndtime: $('tc-endtime'),
  tcRunning: $('tc-running'),
  
  thPriority: $('th-priority'),
  thLocation: $('th-location'),
  thDescription: $('th-description'),
  thNotes: $('th-notes'),
  thCharacters: $('th-characters'),
  thShotsize: $('th-shotsize'),
  thLens: $('th-lens'),
  thMovement: $('th-movement'),
  thProps: $('th-props'),
  thDuration: $('th-duration'),
  thCalltime: $('th-calltime'),
  thEndtime: $('th-endtime'),
  thRunning: $('th-running'),
  tableWrap: $('tableWrap'),
  gridWrap: $('gridWrap'),
  contextMenu: $('contextMenu'),
  fileInput: $('fileInput'),
  lightbox: $('lightbox'),
  lbImg: $('lbImg'),
  lbLabel: $('lbLabel'),
  lbClose: $('lbClose'),
  lbPrev: $('lbPrev'),
  lbNext: $('lbNext'),
  lbBackdrop: $('lbBackdrop'),
  lbReplace: $('lbReplace'),
  lbDelete: $('lbDelete'),
  lbDescription: $('lbDescription'),
  lbNotes: $('lbNotes'),
  lbMeta: $('lbMeta'),
  lbTiming: $('lbTiming'),
  lbCast: $('lbCast'),
  boardRatioSelect: $('boardRatioSelect'),
  
  // Sync UI
  btnSyncSettingsHome: $('btnSyncSettingsHome'),
  syncStatusTextHome: $('syncStatusTextHome'),
  btnSyncSettingsEditor: $('btnSyncSettingsEditor'),
  syncStatusTextEditor: $('syncStatusTextEditor'),
  syncModal: $('syncModal'),
  syncPasscodeInput: $('syncPasscodeInput'),
  syncCancel: $('syncCancel'),
  syncDisconnect: $('syncDisconnect'),
  syncForceImages: $('syncForceImages'),
  syncSubmit: $('syncSubmit')
};

export function customPrompt(titleText) {
  return new Promise((resolve) => {
    const dialog = $('customPromptModal');
    const title = $('customPromptTitle');
    const input = $('customPromptInput');
    const btnCancel = $('customPromptCancel');
    const btnSubmit = $('customPromptSubmit');

    title.textContent = titleText;
    input.value = '';
    
    // Cleanup function
    const cleanup = () => {
      dialog.close();
      btnCancel.removeEventListener('click', onCancel);
      btnSubmit.removeEventListener('click', onSubmit);
      input.removeEventListener('keydown', onKey);
    };

    const onCancel = () => { cleanup(); resolve(null); };
    const onSubmit = () => { cleanup(); resolve(input.value); };
    const onKey = (e) => {
      if (e.key === 'Enter') onSubmit();
      if (e.key === 'Escape') onCancel();
    };

    btnCancel.addEventListener('click', onCancel);
    btnSubmit.addEventListener('click', onSubmit);
    input.addEventListener('keydown', onKey);

    dialog.showModal();
    // Use requestAnimationFrame or setTimeout to ensure it focuses after rendering
    setTimeout(() => input.focus(), 10);
  });
}
