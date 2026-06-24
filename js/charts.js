/* =============================================================================
 *  charts.js  —  외부 라이브러리 없이 동작하는 경량 SVG 차트
 *  (오프라인에서도 100% 동작하도록 순수 SVG 로 직접 렌더링)
 * ========================================================================== */
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
function _el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

/** 다중 라인 차트
 *  host: 컨테이너 element
 *  series: [{name, color, data:[number,...]}]
 *  opts: { xlabels?, height?, yfmt? } */
function lineChart(host, series, opts = {}) {
  host.innerHTML = '';
  const W = 760, H = opts.height || 280;
  const padL = 64, padR = 16, padT = 16, padB = 28;
  const svg = _el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', preserveAspectRatio: 'none' });

  const all = series.flatMap(s => s.data).filter(isFinite);
  if (!all.length) { host.appendChild(svg); return; }
  let max = Math.max(...all, 0), min = Math.min(...all, 0);
  if (max === min) max = min + 1;
  const n = Math.max(...series.map(s => s.data.length));
  const x = i => padL + (W - padL - padR) * (n <= 1 ? 0 : i / (n - 1));
  const y = v => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const yfmt = opts.yfmt || (v => Math.round(v).toLocaleString('ko-KR'));

  // y 격자 + 라벨 (5분할)
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const yy = y(v);
    svg.appendChild(_el('line', { x1: padL, y1: yy, x2: W - padR, y2: yy, class: 'grid' }));
    const t = _el('text', { x: padL - 8, y: yy + 4, class: 'axis', 'text-anchor': 'end' });
    t.textContent = yfmt(v);
    svg.appendChild(t);
  }
  // x 라벨 (양 끝 + 중앙)
  if (opts.xlabels && opts.xlabels.length) {
    const idxs = [0, Math.floor((n - 1) / 2), n - 1];
    idxs.forEach(i => {
      if (i < 0 || i >= opts.xlabels.length) return;
      const t = _el('text', { x: x(i), y: H - 8, class: 'axis', 'text-anchor': 'middle' });
      t.textContent = opts.xlabels[i];
      svg.appendChild(t);
    });
  }
  // 라인
  series.forEach(s => {
    const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    svg.appendChild(_el('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 2.2 }));
  });
  host.appendChild(svg);

  // 범례
  if (series.length > 1 || series[0].name) {
    const leg = document.createElement('div');
    leg.className = 'legend';
    series.forEach(s => {
      const item = document.createElement('span');
      item.innerHTML = `<i style="background:${s.color}"></i>${s.name}`;
      leg.appendChild(item);
    });
    host.appendChild(leg);
  }
}

/** 도넛 차트 (비율 배분 시각화)
 *  host, parts: [{name, value, color}] */
function donutChart(host, parts) {
  host.innerHTML = '';
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const W = 320, H = 220, cx = 110, cy = 110, r = 78, rin = 46;
  const svg = _el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
  if (total <= 0) { host.appendChild(svg); return; }
  let ang = -Math.PI / 2;
  parts.forEach(p => {
    const frac = Math.max(0, p.value) / total;
    if (frac <= 0) return;
    const a2 = ang + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const xi2 = cx + rin * Math.cos(a2), yi2 = cy + rin * Math.sin(a2);
    const xi1 = cx + rin * Math.cos(ang), yi1 = cy + rin * Math.sin(ang);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${rin} ${rin} 0 ${large} 0 ${xi1} ${yi1} Z`;
    svg.appendChild(_el('path', { d, fill: p.color }));
    ang = a2;
  });
  host.appendChild(svg);
  const leg = document.createElement('div');
  leg.className = 'legend';
  parts.forEach(p => {
    const pctv = total ? Math.round(p.value / total * 100) : 0;
    const item = document.createElement('span');
    item.innerHTML = `<i style="background:${p.color}"></i>${p.name} ${pctv}%`;
    leg.appendChild(item);
  });
  host.appendChild(leg);
}
