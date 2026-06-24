/* =============================================================================
 *  app.js  —  UI 와이어링: 입력 → 계산 → 결과/표/차트 렌더링
 *  디자인: Montage (WDS) · 탭: 예금 / 적금 / 연금 / 투자 / 대출
 * ========================================================================== */
'use strict';

/* Montage accent 팔레트 (차트 공용) */
const C = {
  rate: '#5B37ED',   // violet-45 (금리형)
  bond: '#009632',   // green-40  (채권형)
  stock: '#D17600',  // orange-39 (주식형)
  sum: '#0066FF',    // blue-50   (합계/Primary)
  asset: '#0066FF',  // 연금 자산
  gold: '#FF9200'    // orange-50 (강조)
};

let investSub = 'quick';      // 투자 탭 활성 서브패널
let loanMode = 'amort';       // 대출 상환 방식
let depositMode = 'compound'; // 예금: 복리 / 단리
let savingsMode = 'compound'; // 적금: 복리 / 단리

/* ── 메인 탭 전환 ─────────────────────────────────────────────────────── */
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    recomputeAll();
  });
});

/* ── 투자 탭 서브패널 전환 ────────────────────────────────────────────── */
document.querySelectorAll('#tab-invest .subtabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    investSub = btn.dataset.sub;
    document.querySelectorAll('#tab-invest .subtabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#tab-invest .sub-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector('#tab-invest .sub-panel[data-sub="' + investSub + '"]').classList.add('active');
    recomputeAll();
  });
});

/* ── 예금·적금 복리/단리 토글 ────────────────────────────────────────── */
function bindModeToggle(containerId, setMode) {
  document.querySelectorAll('#' + containerId + ' button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#' + containerId + ' button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setMode(btn.dataset.mode);
      recomputeAll();
    });
  });
}
bindModeToggle('dep_modes', m => { depositMode = m; });
bindModeToggle('sav_modes', m => { savingsMode = m; });

/* ── 대출 상환방식 전환 ───────────────────────────────────────────────── */
document.querySelectorAll('#tab-loan .subtabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-loan .subtabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loanMode = btn.dataset.sub;
    document.getElementById('ln_grace_field').style.display = loanMode === 'bullet' ? 'none' : '';
    renderLoan();
  });
});

/* ── 세금 비교 표 (예금/적금 공통) ────────────────────────────────────── */
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

/* ── 예금 (복리/단리 토글) ────────────────────────────────────────────── */
const DEP_DESC = {
  compound: '목돈을 한 번에 맡기고 <b>월 복리</b>로 굴립니다. 세금 구간별 실수령액·물가 반영 현재가치까지 계산합니다. (엑셀 <code>FV</code> 함수)',
  simple: '<b>연 단리</b>: 이자가 원금에만 붙습니다. <code>이자 = 원금 × 이자율 × 기간(년)</code>'
};
function renderDeposit() {
  const args = { principal: val('dep_principal'), months: val('dep_months'), rate: valPct('dep_rate'), inflation: valPct('dep_inf') };
  const r = depositMode === 'compound' ? calcDepositCompound(args) : calcDepositSimple(args);
  document.getElementById('dep_desc').innerHTML = DEP_DESC[depositMode];
  document.getElementById('dep_total').textContent = won(r.total);
  document.getElementById('dep_p').textContent = won(r.principal);
  document.getElementById('dep_i').textContent = won(r.interest);
  renderTaxTable('dep', r.tax);
}

