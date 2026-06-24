/* =============================================================================
 *  calculators.js  —  9개 시트의 계산 로직 (순수 함수)
 *  각 함수는 입력 객체를 받아 결과 객체를 반환한다. (불변 패턴)
 *  엑셀 원본 수식을 그대로 옮겼으며, 셀 참조를 주석으로 표기.
 * ========================================================================== */
'use strict';

const TAX = { normal: 0.154, prefer: 0.095, free: 0 }; // 일반과세 15.4% / 세금우대 9.5% / 비과세

/* ── 세후이자·실지급액·현재가치 공통 계산 (예금/적금 시트 I·J·K열) ───────── */
function taxBreakdown(totalInterest, principalForPayout, inflation, years) {
  const make = (rate) => {
    const afterTax = totalInterest * (1 - rate);          // I = 총이자*(1-세율)
    const payout = afterTax + principalForPayout;          // J = 세후이자 + 원금(or 총납입)
    const present = -PV(inflation, years, 0, payout);      // K = -PV(물가, 연수, 0, 실지급액)
    return { afterTax, payout, present };
  };
  return { normal: make(TAX.normal), prefer: make(TAX.prefer), free: make(TAX.free) };
}

/* ─────────────────────────── 1) 미래가치 (메인 C6) ───────────────────────── */
function calcFutureValue({ pv, rate, years }) {
  return { result: -FV(rate, years, 0, pv) };             // =-FV(수익률, 기간, 0, 현재가치)
}

/* ─────────────────────────── 2) 현재가치 (메인 C13) ──────────────────────── */
function calcPresentValue({ fv, rate, years }) {
  return { result: -PV(rate, years, 0, fv, 0) };          // =-PV(수익률, 기간, 0, 미래가치)
}

/* ───────────────────────── 3) 목돈 모으기 (메인 C20) ─────────────────────── */
function calcTargetSaving({ target, months, rate }) {
  return { monthly: -PMT(rate / 12, months, 0, target) }; // =-PMT(수익률/12, 개월, 0, 목표금액)
}

/* ───────────────────── 4) 예금/거치식 (월복리) — 예금시트 ────────────────── */
function calcDepositCompound({ principal, months, rate, inflation }) {
  const total = -FV(rate / 12, months, 0, principal);     // C4 =-FV(이자/12, 개월, 0, 거치금액)
  const interest = total - principal;                     // F5 = 총금액 - 거치금액
  const tax = taxBreakdown(interest, principal, inflation, months / 12);
  return { total, principal, interest, tax };
}

/* ────────────────────── 5) 예금/거치식 (연 단리) — 예금시트 ───────────────── */
function calcDepositSimple({ principal, months, rate, inflation }) {
  const total = principal * rate * (months / 12) + principal; // C12 = 원금*이자*(개월/12)+원금
  const interest = total - principal;
  const tax = taxBreakdown(interest, principal, inflation, months / 12);
  return { total, principal, interest, tax };
}

/* ───────────────────── 6) 적금/적립식 (월복리) — 적금시트 ────────────────── */
function calcInstallmentCompound({ monthly, months, rate, inflation }) {
  const total = -FV(rate / 12, months, monthly, 0);       // C4 =-FV(이자/12, 개월, 월납입, 0)
  const deposit = monthly * months;                       // F4 = 월납입 * 개월
  const interest = total - deposit;
  const tax = taxBreakdown(interest, deposit, inflation, months / 12);
  return { total, deposit, interest, tax };
}

/* ────────────────────── 7) 적금/적립식 (연 단리) — 적금시트 ───────────────── */
function calcInstallmentSimple({ monthly, months, rate, inflation }) {
  // C12 = ((월납입*개월*(개월+1)/2)*(이자/12)) + (월납입*개월)
  const total = (monthly * months * (months + 1) / 2) * (rate / 12) + (monthly * months);
  const deposit = monthly * months;
  const interest = total - deposit;
  const tax = taxBreakdown(interest, deposit, inflation, months / 12);
  return { total, deposit, interest, tax };
}

/* ─────────────────────────── 연금 계산기 (2단계 시뮬레이터) ──────────────────
 *  ① 적립(축적) 단계: 현재자산 + 매월 적립 → 은퇴 시점 자산 (월복리, FV)
 *  ② 수령(인출) 단계: 은퇴 자산을 수령기간 동안 매월 인출 (PMT)
 *  엑셀 메인 시트의 FV/PMT 로직을 노후설계용으로 확장. */
