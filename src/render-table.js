import { dom, $, customPrompt } from './dom.js';
import { state, getSceneGroup, createShot, createBlock, PRIORITY_CYCLE, MOVEMENT_TYPES, SHOT_SIZES, LENS_OPTIONS, uid, setShots, getNextShotNumber, getShot } from './state.js';
import { parseDuration, formatDuration, formatTime, formatOverrun, isValidDuration, isValidTime, normalizeDuration, normalizeTime, cascadeSchedule } from './schedule.js';
import { openLightbox } from './lightbox.js';
import { showAutocomplete, hideAutocomplete, handleAutocompleteKey, filterAutocomplete, isAutocompleteActiveFor, scheduleAutocompleteHide, cancelAutocompleteHide, saveAutocomplete } from './autocomplete.js';
import { updateStats, applyPresetLayout } from './main.js';
import { render } from './events.js';
import { save } from './storage.js';
import { esc } from './utils.js';
import { initDrag, initTouchDrag } from './drag-drop.js';
import { applyBulkEdit, updateSelectionUI } from './bulk-actions.js';
import { getGroupInfo } from './grouping.js';
import { putImage, getImage } from './db.js';
  // ── Render: Table ──────────────────────────────
  export function renderTable() {
    const filtered = state.shots;
    

    let html = '';
    let cumulative = 0;

    if (state.currentGroupMode !== 'none') {
      const groups = {};
      const order = [];
      filtered.forEach(s => {
        const { key } = getGroupInfo(s);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(s);
      });

      order.forEach(key => {
        const { icon } = getGroupInfo(groups[key][0] || {});

        html += `<tr class="location-group"><td colspan="18">${icon}${esc(key)}</td></tr>`;
        let groupCum = 0;
        groups[key].forEach(s => {
          const dur = parseDuration(s.duration);
          if (dur > 0) { cumulative += dur; groupCum += dur; }
          html += s.kind === 'block' ? buildBlockRow(s, cumulative) : buildRow(s, cumulative);
        });
        html += `<tr class="location-subtotal">
          <td class="drag-handle"></td>
          <td class="col-select"></td>
          <td colspan="7"></td>
          <td></td>
          <td class="hide-tablet"></td>
          <td></td>
          <td class="hide-tablet"></td>
          <td colspan="3" style="text-align:center">${groups[key].length} items · ${formatDuration(groupCum)}</td>
          <td class="hide-tablet"></td>
          <td class="col-actions"></td>
        </tr>`;
      });
    } else {
      let currentScene = null;
      let sceneShots = [];

      const renderSceneSummary = () => {
        if (sceneShots.length > 0 && currentScene) {
          const firstShot = sceneShots[0];
          const lastShot = sceneShots[sceneShots.length - 1];
          const startSched = state.scheduleMap[firstShot.id];
          const endSched = state.scheduleMap[lastShot.id];
          
          let startStr = startSched && startSched.callMin >= 0 ? formatTime(startSched.callMin) : '--:--';
          let endStr = endSched && endSched.endMin >= 0 ? formatTime(endSched.endMin) : '--:--';
          
          let totalDur = 0;
          sceneShots.forEach(sh => totalDur += parseDuration(sh.duration));
          
          html += `<tr class="scene-summary-row" style="background: var(--bg-2); border-bottom: 1px solid var(--border);">
            <td class="drag-handle"></td>
            <td class="col-select"></td>
            <td colspan="7" style="text-align: right; font-family: var(--font-mono); font-size: 11px; color: var(--text-2); padding: 6px 12px; font-weight: 600; text-transform: uppercase;">
              Scene ${esc(currentScene)} Summary
            </td>
            <td></td>
            <td class="hide-tablet"></td>
            <td></td>
            <td class="hide-tablet"></td>
            <td style="text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-0); padding: 4px; font-weight: bold; line-height: 1.2;">
              <span style="font-size: 8px; color: var(--text-2); font-weight: normal; display: block; text-transform: uppercase; letter-spacing: 0.5px;">Total</span>
              ${formatDuration(totalDur)}
            </td>
            <td style="text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-0); padding: 4px; font-weight: bold; line-height: 1.2;">
              <span style="font-size: 8px; color: var(--text-2); font-weight: normal; display: block; text-transform: uppercase; letter-spacing: 0.5px;">Start</span>
              ${startStr}
            </td>
            <td style="text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-0); padding: 4px; font-weight: bold; line-height: 1.2;">
              <span style="font-size: 8px; color: var(--text-2); font-weight: normal; display: block; text-transform: uppercase; letter-spacing: 0.5px;">End</span>
              ${endStr}
            </td>
            <td class="hide-tablet"></td>
            <td class="col-actions"></td>
          </tr>`;
        }
      };

      filtered.forEach(s => {
        const sceneNum = s.num ? String(s.num).trim() : '';
        if (s.kind === 'shot' || sceneNum !== '') {
          if (sceneNum !== currentScene) {
            renderSceneSummary();
            currentScene = sceneNum;
            sceneShots = [];
          }
          if (sceneNum) {
            sceneShots.push(s);
          }
        }

        const dur = parseDuration(s.duration);
        if (dur > 0) cumulative += dur;
        html += s.kind === 'block' ? buildBlockRow(s, cumulative) : buildRow(s, cumulative);
      });
      renderSceneSummary();
    }

    dom.shotBody.innerHTML = html;
    updateStats();
    hydrateImages();
  }

  export function updateShotDOM(id, field, val) {
    const row = dom.shotBody.querySelector(`tr[data-id="${id}"]`);
    const card = dom.gridWrap.querySelector(`.grid-card[data-id="${id}"]`);
    
    [row, card].forEach(el => {
      if (!el) return;
      const node = el.querySelector(`[data-field="${field}"]`);
      if (!node) return;
      
      if (node.tagName === 'INPUT' || node.tagName === 'SELECT') {
        if (node.value !== val) node.value = val;
      } else if (node.hasAttribute('contenteditable')) {
        if (document.activeElement !== node && node.textContent !== val) {
          node.textContent = val;
        }
      }
    });
  }

  export function refreshScheduleDOM() {
    cascadeSchedule();
    let cumulative = 0;
    state.shots.forEach(s => {
      const dur = parseDuration(s.duration);
      if (dur > 0) cumulative += dur;
      
      const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1, overrunMin: 0, isInherited: false };
      const callTimeVal = sched.isInherited ? formatTime(sched.callMin) : (s.callTime || '');
      const endTimeStr = sched.endMin >= 0 ? formatTime(sched.endMin) : '--:--';
      
      const row = dom.shotBody.querySelector(`tr[data-id="${s.id}"]`);
      if (row) {
        const timeInput = row.querySelector('.time-input');
        if (timeInput) {
          timeInput.value = callTimeVal;
          timeInput.classList.toggle('inherited', sched.isInherited);
          timeInput.dataset.inherited = sched.isInherited;
        }
        const printTimeSpan = row.querySelector('.time-input + .print-only');
        if (printTimeSpan) printTimeSpan.textContent = callTimeVal;
        
        const endTimeEl = row.querySelector('.end-time');
        if (endTimeEl) endTimeEl.textContent = endTimeStr;
        
        const runTimeEl = row.querySelector('.running-time');
        if (runTimeEl) runTimeEl.textContent = formatDuration(cumulative);
      }
      
      const card = dom.gridWrap.querySelector(`.grid-card[data-id="${s.id}"]`);
      if (card) {
        const timeInput = card.querySelector('.time-input');
        if (timeInput) {
          timeInput.value = callTimeVal;
          timeInput.classList.toggle('inherited', sched.isInherited);
          timeInput.dataset.inherited = sched.isInherited;
        }
      }
    });
  }

  export async function hydrateImages() {
    const lazyImages = document.querySelectorAll('img[data-lazy-img]');
    for (const img of lazyImages) {
      if (img.dataset.hydrated) continue;
      const id = img.dataset.lazyImg;
      const blobOrDataUrl = await getImage(id);
      if (blobOrDataUrl) {
        img.src = blobOrDataUrl;
      }
      img.dataset.hydrated = "true";
    }
  }

  // Build select options: base list + custom persisted values + "Custom…" sentinel
  export function buildSelectOpts(baseOpts, acSet, currentVal) {
    const customOpts = [...acSet].filter(v => !baseOpts.includes(v)).sort();
    const allOpts = [...baseOpts, ...customOpts];
    return allOpts.map(t =>
      `<option value="${t}"${currentVal === t ? ' selected' : ''}>${t}</option>`
    ).join('') + `<option value="__custom__">Custom\u2026</option>`;
  }

  export function buildRow(s, runTime) {
    const prioMap = { 'off': '-', 'low': 'I', 'medium': 'II', 'high': 'III' };
    const prioDisplay = prioMap[s.priority] || '-';

    const storyboardContent = s.storyboard
      ? `<div class="sb-thumb-wrap"><img data-lazy-img="${s.id}" alt="storyboard" loading="lazy"></div>`
      : `<div class="placeholder">+</div>`;

    const durValid = isValidDuration(s.duration);
    const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1, overrunSec: 0, isInherited: false };

    const callTimeVal = sched.isInherited ? formatTime(sched.callMin) : (s.callTime || '');
    const callValid = isValidTime(s.callTime);
    const inheritedClass = sched.isInherited ? ' inherited' : '';
    const endTimeStr = sched.endMin >= 0 ? formatTime(sched.endMin) : '--:--';
    const overrunStr = sched.overrunMin > 0 ? formatOverrun(sched.overrunMin) : '';
    const overrunClass = sched.overrunMin > 0 ? ' has-overrun' : '';

    const group = getSceneGroup(s.num);
    const rowStyle = group ? `background:${group.bg};` : '';
    const borderStyle = group ? `border-left-color:${group.border} !important;` : '';

    const movOpts  = buildSelectOpts(MOVEMENT_TYPES, state.acSets.movement, s.movement || 'STATIC');
    const sizeOpts = buildSelectOpts(SHOT_SIZES,     state.acSets.shotSize, s.shotSize || '');
    const lensOpts = buildSelectOpts(LENS_OPTIONS,   state.acSets.lens,     s.lens || '');

    const pinIcon = (!sched.isInherited && s.callTime && isValidTime(s.callTime))
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; right:4px; pointer-events:none; opacity:0.8;" title="Pinned Call Time"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>'
      : '';

    return `<tr data-id="${s.id}" draggable="false" style="${rowStyle}">
      <td class="drag-handle" title="Drag to reorder" style="${borderStyle}">&#x2807;</td>
      <td class="col-select"><input type="checkbox" class="row-checkbox" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}></td>
      <td class="storyboard-cell" data-id="${s.id}">${storyboardContent}</td>
      <td class="scene-num" contenteditable="true" data-field="num">${esc(s.num)}</td>
      <td class="shot-num" contenteditable="true" data-field="shot">${esc(s.shot || '')}</td>
      <td style="text-align: center;"><span class="priority-label" data-p="${s.priority}" title="Priority: ${s.priority}">${prioDisplay}</span></td>
      <td contenteditable="true" data-field="location">${esc(s.location)}</td>
      <td contenteditable="true" data-field="description">${esc(s.description)}</td>
      <td contenteditable="true" data-field="notes">${esc(s.notes)}</td>
      <td contenteditable="true" data-field="characters">${esc(s.characters)}</td>
      <td><select class="screen-only" data-field="shotSize">${sizeOpts}</select><span class="print-only">${esc(s.shotSize || '')}</span></td>
      <td class="hide-tablet"><select class="screen-only" data-field="lens">${lensOpts}</select><span class="print-only">${esc(s.lens || '')}</span></td>
      <td><select class="screen-only" data-field="movement">${movOpts}</select><span class="print-only">${esc(s.movement || 'STATIC')}</span></td>
      <td class="hide-tablet" contenteditable="true" data-field="props">${esc(s.props)}</td>
      <td>
        <input class="duration-input screen-only${durValid ? '' : ' invalid'}" type="text" value="${esc(s.duration)}" placeholder="HH:MM" data-field="duration">
        <span class="print-only">${esc(s.duration)}</span>
      </td>
      <td><div style="position:relative;display:flex;align-items:center;">
        <input class="time-input screen-only${callValid ? '' : ' invalid'}${inheritedClass}" type="text" value="${callTimeVal}" placeholder="HH:MM" data-field="callTime" data-inherited="${sched.isInherited}" style="padding-right: 18px;">
        <span class="print-only">${callTimeVal}</span>
        ${pinIcon}
      </div></td>
      <td class="end-time">${endTimeStr}</td>
      <td class="running-time hide-tablet">${formatDuration(runTime)}</td>
      <td class="col-actions"><button class="actions-btn" title="Actions" aria-label="Shot Actions">&#x22EF;</button></td>
    </tr>`;
  }

  export function buildBlockRow(s, runTime) {
    const durValid = isValidDuration(s.duration);
    const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1, overrunMin: 0, isInherited: false };

    const callTimeVal = sched.isInherited ? formatTime(sched.callMin) : (s.callTime || '');
    const callValid = isValidTime(s.callTime);
    const inheritedClass = sched.isInherited ? ' inherited' : '';
    const endTimeStr = sched.endMin >= 0 ? formatTime(sched.endMin) : '--:--';
    const overrunStr = sched.overrunMin > 0 ? formatOverrun(sched.overrunMin) : '';
    const overrunClass = sched.overrunMin > 0 ? ' has-overrun' : '';

    const group = getSceneGroup(s.num);
    const rowStyle = group ? `background:${group.bg};` : '';
    const borderStyle = group ? `border-left-color:${group.border} !important;` : '';

    const pinIcon = (!sched.isInherited && s.callTime && isValidTime(s.callTime))
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; right:4px; pointer-events:none; opacity:0.8;" title="Pinned Call Time"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>'
      : '';

    return `<tr class="block-row block-type-${s.blockType}" data-id="${s.id}" draggable="false" style="${rowStyle}">
      <td class="drag-handle" title="Drag to reorder" style="${borderStyle}">&#x2807;</td>
      <td class="col-select"><input type="checkbox" class="row-checkbox" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}></td>
      <td class="storyboard-cell"></td>
      <td class="scene-num" contenteditable="true" data-field="num">${esc(s.num || '')}</td>
      <td class="shot-num"></td>
      <td></td>
      <td></td>
      <td>
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <select data-field="blockType" class="block-select screen-only">
            ${['PREP','BREAK','LUNCH','TRAVEL','CUSTOM'].map(t => `<option value="${t}"${s.blockType === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <span class="print-only">${esc(s.blockType)}</span>
          <span contenteditable="true" data-field="label" class="block-label" data-placeholder="Label..." style="${s.blockType === 'CUSTOM' ? 'display:inline-block;' : 'display:none;'}">${esc(s.label || '')}</span>
        </div>
      </td>
      <td contenteditable="true" data-field="notes">${esc(s.notes || '')}</td>
      <td></td> <!-- Empty cell for Characters -->
      <td></td>
      <td class="hide-tablet"></td>
      <td></td>
      <td class="hide-tablet"></td>
      <td>
        <input class="duration-input screen-only${durValid ? '' : ' invalid'}" type="text" value="${esc(s.duration)}" placeholder="HH:MM" data-field="duration">
        <span class="print-only">${esc(s.duration)}</span>
      </td>
      <td><div style="position:relative;display:flex;align-items:center;">
        <input class="time-input screen-only${callValid ? '' : ' invalid'}${inheritedClass}" type="text" value="${callTimeVal}" placeholder="HH:MM" data-field="callTime" data-inherited="${sched.isInherited}" style="padding-right: 18px;">
        <span class="print-only">${callTimeVal}</span>
        ${pinIcon}
      </div></td>
      <td class="end-time">${endTimeStr}</td>
      <td class="running-time hide-tablet">${formatDuration(runTime)}</td>
      <td class="col-actions"><button class="actions-btn" title="Actions" aria-label="Shot Actions">&#x22EF;</button></td>
    </tr>`;
  }

  // ── Event Binding: Table ───────────────────────
  let lastCheckedId = null;

  export function softRender(forceGroupRender = false) {
    if (state.currentGroupMode !== 'none' && forceGroupRender) {
      render();
    } else {
      refreshScheduleDOM();
      updateStats();
    }
  }

  export function initTableDelegation() {
    const bind = (evt, handler, opts) => {
      dom.shotBody.addEventListener(evt, handler, opts);
      dom.gridWrap.addEventListener(evt, handler, opts);
    };
    const selectAll = $('selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', e => {
        if (e.target.checked) {
          state.shots.forEach(s => state.selectedIds.add(s.id));
        } else {
          state.selectedIds.clear();
        }
        updateSelectionUI();
        render(); // Re-render to show checked rows
      });
    }

    bind('change', async e => {
      const target = e.target;
      if (target.matches('.row-checkbox')) {
        const id = target.dataset.id;
        const checked = target.checked;
        if (e.shiftKey && lastCheckedId) {
          const rows = Array.from(dom.shotBody.querySelectorAll('tr[data-id], .grid-card[data-id]'));
          const startIdx = rows.findIndex(r => r.dataset.id === lastCheckedId);
          const endIdx = rows.findIndex(r => r.dataset.id === id);
          if (startIdx !== -1 && endIdx !== -1) {
            const min = Math.min(startIdx, endIdx);
            const max = Math.max(startIdx, endIdx);
            for (let i = min; i <= max; i++) {
              const rowId = rows[i].dataset.id;
              if (checked) state.selectedIds.add(rowId);
              else state.selectedIds.delete(rowId);
              rows[i].querySelector('.row-checkbox').checked = checked;
              rows[i].classList.toggle('selected', checked);
            }
          }
        } else {
          if (checked) state.selectedIds.add(id);
          else state.selectedIds.delete(id);
          target.closest('tr, .grid-card').classList.toggle('selected', checked);
        }
        lastCheckedId = id;
        updateSelectionUI();
      }

      if (target.matches('select[data-field]')) {
        const row = target.closest('tr, .grid-card');
        const shot = getShot(row.dataset.id);
        if (!shot) return;
        const field = target.dataset.field;

        if (target.value === '__custom__') {
          const labels = { shotSize: 'Shot Size', lens: 'Lens', movement: 'Movement' };
          const customVal = await customPrompt(`Enter custom ${labels[field] || field}:`);
          if (customVal && customVal.trim()) {
            const trimmed = customVal.trim();
            if (state.acSets[field]) { state.acSets[field].add(trimmed); saveAutocomplete(); }
            applyBulkEdit(shot.id, field, trimmed);
            save(); softRender();
          } else {
            target.value = shot[field] || '';
          }
          return;
        }

        if (field === 'blockType') {
          applyBulkEdit(shot.id, 'blockType', target.value);
          const lbl = row.querySelector('.block-label');
          if (lbl) lbl.style.display = target.value === 'CUSTOM' ? '' : 'none';
          save(); softRender(true);
        } else {
          applyBulkEdit(shot.id, field, target.value);
          let force = (field === state.currentGroupMode);
          save(); softRender(force);
        }
      }
    });

    bind('focusin', e => {
      const target = e.target;
      if (target.matches('[contenteditable="true"]')) {
        const field = target.dataset.field;
        if (field === 'characters' || field === 'location' || field === 'props') {
          cancelAutocompleteHide();
          showAutocomplete(target, field);
        }
      }
      if (target.matches('.time-input[data-field="callTime"]')) {
        if (target.dataset.inherited === 'true') {
          target.value = '';
          target.classList.remove('inherited');
        }
      }
    });

    bind('input', e => {
      const target = e.target;
      if (target.matches('[contenteditable="true"]')) {
        if (isAutocompleteActiveFor(target)) filterAutocomplete();
      }
    });

    bind('focusout', e => {
      const target = e.target;
      if (target.matches('[contenteditable="true"]')) {
        const field = target.dataset.field;
        if (field === 'characters' || field === 'location' || field === 'props') {
          scheduleAutocompleteHide();
        }
        const row = target.closest('tr, .grid-card');
        if (row) {
          const id = row.dataset.id;
          const shot = getShot(id);
          if (shot) { 
            const val = target.textContent.trim();
            applyBulkEdit(id, field, val);
            
            if (field === 'characters' || field === 'props') {
              let changed = false;
              val.split(',').forEach(part => {
                const trimmed = part.trim();
                if (trimmed && !state.acSets[field].has(trimmed)) {
                  state.acSets[field].add(trimmed);
                  changed = true;
                }
              });
              if (changed) saveAutocomplete();
            } else if (field === 'location') {
              if (val && !state.acSets.location.has(val)) {
                state.acSets.location.add(val);
                saveAutocomplete();
              }
            }
            
            let force = (field === state.currentGroupMode || field === 'num' || field === 'shot');
            save(); softRender(force); 
          }
        }
      }

      if (target.matches('.duration-input')) {
        const row = target.closest('tr, .grid-card');
        const shot = getShot(row.dataset.id);
        if (shot) {
          const normalized = normalizeDuration(target.value.trim());
          applyBulkEdit(shot.id, 'duration', normalized);
          target.value = normalized;
          save(); softRender(true);
        }
      }

      if (target.matches('.block-label')) {
        const row = target.closest('tr, .grid-card');
        const shot = getShot(row.dataset.id);
        if (shot) { applyBulkEdit(shot.id, 'label', target.textContent.trim()); save(); }
      }

      if (target.matches('.time-input[data-field="callTime"]')) {
        const row = target.closest('tr, .grid-card');
        const shot = getShot(row.dataset.id);
        if (shot) {
          const raw = target.value.trim();
          if (raw === '') {
            applyBulkEdit(shot.id, 'callTime', '');
          } else {
            const normalized = normalizeTime(raw);
            if (!isValidTime(normalized)) {
              target.classList.add('invalid');
              return;
            }
            applyBulkEdit(shot.id, 'callTime', normalized);
            target.value = normalized;
            target.classList.remove('invalid');
          }
          save(); softRender(true);
        }
      }
    });

    bind('keydown', e => {
      const target = e.target;
      if (target.matches('[contenteditable="true"]')) {
        if (handleAutocompleteKey(e, target)) return;
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); target.blur(); }
      }
      if (target.matches('.duration-input') || target.matches('.block-label') || target.matches('.time-input[data-field="callTime"]')) {
        if (e.key === 'Enter') { e.preventDefault(); target.blur(); }
      }
    });

    bind('click', e => {
      const target = e.target;
      
      const row = target.closest('tr[data-id], .grid-card[data-id]');
      if (row && (e.metaKey || e.ctrlKey || e.shiftKey) && !target.closest('.actions-btn') && !target.closest('.storyboard-cell')) {
        e.preventDefault();
        const id = row.dataset.id;
        const checkbox = row.querySelector('.row-checkbox');
        
        if (e.shiftKey && lastCheckedId) {
          const rows = Array.from(dom.shotBody.querySelectorAll('tr[data-id], .grid-card[data-id]'));
          const startIdx = rows.findIndex(r => r.dataset.id === lastCheckedId);
          const endIdx = rows.findIndex(r => r.dataset.id === id);
          if (startIdx !== -1 && endIdx !== -1) {
            const min = Math.min(startIdx, endIdx);
            const max = Math.max(startIdx, endIdx);
            
            const lastRow = rows.find(r => r.dataset.id === lastCheckedId);
            const checked = lastRow ? lastRow.querySelector('.row-checkbox').checked : true;
            
            for (let i = min; i <= max; i++) {
              const rowId = rows[i].dataset.id;
              if (checked) state.selectedIds.add(rowId);
              else state.selectedIds.delete(rowId);
              rows[i].querySelector('.row-checkbox').checked = checked;
              rows[i].classList.toggle('selected', checked);
            }
          }
        } else if (e.metaKey || e.ctrlKey) {
          const isSelected = state.selectedIds.has(id);
          if (isSelected) {
            state.selectedIds.delete(id);
            checkbox.checked = false;
            row.classList.remove('selected');
          } else {
            state.selectedIds.add(id);
            checkbox.checked = true;
            row.classList.add('selected');
          }
          lastCheckedId = id;
        }
        updateSelectionUI();
        return;
      }
      
      const priorityLabel = target.closest('.priority-label');
      if (priorityLabel) {
        const id = priorityLabel.closest('tr, .grid-card').dataset.id;
        const shot = getShot(id);
        if (shot) {
          const i = PRIORITY_CYCLE.indexOf(shot.priority);
          shot.priority = PRIORITY_CYCLE[(i+1) % PRIORITY_CYCLE.length];
          save(); render();
        }
        return;
      }

      const storyboardCell = target.closest('.storyboard-cell');
      if (storyboardCell) {
        const id = storyboardCell.dataset.id;
        if (!id) return; 
        const shot = getShot(id);
        if (!shot) return;
        if (shot.storyboard) {
          openLightbox(id);
        } else {
          state.currentStoryboardId = id;
          dom.fileInput.click();
        }
        return;
      }

      const actionsBtn = target.closest('.actions-btn');
      if (actionsBtn) {
        e.stopPropagation();
        const row = actionsBtn.closest('tr, .grid-card');
        state.contextRowId = row.dataset.id;
        showContextMenu(e.clientX, e.clientY);
        return;
      }
    });

    bind('mousedown', e => {
      const handle = e.target.closest('.drag-handle');
      if (handle) initDrag(e, handle);
    });

    bind('touchstart', e => {
      const handle = e.target.closest('.drag-handle');
      if (handle) initTouchDrag(e, handle);
    }, { passive: false });
  }

  // ── File Input (Storyboard) ────────────────────
  dom.fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !state.currentStoryboardId) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1920;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const shot = getShot(state.currentStoryboardId);
        if (shot) {
          putImage(shot.id, dataUrl).then(() => {
            shot.storyboard = true;
            save();
            render();
            // If dom.lightbox is open (Replace flow), refresh it
            if (dom.lightbox.classList.contains('lb-visible')) {
              openLightbox(state.currentStoryboardId);
            }
          });
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    dom.fileInput.value = '';
  });

  // ── Context Menu ───────────────────────────────
  export function showContextMenu(x, y) {
    dom.contextMenu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    dom.contextMenu.style.top = Math.min(y, window.innerHeight - 140) + 'px';
    dom.contextMenu.classList.add('visible');
  }

  export function hideContextMenu() {
    dom.contextMenu.classList.remove('visible');
    state.contextRowId = null;
  }

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', e => {
    const row = e.target.closest('tr[data-id]');
    if (row) {
      e.preventDefault();
      state.contextRowId = row.dataset.id;
      showContextMenu(e.clientX, e.clientY);
    }
  });

  $('cmDuplicate').addEventListener('click', () => {
    if (!state.contextRowId) return;
    const src = getShot(state.contextRowId);
    if (src) {
      const idx = state.shots.indexOf(src);
      const dup = createShot({ ...src, id: uid(), num: String(state.shots.length + 1), callTime: '' });
      const updatedShots = [...state.shots];
      updatedShots.splice(idx + 1, 0, dup);
      setShots(updatedShots);
      save(); render();
    }
  });

  $('cmInsertAbove').addEventListener('click', () => {
    if (!state.contextRowId) return;
    const idx = state.shots.findIndex(s => s.id === state.contextRowId);
    if (idx >= 0) {
      const src = state.shots[idx];
      const defaultNum = src ? src.num : '';
      const defaultShot = getNextShotNumber(defaultNum, state.shots);
      const updatedShots = [...state.shots];
      updatedShots.splice(idx, 0, createShot({ num: defaultNum, shot: defaultShot }));
      setShots(updatedShots);
      save(); render();
    }
  });

  $('cmInsertBelow').addEventListener('click', () => {
    if (!state.contextRowId) return;
    const idx = state.shots.findIndex(s => s.id === state.contextRowId);
    if (idx >= 0) {
      const src = state.shots[idx];
      const defaultNum = src ? src.num : '';
      const defaultShot = getNextShotNumber(defaultNum, state.shots);
      const updatedShots = [...state.shots];
      updatedShots.splice(idx + 1, 0, createShot({ num: defaultNum, shot: defaultShot }));
      setShots(updatedShots);
      save(); render();
    }
  });

  $('cmDelete').addEventListener('click', () => {
    if (!state.contextRowId) return;
    setShots(state.shots.filter(s => s.id !== state.contextRowId));
    save(); render();
  });

  // ── Render: Grid ───────────────────────────────
  export function renderGrid() {
    const filtered = state.shots.filter(s => s.kind !== 'block');
    let html = '';
    let cumulative = 0;

    if (state.currentGroupMode !== 'none') {
      const groups = {};
      const order = [];
      filtered.forEach(s => {
        const { key } = getGroupInfo(s);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(s);
      });

      order.forEach(key => {
        const { icon } = getGroupInfo(groups[key][0] || {});

        html += `<div class="grid-group-header">${icon}${esc(key)}</div>`;
        groups[key].forEach(s => {
          const dur = parseDuration(s.duration);
          if (dur > 0) cumulative += dur;
          html += s.kind === 'block' ? buildGridBlockCard(s, cumulative) : buildGridCard(s, cumulative);
        });
      });
    } else {
      filtered.forEach(s => {
        const dur = parseDuration(s.duration);
        if (dur > 0) cumulative += dur;
        html += s.kind === 'block' ? buildGridBlockCard(s, cumulative) : buildGridCard(s, cumulative);
      });
    }

    dom.gridWrap.innerHTML = html;
    hydrateImages();
  }

  function buildGridCard(s, runTime) {
    const prioMap = { 'off': '-', 'low': 'I', 'medium': 'II', 'high': 'III' };
    const prioDisplay = prioMap[s.priority] || '-';
    const durValid = isValidDuration(s.duration);
    const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1, overrunMin: 0, isInherited: false };
    const callTimeVal = sched.isInherited ? formatTime(sched.callMin) : (s.callTime || '');
    const callValid = isValidTime(s.callTime);
    const inheritedClass = sched.isInherited ? ' inherited' : '';

    const group = getSceneGroup(s.num);
    const pillStyle = group ? `background:${group.border};` : 'background:var(--text-2);';
    
    let ratioVal = state.boardRatio === 'auto' ? '16/9' : state.boardRatio;
    if (ratioVal.includes(':')) ratioVal = ratioVal.replace(':', '/');

    let storyboardContent = '';
    if (s.storyboard) {
      storyboardContent = `<img data-lazy-img="${s.id}" alt="Storyboard">`;
    } else {
      storyboardContent = `<div class="gc-board-placeholder" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">Upload Board</div>`;
    }

    const movOpts  = buildSelectOpts(MOVEMENT_TYPES, state.acSets.movement, s.movement || 'STATIC');
    const sizeOpts = buildSelectOpts(SHOT_SIZES,     state.acSets.shotSize, s.shotSize || '');
    const lensOpts = buildSelectOpts(LENS_OPTIONS,   state.acSets.lens,     s.lens || '');

    const isSelected = state.selectedIds.has(s.id) ? ' selected' : '';

      const v = state.gridVisibility || { header: true, location: true, schedule: true, description: true, castProps: true, tech: true };

      let headerHTML = v.header ? `<div class="gc-header">
        <div style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" class="row-checkbox" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}>
          <div class="gc-scene-pill" style="${pillStyle} display:flex; align-items:center; gap:4px;">
            <span style="font-size:0.75em; font-weight:bold; opacity:0.7; letter-spacing:0.5px;">SCENE</span>
            <span contenteditable="true" data-field="num" style="min-width:1ch; display:inline-block; outline:none;">${esc(s.num)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:0.75em; font-weight:bold; color:var(--text-2); letter-spacing:0.5px;">SHOT</span>
            <span contenteditable="true" data-field="shot" style="outline:none; min-width:1ch; display:inline-block; color:var(--text-0);">${esc(s.shot || '')}</span>
          </div>
        </div>
        <span class="priority-label" data-p="${s.priority}" title="Priority: ${s.priority}" style="margin-right:12px;">${prioDisplay}</span>
      </div>` : `<div style="display:none;"><input type="checkbox" class="row-checkbox" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}></div>`;

      let locationHTML = v.location ? `<div contenteditable="true" data-field="location" style="outline:none; color:var(--text-1); font-size: 0.9em; min-width:2ch; display:inline-block;">${esc(s.location || 'Location...')}</div>` : '';
      
      let scheduleHTML = v.schedule ? `<div style="font-family: var(--font-mono); font-size: 0.9em; display:flex; align-items:center;">
            <input class="time-input${callValid ? '' : ' invalid'}${inheritedClass}" type="text" value="${callTimeVal}" placeholder="HH:MM" data-field="callTime" data-inherited="${sched.isInherited}" style="width: 44px; background: transparent; border: none; color: var(--text-1); text-align: right; outline: none; font-family: inherit;">
            <span style="color:var(--text-2); margin:0 2px;">→</span>
            <input class="duration-input${durValid ? '' : ' invalid'}" type="text" value="${esc(s.duration)}" placeholder="HH:MM" data-field="duration" style="width: 44px; background: transparent; border: none; color: var(--text-1); outline: none; font-family: inherit;">
          </div>` : '';

      let topRowHTML = (v.location || v.schedule) ? `<div class="gc-row"><div style="flex:1;">${locationHTML}</div>${scheduleHTML}</div>` : '';

      let descHTML = '';
      if (v.description) {
        const descText = s.description ? esc(s.description) : '<span style="opacity:0.35;">Description…</span>';
        descHTML = `<div class="gc-desc" contenteditable="true" data-field="description" style="outline:none;">${descText}</div>`;
        if (s.notes) {
          descHTML += `<div class="gc-notes" contenteditable="true" data-field="notes" style="outline:none;">${esc(s.notes)}</div>`;
        }
      }

      let castPropsHTML = v.castProps ? `<div class="gc-row" style="margin-top:2px;">
          <span style="color:var(--text-1);">Cast: <span contenteditable="true" data-field="characters" style="outline:none; color:var(--text-0);">${esc(s.characters || '')}</span></span>
          <span style="color:var(--text-1); font-size: 0.9em;">Props: <span contenteditable="true" data-field="props" style="outline:none; color:var(--text-0);">${esc(s.props || '')}</span></span>
        </div>` : '';

      let techHTML = v.tech ? `<div class="gc-pills">
          <select class="gc-pill" data-field="shotSize" style="appearance:none; padding-right:4px;">${sizeOpts}</select>
          <select class="gc-pill" data-field="lens" style="appearance:none; padding-right:4px;">${lensOpts}</select>
          <select class="gc-pill" data-field="movement" style="appearance:none; padding-right:4px;">${movOpts}</select>
        </div>` : '';

      let infoHTML = (topRowHTML || descHTML || castPropsHTML || techHTML) ? `<div class="gc-info">${topRowHTML}${descHTML}${castPropsHTML}${techHTML}</div>` : '';

    return `<div class="grid-card${isSelected}" data-id="${s.id}">
      <div class="col-actions" style="position: absolute; top: 0; right: 0; z-index: 10;"><button class="actions-btn" title="Actions" aria-label="Shot Actions" style="background: transparent; border: none; font-size: 18px; color: var(--text-0); cursor: pointer; padding: 4px;">&#x22EF;</button></div>
      ${headerHTML}
      <div class="gc-board-wrap storyboard-cell" data-id="${s.id}" style="cursor: pointer; aspect-ratio: ${ratioVal};">
        ${storyboardContent}
      </div>
      ${infoHTML}
    </div>`;
  }

  function buildGridBlockCard(s, runTime) {
    const durValid = isValidDuration(s.duration);
    const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1, overrunMin: 0, isInherited: false };
    const callTimeVal = sched.isInherited ? formatTime(sched.callMin) : (s.callTime || '');
    const callValid = isValidTime(s.callTime);
    const inheritedClass = sched.isInherited ? ' inherited' : '';

    const group = getSceneGroup(s.num);
    const pillStyle = group ? `background:${group.bg}; border-left: 4px solid ${group.border};` : 'background:var(--bg-2); border-left: 4px solid var(--text-2);';

    const isSelected = state.selectedIds.has(s.id) ? ' selected' : '';

    return `<div class="grid-card block-row block-type-${s.blockType} ${isSelected}" data-id="${s.id}" style="${pillStyle} grid-column: 1 / -1; flex-direction: row; align-items: center; padding: 12px; gap: 12px;">
      <input type="checkbox" class="row-checkbox" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}>
      
      <div class="gc-scene-pill" style="background: transparent; color: var(--text-0); display:flex; align-items:center; gap:4px;">
        <span style="font-size:0.75em; font-weight:bold; opacity:0.5; letter-spacing:0.5px;">SCENE</span>
        <span contenteditable="true" data-field="num" style="min-width:1ch; display:inline-block; outline:none;">${esc(s.num)}</span>
      </div>

      <select data-field="blockType" class="gc-pill" style="appearance:none;">
        ${['PREP','BREAK','LUNCH','TRAVEL','CUSTOM'].map(t => `<option value="${t}"${s.blockType === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
      <span contenteditable="true" data-field="label" class="block-label" data-placeholder="Label..." style="${s.blockType === 'CUSTOM' ? 'display:inline-block;' : 'display:none;'} color:var(--text-0); font-weight:bold; font-family:var(--font-sans);">${esc(s.label || '')}</span>
      
      <div style="flex: 1;"></div>

      <div style="font-family: var(--font-mono); font-size: 0.9em; display:flex; align-items:center;">
        <input class="time-input${callValid ? '' : ' invalid'}${inheritedClass}" type="text" value="${callTimeVal}" placeholder="HH:MM" data-field="callTime" data-inherited="${sched.isInherited}" style="width: 48px; background: transparent; border: none; color: var(--text-1); text-align: right; outline: none; font-family: inherit;">
        <span style="color:var(--text-2); margin:0 8px;">→</span>
        <input class="duration-input${durValid ? '' : ' invalid'}" type="text" value="${esc(s.duration)}" placeholder="HH:MM" data-field="duration" style="width: 48px; background: transparent; border: none; color: var(--text-1); outline: none; font-family: inherit;">
      </div>
      <div class="col-actions"><button class="actions-btn" title="Actions" aria-label="Shot Actions" style="background: transparent; border: none; font-size: 18px; color: var(--text-0); cursor: pointer; padding: 4px;">&#x22EF;</button></div>
    </div>`;
  }
