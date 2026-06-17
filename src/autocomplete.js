import { dom, $ } from './dom.js';
import { state, SHOT_SIZES, LENS_OPTIONS, MOVEMENT_TYPES, LS_AC_CHARS, LS_AC_LOCS, LS_AC_PROPS, LS_AC_SHOTSIZE, LS_AC_LENS, LS_AC_MOVEMENT } from './state.js';
import { render, save } from './main.js';
  // ── Autocomplete ───────────────────────────────
  export function loadAutocomplete() {
    try {
      const chars = localStorage.getItem(LS_AC_CHARS);
      const locs = localStorage.getItem(LS_AC_LOCS);
      const props = localStorage.getItem(LS_AC_PROPS);
      const shotSize = localStorage.getItem(LS_AC_SHOTSIZE);
      const lens = localStorage.getItem(LS_AC_LENS);
      const movement = localStorage.getItem(LS_AC_MOVEMENT);
      if (chars) state.acSets.characters = new Set(JSON.parse(chars));
      if (locs) state.acSets.location = new Set(JSON.parse(locs));
      if (props) state.acSets.props = new Set(JSON.parse(props));
      if (shotSize) state.acSets.shotSize = new Set(JSON.parse(shotSize));
      if (lens) state.acSets.lens = new Set(JSON.parse(lens));
      if (movement) state.acSets.movement = new Set(JSON.parse(movement));
    } catch(e) {}
  }

  export function saveAutocomplete() {
    try {
      localStorage.setItem(LS_AC_CHARS, JSON.stringify([...state.acSets.characters]));
      localStorage.setItem(LS_AC_LOCS, JSON.stringify([...state.acSets.location]));
      localStorage.setItem(LS_AC_PROPS, JSON.stringify([...state.acSets.props]));
      localStorage.setItem(LS_AC_SHOTSIZE, JSON.stringify([...state.acSets.shotSize]));
      localStorage.setItem(LS_AC_LENS, JSON.stringify([...state.acSets.lens]));
      localStorage.setItem(LS_AC_MOVEMENT, JSON.stringify([...state.acSets.movement]));
    } catch(e) {}
  }

  export function extractAutocompleteFromShots() {
    let changed = false;
    state.shots.forEach(s => {
      if (s.location) {
        const val = s.location.trim();
        if (val && !state.acSets.location.has(val)) { state.acSets.location.add(val); changed = true; }
      }
      if (s.characters) {
        s.characters.split(',').forEach(part => {
          const val = part.trim();
          if (val && !state.acSets.characters.has(val)) { state.acSets.characters.add(val); changed = true; }
        });
      }
      if (s.props) {
        s.props.split(',').forEach(part => {
          const val = part.trim();
          if (val && !state.acSets.props.has(val)) { state.acSets.props.add(val); changed = true; }
        });
      }
      if (s.shotSize && !SHOT_SIZES.includes(s.shotSize)) {
        if (!state.acSets.shotSize.has(s.shotSize)) { state.acSets.shotSize.add(s.shotSize); changed = true; }
      }
      if (s.lens && !LENS_OPTIONS.includes(s.lens)) {
        if (!state.acSets.lens.has(s.lens)) { state.acSets.lens.add(s.lens); changed = true; }
      }
      if (s.movement && !MOVEMENT_TYPES.includes(s.movement)) {
        if (!state.acSets.movement.has(s.movement)) { state.acSets.movement.add(s.movement); changed = true; }
      }
    });
    if (changed) saveAutocomplete();
  }



  // ── Autocomplete UI ──────────────────────────────
  let acVisible = false;
  let acCurrentTarget = null;
  let acCurrentType = '';
  let acHideTimeout = null;

  export function isAutocompleteActiveFor(el) {
    return acVisible && acCurrentTarget === el;
  }

  export function scheduleAutocompleteHide() {
    acHideTimeout = setTimeout(hideAutocomplete, 150);
  }

  export function cancelAutocompleteHide() {
    clearTimeout(acHideTimeout);
  }

  let acOptions = [];
  let acSelectedIndex = -1;

  export function showAutocomplete(td, type) {
    acCurrentTarget = td;
    acCurrentType = type;
    acVisible = true;
    $('acDropdown').classList.add('visible');
    filterAutocomplete();
  }

  export function hideAutocomplete() {
    acVisible = false;
    acCurrentTarget = null;
    acCurrentType = null;
    $('acDropdown').classList.remove('visible');
  }

  export function filterAutocomplete() {
    if (!acVisible || !acCurrentTarget || !acCurrentType) return;
    
    const rawText = acCurrentTarget.innerText || '';
    let searchTerm = rawText;
    let prefix = '';
    
    if (acCurrentType === 'characters' || acCurrentType === 'props') {
      const lastComma = rawText.lastIndexOf(',');
      if (lastComma !== -1) {
        prefix = rawText.substring(0, lastComma + 1);
        searchTerm = rawText.substring(lastComma + 1);
      }
    }
    
    searchTerm = searchTerm.trim().toLowerCase();
    const set = state.acSets[acCurrentType];
    if (!set) return;

    acOptions = [...set].filter(val => val.toLowerCase().includes(searchTerm)).sort();
    
    if (acOptions.length === 0) {
      hideAutocomplete();
      return;
    }
    
    acSelectedIndex = -1;
    
    const drop = $('acDropdown');
    drop.innerHTML = acOptions.map((opt, i) => {
      let displayHtml = esc(opt);
      if (searchTerm) {
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
        displayHtml = esc(opt).replace(regex, '<mark>$1</mark>');
      }
      return `<div class="ac-item" data-index="${i}">${displayHtml}</div>`;
    }).join('');
    
    const rect = acCurrentTarget.getBoundingClientRect();
    drop.style.top = (rect.bottom + window.scrollY) + 'px';
    drop.style.left = (rect.left + window.scrollX) + 'px';
    drop.style.width = Math.max(rect.width, 150) + 'px';
  }

  function selectAutocompleteOption(index) {
    if (index < 0 || index >= acOptions.length || !acCurrentTarget) return;
    const opt = acOptions[index];
    
    let prefix = '';
    const rawText = acCurrentTarget.innerText || '';
    if (acCurrentType === 'characters' || acCurrentType === 'props') {
      const lastComma = rawText.lastIndexOf(',');
      if (lastComma !== -1) {
        prefix = rawText.substring(0, lastComma + 1) + ' ';
      }
    }
    
    acCurrentTarget.innerText = prefix + opt;
    
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(acCurrentTarget);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    
    acCurrentTarget.blur(); // Trigger save and render
    hideAutocomplete();
  }

  document.addEventListener('mousedown', e => {
    if (!acVisible) return;
    const item = e.target.closest('.ac-item');
    if (item) {
      e.preventDefault(); // prevent input blur
      selectAutocompleteOption(parseInt(item.dataset.index, 10));
    }
  });

  export function handleAutocompleteKey(e, el) {
    if (acVisible && acCurrentTarget === el) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acSelectedIndex = (acSelectedIndex + 1) % acOptions.length;
        Array.from(document.getElementById('acDropdown').children).forEach((child, i) => {
          child.classList.toggle('selected', i === acSelectedIndex);
          if (i === acSelectedIndex) child.scrollIntoView({ block: 'nearest' });
        });
        return true;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acSelectedIndex = (acSelectedIndex - 1 + acOptions.length) % acOptions.length;
        Array.from(document.getElementById('acDropdown').children).forEach((child, i) => {
          child.classList.toggle('selected', i === acSelectedIndex);
          if (i === acSelectedIndex) child.scrollIntoView({ block: 'nearest' });
        });
        return true;
      } else if (e.key === 'Enter') {
        if (acSelectedIndex >= 0) {
          e.preventDefault();
          selectAutocompleteOption(acSelectedIndex);
          return true;
        }
      } else if (e.key === 'Escape') {
        hideAutocomplete();
        return true;
      }
    }
    return false;
  }
