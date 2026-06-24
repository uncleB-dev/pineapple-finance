/* =============================================================================
 *  app.js  —  UI 와이어링: 입력 → 계산 → 결과/표/차트 렌더링
 * ========================================================================== */
'use strict';

const C = { rate: '#5e35b1', bond: '#00897b', stock: '#e65100', sum: '#2e7d32', gold: '#f4b400' };

/* ── 탭 전환 ──────────────────────────────────────────────────────────── */
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    recomputeAll();
  });
});

/* ── 대출 서브탭 전환 ─────────────────────────────────────────────────── */
let loanMode = 'amort';
document.querySelectorAll('.subtabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loanMode = btn.dataset.sub;
    // 거치 입력은 만기일시에서 숨김 (원본에서도 미반영)
    document.getElementById('ln_grace_field').style.display = loanMode === 'bullet' ? 'none' : '';
    renderLoan();
  });
});

/* ── 세금 비교 표 렌더링 (예금/적금 공통) ─────────────────────────────── */
function renderTaxTable(prefix, tax) {
  const box = document.querySelector(`.taxbox[data-prefix="${prefix}"]`);
  if (!box) return;
  const row = (label, t) =>
    `<tr><td class="lbl">${label}</td><td>${won(t.afterTax)}</td><td>${won(t.payout)}</td><td>${won(t.present)}</td></tr>`;
  box.innerHTML = `
    <h3>세금 구간별 실수령액 &amp; 물가 반영 현재가치</h3>
    <div class="table-wrap" style="max-height:none">
      <table class="tax-table">
        <thead><tr><th>구분</th><th>세후 이자</th><th>실 지급액</th><th>현재 가치</th></tr></thead>
        <tbody>
          ${row('일반과세 (15.4%)', tax.normal)}
          ${row('세금우대 (9.5%)', tax.prefer)}
          ${row('비과세', tax.free)}
        </tbody>
      </table>
    </div>`;
}

/* ── 종합 계산기 ─────────────────────────────────────────────────────── */
function renderMain() {
  // 1) 미래가치
  {
    const pv = val('fv_pv'), rate = valPct('fv_rate'), years = val('fv_years');
    const r = calcFutureValue({ pv, rate, years });
    document.getElementById('fv_out').textContent = won(r.result);
    document.getElementById('fv_sentence').innerHTML =
      `현재 <b>${won(pv)}</b>이 매년 <b>${pct(rate)}</b>의 수익률로 <b>${num(years)}년</b> 뒤에는 <b>${won(r.result)}</b>이 됩니다.`;
  }
  // 2) 현재가치
  {
    const fv = val('pv_fv'), rate = valPct('pv_rate'), years = val('pv_years');
    const r = calcPresentValue({ fv, rate, years });
    document.getElementById('pv_out').textContent = won(r.result);
    document.getElementById('pv_sentence').innerHTML =
      `매년 <b>${pct(rate)}</b> 수익 가정 시, <b>${num(years)}년</b> 뒤의 <b>${won(fv)}</b>는 현재가치로 <b>${won(r.result)}</b>입니다.`;
  }
  // 3) 목돈 모으기
  {
    const target = val('tg_target'), months = val('tg_months'), rate = valPct('tg_rate');
    const r = calcTargetSaving({ target, months, rate });
    document.getElementById('tg_out').innerHTML = won(r.monthly) + ' <small>/ 월</small>';
    document.getElementById('tg_sentence').innerHTML =
      `<b>${won(target)}</b>을 <b>${num(months)}개월</b> 동안 연 <b>${pct(rate)}</b> 수익률로 모으려면 매월 <b>${won(r.monthly)}</b>씩 적립해야 합니다.`;
  }
  // 4) 예금 월복리
  {
    const r = calcDepositCompound({ principal: val('dc_principal'), months: val('dc_months'), rate: valPct('dc_rate'), inflation: valPct('dc_inf') });
    document.getElementById('dc_total').textContent = won(r.total);
    document.getElementById('dc_p').textContent = won(r.principal);
    document.getElementById('dc_i').textContent = won(r.interest);
    renderTaxTable('dc', r.tax);
  }
  // 5) 예금 연단리
  {
    const r = calcDepositSimple({ principal: val('ds_principal'), months: val('ds_months'), rate: valPct('ds_rate'), inflation: valPct('ds_inf') });
    document.getElementById('ds_total').textContent = won(r.total);
    document.getElementById('ds_p').textContent = won(r.principal);
    document.getElementById('ds_i').textContent = won(r.interest);
    renderTaxTable('ds', r.tax);
  }
  // 6) 적금 월복리
  {
    const r = calcInstallmentCompound({ monthly: val('ic_monthly'), months: val('ic_months'), rate: valPct('ic_rate'), inflation: valPct('ic_inf') });
    document.getElementById('ic_total').textContent = won(r.total);
    document.getElementById('ic_d').textContent = won(r.deposit);
    document.getElementById('ic_i').textContent = won(r.interest);
    renderTaxTable('ic', r.tax);
  }
  // 7) 적금 연단리
  {
    const r = calcInstallmentSimple({ monthly: val('is_monthly'), months: val('is_months'), rate: valPct('is_rate'), inflation: valPct('is_inf') });
    document.getElementById('is_total').textContent = won(r.total);
    document.getElementById('is_d').textContent = won(r.deposit);
    document.getElementById('is_i').textContent = won(r.interest);
    renderTaxTable('is', r.tax);
  }
}

