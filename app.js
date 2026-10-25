const search = document.querySelector('#search');
const rows = document.querySelector('#rows');
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, '');
const numberFormat = new Intl.NumberFormat('ko-KR');
let items = [];
let kind = 'all';
let priceRange = null;

function displayPrice(item) {
  // 드라군은 예외 단가를 적용하고, 나머지는 표시 단위로 변환합니다.
  return normalize(item.title) === '드라군' ? 25500 : item.unit_price / 10;
}

function showMessage(message) {
  const text = document.createElement('p');
  text.className = 'message';
  text.textContent = message;
  rows.replaceChildren(text);
}

function render() {
  const query = normalize(search.value);
  const priceQuery = query.replace(/,/g, '');
  const matches = items.filter(item => {
    const price = displayPrice(item);
    const kindMatch = kind === 'all' || (kind === 'new' && item.is_new === 1);
    const rangeMatch = !priceRange || (price >= priceRange[0] && price < priceRange[1]);
    const searchMatch = !query || [item.title, item.alias].some(value => normalize(value).includes(query)) ||
      (/^\d+(?:\.\d+)?$/.test(priceQuery) && String(price).includes(priceQuery));
    return kindMatch && rangeMatch && searchMatch;
  });
  matches.sort((a, b) => (displayPrice(a) - displayPrice(b)) || a.title.localeCompare(b.title, 'ko'));
  search.placeholder = `시그니처 검색 (${numberFormat.format(items.length)}곡)`;
  if (!matches.length) { showMessage('검색 결과가 없습니다.'); return; }
  const fragment = document.createDocumentFragment();
  for (const item of matches) {
    const card = document.createElement('article');
    card.className = 'card';
    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail';
    thumbnail.dataset.title = item.title;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    try {
      const url = new URL(item.image_url);
      if (url.protocol === 'https:') img.src = url.href;
      else thumbnail.classList.add('failed');
    } catch { thumbnail.classList.add('failed'); }
    img.addEventListener('error', () => { img.remove(); thumbnail.classList.add('failed'); }, { once: true });
    const cover = document.createElement('div');
    cover.className = 'price-cover';
    const priceText = numberFormat.format(displayPrice(item));
    cover.setAttribute('aria-label', `단가 ${priceText}`);
    // SVG에 테두리를 직접 그려 브라우저의 글자 테두리 스타일 영향을 방지합니다.
    const svgNS = 'http://www.w3.org/2000/svg';
    const priceGraphic = document.createElementNS(svgNS, 'svg');
    priceGraphic.setAttribute('viewBox', `0 0 ${Math.max(300, priceText.length * 61)} 120`);
    priceGraphic.setAttribute('aria-hidden', 'true');
    priceGraphic.setAttribute('class', 'price-graphic');
    for (const [fill, stroke, width] of [['#000000', '#000000', 14], ['#ffffff', '#ffffff', 8], ['#ff1515', 'none', 0]]) {
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', '50%');
      text.setAttribute('y', '91');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Jua, sans-serif');
      text.setAttribute('font-weight', '400');
      text.setAttribute('font-size', '96');
      text.setAttribute('fill', fill);
      text.setAttribute('stroke', stroke);
      text.setAttribute('stroke-width', String(width));
      text.setAttribute('stroke-linejoin', 'round');
      text.textContent = priceText;
      priceGraphic.append(text);
    }
    cover.append(priceGraphic);
    const badges = document.createElement('div');
    badges.className = 'badges';
    for (const [enabled, text, className] of [[item.is_new, 'NEW!', 'badge'], [item.is_group, '단체', 'badge group']]) {
      if (!enabled) continue;
      const badge = document.createElement('span');
      badge.className = className;
      badge.textContent = text;
      badges.append(badge);
    }
    thumbnail.append(img, cover, badges);
    const caption = document.createElement('div');
    caption.className = 'caption';
    const title = document.createElement('h2');
    title.textContent = item.title;
    caption.append(title);
    card.append(thumbnail, caption);
    fragment.append(card);
  }
  rows.replaceChildren(fragment);
}

async function fetchItems(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.items) || !data.items.every(item => typeof item.title === 'string' && Number.isFinite(item.unit_price))) throw new Error('데이터 형식이 올바르지 않습니다.');
  return data.items.filter(item => item.is_active === 1);
}

async function load() {
  rows.setAttribute('aria-busy', 'true');
  try {
    items = await fetchItems('./signatures.json');
    render();
  } catch {
    showMessage('목록을 불러올 수 없습니다. 페이지를 새로고침해 주세요.');
  } finally {
    rows.setAttribute('aria-busy', 'false');
  }
}
search.addEventListener('input', render);
function updateFilters() {
  document.querySelectorAll('[data-kind]').forEach(button => {
    const active = button.dataset.kind === kind && priceRange === null;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-price]').forEach(button => {
    const active = priceRange !== null && button.dataset.price === priceRange.join(':');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  render();
}
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  priceRange = null;
  updateFilters();
}));
document.querySelectorAll('[data-price]').forEach(button => button.addEventListener('click', () => {
  const range = button.dataset.price;
  kind = 'all';
  priceRange = priceRange?.join(':') === range ? null : range.split(':').map(Number);
  updateFilters();
}));
load();
