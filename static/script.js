document.addEventListener('DOMContentLoaded', () => {
  const els = {
    p200: document.getElementById('p200'),
    p4: document.getElementById('p4'),
    ll: document.getElementById('ll'),
    pl: document.getElementById('pl'),
    cu: document.getElementById('cu'),
    cc: document.getElementById('cc'),
    p200Val: document.getElementById('p200-val'),
    p4Val: document.getElementById('p4-val'),
    gradationGroup: document.getElementById('gradation-group'),
    sieveWarning: document.getElementById('sieve-warning'),
    atterbergWarning: document.getElementById('atterberg-warning'),
    derivedPi: document.getElementById('derived-pi'),
    resultCard: document.getElementById('result-card'),
    resultStatus: document.getElementById('result-status'),
    outSymbol: document.getElementById('out-symbol'),
    outName: document.getElementById('out-name'),
    metricGroup: document.getElementById('metric-group'),
    metricPi: document.getElementById('metric-pi'),
    metricFines: document.getElementById('metric-fines'),
    metricSymbol: document.getElementById('metric-symbol'),
    groupSwatch: document.getElementById('group-swatch'),
    resultErrorMessage: document.getElementById('result-error-message'),
    retryBtn: document.getElementById('retry-btn'),
    copyBtn: document.getElementById('copy-btn'),
    copyBtnLabel: document.getElementById('copy-btn-label'),
    resetBtn: document.getElementById('reset-btn'),
    coreFill: document.getElementById('core-fill'),
    legendGravel: document.getElementById('legend-gravel'),
    legendSand: document.getElementById('legend-sand'),
    legendFines: document.getElementById('legend-fines'),
    legendFinesSwatch: document.getElementById('legend-fines-swatch'),
    chartCard: document.getElementById('chart-card'),
    chartImg: document.getElementById('chart-img'),
  };

  const DEFAULTS = { p200: 25.0, p4: 75.0, ll: 35, pl: 20, cu: 5.0, cc: 1.5 };

  const CLAY_COLOR = '#A65A42';
  const SILT_COLOR = '#9C8B6E';
  const GRAVEL_COLOR = '#948B7A';
  const SAND_COLOR = '#C9A227';

  let debounceHandle = null;
  let requestSeq = 0;

  function readInputs() {
    return {
      p200: parseFloat(els.p200.value),
      p4: parseFloat(els.p4.value),
      ll: parseFloat(els.ll.value),
      pl: parseFloat(els.pl.value),
      cu: parseFloat(els.cu.value),
      cc: parseFloat(els.cc.value),
    };
  }

  function updateReadouts(v) {
    els.p200Val.textContent = v.p200.toFixed(1);
    els.p4Val.textContent = v.p4.toFixed(1);
  }

  function updateGradationVisibility(v) {
    const needsGradation = v.p200 < 12;
    els.gradationGroup.classList.toggle('is-collapsed', !needsGradation);
    els.gradationGroup.querySelectorAll('input').forEach((input) => {
      input.disabled = !needsGradation;
    });
  }

  function updateWarnings(v) {
    const sieveInvalid = v.p200 > v.p4;
    els.sieveWarning.hidden = !sieveInvalid;

    const atterbergInvalid = v.pl > v.ll;
    els.atterbergWarning.hidden = !atterbergInvalid;
    els.pl.classList.toggle('has-warning', atterbergInvalid);

    return !sieveInvalid && !atterbergInvalid;
  }

  function updateCoreSample(v) {
    const finesPct = Math.max(0, Math.min(100, v.p200));
    const coarsePct = 100 - finesPct;
    const retained4 = 100 - v.p4;
    const gravelPct = coarsePct > 0 ? Math.min(coarsePct, Math.max(0, (retained4 / 100) * coarsePct)) : 0;
    const sandPct = Math.max(0, coarsePct - gravelPct);

    const pi = v.ll - v.pl;
    const aLine = 0.73 * (v.ll - 20);
    const fineColor = (pi > aLine && pi > 7) ? CLAY_COLOR : SILT_COLOR;

    let running = 0;
    const stops = [];
    if (gravelPct > 0) {
      stops.push(`${GRAVEL_COLOR} ${running}% ${running + gravelPct}%`);
      running += gravelPct;
    }
    if (sandPct > 0) {
      stops.push(`${SAND_COLOR} ${running}% ${running + sandPct}%`);
      running += sandPct;
    }
    if (finesPct > 0) {
      stops.push(`${fineColor} ${running}% ${running + finesPct}%`);
    }

    els.coreFill.style.background = stops.length
      ? `linear-gradient(180deg, ${stops.join(', ')})`
      : 'var(--surface-sunken)';

    els.legendGravel.textContent = `${gravelPct.toFixed(1)}%`;
    els.legendSand.textContent = `${sandPct.toFixed(1)}%`;
    els.legendFines.textContent = `${finesPct.toFixed(1)}%`;
    els.legendFinesSwatch.style.background = fineColor;
  }

  function setStatus(isUpdating) {
    els.resultCard.classList.toggle('is-updating', isUpdating);
    els.resultStatus.classList.toggle('is-visible', isUpdating);
  }

  function setError(message) {
    if (message) {
      els.resultErrorMessage.textContent = message;
      els.resultCard.classList.add('has-error');
      els.chartCard.classList.remove('is-updating');
    } else {
      els.resultCard.classList.remove('has-error');
    }
  }

  function renderResult(data, v) {
    els.outSymbol.textContent = data.symbol;
    els.outName.textContent = data.name;
    els.metricGroup.textContent = data.group;
    els.metricSymbol.textContent = data.symbol;
    els.metricPi.textContent = Number(data.pi).toFixed(1);
    els.metricFines.textContent = `${v.p200.toFixed(1)}%`;
    els.groupSwatch.style.background = data.group === 'Fine-grained' ? CLAY_COLOR : SAND_COLOR;
    els.chartImg.src = `data:image/png;base64,${data.chart_img}`;
    els.chartCard.classList.remove('is-updating');
  }

  function fetchClassification() {
    const v = readInputs();

    if (Object.values(v).some((n) => Number.isNaN(n))) {
      return; // wait for a complete, valid entry
    }

    updateReadouts(v);
    updateGradationVisibility(v);
    const inputsValid = updateWarnings(v);
    updateCoreSample(v);
    els.derivedPi.textContent = (v.ll - v.pl).toFixed(1);

    const seq = ++requestSeq;
    setStatus(true);
    els.chartCard.classList.add('is-updating');

    const payload = {
      p200: v.p200,
      p4: v.p4,
      ll: v.ll,
      pl: v.pl,
      cu: v.p200 < 12 ? v.cu : null,
      cc: v.p200 < 12 ? v.cc : null,
    };

    fetch('/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (seq !== requestSeq) return; // a newer request superseded this one
        setError(null);
        renderResult(data, v);
      })
      .catch(() => {
        if (seq !== requestSeq) return;
        setError('Check your connection and try again.');
      })
      .finally(() => {
        if (seq === requestSeq) setStatus(false);
      });

    void inputsValid; // warnings are non-blocking; classification still runs
  }

  function scheduleUpdate() {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(fetchClassification, 150);
  }

  function applyValues(values) {
    els.p200.value = values.p200;
    els.p4.value = values.p4;
    els.ll.value = values.ll;
    els.pl.value = values.pl;
    els.cu.value = values.cu;
    els.cc.value = values.cc;
    fetchClassification();
  }

  [els.p200, els.p4, els.ll, els.pl, els.cu, els.cc].forEach((el) => {
    el.addEventListener('input', scheduleUpdate);
  });

  els.retryBtn.addEventListener('click', fetchClassification);

  els.resetBtn.addEventListener('click', () => applyValues(DEFAULTS));

  els.copyBtn.addEventListener('click', () => {
    const symbol = els.outSymbol.textContent;
    navigator.clipboard.writeText(symbol).then(() => {
      const original = els.copyBtnLabel.textContent;
      els.copyBtn.classList.add('btn-copied');
      els.copyBtnLabel.textContent = 'Copied';
      setTimeout(() => {
        els.copyBtn.classList.remove('btn-copied');
        els.copyBtnLabel.textContent = original;
      }, 1400);
    });
  });

  fetchClassification();
});
