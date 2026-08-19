document.addEventListener('DOMContentLoaded', () => {
  const p200Input = document.getElementById('p200');
  const p4Input = document.getElementById('p4');
  const llInput = document.getElementById('ll');
  const plInput = document.getElementById('pl');
  const cuInput = document.getElementById('cu');
  const ccInput = document.getElementById('cc');
  const gradationGroup = document.getElementById('gradation-group');

  function updateCoreStrip(p200, p4, ll, pl) {
    const finesPct = p200;
    const coarsePct = 100 - p200;
    const retained4 = 100 - p4;
    const gravelPct = coarsePct > 0 ? Math.min(coarsePct, Math.max(0, (retained4 / 100.0) * coarsePct)) : 0;
    const sandPct = Math.max(0, coarsePct - gravelPct);
    const pi = ll - pl;
    const aLine = 0.73 * (ll - 20);

    const fineColor = (pi > aLine && pi > 7) ? '#8B4A3B' : '#9C8B6E'; // Clay vs Silt
    const gravelColor = '#8C8577';
    const sandColor = '#C9A227';

    let running = 0;
    let stops = [];

    if (gravelPct > 0) {
      stops.push(`${gravelColor} ${running}% ${running + gravelPct}%`);
      running += gravelPct;
    }
    if (sandPct > 0) {
      stops.push(`${sandColor} ${running}% ${running + sandPct}%`);
      running += sandPct;
    }
    if (finesPct > 0) {
      stops.push(`${fineColor} ${running}% ${running + finesPct}%`);
    }

    const coreFill = document.getElementById('core-fill');
    if (stops.length > 0) {
      coreFill.style.background = `linear-gradient(180deg, ${stops.join(', ')})`;
    } else {
      coreFill.style.background = '#2A323B';
    }
  }

  function fetchClassification() {
    const p200 = parseFloat(p200Input.value);
    const p4 = parseFloat(p4Input.value);
    const ll = parseFloat(llInput.value);
    const pl = parseFloat(plInput.value);

    // Toggle Gradation inputs visibility
    if (p200 < 12) {
      gradationGroup.style.display = 'block';
    } else {
      gradationGroup.style.display = 'none';
    }

    document.getElementById('p200-val').textContent = p200.toFixed(1);
    document.getElementById('p4-val').textContent = p4.toFixed(1);

    updateCoreStrip(p200, p4, ll, pl);

    const payload = {
      p200: p200,
      p4: p4,
      ll: ll,
      pl: pl,
      cu: p200 < 12 ? parseFloat(cuInput.value) : null,
      cc: p200 < 12 ? parseFloat(ccInput.value) : null
    };

    fetch('/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      document.getElementById('out-symbol').textContent = data.symbol;
      document.getElementById('out-name').textContent = data.name;
      document.getElementById('metric-symbol').textContent = data.symbol;
      document.getElementById('metric-pi').textContent = data.pi;
      document.getElementById('metric-group').textContent = data.group;
      document.getElementById('chart-img').src = `data:image/png;base64,${data.chart_img}`;
    })
    .catch(err => console.error(err));
  }

  // Attach event listeners for real-time reactivity
  [p200Input, p4Input, llInput, plInput, cuInput, ccInput].forEach(elem => {
    elem.addEventListener('input', fetchClassification);
  });

  fetchClassification();
});