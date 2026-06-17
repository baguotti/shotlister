import { dom, $ } from './dom.js';
import { state, SHOT_SIZES, LENS_OPTIONS, MOVEMENT_TYPES } from './state.js';
import { saveAutocomplete } from './autocomplete.js';
import { save, render, esc } from './main.js';

export function renderSettings() {
  const container = $('settingsView');
  let html = `<div style="padding: 20px; max-width: 600px; margin: 0 auto; color: var(--text-0);">`;
  html += `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 24px;">
    <h2 style="font-family: var(--font-mono); margin: 0;">Custom Entries Manager</h2>
    <button id="btnCloseSettings" style="background: transparent; border: none; color: var(--text-1); font-size: 20px; cursor: pointer;">&times;</button>
  </div>`;
  html += `<p style="color: var(--text-2); font-size: 13px; margin-bottom: 24px;">Manage custom values you've added to dropdowns. Deleting a value here will also remove it from any shots currently using it.</p>`;

  const categories = [
    { id: 'shotSize', title: 'Shot Sizes', baseOpts: SHOT_SIZES },
    { id: 'lens', title: 'Lenses', baseOpts: LENS_OPTIONS },
    { id: 'movement', title: 'Movements', baseOpts: MOVEMENT_TYPES },
    { id: 'characters', title: 'Characters', baseOpts: [] },
    { id: 'location', title: 'Locations', baseOpts: [] },
    { id: 'props', title: 'Props', baseOpts: [] },
  ];

  categories.forEach(cat => {
    const acSet = state.acSets[cat.id];
    if (!acSet) return;
    
    // Filter out base options so we only show purely custom entries
    const customOpts = [...acSet].filter(v => !cat.baseOpts.includes(v)).sort();
    
    if (customOpts.length === 0) return;

    html += `<div style="margin-bottom: 24px;">`;
    html += `<h3 style="font-size: 14px; margin-bottom: 8px; color: var(--text-1);">${cat.title}</h3>`;
    html += `<div style="background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;">`;
    
    customOpts.forEach(opt => {
      html += `<div class="custom-entry-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border);">
        <span style="font-family: var(--font-mono); font-size: 13px;">${esc(opt)}</span>
        <button class="btn-del-custom" data-field="${cat.id}" data-val="${esc(opt)}" style="background: transparent; border: none; color: var(--priority-high); cursor: pointer; font-size: 16px; padding: 0 4px;" title="Delete Custom Entry">&times;</button>
      </div>`;
    });
    
    html += `</div></div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Bind close event
  $('btnCloseSettings').addEventListener('click', () => {
    container.close();
  });

  // Bind delete events
  container.querySelectorAll('.btn-del-custom').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const field = btn.dataset.field;
      const val = btn.dataset.val;
      
      // Remove from autocomplete memory
      if (state.acSets[field]) {
        state.acSets[field].delete(val);
        saveAutocomplete();
      }

      // Remove from existing shots
      let changedShots = false;
      state.shots.forEach(shot => {
        if (field === 'characters' || field === 'props') {
          if (shot[field]) {
            const parts = shot[field].split(',').map(s => s.trim());
            const filtered = parts.filter(p => p !== val);
            if (parts.length !== filtered.length) {
              shot[field] = filtered.join(', ');
              changedShots = true;
            }
          }
        } else {
          if (shot[field] === val) {
            shot[field] = '';
            changedShots = true;
          }
        }
      });

      if (changedShots) {
        save();
      }
      
      renderSettings();
    });
  });
}
