/* ==========================================================================
   스마트 계산기 Pro - 메인 스크립트 (app.js)
   1. 테마 & 탭 네비게이션
   2. 일반/공학 계산기 + 계산 기록
   3. 실시간 + 오프라인 환율 변환기 (수동 환율 설정 지원)
   4. 11종 카테고리 종합 단위 변환기 (한국 전통 단위 포함)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initCalculator();
  initCurrencyConverter();
  initUnitConverter();
  initComments();
});

/* ==================== 유틸리티 함수 ==================== */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

function copyToClipboard(text, label = '값이') {
  const clean = String(text).replace(/,/g, '').trim();
  navigator.clipboard.writeText(clean).then(() => {
    showToast(`${label} 클립보드에 복사되었습니다: ${text}`);
  }).catch(() => {
    showToast('복사에 실패했습니다.');
  });
}

function formatNumber(num, maxDecimals = 8) {
  if (!Number.isFinite(num)) return '오류';
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if ((abs >= 1e12 || (abs > 0 && abs < 1e-7))) {
    return num.toExponential(6).replace(/\.?0+e/, 'e');
  }
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  const parts = String(rounded).split('.');
  parts[0] = Number(parts[0]).toLocaleString('ko-KR');
  return parts.join('.');
}

// 한국어 화폐/숫자 읽기 보조 표시 (예: 1억 2,345만 6,789)
function numberToKoreanReading(num, unitSuffix = '') {
  if (!Number.isFinite(num) || num === 0) return '';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs < 1000) return `${sign}${formatNumber(abs, 4)} ${unitSuffix}`.trim();

  const intPart = Math.floor(abs);
  const units = ['', '만', '억', '조', '경'];
  let remaining = intPart;
  let unitIndex = 0;
  const chunks = [];

  while (remaining > 0 && unitIndex < units.length) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      chunks.unshift(`${chunk.toLocaleString('ko-KR')}${units[unitIndex]}`);
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex++;
  }

  return `${sign}${chunks.join(' ')} ${unitSuffix}`.trim();
}

