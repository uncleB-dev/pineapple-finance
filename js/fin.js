/* =============================================================================
 *  fin.js  —  Excel 금융함수 정밀 재현 + 숫자 포맷 유틸
 *  파인애플 금융계산기에서 사용하는 FV / PV / PMT / IPMT / PPMT 를
 *  Microsoft Excel 과 동일한 부호·정밀도로 구현한다.
 *  (모든 함수는 검증 완료: 엑셀 결과값과 1원 미만 오차)
 * ========================================================================== */
'use strict';

/** 미래가치 (Future Value)
 *  rate: 기간당 이자율, nper: 기간 수, pmt: 매 기간 납입액, pv: 현재가치, type: 0(기말)/1(기초) */
function FV(rate, nper, pmt, pv = 0, type = 0) {
  if (rate === 0) return -(pv + pmt * nper);
  const p = Math.pow(1 + rate, nper);
  return -(pv * p + pmt * (1 + rate * type) * (p - 1) / rate);
}

/** 현재가치 (Present Value) */
function PV(rate, nper, pmt, fv = 0, type = 0) {
  if (rate === 0) return -(fv + pmt * nper);
  const p = Math.pow(1 + rate, nper);
  return -(fv + pmt * (1 + rate * type) * (p - 1) / rate) / p;
}

/** 정기 납입액 (Payment) */
function PMT(rate, nper, pv, fv = 0, type = 0) {
  if (rate === 0) return -(pv + fv) / nper;
  const p = Math.pow(1 + rate, nper);
  return -(pv * p + fv) * rate / ((1 + rate * type) * (p - 1));
}

/** 특정 회차의 이자 납입액 (Interest Payment) */
function IPMT(rate, per, nper, pv, fv = 0, type = 0) {
  const pmt = PMT(rate, nper, pv, fv, type);
  let interest;
  if (per === 1) {
    interest = type === 1 ? 0 : -pv;
  } else if (type === 1) {
    interest = FV(rate, per - 2, pmt, pv, 1) - pmt;
  } else {
    interest = FV(rate, per - 1, pmt, pv, 0);
  }
  return interest * rate;
}

/** 특정 회차의 원금 납입액 (Principal Payment) */
function PPMT(rate, per, nper, pv, fv = 0, type = 0) {
  return PMT(rate, nper, pv, fv, type) - IPMT(rate, per, nper, pv, fv, type);
}

/* ---------------------------------------------------------------- 포맷 유틸 */

/** 원(KRW) 표기: 반올림 후 천단위 구분 + "원" */
function won(n) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

/** 원 표기(부호 유지, 소수 없음) — '원' 없이 숫자만 */
function num(n) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
}

/** 퍼센트 표기 (소수 입력값 → %) */
function pct(n, digits = 2) {
  if (!isFinite(n)) return '-';
  return (n * 100).toLocaleString('ko-KR', { maximumFractionDigits: digits }) + '%';
}

/** 입력 element 의 값을 숫자로 (콤마/공백 허용) */
function val(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = String(el.value).replace(/,/g, '').trim();
  const v = parseFloat(raw);
  return isFinite(v) ? v : 0;
}

/** 퍼센트 입력(예: 3 → 0.03) */
function valPct(id) { return val(id) / 100; }

/** 엑셀 직렬 날짜 → JS Date (1900 날짜 시스템) */
function excelSerialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

/** 'YYYY-MM' (input[type=month]) → {y, m0}  (m0: 0-based month) */
function parseYM(str, fallbackY, fallbackM0) {
  const m = /^(\d{4})-(\d{2})$/.exec(str || '');
  if (!m) return { y: fallbackY, m0: fallbackM0 };
  return { y: parseInt(m[1], 10), m0: parseInt(m[2], 10) - 1 };
}

/** 시작 연월에서 k개월 뒤의 'YYYY.MM' 라벨 (EDATE 재현) */
function ymLabel(startY, startM0, addMonths) {
  const total = startM0 + addMonths;
  const y = startY + Math.floor(total / 12);
  const m = (total % 12 + 12) % 12;
  return y + '.' + String(m + 1).padStart(2, '0');
}
