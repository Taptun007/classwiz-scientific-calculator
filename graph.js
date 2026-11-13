(() => {
  'use strict';

  const $ = (selector, root=document) => root.querySelector(selector);
  const palette = ['#2d7ff0','#eb4d64','#13a879','#9864d8','#ed9a24','#15a8b8'];
  const dialog = $('#graphDialog');
  const canvas = $('#graphCanvas');
  const ctx = canvas.getContext('2d');
  const functionsHost = $('#graphFunctions');
  const rangeLabel = $('#graphRange');
  const traceLabel = $('#graphTrace');
  const errorLabel = $('#graphError');
  const storageKey = 'cw-graph-functions';
  const view = {xMin:-10,xMax:10,yMin:-10,yMax:10};
  let functions = [];
  let traceX = null;
  let drag = null;
  let resizeObserver;

  function normalizeExpression(source) {
    let expression = String(source || '').trim().replace(/^=/,'').trim();
    const equals = expression.indexOf('=');
    if (equals >= 0) {
      const left = expression.slice(0, equals).trim();
      const right = expression.slice(equals + 1).trim();
      if (/^(?:y|f\s*\(\s*x\s*\))$/i.test(left)) expression = right;
      else if (/^(?:y|f\s*\(\s*x\s*\))$/i.test(right)) expression = left;
      else throw Error('Write a function such as x^2 or y = sin(x).');
    }
    return expression.trim();
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(functions));
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'undefined';
    if (Math.abs(value) > 99999 || (value !== 0 && Math.abs(value) < .0001)) return value.toExponential(2);
    return Number(value.toPrecision(4)).toString();
  }

  function gridStep(span, pixelLength) {
    const raw = span / Math.max(2, pixelLength / 72);
    const power = 10 ** Math.floor(Math.log10(raw || 1));
    const scaled = raw / power;
    return (scaled < 1.5 ? 1 : scaled < 3.5 ? 2 : scaled < 7.5 ? 5 : 10) * power;
  }

  function renderFunctionRows() {
    functionsHost.replaceChildren();
    functions.forEach((fn, index) => {
      const row = document.createElement('div');
      row.className = 'graph-function';

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = fn.enabled !== false;
      toggle.setAttribute('aria-label', 'Show function ' + (index + 1));
      toggle.addEventListener('change', () => {
        fn.enabled = toggle.checked;
        save();
        draw();
      });

      const color = document.createElement('span');
      color.className = 'graph-color';
      color.style.backgroundColor = fn.color || palette[index % palette.length];

      const label = document.createElement('label');
      label.className = 'graph-expression';
      label.append(document.createTextNode('y = '));
      const field = document.createElement('input');
      field.type = 'text';
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.inputMode = 'text';
      field.value = fn.expression || '';
      field.setAttribute('aria-label', 'Function ' + (index + 1));
      field.addEventListener('input', () => {
        fn.expression = field.value;
        save();
        draw();
      });
      label.append(field);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'graph-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove function ' + (index + 1));
      remove.disabled = functions.length < 2;
      remove.addEventListener('click', () => {
        functions.splice(index, 1);
        save();
        renderFunctionRows();
        draw();
      });

      row.append(toggle, color, label, remove);
      functionsHost.append(row);
    });
  }

  function expressionValue(fn, x) {
    if (!fn.expression.trim()) return NaN;
    try {
      return window.evaluateCalculatorExpression(normalizeExpression(fn.expression), {x});
    } catch {
      return NaN;
    }
  }

  function draw() {
    if (!dialog.open) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    const xRange = view.xMax - view.xMin;
    const yRange = view.yMax - view.yMin;
    const xToPx = x => (x - view.xMin) / xRange * width;
    const yToPx = y => height - (y - view.yMin) / yRange * height;
    const xStep = gridStep(xRange, width);
    const yStep = gridStep(yRange, height);

    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
      const px = xToPx(x);
      ctx.strokeStyle = Math.abs(x) < xStep * 1e-8 ? '#6b7d70' : '#e8ece9';
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
      if (Math.abs(x) > xStep * 1e-8) {
        ctx.fillStyle = '#758078';
        ctx.fillText(formatNumber(x), Math.min(width - 35, Math.max(3, px + 4)), Math.min(height - 16, Math.max(3, yToPx(0) + 5)));
      }
    }
    for (let y = Math.ceil(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
      const py = yToPx(y);
      ctx.strokeStyle = Math.abs(y) < yStep * 1e-8 ? '#6b7d70' : '#e8ece9';
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
      if (Math.abs(y) > yStep * 1e-8) {
        ctx.fillStyle = '#758078';
        ctx.fillText(formatNumber(y), Math.min(width - 34, Math.max(4, xToPx(0) + 5)), Math.max(3, py - 14));
      }
    }

    const enabled = functions.filter(fn => fn.enabled !== false);
    const errors = [];
    enabled.forEach((fn, index) => {
      let expression;
      try { expression = normalizeExpression(fn.expression); }
      catch (error) { errors.push(error.message); return; }
      let started = false;
      let previousY = 0;
      ctx.beginPath();
      ctx.strokeStyle = fn.color || palette[index % palette.length];
      ctx.lineWidth = 2.5;
      const samples = Math.max(240, Math.min(1800, Math.round(width * 1.5)));
      for (let i = 0; i <= samples; i++) {
        const x = view.xMin + xRange * i / samples;
        let y;
        try { y = window.evaluateCalculatorExpression(expression, {x}); }
        catch { y = NaN; }
        if (!Number.isFinite(y) || Math.abs(y) > Math.max(1e6, yRange * 80)) {
          started = false;
          continue;
        }
        const px = xToPx(x);
        const py = yToPx(y);
        if (started && Math.abs(py - previousY) < height * 1.4) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        started = true;
        previousY = py;
      }
      ctx.stroke();
    });

    if (traceX !== null) {
      const px = xToPx(traceX);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#43534a88';
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
      ctx.restore();
      const lines = ['x = ' + formatNumber(traceX)];
      enabled.forEach((fn, index) => {
        const y = expressionValue(fn, traceX);
        if (Number.isFinite(y)) {
          ctx.fillStyle = fn.color || palette[index % palette.length];
          ctx.beginPath(); ctx.arc(px, yToPx(y), 5, 0, Math.PI * 2); ctx.fill();
          lines.push('f' + (index + 1) + '(x) = ' + formatNumber(y));
        }
      });
      traceLabel.textContent = lines.join('   ·   ');
    }
    if (errors.length) errorLabel.textContent = [...new Set(errors)].join(' ');
    else if (!enabled.length) errorLabel.textContent = 'Turn on at least one function to plot it.';
    else if (enabled.every(fn => !fn.expression.trim())) errorLabel.textContent = 'Enter a function of x, such as x^2.';
    else errorLabel.textContent = '';
    rangeLabel.textContent = 'x ' + formatNumber(view.xMin) + ' to ' + formatNumber(view.xMax) + '  ·  y ' + formatNumber(view.yMin) + ' to ' + formatNumber(view.yMax);
  }

  function fitY() {
    const values = [];
    functions.filter(fn => fn.enabled !== false).forEach(fn => {
      let expression;
      try { expression = normalizeExpression(fn.expression); } catch { return; }
      for (let i = 0; i <= 500; i++) {
        const x = view.xMin + (view.xMax - view.xMin) * i / 500;
        try {
          const y = window.evaluateCalculatorExpression(expression, {x});
          if (Number.isFinite(y) && Math.abs(y) < 1e5) values.push(y);
        } catch {}
      }
    });
    if (!values.length) {
      errorLabel.textContent = 'No finite points in this x range. Try another range or function.';
      return;
    }
    values.sort((a,b) => a-b);
    let low = values[Math.floor(values.length * .03)];
    let high = values[Math.floor(values.length * .97)];
    if (high - low < .1) { low -= 1; high += 1; }
    const margin = (high - low) * .12;
    view.yMin = low - margin;
    view.yMax = high + margin;
    traceX = null;
    draw();
  }

  function zoom(factor, px=canvas.clientWidth/2, py=canvas.clientHeight/2) {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const anchorX = view.xMin + px / width * (view.xMax - view.xMin);
    const anchorY = view.yMax - py / height * (view.yMax - view.yMin);
    const nextXRange = (view.xMax - view.xMin) * factor;
    const nextYRange = (view.yMax - view.yMin) * factor;
    view.xMin = anchorX - nextXRange * px / width;
    view.xMax = view.xMin + nextXRange;
    view.yMax = anchorY + nextYRange * py / height;
    view.yMin = view.yMax - nextYRange;
    traceX = null;
    draw();
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {x:event.clientX - rect.left, y:event.clientY - rect.top, width:rect.width, height:rect.height};
  }

  function beginPan(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const point = canvasPoint(event);
    drag = {pointerId:event.pointerId,startX:point.x,startY:point.y,moved:false,view:{...view}};
    canvas.setPointerCapture(event.pointerId);
  }

  function movePan(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    if (Math.hypot(dx,dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const xRange = drag.view.xMax - drag.view.xMin;
    const yRange = drag.view.yMax - drag.view.yMin;
    view.xMin = drag.view.xMin - dx / point.width * xRange;
    view.xMax = view.xMin + xRange;
    view.yMin = drag.view.yMin + dy / point.height * yRange;
    view.yMax = view.yMin + yRange;
    traceX = null;
    draw();
  }

  function endPan(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasMoved = drag.moved;
    drag = null;
    if (!wasMoved) {
      const point = canvasPoint(event);
      traceX = view.xMin + point.x / point.width * (view.xMax - view.xMin);
    }
    draw();
  }

  function addFunction(expression='sin(x)') {
    if (functions.length >= palette.length) {
      errorLabel.textContent = 'You can graph up to ' + palette.length + ' functions.';
      return;
    }
    functions.push({expression,enabled:true,color:palette[functions.length % palette.length]});
    save();
    renderFunctionRows();
    draw();
  }

  function seedFunctions(source) {
    try {
      const expression = normalizeExpression(source);
      if (!expression) return;
      if (!functions.length) functions.push({expression,enabled:true,color:palette[0]});
      else functions[0].expression = expression;
    } catch (error) {
      errorLabel.textContent = error.message;
    }
  }

  function open(source='') {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    functions = Array.isArray(stored) ? stored.filter(fn => fn && typeof fn === 'object').slice(0,palette.length) : [];
    functions = functions.map((fn,index) => ({expression:String(fn.expression || ''),enabled:fn.enabled !== false,color:palette[index]}));
    if (!functions.length) functions.push({expression:'x^2',enabled:true,color:palette[0]});
    if (source.trim()) seedFunctions(source);
    traceX = null;
    save();
    renderFunctionRows();
    if (!dialog.open) dialog.showModal();
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(draw);
      resizeObserver.observe(canvas);
    }
    requestAnimationFrame(draw);
  }

  $('#addGraphFunction').addEventListener('click', () => addFunction());
  $('#closeGraph').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { drag = null; });
  dialog.querySelectorAll('[data-graph-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.graphAction;
    if (action === 'zoom-in') zoom(.75);
    else if (action === 'zoom-out') zoom(1.33);
    else if (action === 'reset') { view.xMin=-10; view.xMax=10; view.yMin=-10; view.yMax=10; traceX=null; draw(); }
    else if (action === 'fit') fitY();
  }));
  canvas.addEventListener('pointerdown', beginPan);
  canvas.addEventListener('pointermove', movePan);
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const point = canvasPoint(event);
    zoom(event.deltaY < 0 ? .82 : 1.22, point.x, point.y);
  }, {passive:false});
  window.addEventListener('resize', draw);

  window.CalculatorGraph = {open};
})();
