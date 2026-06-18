import { dom } from './dom.js';
import { state } from './state.js';
import { render, save } from './main.js';
import { formatTime, formatOverrun } from './schedule.js';
  // ── Lightbox ───────────────────────────────────
  export function getShotLabel(shot) {
    if (!shot) return '';
    const shotNum = shot.shot != null ? shot.shot : '';
    if (shot.num && shotNum) return `SCENE ${shot.num}  •  SHOT ${shotNum}`;
    if (shot.num) return `SCENE ${shot.num}`;
    return 'SHOT';
  }

  export function openLightbox(id) {
    // Build ordered list of all state.shots that have storyboard images, in current
    // rendered (filtered) order. We walk the actual tbody rows so the order
    // matches what the user sees (including group mode, filters, etc.).
    const renderedIds = Array.from(
      dom.shotBody.querySelectorAll('tr[data-id]')
    ).map(tr => tr.dataset.id);

    state.lbShotIds = renderedIds.filter(rid => {
      const s = state.shots.find(s => s.id === rid);
      return s && s.storyboard;
    });

    state.lbIndex = state.lbShotIds.indexOf(id);
    if (state.lbIndex === -1) return; // shouldn't happen

    lbRefresh();
    dom.lightbox.classList.add('lb-visible');
    document.body.style.overflow = 'hidden';
  }

  export function closeLightbox() {
    dom.lightbox.classList.remove('lb-visible');
    document.body.style.overflow = '';
    state.lbShotIds = [];
    state.lbIndex = -1;
  }

  function lbRefresh() {
    const id   = state.lbShotIds[state.lbIndex];
    const shot = state.shots.find(s => s.id === id);
    if (!shot) return;

    dom.lbImg.style.opacity = '0';
    // Small tick so the fade-out is visible when navigating
    requestAnimationFrame(() => {
      dom.lbImg.src = shot.storyboard;
      dom.lbImg.onload = () => { dom.lbImg.style.opacity = '1'; };
      // If cached, onload may not fire; force opacity
      if (dom.lbImg.complete) dom.lbImg.style.opacity = '1';
    });

    dom.lbLabel.textContent = getShotLabel(shot);
    
    const metaParts = [];
    if (shot.shotSize) metaParts.push(shot.shotSize);
    if (shot.lens) metaParts.push(shot.lens);
    if (shot.movement) metaParts.push(shot.movement);
    
    if (metaParts.length) {
      dom.lbMeta.textContent = metaParts.join('  •  ');
      dom.lbMeta.style.display = '';
    } else {
      dom.lbMeta.style.display = 'none';
    }

    const sched = state.scheduleMap[shot.id] || { callMin: -1, endMin: -1, overrunMin: 0, isInherited: false };
    const timeParts = [];
    if (sched.callMin >= 0) timeParts.push(`Call: ${formatTime(sched.callMin)}`);
    if (sched.endMin >= 0) timeParts.push(`End: ${formatTime(sched.endMin)}`);
    if (shot.duration) timeParts.push(`Dur: ${shot.duration}`);
    if (sched.overrunMin > 0) timeParts.push(`Overrun: ${formatOverrun(sched.overrunMin)}`);
    
    if (timeParts.length) {
      dom.lbTiming.textContent = timeParts.join('  •  ');
      dom.lbTiming.style.display = '';
    } else {
      dom.lbTiming.style.display = 'none';
    }

    const castPropsParts = [];
    if (shot.characters) castPropsParts.push(shot.characters);
    if (shot.props) castPropsParts.push(shot.props);
    
    if (castPropsParts.length) {
      dom.lbCast.textContent = castPropsParts.join('  •  ');
      dom.lbCast.style.display = '';
    } else {
      dom.lbCast.style.display = 'none';
    }
    
    dom.lbDescription.textContent = shot.description || '';
    if (shot.description) {
      dom.lbDescription.style.display = '';
    } else {
      dom.lbDescription.style.display = 'none';
    }

    dom.lbNotes.textContent = shot.notes || '';
    if (shot.notes) {
      dom.lbNotes.style.display = '';
    } else {
      dom.lbNotes.style.display = 'none';
    }
    
    dom.lbPrev.classList.toggle('disabled', state.lbIndex === 0);
    dom.lbNext.classList.toggle('disabled', state.lbIndex === state.lbShotIds.length - 1);
    state.currentStoryboardId = id; // keep in sync for Replace
  }

  function lbNavigate(dir) {
    const next = state.lbIndex + dir;
    if (next < 0 || next >= state.lbShotIds.length) return;
    state.lbIndex = next;
    lbRefresh();
  }

  // Button wiring
  dom.lbClose.addEventListener('click', closeLightbox);
  dom.lbBackdrop.addEventListener('click', closeLightbox);
  dom.lbPrev.addEventListener('click', e => { e.stopPropagation(); lbNavigate(-1); });
  dom.lbNext.addEventListener('click', e => { e.stopPropagation(); lbNavigate(1); });

  dom.lbReplace.addEventListener('click', e => {
    e.stopPropagation();
    dom.fileInput.click(); // state.currentStoryboardId already set by lbRefresh
  });

  dom.lbDelete.addEventListener('click', e => {
    e.stopPropagation();
    const id   = state.lbShotIds[state.lbIndex];
    const shot = state.shots.find(s => s.id === id);
    if (!shot) return;
    shot.storyboard = '';
    save(); render();

    // Remove from navigation list
    state.lbShotIds.splice(state.lbIndex, 1);
    if (state.lbShotIds.length === 0) {
      closeLightbox();
    } else {
      state.lbIndex = Math.min(state.lbIndex, state.lbShotIds.length - 1);
      lbRefresh();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!dom.lightbox.classList.contains('lb-visible')) return;
    if (e.key === 'Escape')      { closeLightbox(); }
    else if (e.key === 'ArrowLeft')  { lbNavigate(-1); }
    else if (e.key === 'ArrowRight') { lbNavigate(1); }
  });

  // Touch / swipe support
  let lbTouchStartX = null;
  dom.lightbox.addEventListener('touchstart', e => {
    if (e.touches.length === 1) lbTouchStartX = e.touches[0].clientX;
  }, { passive: true });
  dom.lightbox.addEventListener('touchend', e => {
    if (lbTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - lbTouchStartX;
    lbTouchStartX = null;
    if (Math.abs(dx) < 40) return; // too small — treat as tap
    if (dx < 0) lbNavigate(1);   // swipe left → next
    else         lbNavigate(-1);  // swipe right → prev
  }, { passive: true });