function calcPension({ initial, monthly, accumYears, accumRate, payoutYears, payoutRate, inflation }) {
  const na = Math.round(accumYears * 12);
  const np = Math.round(payoutYears * 12);
  // ① 적립 단계
  const nest = -FV(accumRate / 12, na, monthly, initial);   // 은퇴 시점 자산
  const contributed = initial + monthly * na;                // 총 납입원금
  const accumProfit = nest - contributed;                    // 적립 수익
  // ② 수령 단계
  const monthlyPayout = np > 0 ? -PMT(payoutRate / 12, np, nest, 0) : 0; // 매월 수령액(원금 소진)
  const totalPayout = monthlyPayout * np;                    // 총 수령액
  const interestOnly = nest * payoutRate / 12;               // 원금 보존(이자만) 시 매월
  // 첫 수령액의 물가 반영 현재가치 (은퇴 시점은 accumYears 후)
  const realFirstPayout = monthlyPayout / Math.pow(1 + inflation, accumYears);

  // 자산 추이 (연 단위): 적립 0~accumYears, 수령 +1~payoutYears
  const timeline = [];
  for (let y = 0; y <= accumYears; y++) {
    timeline.push({ label: `+${y}년`, value: -FV(accumRate / 12, y * 12, monthly, initial), phase: 'accum' });
  }
  const rp = payoutRate / 12;
  for (let y = 1; y <= payoutYears; y++) {
    const t = y * 12;
    const bal = nest * Math.pow(1 + rp, t) - monthlyPayout * (rp === 0 ? t : (Math.pow(1 + rp, t) - 1) / rp);
    timeline.push({ label: `+${accumYears + y}년`, value: Math.max(0, bal), phase: 'payout' });
  }
  return { nest, contributed, accumProfit, monthlyPayout, totalPayout, interestOnly, realFirstPayout, timeline };
}

/* ─────────────────────────── 월지급식펀드 계산기 ─────────────────────────── */
/* 분배금 재투자 모델: 원금이 연 적립금(연 분배금+추가적립)만큼 매년 성장 */
function calcMonthlyFund({ basePrice, distPer1000, principal, addMonthly, years }) {
  const rows = [];
  let B = principal;                                      // 투자원금
  for (let k = 0; k <= years; k++) {
    const units = B / basePrice * 1000;                   // C = 보유좌수 = 원금/기준가*1000
    const monthDist = units / 1000 * distPer1000;         // E = 월 분배금
    const yearDist = monthDist * 12;                       // D = 예상 연간 분배금
    const monthSave = monthDist + addMonthly;             // G = 월 적립금 = 월분배금 + 추가적립
    const yearSave = monthSave * 12;                       // H = 연 적립금
    rows.push({ year: k, principal: B, units, yearDist, monthDist, addMonthly, monthSave, yearSave });
    B = B + yearSave;                                      // 다음 해 원금 = 원금 + 연 적립금
  }
  const eff = distPer1000 * 12 / basePrice;               // 참고: 분배 기준 연환산 수익률
  return { rows, effRate: eff };
}

/* ─────────────────────────── 투자자산 배분 계산기 ───────────────────────── */
/* 금리형=단리(매 12개월 연이자 가산), 채권형/주식형=월복리 */
function calcAssetAllocation({ amount, months, rates, ratios }) {
  // rates = {rate, bond, stock}  (연), ratios = {rate, bond, stock}
  const cR = amount * ratios.rate * 0.1;   // C9 = A5*E6*0.1  (금리형 월투자)
  const cB = amount * ratios.bond * 0.1;   // E9 = A5*G6*0.1  (채권형 월투자)
  const cS = amount * ratios.stock * 0.1;  // G9 = A5*I6*0.1  (주식형 월투자)
  const rows = [];
  let D = 0, F = 0, H = 0;                  // 평가액(금리/채권/주식)
  for (let m = 1; m <= months; m++) {
    if (m === 1) {
      D = cR; F = cB; H = cS;              // 첫 달은 이자 없이 납입만
    } else {
      // 금리형(단리): 평소엔 누적만, 12개월마다 연이자 1회 가산
      if (m % 12 === 0) D = (cR + D) + (cR + D) * rates.rate;  // D20 패턴
      else D = cR + D;
      F = (cB + F) + (cB + F) * rates.bond / 12;               // 채권형 월복리
      H = (cS + H) + (cS + H) * rates.stock / 12;              // 주식형 월복리
    }
    rows.push({ m, cR, D, cB, F, cS, H, sum: D + F + H });
  }
  return { rows, monthly: { cR, cB, cS } };
}

