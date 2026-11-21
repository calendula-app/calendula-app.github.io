// Calendula site: press and hold a block to reorder, tap a task to complete it.
(() => {
  const list = document.querySelector('.agenda');
  if (!list) return;

  const HOLD_MS = 280;      // press time before a block lifts
  const SLOP = 8;           // finger movement that cancels the hold (it's a scroll)
  const LIFT_SCALE = 1.03;

  let pending = null;       // { li, x, y, timer }
  let drag = null;          // active drag state
  let suppressClick = false;

  const items = () => [...list.children];
  const gap = () => parseFloat(getComputedStyle(list).rowGap) || 0;

  function startPress(li, x, y) {
    cancelPress();
    li.classList.add('pressing');
    pending = { li, x, y, timer: setTimeout(() => lift(li, y), HOLD_MS) };
  }

  function cancelPress() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.li.classList.remove('pressing');
    pending = null;
  }

  function lift(li, y) {
    const all = items();
    const rects = all.map(el => el.getBoundingClientRect());
    pending = null;
    li.classList.remove('pressing');
    li.classList.add('lifted');
    all.forEach(el => { if (el !== li) el.classList.add('shift'); });
    drag = {
      li, all, rects,
      from: all.indexOf(li),
      to: all.indexOf(li),
      startY: y,
      dy: 0,
      step: rects[all.indexOf(li)].height + gap(),
    };
    if (navigator.vibrate) navigator.vibrate(8);
    render();
  }

  function move(y) {
    if (!drag) return;
    const { rects, from, all } = drag;
    const minDy = rects[0].top - rects[from].top;
    const maxDy = rects[all.length - 1].bottom - rects[from].bottom;
    drag.dy = Math.max(minDy - 12, Math.min(maxDy + 12, y - drag.startY));

    // Target slot = how many siblings the lifted block's centre has passed.
    const centre = rects[from].top + rects[from].height / 2 + drag.dy;
    let to = 0;
    rects.forEach((r, i) => {
      if (i === from) return;
      if (centre > r.top + r.height / 2) to++;
    });
    if (to !== drag.to) {
      drag.to = to;
      if (navigator.vibrate) navigator.vibrate(4);
    }
    render();
  }

  function render() {
    const { li, all, from, to, dy, step } = drag;
    li.style.transform = `translateY(${dy}px) scale(${LIFT_SCALE})`;
    all.forEach((el, i) => {
      if (el === li) return;
      let shift = 0;
      if (from < to && i > from && i <= to) shift = -step;
      if (from > to && i >= to && i < from) shift = step;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }

  function drop() {
    if (!drag) return;
    const { li, all, rects, from, to } = drag;
    // Fly the block into its new slot, then commit the DOM order.
    const target = to === from ? 0
      : to > from ? rects[to].bottom - rects[from].bottom
      : rects[to].top - rects[from].top;
    li.classList.add('settling');
    li.style.transform = `translateY(${target}px) scale(1)`;
    const done = () => {
      li.removeEventListener('transitionend', done);
      clearTimeout(fallback);
      all.forEach(el => { el.classList.remove('shift', 'lifted', 'settling'); el.style.transition = 'none'; el.style.transform = ''; });
      const ref = all.filter(el => el !== li)[to] || null;
      list.insertBefore(li, ref);
      requestAnimationFrame(() => all.forEach(el => { el.style.transition = ''; }));
    };
    const fallback = setTimeout(done, 400);
    li.addEventListener('transitionend', done);
    drag = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
  }

  // ---- Touch (iOS Safari): hold to lift, then the page must not scroll ----
  list.addEventListener('touchstart', e => {
    const li = e.target.closest('.agenda > li');
    if (!li || e.touches.length > 1) return;
    const t = e.touches[0];
    startPress(li, t.clientX, t.clientY);
  }, { passive: true });

  list.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (drag) { e.preventDefault(); move(t.clientY); return; }
    if (pending && Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > SLOP) cancelPress();
  }, { passive: false });

  const endTouch = () => { cancelPress(); drop(); };
  list.addEventListener('touchend', endTouch);
  list.addEventListener('touchcancel', endTouch);

  // ---- Mouse ----
  list.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const li = e.target.closest('.agenda > li');
    if (li) startPress(li, e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', e => {
    if (drag) { move(e.clientY); return; }
    if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > SLOP) cancelPress();
  });
  window.addEventListener('mouseup', () => { cancelPress(); drop(); });

  // ---- Tap a task to complete / uncomplete ----
  list.addEventListener('click', e => {
    if (suppressClick) return;
    const task = e.target.closest('.task');
    if (!task) return;
    task.classList.toggle('done');
    task.classList.add('pop');
    setTimeout(() => task.classList.remove('pop'), 220);
    task.setAttribute('aria-checked', task.classList.contains('done'));
  });

  list.addEventListener('contextmenu', e => e.preventDefault());
})();
