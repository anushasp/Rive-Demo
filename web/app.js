/* global rive */
(() => {
  'use strict';

  rive.RuntimeLoader.setWasmUrl('https://cdn.jsdelivr.net/npm/@rive-app/canvas@2.43.1/rive.wasm');

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmtKwh = (n) => `${Math.round(n).toLocaleString()} kWh`;

  // ---------------------------------------------------------------------------
  // Rive mounting: HiDPI sizing, resize handling, offscreen pausing, loading UI
  // ---------------------------------------------------------------------------
  function mountRive({ canvas, src, stateMachine, animations, autoBind = true, onLoad }) {
    const stage = canvas.closest('.stage');
    stage.classList.add('is-loading');
    stage.classList.remove('has-error');
    // Resume by name: a bare play() would also start scrub-only timelines.
    const running = [].concat(animations ?? stateMachine);

    const r = new rive.Rive({
      src,
      canvas,
      stateMachines: stateMachine,
      animations,
      autoplay: true,
      autoBind,
      layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();
        onLoad?.(r);
        requestAnimationFrame(() => stage.classList.remove('is-loading'));
      },
      onLoadError: () => {
        stage.classList.remove('is-loading');
        stage.classList.add('has-error');
        stage.dataset.error = `Couldn't load ${src.split('/').pop()}`;
      },
    });

    const ro = new ResizeObserver(() => r.resizeDrawingSurfaceToCanvas());
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) r.play(running); else r.pause(running);
    });
    io.observe(stage);

    return {
      rive: r,
      destroy() { ro.disconnect(); io.disconnect(); r.cleanup(); },
    };
  }

  // Segmented control helper
  function segmented(name, onChange) {
    const group = $(`.segmented[data-name="${name}"]`);
    const buttons = $$('button', group);
    const select = (value, emit = true) => {
      buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === value)));
      if (emit) onChange(value);
    };
    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.value)));
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      select(next.dataset.value);
    });
    return { select, get value() { return buttons.find((b) => b.getAttribute('aria-checked') === 'true').dataset.value; } };
  }

  function paintRange(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--pct', `${pct}%`);
  }
  $$('input[type="range"]').forEach((el) => {
    paintRange(el);
    el.addEventListener('input', () => paintRange(el));
  });

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  const pageIsDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : darkQuery.matches;
  };
  const themeListeners = [];
  const onThemeChange = (fn) => themeListeners.push(fn);
  const emitTheme = () => themeListeners.forEach((fn) => fn(pageIsDark()));

  $('#themeToggle').addEventListener('click', () => {
    const next = pageIsDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    emitTheme();
  });
  darkQuery.addEventListener('change', emitTheme);

  // ---------------------------------------------------------------------------
  // 1. Home energy scene
  // ---------------------------------------------------------------------------
  // The file's "State Machine 1" declares isDay/hasSolar but has no transitions
  // wired to them, so toggling the inputs changes nothing. Instead we loop the
  // EnergyFlow timeline and scrub the two one-shot timelines in either direction:
  //   DayToNight:      0 = day,        end = night
  //   SolarVisibility: 0 = panels on,  end = panels hidden
  (() => {
    const TIMELINES = { night: 'DayToNight', noSolar: 'SolarVisibility' };
    const state = { isDay: true, hasSolar: true };
    const progress = { night: 0, noSolar: 0 }; // 0..1 along each timeline
    const target = () => ({ night: state.isDay ? 0 : 1, noSolar: state.hasSolar ? 0 : 1 });
    let r = null;
    let raf = 0;

    const ready = () => Object.values(TIMELINES).every((n) => r.animator.animations.some((x) => x.name === n));
    const scrubAll = () => Object.entries(TIMELINES).forEach(([k, name]) => {
      const a = r.animator.animations.find((x) => x.name === name);
      if (!a) return; // not instantiated until the runtime flushes its play queue
      r.scrub(name, progress[k] * (a.animation.duration / a.animation.fps));
    });

    const apply = () => {
      if (!r) return;
      cancelAnimationFrame(raf);
      let last = performance.now();
      const step = (now) => {
        const dt = (now - last) / 1000;
        last = now;
        const t = target();
        let done = true;
        for (const k of Object.keys(progress)) {
          const d = t[k] - progress[k];
          const move = reducedMotion ? Math.abs(d) : dt / 1.2; // ~1.2s per transition
          progress[k] += Math.sign(d) * Math.min(Math.abs(d), move);
          if (progress[k] !== t[k]) done = false;
        }
        scrubAll();
        if (!done || !ready()) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    mountRive({
      canvas: $('#c-home'),
      src: 'assets/daytonight.riv',
      animations: 'EnergyFlow',
      autoBind: false,
      onLoad: (instance) => {
        r = instance;
        const scrubbed = Object.values(TIMELINES);
        r.play(scrubbed);
        r.pause(scrubbed);
        apply();
      },
    });

    const time = segmented('timeOfDay', (v) => { state.isDay = v === 'day'; apply(); });

    $('#home-solar').addEventListener('change', (e) => { state.hasSolar = e.target.checked; apply(); });

    let cycleTimer = null;
    $('#home-cycle').addEventListener('change', (e) => {
      clearInterval(cycleTimer);
      if (!e.target.checked) return;
      const tick = () => time.select(state.isDay ? 'night' : 'day');
      tick();
      cycleTimer = setInterval(tick, 5000);
    });
  })();

  // ---------------------------------------------------------------------------
  // 2. EV meters (data binding: chargingStatus, meterPercent)
  // ---------------------------------------------------------------------------
  (() => {
    const state = { charging: true, percent: 76 };
    const meters = [];

    const applyTo = (vmi) => {
      if (!vmi) return;
      const c = vmi.boolean('chargingStatus');
      const p = vmi.number('meterPercent');
      if (c) c.value = state.charging;
      if (p) p.value = state.percent;
    };
    const apply = () => meters.forEach((m) => applyTo(m.rive.viewModelInstance));

    meters.push(mountRive({
      canvas: $('#c-ev1'), src: 'assets/evmeter.riv', stateMachine: 'State Machine',
      onLoad: (r) => applyTo(r.viewModelInstance),
    }));
    meters.push(mountRive({
      canvas: $('#c-ev2'), src: 'assets/evmeterv1.riv', stateMachine: 'state machine',
      onLoad: (r) => applyTo(r.viewModelInstance),
    }));

    const charging = $('#ev-charging');
    const slider = $('#ev-percent');
    const out = $('#ev-percent-out');
    const chips = $$('.chip[data-percent]');
    const simBtn = $('#ev-simulate');

    const setPercent = (v) => {
      state.percent = Math.max(0, Math.min(100, Math.round(v)));
      slider.value = state.percent;
      paintRange(slider);
      out.textContent = `${state.percent}%`;
      chips.forEach((c) => c.classList.toggle('is-active', Number(c.dataset.percent) === state.percent));
      apply();
    };
    const setCharging = (v) => { state.charging = v; charging.checked = v; apply(); };

    charging.addEventListener('change', () => { stopSim(); setCharging(charging.checked); });
    slider.addEventListener('input', () => { stopSim(); setPercent(Number(slider.value)); });
    chips.forEach((c) => c.addEventListener('click', () => { stopSim(); setPercent(Number(c.dataset.percent)); }));

    // Simulated charge: ramp to 100% while charging, then unplug.
    let raf = 0;
    function stopSim() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      simBtn.setAttribute('aria-pressed', 'false');
      $('span', simBtn).textContent = 'Simulate a charge';
    }
    simBtn.addEventListener('click', () => {
      if (raf) { stopSim(); return; }
      if (state.percent >= 100) setPercent(8);
      setCharging(true);
      simBtn.setAttribute('aria-pressed', 'true');
      $('span', simBtn).textContent = 'Stop simulation';
      const perSecond = reducedMotion ? 100 : 18;
      let last = performance.now();
      let value = state.percent;
      const step = (now) => {
        value += ((now - last) / 1000) * perSecond;
        last = now;
        setPercent(value);
        if (value >= 100) {
          raf = 0;
          stopSim();
          setTimeout(() => setCharging(false), 900);
          return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });

    setPercent(state.percent);
  })();

  // ---------------------------------------------------------------------------
  // 3. Usage tracker (data binding: usage, cap, projected, tagValue, isLightMode)
  // ---------------------------------------------------------------------------
  (() => {
    const STATUS = {
      'On track': 'var(--status-ontrack)',
      'Close to over': 'var(--status-close)',
      'Trending over': 'var(--status-trending)',
      'Over limit': 'var(--status-over)',
    };
    const SCENARIOS = {
      onTrack: { usage: 332, projected: 1860, cap: 2250 },
      close: { usage: 1480, projected: 2140, cap: 2250 },
      trending: { usage: 1232, projected: 2350, cap: 2250 },
      over: { usage: 2336, projected: 2350, cap: 2250 },
    };

    const state = { usage: 332, projected: 1860, cap: 2250, statusMode: 'auto', theme: 'page' };
    const stage = $('#usage-stage');
    const els = {
      usage: $('#u-usage'), projected: $('#u-projected'), cap: $('#u-cap'),
      status: $('#u-status'), file: $('#u-file'),
      dot: $('#usage-dot'), statusText: $('#usage-status-text'), summary: $('#usage-summary'),
    };
    const scenarioChips = $$('.chip[data-scenario]');
    let meter = null;

    const autoStatus = ({ usage, projected, cap }) => {
      if (usage >= cap) return 'Over limit';
      if (projected > cap) return 'Trending over';
      if (projected >= cap * 0.9) return 'Close to over';
      return 'On track';
    };
    const currentStatus = () => (state.statusMode === 'auto' ? autoStatus(state) : state.statusMode);
    const isLight = () => (state.theme === 'page' ? !pageIsDark() : state.theme === 'light');

    function render() {
      ['usage', 'projected', 'cap'].forEach((k) => {
        els[k].value = state[k];
        paintRange(els[k]);
        $(`#u-${k}-out`).textContent = fmtKwh(state[k]);
      });
      const status = currentStatus();
      els.dot.style.background = STATUS[status];
      els.statusText.textContent = status;
      const pct = Math.round((state.usage / Math.max(state.cap, 1)) * 100);
      els.summary.textContent = `${pct}% of limit used, projected ${fmtKwh(state.projected)}`;
      stage.classList.toggle('is-dark', !isLight());

      const match = Object.entries(SCENARIOS).find(([, s]) =>
        s.usage === state.usage && s.projected === state.projected && s.cap === state.cap);
      scenarioChips.forEach((c) => c.classList.toggle('is-active', !!match && match[0] === c.dataset.scenario));

      const vmi = meter?.rive.viewModelInstance;
      if (!vmi) return;
      vmi.number('usage').value = state.usage;
      vmi.number('projected').value = state.projected;
      vmi.number('cap').value = Math.max(state.cap, 1);
      vmi.enum('tagValue').value = status;
      vmi.boolean('isLightMode').value = isLight();
    }

    function load(src) {
      meter?.destroy();
      meter = mountRive({
        canvas: $('#c-usage'), src, stateMachine: 'State Machine 1', onLoad: render,
      });
    }

    ['usage', 'projected', 'cap'].forEach((k) => {
      els[k].addEventListener('input', () => { state[k] = Number(els[k].value); render(); });
    });
    els.status.addEventListener('change', () => { state.statusMode = els.status.value; render(); });
    els.file.addEventListener('change', () => load(els.file.value));
    scenarioChips.forEach((c) => c.addEventListener('click', () => {
      Object.assign(state, SCENARIOS[c.dataset.scenario]);
      state.statusMode = 'auto';
      els.status.value = 'auto';
      render();
    }));
    segmented('usageTheme', (v) => { state.theme = v; render(); });
    onThemeChange(render);

    render();
    load(els.file.value);
  })();
})();
