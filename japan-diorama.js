(() => {
  const viewport = document.querySelector('.journey-object__viewport');
  if (!viewport) return;
  const image = viewport.querySelector('.journey-object__scene');
  const toolbar = document.querySelector('.journey-object__toolbar');
  const destinations = [{"id":"tokyo","name":"도쿄","en":"TOKYO","jp":"東京","title":"도시의 빛을 따라.","description":"골목의 작은 카페부터 잠들지 않는 거리까지. 익숙한 일상 너머, 나만의 도쿄를 발견하세요.","theme":"도시 · 미식 · 문화","x":75,"y":50,"coordinate":"35°40′ N 139°45′ E"},{"id":"kyoto","name":"교토","en":"KYOTO","jp":"京都","title":"시간이 머무는 곳.","description":"고요한 정원과 오래된 골목, 계절이 스며든 풍경. 조금 느린 걸음으로 교토를 만나보세요.","theme":"정원 · 산책 · 전통","x":61,"y":55,"coordinate":"35°00′ N 135°46′ E"},{"id":"osaka","name":"오사카","en":"OSAKA","jp":"大阪","title":"맛있는 순간 사이로.","description":"활기찬 시장에서 반짝이는 강변까지. 먹고 걷고 웃는 순간으로 오사카의 하루를 채워보세요.","theme":"미식 · 쇼핑 · 야경","x":58,"y":61,"coordinate":"34°41′ N 135°30′ E"},{"id":"fukuoka","name":"후쿠오카","en":"FUKUOKA","jp":"福岡","title":"가볍게, 더 가까이.","description":"바다의 바람과 포장마차의 온기. 여유로운 동네 산책으로 시작하는 후쿠오카 여행.","theme":"미식 · 바다 · 휴식","x":38,"y":67,"coordinate":"33°35′ N 130°24′ E"},{"id":"sapporo","name":"삿포로","en":"SAPPORO","jp":"札幌","title":"북쪽의 계절 속으로.","description":"넓은 하늘과 깊은 숲, 계절마다 새로운 풍경. 홋카이도에서 여행의 호흡을 바꿔보세요.","theme":"자연 · 계절 · 미식","x":83,"y":17,"coordinate":"43°03′ N 141°21′ E"}];
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
    zoom(Math.exp(-delta * 0.002), (event.clientX - rect.left) * viewport.clientWidth / rect.width - image.offsetLeft, (event.clientY - rect.top) * viewport.clientHeight / rect.height - image.offsetTop);
  }, { passive: false });
  viewport.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
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
    if (event.target !== viewport) return;
    const moves = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] };
    if (moves[event.key]) { event.preventDefault(); x += moves[event.key][0]; y += moves[event.key][1]; render(); }
    else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? 1 / 1.2 : 1.2); }
    else if (['Home', '0'].includes(event.key)) { event.preventDefault(); reset(); }
  });
  let selectedId = 'tokyo';
  document.querySelectorAll('[data-destination]').forEach(button => {
    button.addEventListener('click', () => {
      const destination = destinations.find(item => item.id === button.dataset.destination);
      selectedId = destination.id;
      document.querySelectorAll('[data-destination]').forEach(item => {
        const selected = item.dataset.destination === selectedId;
        item.setAttribute('aria-pressed', String(selected));
        if (item.classList.contains('terrain-marker')) item.classList.toggle('is-selected', selected);
      });
      const panel = document.querySelector('.explorer-destination');
      panel.querySelector('h2').firstChild.textContent = destination.name;
      panel.querySelector('h2 span').textContent = destination.en;
      panel.querySelector('.explorer-city > span').textContent = destination.jp;
      panel.querySelector('h3').textContent = destination.title;
      panel.querySelector('p').textContent = destination.description;
      panel.querySelector('.explorer-theme').textContent = destination.theme;
      document.querySelector('.explorer-coordinate').textContent = destination.coordinate;
      document.querySelector('.explorer-cta').firstChild.textContent = destination.name + ' 여행 계획하기 ';
    });
  });
  document.querySelector('.explorer-cta').addEventListener('click', () => {
    const destination = destinations.find(item => item.id === selectedId);
    const regionButton = Array.from(document.querySelectorAll('#regions [role="tab"]')).find(button => button.textContent.trim() === destination.name);
    regionButton?.click();
  });

})();