/* ── 적금 (복리/단리 토글) ────────────────────────────────────────────── */
const SAV_DESC = {
  compound: '매월 일정액을 납입하고 <b>월 복리</b>로 굴립니다. (엑셀 <code>FV</code> 함수, 정기납입)',
  simple: '<b>연 단리</b>: 매월 납입, 각 회차 납입금이 보유 기간만큼 단리 이자를 받습니다. (등차수열 합 공식)'
};
function renderSavings() {
  const args = { monthly: val('sav_monthly'), months: val('sav_months'), rate: valPct('sav_rate'), inflation: valPct('sav_inf') };
  const r = savingsMode === 'compound' ? calcInstallmentCompound(args) : calcInstallmentSimple(args);
  document.getElementById('sav_desc').innerHTML = SAV_DESC[savingsMode];
  document.getElementById('sav_total').textContent = won(r.total);
  document.getElementById('sav_d').textContent = won(r.deposit);
  document.getElementById('sav_i').textContent = won(r.interest);
  renderTaxTable('sav', r.tax);
}

/* ── 빠른 계산 (미래가치 / 현재가치 / 목돈모으기) ─────────────────────── */
function renderQuick() {
  const pv = val('fv_pv'), fvRate = valPct('fv_rate'), fvYears = val('fv_years');
  const fv = calcFutureValue({ pv, rate: fvRate, years: fvYears });
  document.getElementById('fv_out').textContent = won(fv.result);
  document.getElementById('fv_sentence').innerHTML =
    `현재 <b>${won(pv)}</b>이 매년 <b>${pct(fvRate)}</b>의 수익률로 <b>${num(fvYears)}년</b> 뒤에는 <b>${won(fv.result)}</b>이 됩니다.`;

  const fvv = val('pv_fv'), pvRate = valPct('pv_rate'), pvYears = val('pv_years');
  const pvr = calcPresentValue({ fv: fvv, rate: pvRate, years: pvYears });
  document.getElementById('pv_out').textContent = won(pvr.result);
  document.getElementById('pv_sentence').innerHTML =
    `매년 <b>${pct(pvRate)}</b> 수익 가정 시, <b>${num(pvYears)}년</b> 뒤의 <b>${won(fvv)}</b>는 현재가치로 <b>${won(pvr.result)}</b>입니다.`;

  const target = val('tg_target'), tgMonths = val('tg_months'), tgRate = valPct('tg_rate');
  const tg = calcTargetSaving({ target, months: tgMonths, rate: tgRate });
  document.getElementById('tg_out').innerHTML = won(tg.monthly) + ' <small>/ 월</small>';
  document.getElementById('tg_sentence').innerHTML =
    `<b>${won(target)}</b>을 <b>${num(tgMonths)}개월</b> 동안 연 <b>${pct(tgRate)}</b> 수익률로 모으려면 매월 <b>${won(tg.monthly)}</b>씩 적립해야 합니다.`;
}

/* ── 연금 ─────────────────────────────────────────────────────────────── */
function renderPension() {
  const r = calcPension({
    initial: val('pn_initial'), monthly: val('pn_monthly'),
    accumYears: val('pn_accum_years'), accumRate: valPct('pn_accum_rate'),
    payoutYears: val('pn_payout_years'), payoutRate: valPct('pn_payout_rate'),
    inflation: valPct('pn_inf')
  });
  document.getElementById('pn_nest').textContent = won(r.nest);
  document.getElementById('pn_payout').innerHTML = won(r.monthlyPayout) + ' <small>/ 월</small>';
  document.getElementById('pn_contrib').textContent = won(r.contributed);
  document.getElementById('pn_profit').textContent = won(r.accumProfit);
  document.getElementById('pn_total').textContent = won(r.totalPayout);
  document.getElementById('pn_interest_only').innerHTML = won(r.interestOnly) + ' <small>/ 월</small>';
  document.getElementById('pn_real').textContent = won(r.realFirstPayout);
  document.getElementById('pn_sentence').innerHTML =
    `매월 <b>${won(val('pn_monthly'))}</b>씩 <b>${num(val('pn_accum_years'))}년</b> 모으면 은퇴 시 <b>${won(r.nest)}</b>, 이후 <b>${num(val('pn_payout_years'))}년</b> 동안 매월 <b>${won(r.monthlyPayout)}</b>씩 받을 수 있습니다.`;

  lineChart(document.getElementById('pn_chart'), [
    { name: '예상 자산', color: C.asset, data: r.timeline.map(x => x.value) }
  ], { xlabels: r.timeline.map(x => x.label), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });
}