/* ── 월지급식 펀드 ───────────────────────────────────────────────────── */
function renderFund() {
  const years = Math.min(Math.max(val('fn_years'), 0), 60);
  const r = calcMonthlyFund({
    basePrice: val('fn_baseprice'), distPer1000: val('fn_dist'),
    principal: val('fn_principal'), addMonthly: val('fn_add'), years
  });
  document.getElementById('fn_eff').textContent = pct(r.effRate);
  document.getElementById('fn_m0').textContent = won(r.rows[0].monthDist);
  document.getElementById('fn_mN').textContent = won(r.rows[r.rows.length - 1].monthDist);
  document.getElementById('fn_pN').textContent = won(r.rows[r.rows.length - 1].principal);

  const tb = document.querySelector('#fn_table tbody');
  tb.innerHTML = r.rows.map(x =>
    `<tr><td>${x.year}년</td><td>${num(x.principal)}</td><td>${num(x.units)}</td><td>${num(x.yearDist)}</td><td>${num(x.monthDist)}</td><td>${num(x.monthSave)}</td><td>${num(x.yearSave)}</td></tr>`
  ).join('');

  lineChart(document.getElementById('fn_chart'), [
    { name: '투자원금', color: C.gold, data: r.rows.map(x => x.principal) },
    { name: '월 분배금', color: C.stock, data: r.rows.map(x => x.monthDist) }
  ], { xlabels: r.rows.map(x => x.year + '년'), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });
}

/* ── 투자자산 배분 ───────────────────────────────────────────────────── */
function renderAlloc() {
  const months = Math.min(Math.max(Math.round(val('al_months')), 1), 360);
  const r = calcAssetAllocation({
    amount: val('al_amount'), months,
    rates: { rate: valPct('al_r_rate'), bond: valPct('al_r_bond'), stock: valPct('al_r_stock') },
    ratios: { rate: val('al_w_rate'), bond: val('al_w_bond'), stock: val('al_w_stock') }
  });
  const last = r.rows[r.rows.length - 1];
  const totalIn = (r.monthly.cR + r.monthly.cB + r.monthly.cS) * months;
  document.getElementById('al_sum').textContent = won(last.sum);
  document.getElementById('al_in').textContent = won(totalIn);
  document.getElementById('al_profit').textContent = won(last.sum - totalIn);
  document.getElementById('al_sentence').innerHTML =
    `매월 <b>${won(val('al_amount'))}</b>씩 <b>${num(months)}개월</b> 투자하면 최종 평가액은 <b>${won(last.sum)}</b>입니다.`;

  const start = parseYM(document.getElementById('al_start').value, 2021, 5);
  const tb = document.querySelector('#al_table tbody');
  tb.innerHTML = r.rows.map(x =>
    `<tr class="${x.m % 12 === 0 ? 'year-mark' : ''}"><td>${x.m}</td><td>${ymLabel(start.y, start.m0, x.m - 1)}</td><td>${num(x.D)}</td><td>${num(x.F)}</td><td>${num(x.H)}</td><td>${num(x.sum)}</td></tr>`
  ).join('');

  lineChart(document.getElementById('al_chart'), [
    { name: '금리형', color: C.rate, data: r.rows.map(x => x.D) },
    { name: '채권형', color: C.bond, data: r.rows.map(x => x.F) },
    { name: '주식형', color: C.stock, data: r.rows.map(x => x.H) },
    { name: '합계', color: C.sum, data: r.rows.map(x => x.sum) }
  ], { xlabels: r.rows.map(x => x.m + '월'), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });

  donutChart(document.getElementById('al_donut'), [
    { name: '금리형', value: val('al_w_rate'), color: C.rate },
    { name: '채권형', value: val('al_w_bond'), color: C.bond },
    { name: '주식형', value: val('al_w_stock'), color: C.stock }
  ]);
}

