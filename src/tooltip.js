export function initTooltips() {
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'custom-tooltip';
  document.body.appendChild(tooltipEl);

  let activeTarget = null;

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[title]');
    if (target) {
      const title = target.getAttribute('title');
      if (title) {
        target.setAttribute('data-original-title', title);
        target.removeAttribute('title');
        
        tooltipEl.textContent = title;
        tooltipEl.classList.add('visible');
        
        const rect = target.getBoundingClientRect();
        
        // Position centered below the element
        let left = rect.left + (rect.width / 2);
        let top = rect.bottom + 6;
        
        // Boundaries check
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
        
        // Adjust if it goes off screen after rendering
        requestAnimationFrame(() => {
          const tRect = tooltipEl.getBoundingClientRect();
          if (tRect.right > window.innerWidth) {
            tooltipEl.style.left = (window.innerWidth - tRect.width / 2 - 8) + 'px';
          }
          if (tRect.left < 0) {
            tooltipEl.style.left = (tRect.width / 2 + 8) + 'px';
          }
          if (tRect.bottom > window.innerHeight) {
            tooltipEl.style.top = (rect.top - tRect.height - 6) + 'px'; // Show above
          }
        });
        
        activeTarget = target;
      }
    } else if (activeTarget && !e.target.closest('.custom-tooltip')) {
      // Hide if mouse leaves target
      hideTooltip();
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (activeTarget && e.target === activeTarget) {
      hideTooltip();
    }
  });

  // Also hide on click or scroll
  document.addEventListener('mousedown', hideTooltip);
  window.addEventListener('scroll', hideTooltip, { capture: true });

  function hideTooltip() {
    if (activeTarget) {
      const originalTitle = activeTarget.getAttribute('data-original-title');
      if (originalTitle) {
        activeTarget.setAttribute('title', originalTitle);
        activeTarget.removeAttribute('data-original-title');
      }
      activeTarget = null;
    }
    tooltipEl.classList.remove('visible');
  }
}
