(() => {
  const viewport = document.querySelector('.journey-object__viewport');
  if (!viewport) return;
  const image = viewport.querySelector('img');
  const toolbar = document.querySelector('.journey-object__toolbar');
  let x = 0, y = 0, scale = 1, drag = null;
  function render() {
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    toolbar.querySelector('output').textContent = `${Math.round(scale * 100)}%`;
    toolbar.querySelector('[data-zoom="out"]').disabled = scale <= 0.6;
    toolbar.querySelector('[data-zoom="in"]').disabled = scale >= 3;
  }
  function zoom(factor, anchorX = 0, anchorY = 0) {
    const next = Math.min(3, Math.max(0.6, scale * factor));
    x = anchorX - (anchorX - x) * next / scale;
    y = anchorY - (anchorY - y) * next / scale;
    scale = next;
    render();
  }
  function reset() { x = 0; y = 0; scale = 1; render(); }
  toolbar.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.zoom;
    if (action === 'reset') reset();
    else if (action) zoom(action === 'in' ? 1.2 : 1 / 1.2);
  });
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    zoom(Math.exp(-delta * 0.002), (event.clientX - rect.left - rect.width / 2) * viewport.clientWidth / rect.width, (event.clientY - rect.top - rect.height / 2) * viewport.clientHeight / rect.height);
  }, { passive: false });
  viewport.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const rect = viewport.getBoundingClientRect();
    x += (event.clientX - drag.x) * viewport.clientWidth / rect.width;
    y += (event.clientY - drag.y) * viewport.clientHeight / rect.height;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    render();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    viewport.addEventListener(type, (event) => {
      drag = null;
      viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    });
  }
  viewport.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] };
    if (moves[event.key]) { event.preventDefault(); x += moves[event.key][0]; y += moves[event.key][1]; render(); }
    else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? 1 / 1.2 : 1.2); }
    else if (['Home', '0'].includes(event.key)) { event.preventDefault(); reset(); }
  });
})();