/* ── 거치 + 적립 투자 ────────────────────────────────────────────────── */
function renderLump() {
  const months = Math.min(Math.max(Math.round(val('lp_months')), 1), 360);
  const r = calcLumpInstallment({
    amount: val('lp_amount'), months,
    rates: { rate: valPct('lp_r_rate'), bond: valPct('lp_r_bond'), stock: valPct('lp_r_stock') },
    ratios: { rate: val('lp_w_rate'), bond: val('lp_w_bond'), stock: val('lp_w_stock') },
    lumps: { rate: val('lp_l_rate'), bond: val('lp_l_bond'), stock: val('lp_l_stock') }
  });
  const last = r.rows[r.rows.length - 1];
  document.getElementById('lp_sum').textContent = won(last.sum);
  document.getElementById('lp_in').textContent = won(r.totalIn);
  document.getElementById('lp_profit').textContent = won(last.sum - r.totalIn);
  document.getElementById('lp_sentence').innerHTML =
    `거치식 + 매월 <b>${won(val('lp_amount'))}</b> 적립을 <b>${num(months)}개월</b> 지속하면 최종 평가액은 <b>${won(last.sum)}</b>입니다.`;

  const start = parseYM(document.getElementById('lp_start').value, 2023, 7);
  const tb = document.querySelector('#lp_table tbody');
  tb.innerHTML = r.rows.map(x =>
    `<tr class="${x.m % 12 === 0 ? 'year-mark' : ''}"><td>${x.m}</td><td>${ymLabel(start.y, start.m0, x.m - 1)}</td><td>${num(x.E)}</td><td>${num(x.H)}</td><td>${num(x.K)}</td><td>${num(x.sum)}</td></tr>`
  ).join('');

  lineChart(document.getElementById('lp_chart'), [
    { name: '금리형', color: C.rate, data: r.rows.map(x => x.E) },
    { name: '채권형', color: C.bond, data: r.rows.map(x => x.H) },
    { name: '주식형', color: C.stock, data: r.rows.map(x => x.K) },
    { name: '합계', color: C.sum, data: r.rows.map(x => x.sum) }
  ], { xlabels: r.rows.map(x => x.m + '월'), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });
}

/* ── 대출 ─────────────────────────────────────────────────────────────── */
function renderLoan() {
  const amount = val('ln_amount'), rate = valPct('ln_rate');
  const months = Math.min(Math.max(Math.round(val('ln_months')), 1), 600);
  const grace = Math.min(Math.max(Math.round(val('ln_grace')), 0), months - 1);
  let r, note;
  if (loanMode === 'amort') {
    r = calcLoanAmortizing({ amount, rate, months, grace });
    note = grace > 0
      ? '거치기간 동안 이자만 납부 후, 남은 기간에 원리금을 균등 상환합니다. <b>(원본 엑셀에는 거치 미반영 — 표준 계산으로 확장)</b>'
      : '매월 원금+이자 합계가 동일한 가장 일반적인 방식입니다. 초기엔 이자 비중이 크고 점차 원금 비중이 커집니다.';
  } else if (loanMode === 'eqp') {
    r = calcLoanEqualPrincipal({ amount, rate, months, grace });
    note = '매월 갚는 <b>원금이 동일</b>하고 이자는 잔액에 비례해 점점 줄어듭니다. 총이자가 원리금균등보다 적습니다.';
  } else {
    r = calcLoanBullet({ amount, rate, months });
    note = '<b>만기 일시상환</b>: 매월 이자만 내고 만기에 원금 전액을 한 번에 상환합니다. 총이자가 가장 큽니다.';
  }

  const head = r.monthlyPay != null
    ? `월 상환금 <b>${won(r.monthlyPay)}</b>`
    : `월평균 납입금 ${won(r.avgPay)}`;
  document.getElementById('ln_headline').innerHTML = head;
  document.getElementById('ln_principal').textContent = won(r.principal);
  document.getElementById('ln_interest').textContent = won(r.totalInterest);
  document.getElementById('ln_cost').textContent = won(r.totalCost);
  document.getElementById('ln_avgpay').textContent = won(r.avgPay);
  document.getElementById('ln_note').innerHTML = note;

  const tb = document.querySelector('#ln_table tbody');
  tb.innerHTML = r.rows.map(x =>
    `<tr><td>${x.k}</td><td>${num(x.principal)}</td><td>${num(x.interest)}</td><td>${num(x.pay)}</td><td>${num(x.bal)}</td></tr>`
  ).join('');

  lineChart(document.getElementById('ln_chart'), [
    { name: '대출잔액', color: C.rate, data: r.rows.map(x => x.bal) },
    { name: '납입원금', color: C.sum, data: r.rows.map(x => x.principal) },
    { name: '납입이자', color: C.stock, data: r.rows.map(x => x.interest) }
  ], { xlabels: r.rows.map(x => x.k + '회'), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });
}

/* ── 통합 재계산 (활성 탭만) ──────────────────────────────────────────── */
function recomputeAll() {
  try { renderMain(); } catch (e) { console.error('main', e); }
  const active = document.querySelector('.tab-panel.active');
  if (!active) return;
  try {
    if (active.id === 'tab-fund') renderFund();
    else if (active.id === 'tab-alloc') renderAlloc();
    else if (active.id === 'tab-lump') renderLump();
    else if (active.id === 'tab-loan') renderLoan();
  } catch (e) { console.error(active.id, e); }
}

document.addEventListener('input', recomputeAll);
document.addEventListener('change', recomputeAll);
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ln_grace_field').style.display = '';
  recomputeAll();
});
recomputeAll();
