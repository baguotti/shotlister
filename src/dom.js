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
  
  // Grid Toggles
  toggleGridHeader: $('toggleGridHeader'),
  toggleGridLocation: $('toggleGridLocation'),
  toggleGridSchedule: $('toggleGridSchedule'),
  toggleGridDescription: $('toggleGridDescription'),
  toggleGridCastProps: $('toggleGridCastProps'),
  toggleGridTech: $('toggleGridTech'),

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