/* ==================== 1. 테마 & 탭 전환 ==================== */
function initTheme() {
  const saved = localStorage.getItem('smart_calc_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('smart_calc_theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(targetTab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === targetTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${targetTab}`);
  });
}

/* ==================== 2. 일반 & 공학 계산기 ==================== */
const calcState = {
  expression: '',
  currentResult: '0',
  lastAns: 0,
  memory: 0,
  isDegree: true,
  justEvaluated: false,
  history: JSON.parse(localStorage.getItem('smart_calc_history') || '[]')
};

function initCalculator() {
  const exprEl = document.getElementById('calcExpression');
  const resEl = document.getElementById('calcResult');
  const sciKeypad = document.getElementById('sciKeypad');
  const stdModeBtn = document.getElementById('stdModeBtn');
  const sciModeBtn = document.getElementById('sciModeBtn');
  const degRadBtn = document.getElementById('degRadBtn');
  const memIndicator = document.getElementById('memoryIndicator');

  // 모드 전환 (일반 / 공학)
  stdModeBtn.addEventListener('click', () => {
    stdModeBtn.classList.add('active');
    sciModeBtn.classList.remove('active');
    sciKeypad.classList.add('hidden');
  });

  sciModeBtn.addEventListener('click', () => {
    sciModeBtn.classList.add('active');
    stdModeBtn.classList.remove('active');
    sciKeypad.classList.remove('hidden');
  });

  // 각도 단위 전환 (DEG / RAD)
  degRadBtn.addEventListener('click', () => {
    calcState.isDegree = !calcState.isDegree;
    degRadBtn.textContent = calcState.isDegree ? 'DEG' : 'RAD';
  });

  // 메모리 버튼
  document.querySelectorAll('.mem-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.mem;
      const val = parseFloat(String(calcState.currentResult).replace(/,/g, '')) || 0;
      if (action === 'MC') {
        calcState.memory = 0;
        memIndicator.classList.add('hidden');
      } else if (action === 'MR') {
        if (calcState.justEvaluated) calcState.expression = '';
        calcState.expression += String(calcState.memory);
        calcState.justEvaluated = false;
        updateCalcDisplay();
      } else if (action === 'M+') {
        calcState.memory += val;
        memIndicator.classList.remove('hidden');
        showToast(`메모리 저장: ${formatNumber(calcState.memory)}`);
      } else if (action === 'M-') {
        calcState.memory -= val;
        memIndicator.classList.remove('hidden');
        showToast(`메모리 저장: ${formatNumber(calcState.memory)}`);
      }
    });
  });

  // 키패드 버튼 이벤트
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleCalcInput(btn.dataset.action, btn.dataset.val);
    });
  });

  // 결과 복사 및 다른 탭으로 값 전달
  document.getElementById('copyCalcBtn').addEventListener('click', () => {
    copyToClipboard(calcState.currentResult, '계산 결과가');
  });

  document.getElementById('sendToCurrencyBtn').addEventListener('click', () => {
    const num = parseFloat(String(calcState.currentResult).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      document.getElementById('fromCurrencyAmount').value = num;
      document.getElementById('fromCurrencyAmount').dispatchEvent(new Event('input'));
      switchTab('currency');
      showToast(`${formatNumber(num)} 값을 환율 변환기로 가져왔습니다.`);
    }
  });

  document.getElementById('sendToUnitBtn').addEventListener('click', () => {
    const num = parseFloat(String(calcState.currentResult).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      document.getElementById('fromUnitValue').value = num;
      document.getElementById('fromUnitValue').dispatchEvent(new Event('input'));
      switchTab('unit');
      showToast(`${formatNumber(num)} 값을 단위 변환기로 가져왔습니다.`);
    }
  });

  // 계산 기록 전체 삭제
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    calcState.history = [];
    localStorage.removeItem('smart_calc_history');
    renderHistory();
  });

  // 키보드 입력 지원 (계산기 탭이 활성화되어 있을 때)
  document.addEventListener('keydown', (e) => {
    const isCalcActive = document.getElementById('tab-calculator').classList.contains('active');
    if (!isCalcActive) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      handleCalcInput('num', e.key);
    } else if (e.key === '.') {
      e.preventDefault();
      handleCalcInput('decimal');
    } else if (e.key === '+') {
      e.preventDefault();
      handleCalcInput('op', '+');
    } else if (e.key === '-') {
      e.preventDefault();
      handleCalcInput('op', '-');
    } else if (e.key === '*') {
      e.preventDefault();
      handleCalcInput('op', '×');
    } else if (e.key === '/') {
      e.preventDefault();
      handleCalcInput('op', '÷');
    } else if (e.key === '^') {
      e.preventDefault();
      handleCalcInput('op', '^');
    } else if (e.key === '(' || e.key === ')') {
      e.preventDefault();
      handleCalcInput('op', e.key);
    } else if (e.key === '%') {
      e.preventDefault();
      handleCalcInput('percent');
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      handleCalcInput('equals');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleCalcInput('backspace');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCalcInput('clear');
    }
  });

  renderHistory();
  updateCalcDisplay();

  function handleCalcInput(action, val) {
    if (action === 'clear') {
      calcState.expression = '';
      calcState.currentResult = '0';
      calcState.justEvaluated = false;
    } else if (action === 'backspace') {
      if (calcState.justEvaluated) {
        calcState.expression = '';
        calcState.justEvaluated = false;
      } else {
        calcState.expression = calcState.expression.slice(0, -1);
      }
    } else if (action === 'num') {
      if (calcState.justEvaluated) {
        calcState.expression = val;
        calcState.justEvaluated = false;
      } else {
        calcState.expression += val;
      }
    } else if (action === 'decimal') {
      if (calcState.justEvaluated) {
        calcState.expression = '0.';
        calcState.justEvaluated = false;
      } else {
        const tokens = calcState.expression.split(/[\+\-\×\÷\^\(\)]/);
        const lastToken = tokens[tokens.length - 1];
        if (!lastToken.includes('.')) {
          calcState.expression += lastToken === '' ? '0.' : '.';
        }
      }
    } else if (action === 'op') {
      calcState.justEvaluated = false;
      if (calcState.expression === '' && val !== '(' && val !== '-') {
        calcState.expression = String(calcState.lastAns) + val;
      } else {
        calcState.expression += val;
      }
    } else if (action === 'func') {
      if (calcState.justEvaluated) {
        calcState.expression = `${val}${calcState.lastAns})`;
        calcState.justEvaluated = false;
      } else {
        calcState.expression += val;
      }
    } else if (action === 'const') {
      if (calcState.justEvaluated) {
        calcState.expression = val;
        calcState.justEvaluated = false;
      } else {
        calcState.expression += val;
      }
    } else if (action === 'ans') {
      if (calcState.justEvaluated) calcState.expression = '';
      calcState.expression += String(calcState.lastAns);
      calcState.justEvaluated = false;
    } else if (action === 'percent') {
      calcState.expression += '%';
      calcState.justEvaluated = false;
    } else if (action === 'square') {
      if (calcState.expression === '') calcState.expression = String(calcState.lastAns);
      calcState.expression += '^2';
      calcState.justEvaluated = false;
    } else if (action === 'reciprocal') {
      if (calcState.expression === '') calcState.expression = String(calcState.lastAns);
      calcState.expression = `1/(${calcState.expression})`;
      calcState.justEvaluated = false;
    } else if (action === 'factorial') {
      if (calcState.expression === '') calcState.expression = String(calcState.lastAns);
      calcState.expression += '!';
      calcState.justEvaluated = false;
    } else if (action === 'negate') {
      if (calcState.expression.startsWith('-(') && calcState.expression.endsWith(')')) {
        calcState.expression = calcState.expression.slice(2, -1);
      } else if (calcState.expression) {
        calcState.expression = `-(${calcState.expression})`;
      }
    } else if (action === 'equals') {
      if (!calcState.expression) return;
      const evaluated = evaluateMathExpression(calcState.expression, calcState.isDegree);
      if (evaluated !== null && Number.isFinite(evaluated)) {
        const formatted = formatNumber(evaluated, 10);
        addHistory(calcState.expression, formatted, evaluated);
        calcState.lastAns = parseFloat(formatted.replace(/,/g, ''));
        calcState.currentResult = formatted;
        calcState.justEvaluated = true;
      } else {
        calcState.currentResult = '수식 오류';
        calcState.justEvaluated = true;
      }
      exprEl.textContent = calcState.expression + ' =';
      resEl.textContent = calcState.currentResult;
      return;
    }

    updateCalcDisplay();
  }

  function updateCalcDisplay() {
    exprEl.textContent = calcState.expression || '0';
    if (!calcState.expression) {
      calcState.currentResult = '0';
      resEl.textContent = '0';
      return;
    }
    const preview = evaluateMathExpression(calcState.expression, calcState.isDegree);
    if (preview !== null && Number.isFinite(preview)) {
      calcState.currentResult = formatNumber(preview, 10);
      resEl.textContent = calcState.currentResult;
    }
  }

  function addHistory(expr, formattedRes, rawNum) {
    calcState.history.unshift({ expr, res: formattedRes, raw: rawNum });
    if (calcState.history.length > 30) calcState.history.pop();
    localStorage.setItem('smart_calc_history', JSON.stringify(calcState.history));
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('historyList');
    if (calcState.history.length === 0) {
      list.innerHTML = '<p class="empty-msg">계산 기록이 없습니다.</p>';
      return;
    }
    list.innerHTML = calcState.history.map((item, idx) => `
      <div class="history-item" data-idx="${idx}" title="클릭하여 수식 불러오기">
        <div class="history-expr">${item.expr} =</div>
        <div class="history-res">${item.res}</div>
      </div>
    `).join('');

    list.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = calcState.history[Number(el.dataset.idx)];
        if (item) {
          calcState.expression = String(item.raw);
          calcState.justEvaluated = false;
          updateCalcDisplay();
        }
      });
    });
  }
}

// 안전한 수학 수식 평가기
function evaluateMathExpression(rawExpr, isDegree = true) {
  try {
    let expr = rawExpr.trim();
    if (!expr) return 0;

    // 열린 괄호 자동 닫기 보정
    const openCount = (expr.match(/\(/g) || []).length;
    const closeCount = (expr.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      expr += ')'.repeat(openCount - closeCount);
    }

    // 팩토리얼 처리 (예: 5! -> factorial(5))
    expr = expr.replace(/(\d+(?:\.\d+)?)!/g, 'factorial($1)');

    // 퍼센트 처리 (예: 50% -> (50/100))
    expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // 암시적 곱셈 처리 (예: 2π -> 2*π, 2(3) -> 2*(3), )2 -> )*2)
    expr = expr.replace(/(\d)(π|e|sin|cos|tan|asin|acos|atan|log|ln|sqrt|cbrt|abs|\()/g, '$1*$2');
    expr = expr.replace(/(\)|π|e)(\d|\(|π|e)/g, '$1*$2');

    // 연산자 및 상수 변환
    expr = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**')
      .replace(/π/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E');

    // 함수 매핑
    const scope = {
      sin: (x) => Math.sin(isDegree ? (x * Math.PI) / 180 : x),
      cos: (x) => Math.cos(isDegree ? (x * Math.PI) / 180 : x),
      tan: (x) => Math.tan(isDegree ? (x * Math.PI) / 180 : x),
      asin: (x) => isDegree ? (Math.asin(x) * 180) / Math.PI : Math.asin(x),
      acos: (x) => isDegree ? (Math.acos(x) * 180) / Math.PI : Math.acos(x),
      atan: (x) => isDegree ? (Math.atan(x) * 180) / Math.PI : Math.atan(x),
      log: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x),
      cbrt: (x) => Math.cbrt(x),
      abs: (x) => Math.abs(x),
      factorial: (n) => {
        if (n < 0 || !Number.isInteger(n)) return NaN;
        if (n > 170) return Infinity;
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
      }
    };

    const fnNames = Object.keys(scope);
    const fnValues = Object.values(scope);
    const evaluator = new Function(...fnNames, `"use strict"; return (${expr});`);
    const result = evaluator(...fnValues);
    return typeof result === 'number' && !Number.isNaN(result) ? result : null;
  } catch {
    return null;
  }
}

/* ==================== 3. 환율 변환기 ==================== */
const CURRENCIES = [
  { code: 'KRW', name: '대한민국 원', symbol: '₩', flag: '🇰🇷', unitName: '원' },
  { code: 'USD', name: '미국 달러', symbol: '$', flag: '🇺🇸', unitName: '달러' },
  { code: 'JPY', name: '일본 엔', symbol: '¥', flag: '🇯🇵', unitName: '엔' },
  { code: 'EUR', name: '유럽연합 유로', symbol: '€', flag: '🇪🇺', unitName: '유로' },
  { code: 'CNY', name: '중국 위안', symbol: '¥', flag: '🇨🇳', unitName: '위안' },
  { code: 'GBP', name: '영국 파운드', symbol: '£', flag: '🇬🇧', unitName: '파운드' },
  { code: 'TWD', name: '대만 달러', symbol: 'NT$', flag: '🇹🇼', unitName: '대만달러' },
  { code: 'HKD', name: '홍콩 달러', symbol: 'HK$', flag: '🇭🇰', unitName: '홍콩달러' },
  { code: 'SGD', name: '싱가포르 달러', symbol: 'S$', flag: '🇸🇬', unitName: '싱가포르달러' },
  { code: 'THB', name: '태국 바트', symbol: '฿', flag: '🇹🇭', unitName: '바트' },
  { code: 'VND', name: '베트남 동', symbol: '₫', flag: '🇻🇳', unitName: '동' },
  { code: 'PHP', name: '필리핀 페소', symbol: '₱', flag: '🇵🇭', unitName: '페소' },
  { code: 'AUD', name: '호주 달러', symbol: 'A$', flag: '🇦🇺', unitName: '호주달러' },
  { code: 'CAD', name: '캐나다 달러', symbol: 'C$', flag: '🇨🇦', unitName: '캐나다달러' },
  { code: 'CHF', name: '스위스 프랑', symbol: 'CHF', flag: '🇨🇭', unitName: '프랑' },
  { code: 'NZD', name: '뉴질랜드 달러', symbol: 'NZ$', flag: '🇳🇿', unitName: '뉴질랜드달러' },
  { code: 'INR', name: '인도 루피', symbol: '₹', flag: '🇮🇳', unitName: '루피' },
  { code: 'MYR', name: '말레이시아 링깃', symbol: 'RM', flag: '🇲🇾', unitName: '링깃' },
  { code: 'IDR', name: '인도네시아 루피아', symbol: 'Rp', flag: '🇮🇩', unitName: '루피아' },
  { code: 'MXN', name: '멕시코 페소', symbol: 'Mex$', flag: '🇲🇽', unitName: '멕시코페소' }
];

// 오프라인 기본 환율 (1 USD 기준)
const DEFAULT_USD_RATES = {
  USD: 1,
  KRW: 1380.0,
  JPY: 153.5,
  EUR: 0.92,
  CNY: 7.24,
  GBP: 0.78,
  TWD: 32.1,
  HKD: 7.78,
  SGD: 1.34,
  THB: 34.5,
  VND: 25300.0,
  PHP: 58.2,
  AUD: 1.52,
  CAD: 1.39,
  CHF: 0.88,
  NZD: 1.66,
  INR: 84.1,
  MYR: 4.38,
  IDR: 15750.0,
  MXN: 19.9
};

const currencyState = {
  rates: { ...DEFAULT_USD_RATES },
  customOverrides: {}, // key: "FROM_TO" -> custom rate
  lastUpdated: '기본 내장 환율',
  isLive: false
};

function initCurrencyConverter() {
  const fromSelect = document.getElementById('fromCurrency');
  const toSelect = document.getElementById('toCurrency');
  const fromInput = document.getElementById('fromCurrencyAmount');
  const toInput = document.getElementById('toCurrencyAmount');
  const statusText = document.getElementById('rateStatusText');
  const customPanel = document.getElementById('customRatePanel');
  const customRateInput = document.getElementById('customRateInput');
  const customRateLabel = document.getElementById('customRateLabel');

  // 셀렉트 박스 옵션 생성
  const optionsHtml = CURRENCIES.map(c =>
    `<option value="${c.code}">${c.flag} ${c.code} - ${c.name} (${c.symbol})</option>`
  ).join('');
  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;

  fromSelect.value = 'USD';
  toSelect.value = 'KRW';

  // 저장된 캐시 환율 확인
  const cached = localStorage.getItem('smart_calc_rates_cache');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.rates) {
        currencyState.rates = { ...DEFAULT_USD_RATES, ...parsed.rates };
        currencyState.lastUpdated = parsed.time || '캐시된 환율';
      }
    } catch {}
  }

  // 실시간 환율 API 호출
  fetchLiveRates();

  fromSelect.addEventListener('change', () => {
    updateCustomRateLabel();
    calculateCurrency();
  });
  toSelect.addEventListener('change', () => {
    updateCustomRateLabel();
    calculateCurrency();
  });
  fromInput.addEventListener('input', calculateCurrency);

  // 통화 스왑 버튼
  document.getElementById('swapCurrencyBtn').addEventListener('click', () => {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    updateCustomRateLabel();
    calculateCurrency();
  });

  // 빠른 금액 버튼
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fromInput.value = btn.dataset.val;
      calculateCurrency();
    });
  });

  // 복사 버튼
  document.getElementById('copyCurrencyBtn').addEventListener('click', () => {
    copyToClipboard(toInput.value, `${toSelect.value} 변환 금액이`);
  });

  // 실시간 환율 갱신 버튼
  document.getElementById('refreshRatesBtn').addEventListener('click', () => {
    fetchLiveRates(true);
  });

  // 수동 환율 수정 토글
  document.getElementById('toggleCustomRateBtn').addEventListener('click', () => {
    customPanel.classList.toggle('hidden');
    updateCustomRateLabel();
  });

  // 수동 환율 적용
  document.getElementById('applyCustomRateBtn').addEventListener('click', () => {
    const val = parseFloat(customRateInput.value);
    if (!Number.isFinite(val) || val <= 0) {
      showToast('올바른 환율 숫자를 입력해 주세요.');
      return;
    }
    const from = fromSelect.value;
    const to = toSelect.value;
    currencyState.customOverrides[`${from}_${to}`] = val;
    currencyState.customOverrides[`${to}_${from}`] = 1 / val;
    calculateCurrency();
    showToast(`수동 환율 적용: 1 ${from} = ${formatNumber(val, 4)} ${to}`);
  });

  // 수동 환율 초기화
  document.getElementById('resetRatesBtn').addEventListener('click', () => {
    currencyState.customOverrides = {};
    calculateCurrency();
    updateCustomRateLabel();
    showToast('수동 설정 환율이 초기화되었습니다.');
  });

  function updateCustomRateLabel() {
    const from = fromSelect.value;
    const to = toSelect.value;
    const rate = getExchangeRate(from, to);
    customRateLabel.textContent = `1 ${from} 당 ${to} 환율:`;
    customRateInput.value = Math.round(rate * 1000000) / 1000000;
  }

  async function fetchLiveRates(manual = false) {
    statusText.textContent = '실시간 환율 정보를 가져오는 중...';
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      if (data && data.rates) {
        currencyState.rates = { ...DEFAULT_USD_RATES, ...data.rates };
        const nowStr = new Date().toLocaleString('ko-KR');
        currencyState.lastUpdated = `실시간 연동 완료 (${nowStr})`;
        currencyState.isLive = true;
        localStorage.setItem('smart_calc_rates_cache', JSON.stringify({
          rates: currencyState.rates,
          time: currencyState.lastUpdated
        }));
        statusText.textContent = `🟢 ${currencyState.lastUpdated}`;
        if (manual) showToast('실시간 환율이 최신 상태로 갱신되었습니다.');
      }
    } catch {
      statusText.textContent = `🟠 오프라인/캐시 모드 (${currencyState.lastUpdated}) - 직접 수정 가능`;
      if (manual) showToast('네트워크 연결이 원활하지 않아 내장 환율을 사용합니다.');
    }
    updateCustomRateLabel();
    calculateCurrency();
  }

  function getExchangeRate(from, to) {
    if (from === to) return 1;
    const key = `${from}_${to}`;
    if (currencyState.customOverrides[key]) {
      return currencyState.customOverrides[key];
    }
    const fromRate = currencyState.rates[from] || 1;
    const toRate = currencyState.rates[to] || 1;
    return toRate / fromRate;
  }

  function calculateCurrency() {
    const from = fromSelect.value;
    const to = toSelect.value;
    const amount = parseFloat(fromInput.value) || 0;
    const rate = getExchangeRate(from, to);
    const converted = amount * rate;

    const fromMeta = CURRENCIES.find(c => c.code === from);
    const toMeta = CURRENCIES.find(c => c.code === to);

    toInput.value = formatNumber(converted, 4);

    // 한국어 독음 표시
    document.getElementById('fromCurrencyKorean').textContent =
      numberToKoreanReading(amount, fromMeta?.unitName || from);
    document.getElementById('toCurrencyKorean').textContent =
      numberToKoreanReading(converted, toMeta?.unitName || to);

    // 기준 환율 요약 배너 (일본 엔, 베트남 동, 인도네시아 루피아는 100단위 병기)
    const isCustom = Boolean(currencyState.customOverrides[`${from}_${to}`]);
    const customBadge = isCustom ? ' [사용자 지정 환율]' : '';
    let summaryHtml = `<strong>기준 환율${customBadge}:</strong> 1 ${from} = <strong>${formatNumber(rate, 4)} ${to}</strong>`;
    if (['JPY', 'VND', 'IDR'].includes(from)) {
      summaryHtml += ` &nbsp;|&nbsp; 100 ${from} = <strong>${formatNumber(rate * 100, 4)} ${to}</strong>`;
    }
    summaryHtml += ` &nbsp;(역환율: 1 ${to} = ${formatNumber(1 / rate, 6)} ${from})`;
    document.getElementById('exchangeRateSummary').innerHTML = summaryHtml;

    renderMultiCurrencyGrid(from, amount);
  }

  function renderMultiCurrencyGrid(baseCode, amount) {
    const grid = document.getElementById('multiCurrencyGrid');
    const majorCodes = ['KRW', 'USD', 'JPY', 'EUR', 'CNY', 'GBP', 'TWD', 'HKD', 'SGD', 'THB', 'VND', 'AUD', 'CAD', 'CHF'];
    grid.innerHTML = majorCodes.map(code => {
      const meta = CURRENCIES.find(c => c.code === code);
      const r = getExchangeRate(baseCode, code);
      const val = amount * r;
      const isActive = code === toSelect.value;
      return `
        <div class="multi-item ${isActive ? 'active-unit' : ''}" data-code="${code}" title="클릭하여 변환 대상 통화로 선택">
          <div class="multi-item-header">
            <span>${meta.flag} ${meta.code} (${meta.name})</span>
            <span>${meta.symbol}</span>
          </div>
          <div class="multi-item-value">${formatNumber(val, 2)}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.multi-item').forEach(item => {
      item.addEventListener('click', () => {
        toSelect.value = item.dataset.code;
        updateCustomRateLabel();
        calculateCurrency();
      });
    });
  }
}