/* ───────────────────── 거치식+적립식 투자 예상액 계산기 ──────────────────── */
/* 자산별로 거치식(1개월차 일시금) + 적립식(매월) 입력. 금리형 단리/나머지 월복리 */
function calcLumpInstallment({ amount, months, rates, ratios, lumps }) {
  const dR = amount * ratios.rate / 10;    // D = A5*E6/10 (금리형 월적립)
  const dB = amount * ratios.bond / 10;    // G = A5*H6/10 (채권형 월적립)
  const dS = amount * ratios.stock / 10;   // J = A5*K6/10 (주식형 월적립)
  const rows = [];
  let E = 0, H = 0, K = 0;                  // 평가액
  for (let m = 1; m <= months; m++) {
    const lR = m === 1 ? lumps.rate : 0;   // C: 거치식(1개월차에만)
    const lB = m === 1 ? lumps.bond : 0;   // F
    const lS = m === 1 ? lumps.stock : 0;  // I
    if (m === 1) {
      E = dR + lR; H = dB + lB; K = dS + lS;
    } else {
      if (m % 12 === 0) E = (dR + lR + E) + (lR + dR + E) * rates.rate; // 금리형 단리 연가산
      else E = E + lR + dR;
      H = (H + dB + lB) + (H + lB + dB) * rates.bond / 12;             // 채권형 월복리
      K = (K + dS + lS) + (K + lS + dS) * rates.stock / 12;           // 주식형 월복리
    }
    rows.push({ m, E, H, K, sum: E + H + K });
  }
  const totalIn = (lumps.rate + lumps.bond + lumps.stock) + (dR + dB + dS) * months;
  return { rows, monthly: { dR, dB, dS }, totalIn };
}

/* ───────────────────── 대출 ① 원리금 균등상환 ──────────────────────────── */
function calcLoanAmortizing({ amount, rate, months, grace = 0 }) {
  const r = rate / 12;
  const rows = [];
  let bal = amount, totalP = 0, totalI = 0;
  // 거치(이자만) 구간
  for (let k = 1; k <= grace; k++) {
    const interest = bal * r, principal = 0;
    totalI += interest;
    rows.push({ k, principal, interest, pay: interest, bal });
  }
  const npay = months - grace;
  for (let j = 1; j <= npay; j++) {
    const principal = -PPMT(r, j, npay, amount);
    const interest = -IPMT(r, j, npay, amount);
    bal -= principal;
    totalP += principal; totalI += interest;
    rows.push({ k: grace + j, principal, interest, pay: principal + interest, bal: Math.max(0, bal) });
  }
  const monthlyPay = grace > 0 ? null : -PMT(r, months, amount); // 균등 월상환금(거치 없을 때)
  return summarizeLoan(rows, amount, totalP, totalI, months, monthlyPay);
}

/* ───────────────────── 대출 ② 원금 균등상환 ────────────────────────────── */
function calcLoanEqualPrincipal({ amount, rate, months, grace = 0 }) {
  const r = rate / 12;
  const rows = [];
  let bal = amount, totalP = 0, totalI = 0;
  for (let k = 1; k <= grace; k++) {
    const interest = bal * r;
    totalI += interest;
    rows.push({ k, principal: 0, interest, pay: interest, bal });
  }
  const npay = months - grace;
  const eqP = amount / npay;                 // G = 대출금/상환개월
  for (let j = 1; j <= npay; j++) {
    const interest = bal * r;                // H = 잔액 * (이자/12)
    bal -= eqP;
    totalP += eqP; totalI += interest;
    rows.push({ k: grace + j, principal: eqP, interest, pay: eqP + interest, bal: Math.max(0, bal) });
  }
  return summarizeLoan(rows, amount, totalP, totalI, months, null);
}

/* ───────────────────── 대출 ③ 만기 일시상환 ────────────────────────────── */
function calcLoanBullet({ amount, rate, months }) {
  const r = rate / 12;
  const rows = [];
  let totalI = 0;
  for (let k = 1; k <= months; k++) {
    const interest = amount * r;             // H = 대출금 * (이자/12)
    const principal = k === months ? amount : 0; // 마지막 달 원금 일시상환
    totalI += interest;
    rows.push({ k, principal, interest, pay: interest + principal, bal: k === months ? 0 : amount });
  }
  return summarizeLoan(rows, amount, amount, totalI, months, null);
}

/* 대출 공통 요약 (총이자/총비용/월평균) */
function summarizeLoan(rows, amount, totalP, totalI, months, monthlyPay) {
  return {
    rows,
    monthlyPay,                              // 원리금균등 월상환금 (없으면 null)
    principal: amount,                       // B10 대출금
    totalInterest: totalI,                   // B11 총이자
    totalCost: amount + totalI,              // B12 총비용
    avgPrincipal: totalP / months,           // D10 월평균 상환원금
    avgInterest: totalI / months,            // D11 월평균 이자
    avgPay: (totalP + totalI) / months       // D12 월평균 납입금
  };
}