/* ── 월지급식 펀드 ───────────────────────────────────────────────────── */
function renderFund() {
  const years = Math.min(Math.max(val('fn_years'), 0), 60);
  const r = calcMonthlyFund({ basePrice: val('fn_baseprice'), distPer1000: val('fn_dist'), principal: val('fn_principal'), addMonthly: val('fn_add'), years });
  document.getElementById('fn_eff').textContent = pct(r.effRate);
  document.getElementById('fn_m0').textContent = won(r.rows[0].monthDist);
  document.getElementById('fn_mN').textContent = won(r.rows[r.rows.length - 1].monthDist);
  document.getElementById('fn_pN').textContent = won(r.rows[r.rows.length - 1].principal);
  document.querySelector('#fn_table tbody').innerHTML = r.rows.map(x =>
    `<tr><td>${x.year}년</td><td>${num(x.principal)}</td><td>${num(x.units)}</td><td>${num(x.yearDist)}</td><td>${num(x.monthDist)}</td><td>${num(x.monthSave)}</td><td>${num(x.yearSave)}</td></tr>`
  ).join('');
  lineChart(document.getElementById('fn_chart'), [
    { name: '투자원금', color: C.sum, data: r.rows.map(x => x.principal) },
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
  document.querySelector('#al_table tbody').innerHTML = r.rows.map(x =>
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
  document.querySelector('#lp_table tbody').innerHTML = r.rows.map(x =>
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
  document.getElementById('ln_headline').innerHTML = r.monthlyPay != null ? `월 상환금 <b>${won(r.monthlyPay)}</b>` : `월평균 납입금 ${won(r.avgPay)}`;
  document.getElementById('ln_principal').textContent = won(r.principal);
  document.getElementById('ln_interest').textContent = won(r.totalInterest);
  document.getElementById('ln_cost').textContent = won(r.totalCost);
  document.getElementById('ln_avgpay').textContent = won(r.avgPay);
  document.getElementById('ln_note').innerHTML = note;
  document.querySelector('#ln_table tbody').innerHTML = r.rows.map(x =>
    `<tr><td>${x.k}</td><td>${num(x.principal)}</td><td>${num(x.interest)}</td><td>${num(x.pay)}</td><td>${num(x.bal)}</td></tr>`
  ).join('');
  lineChart(document.getElementById('ln_chart'), [
    { name: '대출잔액', color: C.rate, data: r.rows.map(x => x.bal) },
    { name: '납입원금', color: C.sum, data: r.rows.map(x => x.principal) },
    { name: '납입이자', color: C.stock, data: r.rows.map(x => x.interest) }
  ], { xlabels: r.rows.map(x => x.k + '회'), yfmt: v => Math.round(v / 10000).toLocaleString('ko-KR') + '만' });
}

/* ── 통합 재계산 (활성 탭만 무거운 렌더 수행) ─────────────────────────── */
function recomputeAll() {
  const active = document.querySelector('.tab-panel.active');
  const id = active ? active.id : 'tab-deposit';
  try {
    if (id === 'tab-deposit') renderDeposit();
    else if (id === 'tab-savings') renderSavings();
    else if (id === 'tab-pension') renderPension();
    else if (id === 'tab-invest') {
      if (investSub === 'quick') renderQuick();
      else if (investSub === 'fund') renderFund();
      else if (investSub === 'alloc') renderAlloc();
      else if (investSub === 'lump') renderLump();
    } else if (id === 'tab-loan') renderLoan();
  } catch (e) { console.error(id, e); }
}

document.addEventListener('input', recomputeAll);
document.addEventListener('change', recomputeAll);
document.addEventListener('DOMContentLoaded', recomputeAll);
recomputeAll();