/* ==================== 4. 종합 단위 변환기 (11개 카테고리) ==================== */
const UNIT_CATEGORIES = [
  {
    id: 'length',
    name: '길이',
    icon: '📏',
    baseUnit: 'm',
    defaultFrom: 'm',
    defaultTo: 'cm',
    units: [
      { id: 'mm', name: '밀리미터 (mm)', factor: 0.001 },
      { id: 'cm', name: '센티미터 (cm)', factor: 0.01 },
      { id: 'm', name: '미터 (m)', factor: 1 },
      { id: 'km', name: '킬로미터 (km)', factor: 1000 },
      { id: 'in', name: '인치 (in)', factor: 0.0254 },
      { id: 'ft', name: '피트 (ft)', factor: 0.3048 },
      { id: 'yd', name: '야드 (yd)', factor: 0.9144 },
      { id: 'mi', name: '마일 (mi)', factor: 1609.344 },
      { id: 'nmi', name: '해리 (nmi)', factor: 1852 },
      { id: 'ja', name: '자 / 척 (尺)', factor: 10 / 33 },
      { id: 'gan', name: '간 (間)', factor: 60 / 33 },
      { id: 'ri', name: '리 (里, 한국)', factor: 392.7272727 }
    ]
  },
  {
    id: 'weight',
    name: '무게',
    icon: '⚖️',
    baseUnit: 'kg',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: [
      { id: 'mg', name: '밀리그램 (mg)', factor: 1e-6 },
      { id: 'g', name: '그램 (g)', factor: 0.001 },
      { id: 'kg', name: '킬로그램 (kg)', factor: 1 },
      { id: 't', name: '톤 (t)', factor: 1000 },
      { id: 'oz', name: '온스 (oz)', factor: 0.028349523125 },
      { id: 'lb', name: '파운드 (lb)', factor: 0.45359237 },
      { id: 'don', name: '돈 (3.75g)', factor: 0.00375 },
      { id: 'nyang', name: '냥 (37.5g)', factor: 0.0375 },
      { id: 'geun', name: '근 (고기/한약 600g)', factor: 0.6 },
      { id: 'gwan', name: '관 (3.75kg)', factor: 3.75 }
    ]
  },
  {
    id: 'volume',
    name: '부피',
    icon: '🧪',
    baseUnit: 'L',
    defaultFrom: 'L',
    defaultTo: 'mL',
    units: [
      { id: 'mL', name: '밀리리터 (mL / cc)', factor: 0.001 },
      { id: 'dL', name: '데시리터 (dL)', factor: 0.1 },
      { id: 'L', name: '리터 (L)', factor: 1 },
      { id: 'cm3', name: '세제곱센티미터 (cm³)', factor: 0.001 },
      { id: 'm3', name: '세제곱미터 (m³)', factor: 1000 },
      { id: 'tsp', name: '티스푼 (tsp, 5mL)', factor: 0.005 },
      { id: 'tbsp', name: '테이블스푼 (tbsp, 15mL)', factor: 0.015 },
      { id: 'floz', name: '액량 온스 (US fl oz)', factor: 0.02957352956 },
      { id: 'cup', name: '컵 (US cup, 240mL)', factor: 0.24 },
      { id: 'pt', name: '파인트 (US pt)', factor: 0.473176473 },
      { id: 'qt', name: '쿼트 (US qt)', factor: 0.946352946 },
      { id: 'gal', name: '갤런 (US gal)', factor: 3.785411784 },
      { id: 'hop', name: '홉 (약 180mL)', factor: 0.18039 },
      { id: 'doe', name: '되 (약 1.8L)', factor: 1.8039 },
      { id: 'mal', name: '말 (약 18L)', factor: 18.039 }
    ]
  },
  {
    id: 'area',
    name: '넓이/면적',
    icon: '📐',
    baseUnit: 'm2',
    defaultFrom: 'pyeong',
    defaultTo: 'm2',
    units: [
      { id: 'cm2', name: '제곱센티미터 (cm²)', factor: 0.0001 },
      { id: 'm2', name: '제곱미터 (m²)', factor: 1 },
      { id: 'pyeong', name: '평 (坪, 3.3058m²)', factor: 400 / 121 },
      { id: 'a', name: '아르 (a)', factor: 100 },
      { id: 'ha', name: '헥타르 (ha)', factor: 10000 },
      { id: 'km2', name: '제곱킬로미터 (km²)', factor: 1e6 },
      { id: 'ft2', name: '제곱피트 (ft²)', factor: 0.09290304 },
      { id: 'yd2', name: '제곱야드 (yd²)', factor: 0.83612736 },
      { id: 'acre', name: '에이커 (acre)', factor: 4046.8564224 },
      { id: 'danbo', name: '단보 (300평)', factor: (400 / 121) * 300 },
      { id: 'jeongbo', name: '정보 (3,000평)', factor: (400 / 121) * 3000 }
    ]
  },
  {
    id: 'temperature',
    name: '온도',
    icon: '🌡️',
    baseUnit: 'C',
    defaultFrom: 'C',
    defaultTo: 'F',
    customConvert: true,
    units: [
      { id: 'C', name: '섭씨 (°C)' },
      { id: 'F', name: '화씨 (°F)' },
      { id: 'K', name: '절대온도 켈빈 (K)' }
    ]
  },
  {
    id: 'data',
    name: '데이터 용량',
    icon: '💾',
    baseUnit: 'B',
    defaultFrom: 'GB',
    defaultTo: 'MB',
    units: [
      { id: 'bit', name: '비트 (bit)', factor: 0.125 },
      { id: 'B', name: '바이트 (Byte)', factor: 1 },
      { id: 'KB', name: '킬로바이트 (KB, 10³B)', factor: 1e3 },
      { id: 'MB', name: '메가바이트 (MB, 10⁶B)', factor: 1e6 },
      { id: 'GB', name: '기가바이트 (GB, 10⁹B)', factor: 1e9 },
      { id: 'TB', name: '테라바이트 (TB, 10¹²B)', factor: 1e12 },
      { id: 'PB', name: '페타바이트 (PB, 10¹⁵B)', factor: 1e15 },
      { id: 'KiB', name: '키비바이트 (KiB, 2¹⁰B)', factor: 1024 },
      { id: 'MiB', name: '메비바이트 (MiB, 2²⁰B)', factor: Math.pow(1024, 2) },
      { id: 'GiB', name: '기비바이트 (GiB, 2³⁰B)', factor: Math.pow(1024, 3) },
      { id: 'TiB', name: '테비바이트 (TiB, 2⁴⁰B)', factor: Math.pow(1024, 4) }
    ]
  },
  {
    id: 'speed',
    name: '속도',
    icon: '🚀',
    baseUnit: 'ms',
    defaultFrom: 'kmh',
    defaultTo: 'ms',
    units: [
      { id: 'ms', name: '초속 미터 (m/s)', factor: 1 },
      { id: 'kmh', name: '시속 킬로미터 (km/h)', factor: 1 / 3.6 },
      { id: 'mph', name: '시속 마일 (mph)', factor: 0.44704 },
      { id: 'fts', name: '초속 피트 (ft/s)', factor: 0.3048 },
      { id: 'knot', name: '노트 (knot)', factor: 1852 / 3600 },
      { id: 'mach', name: '마하 (Mach, 340.29m/s)', factor: 340.29 }
    ]
  },
  {
    id: 'time',
    name: '시간',
    icon: '⏱️',
    baseUnit: 's',
    defaultFrom: 'h',
    defaultTo: 'min',
    units: [
      { id: 'ms', name: '밀리초 (ms)', factor: 0.001 },
      { id: 's', name: '초 (s)', factor: 1 },
      { id: 'min', name: '분 (min)', factor: 60 },
      { id: 'h', name: '시간 (h)', factor: 3600 },
      { id: 'd', name: '일 (day)', factor: 86400 },
      { id: 'week', name: '주 (week)', factor: 604800 },
      { id: 'month', name: '개월 (평균 30.44일)', factor: 2629800 },
      { id: 'year', name: '년 (365.25일)', factor: 31557600 }
    ]
  },
  {
    id: 'pressure',
    name: '압력',
    icon: '🛞',
    baseUnit: 'Pa',
    defaultFrom: 'atm',
    defaultTo: 'hPa',
    units: [
      { id: 'Pa', name: '파스칼 (Pa)', factor: 1 },
      { id: 'hPa', name: '헥토파스칼 (hPa / mb)', factor: 100 },
      { id: 'kPa', name: '킬로파스칼 (kPa)', factor: 1000 },
      { id: 'MPa', name: '메가파스칼 (MPa)', factor: 1e6 },
      { id: 'bar', name: '바 (bar)', factor: 100000 },
      { id: 'atm', name: '표준기압 (atm)', factor: 101325 },
      { id: 'mmHg', name: '수은주밀리미터 (mmHg / Torr)', factor: 133.322368 },
      { id: 'psi', name: '프사이 (psi, lbf/in²)', factor: 6894.75729 }
    ]
  },
  {
    id: 'energy',
    name: '에너지/열량',
    icon: '⚡',
    baseUnit: 'J',
    defaultFrom: 'kcal',
    defaultTo: 'kJ',
    units: [
      { id: 'J', name: '줄 (J)', factor: 1 },
      { id: 'kJ', name: '킬로줄 (kJ)', factor: 1000 },
      { id: 'cal', name: '칼로리 (cal)', factor: 4.184 },
      { id: 'kcal', name: '킬로칼로리 (kcal)', factor: 4184 },
      { id: 'Wh', name: '와트시 (Wh)', factor: 3600 },
      { id: 'kWh', name: '킬로와트시 (kWh)', factor: 3600000 },
      { id: 'BTU', name: '영국열량단위 (BTU)', factor: 1055.05585 }
    ]
  },
  {
    id: 'fuel',
    name: '연비',
    icon: '⛽',
    baseUnit: 'kmL',
    defaultFrom: 'kmL',
    defaultTo: 'mpg_us',
    customConvert: true,
    units: [
      { id: 'kmL', name: '킬로미터/리터 (km/L)' },
      { id: 'L100km', name: '리터/100km (L/100km)' },
      { id: 'mpg_us', name: '마일/갤런 (미국 MPG)' },
      { id: 'mpg_uk', name: '마일/갤런 (영국 MPG)' }
    ]
  }
];

let activeCategory = UNIT_CATEGORIES[0];

function initUnitConverter() {
  const categoryBar = document.getElementById('unitCategoryBar');
  const fromUnitSelect = document.getElementById('fromUnit');
  const toUnitSelect = document.getElementById('toUnit');
  const fromUnitInput = document.getElementById('fromUnitValue');
  const toUnitInput = document.getElementById('toUnitValue');

  // 카테고리 버튼 렌더링
  categoryBar.innerHTML = UNIT_CATEGORIES.map(cat => `
    <button class="cat-btn ${cat.id === activeCategory.id ? 'active' : ''}" data-cat="${cat.id}">
      <span class="cat-icon">${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');

  categoryBar.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = UNIT_CATEGORIES.find(c => c.id === btn.dataset.cat);
      populateUnitSelects();
      calculateUnits();
    });
  });

  fromUnitSelect.addEventListener('change', calculateUnits);
  toUnitSelect.addEventListener('change', calculateUnits);
  fromUnitInput.addEventListener('input', calculateUnits);

  document.getElementById('swapUnitBtn').addEventListener('click', () => {
    const temp = fromUnitSelect.value;
    fromUnitSelect.value = toUnitSelect.value;
    toUnitSelect.value = temp;
    calculateUnits();
  });

  document.getElementById('copyUnitBtn').addEventListener('click', () => {
    copyToClipboard(toUnitInput.value, '단위 변환 결과가');
  });

  populateUnitSelects();
  calculateUnits();

  function populateUnitSelects() {
    const html = activeCategory.units.map(u =>
      `<option value="${u.id}">${u.name}</option>`
    ).join('');
    fromUnitSelect.innerHTML = html;
    toUnitSelect.innerHTML = html;
    fromUnitSelect.value = activeCategory.defaultFrom;
    toUnitSelect.value = activeCategory.defaultTo;
    document.getElementById('allUnitsTableTitle').textContent =
      `📊 ${activeCategory.name} 전체 단위 동시 변환표`;
  }

  function convertSingleUnit(value, fromId, toId, category) {
    if (!Number.isFinite(value)) return NaN;
    if (fromId === toId) return value;

    // 1) 온도 변환
    if (category.id === 'temperature') {
      let celsius = value;
      if (fromId === 'F') celsius = (value - 32) * (5 / 9);
      else if (fromId === 'K') celsius = value - 273.15;

      if (toId === 'C') return celsius;
      if (toId === 'F') return celsius * (9 / 5) + 32;
      if (toId === 'K') return celsius + 273.15;
    }

    // 2) 연비 변환
    if (category.id === 'fuel') {
      if (value <= 0) return 0;
      let kmPerLiter = value;
      if (fromId === 'L100km') kmPerLiter = 100 / value;
      else if (fromId === 'mpg_us') kmPerLiter = value * 0.425143707;
      else if (fromId === 'mpg_uk') kmPerLiter = value * 0.35400619;

      if (toId === 'kmL') return kmPerLiter;
      if (toId === 'L100km') return kmPerLiter === 0 ? 0 : 100 / kmPerLiter;
      if (toId === 'mpg_us') return kmPerLiter / 0.425143707;
      if (toId === 'mpg_uk') return kmPerLiter / 0.35400619;
    }

    // 3) 일반 선형 비율 단위 변환
    const fromUnit = category.units.find(u => u.id === fromId);
    const toUnit = category.units.find(u => u.id === toId);
    if (!fromUnit || !toUnit) return NaN;

    const baseVal = value * fromUnit.factor;
    return baseVal / toUnit.factor;
  }

  function calculateUnits() {
    const val = parseFloat(fromUnitInput.value);
    const fromId = fromUnitSelect.value;
    const toId = toUnitSelect.value;

    const fromMeta = activeCategory.units.find(u => u.id === fromId);
    const toMeta = activeCategory.units.find(u => u.id === toId);

    if (!Number.isFinite(val)) {
      toUnitInput.value = '0';
      return;
    }

    const res = convertSingleUnit(val, fromId, toId, activeCategory);
    toUnitInput.value = formatNumber(res, 8);

    // 변환 요약 공식 배너
    const unitRatio = convertSingleUnit(1, fromId, toId, activeCategory);
    const banner = document.getElementById('unitFormulaBanner');
    if (activeCategory.id === 'temperature') {
      banner.innerHTML = `<strong>변환 결과:</strong> ${formatNumber(val, 4)} ${fromMeta.name} = <strong>${formatNumber(res, 4)} ${toMeta.name}</strong> &nbsp;|&nbsp; 공식: °F = °C × 1.8 + 32, K = °C + 273.15`;
    } else if (activeCategory.id === 'fuel') {
      banner.innerHTML = `<strong>변환 결과:</strong> ${formatNumber(val, 4)} ${fromMeta.name} = <strong>${formatNumber(res, 4)} ${toMeta.name}</strong> &nbsp;|&nbsp; 1 km/L ≈ 2.35215 MPG (US)`;
    } else {
      banner.innerHTML = `<strong>기준 비율:</strong> 1 ${fromMeta.name} = <strong>${formatNumber(unitRatio, 8)} ${toMeta.name}</strong>`;
    }

    // 전체 단위 동시 변환표 렌더링
    const allGrid = document.getElementById('allUnitsGrid');
    allGrid.innerHTML = activeCategory.units.map(u => {
      const convertedVal = convertSingleUnit(val, fromId, u.id, activeCategory);
      const formatted = formatNumber(convertedVal, 6);
      const isTarget = u.id === toId;
      return `
        <div class="multi-item ${isTarget ? 'active-unit' : ''}" data-val="${formatted}" data-name="${u.name}">
          <div class="multi-item-header">
            <span>${u.name}</span>
          </div>
          <div class="multi-item-value">${formatted}</div>
        </div>
      `;
    }).join('');

    allGrid.querySelectorAll('.multi-item').forEach(item => {
      item.addEventListener('click', () => {
        copyToClipboard(item.dataset.val, `${item.dataset.name} 값이`);
      });
    });
  }
}

/* ==================== 5. 하단 댓글 & 관리자 삭제 기능 ==================== */
const ADMIN_PASSWORD = '9875';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initComments() {
  let comments = JSON.parse(localStorage.getItem('smart_calc_comments') || '[]');
  let isAdmin = false;

  const commentForm = document.getElementById('commentForm');
  const authorInput = document.getElementById('commentAuthor');
  const contentInput = document.getElementById('commentContent');
  const commentListEl = document.getElementById('commentList');
  const countBadge = document.getElementById('commentCountBadge');

  const toggleAdminBtn = document.getElementById('toggleAdminMenuBtn');
  const adminAuthPanel = document.getElementById('adminAuthPanel');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  const adminActiveBadge = document.getElementById('adminActiveBadge');
  const deleteAllBtn = document.getElementById('deleteAllCommentsBtn');

  // 관리자 메뉴 열기/닫기
  toggleAdminBtn.addEventListener('click', () => {
    adminAuthPanel.classList.toggle('hidden');
    if (!adminAuthPanel.classList.contains('hidden') && !isAdmin) {
      adminPasswordInput.focus();
    }
  });

  // 관리자 비밀번호 인증
  function verifyAdminPassword() {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
      setAdminState(true);
      adminPasswordInput.value = '';
      showToast('🛡️ 관리자 모드가 활성화되었습니다.');
    } else {
      showToast('❌ 관리자 비밀번호가 일치하지 않습니다.');
      adminPasswordInput.value = '';
      adminPasswordInput.focus();
    }
  }

  adminLoginBtn.addEventListener('click', verifyAdminPassword);
  adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      verifyAdminPassword();
    }
  });

  // 관리자 로그아웃
  adminLogoutBtn.addEventListener('click', () => {
    setAdminState(false);
    adminAuthPanel.classList.add('hidden');
    showToast('관리자 모드에서 로그아웃되었습니다.');
  });

  function setAdminState(active) {
    isAdmin = active;
    adminActiveBadge.classList.toggle('hidden', !active);
    deleteAllBtn.classList.toggle('hidden', !active);
    adminLogoutBtn.classList.toggle('hidden', !active);
    adminLoginBtn.classList.toggle('hidden', active);
    adminPasswordInput.classList.toggle('hidden', active);
    renderComments();
  }

  // 전체 댓글 삭제 (관리자 전용)
  deleteAllBtn.addEventListener('click', () => {
    if (!isAdmin) return;
    if (comments.length === 0) {
      showToast('삭제할 댓글이 없습니다.');
      return;
    }
    if (confirm('모든 댓글을 삭제하시겠습니까?')) {
      comments = [];
      saveComments();
      renderComments();
      showToast('전체 댓글이 삭제되었습니다.');
    }
  });

  // 댓글 작성 등록
  commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitNewComment();
  });

  // Enter로 댓글 등록 (Shift+Enter는 줄바꿈)
  contentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitNewComment();
    }
  });

  function submitNewComment() {
    const content = contentInput.value.trim();
    if (!content) {
      showToast('댓글 내용을 입력해 주세요.');
      return;
    }
    const author = authorInput.value.trim() || '익명';
    const newComment = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      author,
      content,
      date: new Date().toLocaleString('ko-KR')
    };

    comments.unshift(newComment);
    saveComments();
    contentInput.value = '';
    renderComments();
    showToast('댓글이 등록되었습니다.');
  }

  function saveComments() {
    localStorage.setItem('smart_calc_comments', JSON.stringify(comments));
  }

  function renderComments() {
    countBadge.textContent = `${comments.length}개`;
    if (comments.length === 0) {
      commentListEl.innerHTML = '<p class="empty-msg">첫 번째 댓글을 남겨보세요!</p>';
      return;
    }

    commentListEl.innerHTML = comments.map(item => `
      <div class="comment-item" data-id="${item.id}">
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-author">👤 ${escapeHtml(item.author)}</span>
            <span class="comment-date">${escapeHtml(item.date)}</span>
          </div>
          <div class="comment-text">${escapeHtml(item.content)}</div>
        </div>
        <button class="comment-delete-btn ${isAdmin ? 'admin-ready' : ''}" data-id="${item.id}" title="관리자 권한으로 댓글 삭제">
          🗑️ 삭제
        </button>
      </div>
    `).join('');

    commentListEl.querySelectorAll('.comment-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.id;
        if (isAdmin) {
          deleteCommentById(targetId);
        } else {
          const inputPw = prompt('댓글을 삭제하려면 관리자 비밀번호를 입력하세요:');
          if (inputPw === null) return;
          if (inputPw === ADMIN_PASSWORD) {
            setAdminState(true);
            deleteCommentById(targetId);
          } else {
            showToast('❌ 관리자 비밀번호가 일치하지 않습니다.');
          }
        }
      });
    });
  }

  function deleteCommentById(id) {
    comments = comments.filter(c => c.id !== id);
    saveComments();
    renderComments();
    showToast('🗑️ 댓글이 삭제되었습니다.');
  }

  renderComments();
}
