/**
 * สมาร์ทกรีน Vision Ai วิเคราะห์ใบมันสำปะหลัง — frontend logic
 * ขั้นตอน: 1 ข้อมูลแปลง → 2 ถ่ายภาพใบ → (กำลังวิเคราะห์) → 3 ผลวิเคราะห์
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Config
  const SLOTS = [
    { key: 'young', no: 1, icon: '🌱', bg: '#dcfce7', label: 'ใบยอด / ใบอ่อน', sub: 'ใบที่ยังคลี่ไม่สุดบนยอด', nutr: 'Zn, B, Fe · ใบด่าง · เพลี้ยแป้ง', required: true },
    { key: 'mature', no: 2, icon: '🍃', bg: '#e0f2fe', label: 'ใบมาตรฐาน', sub: 'ใบแรกที่คลี่เต็มที่ นับจากยอด', nutr: 'N, P, K, Mg (ตัวแทนทั้งต้น)', required: true },
    { key: 'old', no: 3, icon: '🍂', bg: '#fef3c7', label: 'ใบล่าง / ใบแก่', sub: 'ใบช่วงล่างของลำต้น', nutr: 'N, K, Mg · ใบจุด · ไรแดง', required: true },
    { key: 'tree', no: 4, icon: '🍠', bg: '#efebe9', label: 'ทั้งต้น / ลำต้น', sub: 'ทรงต้น ยอดหงิก ลำต้น หรือหัว', nutr: 'เพลี้ยแป้ง · ลำต้นเน่า · หัวเน่า', required: false },
  ];

  const AGES = Array.from({ length: 12 }, (_, i) => String(i + 1)).concat(['มากกว่า 12']);
  const QUICK_AGES = ['1', '2', '3', '4', '6', '8'];
  const VARIETIES = ['เกษตรศาสตร์ 50', 'ระยอง 72', 'ระยอง 9', 'ระยอง 11', 'ห้วยบง 60', 'ห้วยบง 80', 'ระยอง 90', 'ไม่ทราบพันธุ์'];
  const QUICK_VARIETIES = ['เกษตรศาสตร์ 50', 'ระยอง 72', 'ห้วยบง 80', 'ระยอง 9'];

  const PILLS = {
    plantingSeason: [
      ['🌧️ ต้นฝน', 'ปลูกต้นฝน (เม.ย.-มิ.ย.)'],
      ['🍂 ปลายฝน', 'ปลูกปลายฝน (ต.ค.-ธ.ค.)'],
      ['☀️ หน้าแล้ง', 'ปลูกหน้าแล้ง (ม.ค.-มี.ค.)'],
      ['💧 มีระบบน้ำ', 'ปลูกได้ทั้งปี มีระบบน้ำ'],
    ],
    waterStatus: [
      ['🌧️ ดินชื้น/มีฝน', 'ดินชื้น / มีฝนสม่ำเสมอ'],
      ['☀️ แล้ง/ดินแห้ง', 'ฝนทิ้งช่วง / ดินแห้ง'],
      ['💧 มีระบบน้ำ', 'มีระบบน้ำ'],
      ['🌊 น้ำขัง', 'น้ำขัง / ระบายน้ำไม่ดี'],
    ],
    soilType: [
      ['🟫 ดินร่วน', 'ดินร่วน'], ['🏖️ ดินร่วนปนทราย', 'ดินร่วนปนทราย'], ['⛱️ ดินทราย', 'ดินทราย'],
      ['🧱 ดินเหนียว', 'ดินเหนียว'], ['🪨 ดินลูกรัง', 'ดินลูกรัง / ดินตื้น'], ['⚪ ดินร่วนปนปูน', 'ดินร่วนปนปูน / ดินด่าง'],
    ],
    soilPh: [
      ['⚪ ไม่ได้วัด', 'ไม่ได้วัด'], ['🔴 กรดจัด (< 4.5)', 'กรดจัด (pH < 4.5)'], ['🟠 กรด (4.5 - 5.5)', 'กรด (pH 4.5-5.5)'],
      ['🟢 ปกติ (5.5 - 6.5)', 'เหมาะสม (pH 5.5-6.5)'], ['🔵 ด่าง (> 7)', 'ด่าง (pH > 7)'],
    ],
  };
  const PILL_LABELS = { plantingSeason: '🗓️ ฤดูปลูก:', waterStatus: '💧 สภาพน้ำและความชื้นในดิน:', soilType: '🟫 ชนิดดินในแปลง:', soilPh: '🧪 ค่า pH ดิน:' };

  const SYMPTOMS = [
    'ใบด่างเหลือง/ใบหงิก', 'ยอดหงิกเป็นพุ่ม', 'มีปุยแป้งขาวที่ยอด', 'ใบเหลืองซีดทั้งต้น',
    'ใบยอดเล็ก/ซีด', 'ขอบใบล่างไหม้', 'ใบล่างเหลืองร่วง', 'ใบจุดสีน้ำตาล',
    'ใบไหม้/ยอดเหี่ยว', 'ใบประจุดเหลือง (ไรแดง)', 'ต้นแคระแกร็น', 'ลำต้นเน่า/หัวเน่า',
    'ต้นงอกไม่สม่ำเสมอ', 'หัวเล็ก/ผลผลิตลด',
  ];

  const STATUS_STYLE = {
    'ปกติ': { pct: 100, color: '#059669', cls: 'ok' },
    'เสี่ยงขาด': { pct: 75, color: '#65a30d', cls: 'warn' },
    'ขาดเล็กน้อย': { pct: 55, color: '#d97706', cls: 'warn' },
    'ขาดปานกลาง': { pct: 35, color: '#ea580c', cls: 'bad' },
    'ขาดรุนแรง': { pct: 15, color: '#dc2626', cls: 'bad' },
    'ต้องตรวจเพิ่ม': { pct: 50, color: '#94a3b8', cls: '' },
  };
  const LIKELIHOOD_CLS = { 'สูง': 'bad', 'ปานกลาง': 'warn', 'ต่ำ': '' };
  const HEALTH_LEVELS = [
    { min: 0, label: 'วิกฤต' }, { min: 20, label: 'ต้องแก้ไขด่วน' }, { min: 40, label: 'ต้องดูแล' },
    { min: 60, label: 'ค่อนข้างดี' }, { min: 80, label: 'สมบูรณ์ดี' },
  ];

  // Sample photos live in public/assets/samples/ (see README there)
  const DEMO = {
    images: { young: '/assets/samples/young.jpg', mature: '/assets/samples/mature.jpg', old: '/assets/samples/old.jpg', tree: '/assets/samples/tree.jpg' },
    fields: {
      customerName: 'คุณสมชาย ไร่มันทอง แปลงที่ 1', inspectorName: 'สมศักดิ์ (ทีมนักวิชาการสมาร์ทกรีน)',
      plantAge: '3', variety: 'เกษตรศาสตร์ 50', province: 'นครราชสีมา', coordinates: '14.979900, 102.097800',
      yieldPerRai: '3.5', lastFertilizer: '15-15-15 อัตรา 50 กก./ไร่ เมื่อ 2 เดือนก่อน', notes: 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ',
    },
    pills: { plantingSeason: 'ปลูกต้นฝน (เม.ย.-มิ.ย.)', waterStatus: 'ฝนทิ้งช่วง / ดินแห้ง', soilType: 'ดินร่วนปนทราย', soilPh: 'กรด (pH 4.5-5.5)' },
    symptoms: ['ขอบใบล่างไหม้', 'ใบล่างเหลืองร่วง', 'หัวเล็ก/ผลผลิตลด'],
  };

  const HISTORY_KEY = 'cassavaLeafDoctor.history.v1';
  const MAX_HISTORY = 50;
  const MAX_IMAGE_EDGE = 1280;

  // ---------------------------------------------------------------- State
  const images = {}; // key -> { base64, mimeType, dataUrl }
  const selectedSymptoms = new Set();
  const chipButtons = new Map();
  let isDemoPhotos = false;
  let lastResult = null;

  const $ = (sel) => document.querySelector(sel);
  const form = () => $('#cassavaForm');

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------- Navigation
  const SCREENS = ['screen1', 'screen2', 'screenAnalyzing', 'screenResults', 'screenHistory'];
  const STEP_OF = { screen1: 1, screen2: 2, screenAnalyzing: 2, screenResults: 3, screenHistory: 0 };

  function show(id) {
    for (const s of SCREENS) $('#' + s).hidden = s !== id;
    $('#cassavaForm').hidden = !(id === 'screen1' || id === 'screen2');
    const step = STEP_OF[id];
    $('#stepper').hidden = step === 0;
    document.querySelectorAll('.step').forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('active', n === step);
      el.classList.toggle('done', n < step);
    });
    document.querySelectorAll('.step-line').forEach((el, i) => el.classList.toggle('done', i + 1 < step));
    document.querySelectorAll('.bn-item').forEach((el) => {
      const go = el.dataset.go;
      el.classList.toggle('active', (go === 'history' && id === 'screenHistory') || (go === 'home' && id === 'screen1'));
    });
    if (id === 'screenHistory') renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showError(which, msg) {
    const el = $('#error' + which);
    el.textContent = msg || '';
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------------------------------------------------------------- Step 1 widgets
  function fillSelect(name, values) {
    const sel = form().elements[name];
    for (const v of values) sel.add(new Option(name === 'plantAge' && /^\d+$/.test(v) ? `${v} เดือน` : v, v));
  }

  function setSelect(name, value) {
    const sel = form().elements[name];
    if (value && ![...sel.options].some((o) => o.value === value)) sel.add(new Option(value, value));
    sel.value = value;
    syncQuick(name);
  }

  function syncQuick(name) {
    const v = form().elements[name].value;
    document.querySelectorAll(`.quick[data-quick="${name}"] button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  }

  function renderQuick(name, values, fmt) {
    const wrap = document.querySelector(`.quick[data-quick="${name}"]`);
    for (const v of values) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = v;
      b.textContent = fmt ? fmt(v) : v;
      b.addEventListener('click', () => setSelect(name, v));
      wrap.appendChild(b);
    }
    form().elements[name].addEventListener('change', () => syncQuick(name));
  }

  function renderPills() {
    document.querySelectorAll('.pill-group').forEach((group) => {
      const name = group.dataset.name;
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      hidden.value = PILLS[name][0][1];
      const p = document.createElement('p');
      p.textContent = PILL_LABELS[name];
      const row = document.createElement('div');
      for (const [label, value] of PILLS[name]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pill';
        b.textContent = label;
        b.dataset.v = value;
        b.setAttribute('aria-pressed', String(value === hidden.value));
        b.addEventListener('click', () => setPill(name, value));
        row.appendChild(b);
      }
      group.append(p, row, hidden);
    });
  }

  function setPill(name, value) {
    form().elements[name].value = value;
    document.querySelectorAll(`.pill-group[data-name="${name}"] .pill`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
  }

  function renderChips() {
    const wrap = $('#symptomChips');
    for (const s of SYMPTOMS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = s;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (selectedSymptoms.has(s)) selectedSymptoms.delete(s); else selectedSymptoms.add(s);
        b.setAttribute('aria-pressed', String(selectedSymptoms.has(s)));
      });
      chipButtons.set(s, b);
      wrap.appendChild(b);
    }
  }

  function setSymptoms(list) {
    selectedSymptoms.clear();
    for (const s of list) if (chipButtons.has(s)) selectedSymptoms.add(s);
    chipButtons.forEach((b, s) => b.setAttribute('aria-pressed', String(selectedSymptoms.has(s))));
  }

  function updateMapsLink() {
    const v = form().elements.coordinates.value.trim();
    const ok = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v);
    const a = $('#mapsLink');
    a.hidden = !ok;
    if (ok) a.href = 'https://www.google.com/maps?q=' + encodeURIComponent(v.replace(/\s+/g, ''));
  }

  function useGps() {
    const btn = $('#gpsBtn');
    if (!navigator.geolocation) return showError(1, 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังหา...';
    const done = () => { btn.disabled = false; btn.textContent = '🛰️ ดึงพิกัด'; };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form().elements.coordinates.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        updateMapsLink();
        done();
      },
      () => { showError(1, 'ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือพิมพ์พิกัดเอง'); done(); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  function fillDemoInfo() {
    const f = form();
    for (const [name, value] of Object.entries(DEMO.fields)) {
      if (name === 'plantAge' || name === 'variety') setSelect(name, value);
      else if (f.elements[name]) f.elements[name].value = value;
    }
    for (const [name, value] of Object.entries(DEMO.pills)) setPill(name, value);
    setSymptoms(DEMO.symptoms);
    updateMapsLink();
    showError(1, '');
  }

  function validateStep1() {
    const f = form();
    if (!f.elements.customerName.value.trim()) { f.elements.customerName.focus(); return 'กรุณากรอกชื่อเกษตรกร / แปลงมัน'; }
    if (!f.elements.plantAge.value) { f.elements.plantAge.focus(); return 'กรุณาเลือกอายุมันสำปะหลัง'; }
    return '';
  }

  // ---------------------------------------------------------------- Images
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้')); };
      img.src = url;
    });
  }

  function resizeToDataUrl(img, maxEdge, quality) {
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /** Reject blank / single-colour images before they reach the AI (they invite made-up results). */
  function assertHasDetail(img) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 32, 32);
    const px = ctx.getImageData(0, 0, 32, 32).data;
    let sum = 0, sum2 = 0;
    const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      sum += l; sum2 += l * l;
    }
    const sd = Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
    if (sd < 4) throw new Error('ภาพนี้ไม่มีรายละเอียดของใบ (เป็นสีพื้นหรือมืด/สว่างเกินไป) กรุณาถ่ายภาพใบมันสำปะหลังจริงอีกครั้ง');
  }

  async function compressFile(file) {
    const img = await loadImage(file);
    assertHasDetail(img);
    let quality = 0.82;
    let dataUrl = resizeToDataUrl(img, MAX_IMAGE_EDGE, quality);
    // Keep each image under ~600KB so all photos stay below Vercel's 4.5MB body limit
    while (dataUrl.length > 800000 && quality > 0.45) {
      quality -= 0.1;
      dataUrl = resizeToDataUrl(img, MAX_IMAGE_EDGE, quality);
    }
    return { dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  function makeThumb(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(resizeToDataUrl(img, 120, 0.6));
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  // ---------------------------------------------------------------- Step 2: leaf cards
  function renderLeafCards() {
    const wrap = $('#leafCards');
    wrap.innerHTML = '';
    for (const slot of SLOTS) {
      const data = images[slot.key];
      const card = document.createElement('div');
      card.className = 'leaf-card' + (data ? ' ok' : '');
      card.innerHTML = `
        <div class="leaf-head">
          <span class="leaf-icon" style="background:${slot.bg}" aria-hidden="true">${slot.icon}</span>
          <div>
            <div class="leaf-title">${slot.no}. ${esc(slot.label)}${slot.required ? ' <span class="req">*</span>' : '<span class="leaf-opt">ไม่บังคับ</span>'}</div>
            <div class="leaf-nutr">${esc(slot.sub)}</div>
            <div class="leaf-nutr">ธาตุ/อาการ: ${esc(slot.nutr)}</div>
          </div>
        </div>
        <label class="leaf-photo${data ? '' : ' guide'}">
          <img src="${data ? data.dataUrl : `/assets/samples/${slot.key}.jpg`}" alt="${esc(slot.label)}"${data ? '' : ` onerror="this.onerror=null;this.src='/assets/guide/slot_${slot.key}.svg';this.parentNode.classList.add('svg')"`} />
          <span class="leaf-chip ${data ? 'ok' : 'guide'}">${data ? (isDemoPhotos ? '✅ ภาพตัวอย่างจริง (พร้อมตรวจ)' : '✅ อัปโหลดแล้ว (พร้อมตรวจ)') : '📐 ตัวอย่างภาพที่ต้องถ่าย'}</span>
          ${data ? '' : '<span class="leaf-cta">📷 แตะเพื่อถ่าย / เลือกภาพ</span>'}
          <input type="file" accept="image/*" capture="environment" aria-label="ถ่ายหรือเลือกภาพ ${esc(slot.label)}" />
        </label>
        ${data ? '<div class="leaf-tools"><button type="button" class="retake">🔄 ถ่ายใหม่</button><button type="button" class="del">🗑️ ลบ</button></div>' : ''}`;
      const input = card.querySelector('input');
      input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          card.querySelector('.leaf-chip').textContent = '⏳ กำลังประมวลผลภาพ...';
          images[slot.key] = await compressFile(file);
          isDemoPhotos = false; // a real photo was added, so this is no longer a demo run
          showError(2, '');
        } catch (err) {
          showError(2, err.message);
        }
        renderLeafCards();
      });
      if (data) {
        card.querySelector('.retake').addEventListener('click', () => input.click());
        card.querySelector('.del').addEventListener('click', () => { delete images[slot.key]; renderLeafCards(); });
      }
      wrap.appendChild(card);
    }
  }

  async function fetchAsFile(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('ไม่ใช่ไฟล์ภาพ');
    return new File([blob], url.split('/').pop(), { type: blob.type });
  }

  async function loadDemoPhotos() {
    const btn = $('#demoBtn');
    showError(2, '');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังโหลดรูปตัวอย่าง...';
    try {
      const entries = await Promise.all(SLOTS.map(async (slot) => {
        try {
          return [slot.key, await compressFile(await fetchAsFile(DEMO.images[slot.key]))];
        } catch (err) {
          if (slot.required) throw new Error(`โหลดรูปตัวอย่าง "${slot.label}" ไม่ได้ (${err.message})`);
          return [slot.key, null];
        }
      }));
      for (const k of Object.keys(images)) delete images[k];
      for (const [k, v] of entries) if (v) images[k] = v;
      isDemoPhotos = true;
      if (validateStep1()) fillDemoInfo();
      renderLeafCards();
      $('#submitBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showError(2, err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '💡 โหลดรูปตัวอย่างทดสอบ';
    }
  }

  /** Show the sample-photo button only when the sample photos are actually deployed. */
  async function initDemoPhotoButton() {
    try {
      const res = await fetch(DEMO.images.mature, { method: 'HEAD', cache: 'no-cache' });
      const type = res.headers.get('content-type') || '';
      if (res.ok && type.startsWith('image/')) $('#demoBox').hidden = false;
    } catch {}
  }

  // ---------------------------------------------------------------- Analyze
  function collectForm() {
    const fd = new FormData(form());
    const payload = {};
    for (const [k, v] of fd.entries()) if (typeof v === 'string') payload[k] = v.trim();
    payload.observedSymptoms = Array.from(selectedSymptoms);
    payload.isDemo = isDemoPhotos;
    payload.images = {};
    for (const slot of SLOTS) {
      if (images[slot.key]) payload.images[slot.key] = { base64: images[slot.key].base64, mimeType: images[slot.key].mimeType };
    }
    return payload;
  }

  async function callApi(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        if (res.status === 413) throw new Error('ขนาดรูปภาพรวมใหญ่เกินไป กรุณาลองใหม่');
        throw new Error(`เกิดข้อผิดพลาด (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || 'การวิเคราะห์ล้มเหลว กรุณาลองใหม่อีกครั้ง');
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('การวิเคราะห์ใช้เวลานานเกินไป กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่');
      if (err instanceof TypeError) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function startProgress() {
    const steps = ['กำลังส่งภาพให้ AI...', 'กำลังตรวจใบยอดและใบอ่อน...', 'กำลังประเมินธาตุอาหารจากใบมาตรฐาน...',
      'กำลังตรวจหาโรคใบด่าง โรค และแมลง...', 'กำลังจัดทำแผนการใส่ปุ๋ย...'];
    let pct = 0;
    const tick = () => {
      pct = Math.min(92, pct + Math.max(1, (92 - pct) * 0.08));
      $('#azPct').textContent = `${Math.round(pct)}%`;
      $('#azBar').style.width = `${pct}%`;
      $('#azStep').textContent = steps[Math.min(steps.length - 1, Math.floor(pct / 20))];
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      $('#azPct').textContent = '100%';
      $('#azBar').style.width = '100%';
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    showError(2, '');
    const step1Error = validateStep1();
    if (step1Error) { show('screen1'); return showError(1, step1Error); }
    const missing = SLOTS.filter((s) => s.required && !images[s.key]).map((s) => s.label);
    if (missing.length) return showError(2, `กรุณาเพิ่มภาพ: ${missing.join(', ')}`);
    if (!navigator.onLine) return showError(2, 'ไม่มีสัญญาณอินเทอร์เน็ต — ภาพยังอยู่ในหน้าจอ กดวิเคราะห์อีกครั้งเมื่อมีสัญญาณ');

    const payload = collectForm();
    $('#submitBtn').disabled = true;
    $('#azThumbs').innerHTML = SLOTS.filter((s) => images[s.key] && s.key !== 'tree').map((s) =>
      `<figure><img src="${images[s.key].dataUrl}" alt="" /><figcaption>${esc(s.label)}</figcaption></figure>`).join('');
    show('screenAnalyzing');
    const stop = startProgress();

    try {
      const result = await callApi(payload);
      result.analyzedAt = new Date().toISOString();
      result.isDemo = Boolean(payload.isDemo);
      result.photos = {};
      for (const slot of SLOTS) if (images[slot.key]) result.photos[slot.key] = images[slot.key].dataUrl;
      stop();
      lastResult = result;
      renderResult(result);
      setSaveStatus('');
      show('screenResults');
      saveHistory(result);
    } catch (err) {
      stop();
      show('screen2');
      showError(2, err.message);
    } finally {
      $('#submitBtn').disabled = false;
    }
  }

  // ---------------------------------------------------------------- Results
  function healthLevel(score) {
    let idx = 0;
    HEALTH_LEVELS.forEach((l, i) => { if (score >= l.min) idx = i; });
    return idx;
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso || ''; }
  }

  function renderResult(r) {
    const score = Number(r.healthScore) || 0;
    const lvl = healthLevel(score);
    const meta = [
      r.customerName, r.plantAge && `อายุ ${r.plantAge} เดือน`, r.plantingSeason, r.variety, r.province,
    ].filter(Boolean).map(esc).join(' · ');
    const gauge = HEALTH_LEVELS.map((l, i) => `<div class="g${i + 1}${i === lvl ? ' on' : ''}"><b>${i + 1}</b>${esc(l.label)}</div>`).join('');
    const photos = SLOTS.filter((s) => r.photos && r.photos[s.key]).map((s) => `<img src="${r.photos[s.key]}" alt="${esc(s.label)}" />`).join('');

    const needs = (r.nutrientStatus || []).filter((n) => n.status !== 'ปกติ' && n.status !== 'ต้องตรวจเพิ่ม');
    const nutrients = (r.nutrientStatus || []).map((n) => {
      const st = STATUS_STYLE[n.status] || STATUS_STYLE['ต้องตรวจเพิ่ม'];
      return `<div class="nut">
          <span class="code" style="color:${st.color}">${esc(n.code)}</span>
          <div class="bar" role="img" aria-label="${esc(n.name)} ${esc(n.status)}"><span style="width:${st.pct}%;background:${st.color}"></span></div>
          <span class="badge ${st.cls}">${esc(n.status)}</span>
          <span class="ev"><b>${esc(n.name)}</b> — ${esc(n.evidence)}</span>
        </div>`;
    }).join('');

    const diseases = (r.diseases || []).length
      ? r.diseases.map((d) => `
        <article class="disease${d.likelihood === 'สูง' ? ' high' : ''}">
          <header><h3>${esc(d.name)} <span class="badge">${esc(d.type)}</span></h3><span class="badge ${LIKELIHOOD_CLS[d.likelihood] || ''}">โอกาส${esc(d.likelihood)}</span></header>
          <p><b>อาการที่พบ:</b> ${esc(d.evidence)}</p>
          <p><b>การจัดการ:</b> ${esc(d.management)}</p>
        </article>`).join('')
      : '<p>✅ ไม่พบอาการของโรคหรือแมลงศัตรูที่ชัดเจนจากภาพ</p>';

    const plan = (r.fertilizerPlan || []).length
      ? r.fertilizerPlan.map((f) => `
        <div class="fert">
          <div class="fert-name">🧪 ${esc(f.product)}${f.nutrient ? ` <span class="badge">${esc(f.nutrient)}</span>` : ''}</div>
          <dl><dt>อัตรา</dt><dd>${esc(f.rate)}</dd><dt>ช่วงเวลา</dt><dd>${esc(f.timing)}</dd><dt>วิธีใส่</dt><dd>${esc(f.method)}</dd></dl>
        </div>`).join('')
      : '<p>ยังไม่มีคำแนะนำปุ๋ยเพิ่มเติม — รักษาแผนปุ๋ยเดิม</p>';

    const products = (r.smartGreenProducts || []).length
      ? `<section class="sec"><span class="sg-head">🌿 นวัตกรรมสมาร์ทกรีนที่แนะนำสำหรับแปลงนี้</span>
          ${r.smartGreenProducts.map((sg) => `
            <div class="sg-item">
              ${sg.image ? `<img src="${esc(sg.image)}" alt="" loading="lazy" onerror="this.remove()" />` : ''}
              <div><b>${esc(sg.name)}</b><p>${esc(sg.reason)}</p><small>วิธีใช้: ${esc(sg.usage)}</small></div>
            </div>`).join('')}
        </section>`
      : '';

    const urgent = (r.urgentActions || []).length
      ? `<section class="sec urgent"><h2>⚡ สิ่งที่ควรทำทันที</h2><ul>${r.urgentActions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>`
      : '';

    $('#resultContent').innerHTML = `
      <section class="primary-card">
        <div class="pc-label">🎯 ปัญหาหลักที่ตรวจพบ (PRIMARY ISSUE)</div>
        <span class="pc-pill">ผลตรวจ AI · ความมั่นใจ${esc(r.confidence || '-')}${r.isDemo ? ' · [DEMO]' : ''}</span>
        <div class="pc-issue">${esc(r.primaryIssue)}</div>
        <div class="pc-meta">${meta}</div>
        <div class="pc-meta">ตรวจเมื่อ ${esc(formatDate(r.analyzedAt))}${r.inspectorName ? ` · ผู้ตรวจ ${esc(r.inspectorName)}` : ''}</div>
        <div class="pc-score-label">🍠 สุขภาพต้น: <b>${esc(HEALTH_LEVELS[lvl].label)}</b></div>
        <div class="gauge" role="img" aria-label="ระดับสุขภาพ ${lvl + 1} จาก 5">${gauge}</div>
        ${photos ? `<div class="pc-photos">${photos}</div>` : ''}
      </section>
      ${urgent}
      ${needs.length ? `<section class="sec"><h2>💊 ธาตุอาหารที่ควรเสริม</h2><div class="need-pills">${needs.map((n) => `<span>💊 เสริม: ${esc(n.name)}</span>`).join('')}</div></section>` : ''}
      <section class="sec"><h2>🧪 สถานะธาตุอาหาร 8 ธาตุ</h2><div class="nutrients">${nutrients}</div></section>
      <section class="sec"><h2>🦠 โรค แมลง และความเครียด</h2>${diseases}</section>
      <section class="sec"><h2>🚜 แผนการใส่ปุ๋ยแนะนำ</h2>${plan}</section>
      ${products}
      <section class="summary"><h2>📝 สรุปภาพรวมและการวิเคราะห์</h2><p>${esc(r.overallSummary)}</p></section>
      <h2 class="frond-h">🍃 รายละเอียดผลวิเคราะห์ตามตำแหน่งใบ</h2>
      <div class="frond"><h3>🌱 1. ใบยอด / ใบอ่อน</h3><p>${esc(r.youngLeafAnalysis)}</p></div>
      <div class="frond c2"><h3>🍃 2. ใบมาตรฐาน</h3><p>${esc(r.matureLeafAnalysis)}</p></div>
      <div class="frond c3"><h3>🍂 3. ใบล่าง / ใบแก่</h3><p>${esc(r.oldLeafAnalysis)}</p></div>
      <div class="frond c4"><h3>🍠 4. ทั้งต้น / ลำต้น</h3><p>${esc(r.treeAnalysis)}</p></div>
      <section class="next"><h2>💡 คำแนะนำขั้นตอนถัดไป</h2><p>${esc(r.recommendedNextStep)}</p></section>`;
  }

  function buildShareText(r) {
    const lines = [
      '🍠 ผลตรวจใบมันสำปะหลัง (สมาร์ทกรีน Vision Ai)',
      r.customerName ? `แปลง: ${r.customerName}` : '',
      r.plantAge ? `อายุ: ${r.plantAge} เดือน` : '',
      r.plantingSeason ? `ฤดูปลูก: ${r.plantingSeason}` : '',
      `สุขภาพต้น: ${HEALTH_LEVELS[healthLevel(Number(r.healthScore) || 0)].label}`,
      `ปัญหาหลัก: ${r.primaryIssue}`,
      '',
      '🧪 ธาตุที่ควรดูแล:',
      ...(r.nutrientStatus || []).filter((n) => n.status !== 'ปกติ').map((n) => `• ${n.name}: ${n.status}`),
      '',
      (r.diseases || []).length ? '🦠 โรค/แมลงที่ต้องระวัง:' : '',
      ...(r.diseases || []).map((d) => `• ${d.name} (โอกาส${d.likelihood})`),
      '',
      (r.fertilizerPlan || []).length ? '🚜 แผนปุ๋ย:' : '',
      ...(r.fertilizerPlan || []).map((f) => `• ${f.product} ${f.rate}`),
      '',
      (r.smartGreenProducts || []).length ? '🌿 ผลิตภัณฑ์สมาร์ทกรีนแนะนำ:' : '',
      ...(r.smartGreenProducts || []).map((sg) => `• ${sg.name}`),
      '',
      `➡️ ${r.recommendedNextStep}`,
      '',
      '📞 ศูนย์สมาร์ทกรีน 085-2787110',
    ];
    return lines.filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n').trim();
  }

  async function shareLine() {
    if (!lastResult) return;
    const text = buildShareText(lastResult);
    try { await navigator.clipboard.writeText(text); setSaveStatus('📋 คัดลอกผลตรวจแล้ว กำลังเปิด LINE...'); } catch {}
    window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // ---------------------------------------------------------------- A4 report page
  // report.html reads the result from storage, then offers image / PDF / LINE copy.
  const REPORT_KEY = 'cassavaLeafDoctor.report.v1';

  async function storeReport(r) {
    const tryStore = (data) => {
      const json = JSON.stringify(data);
      try { localStorage.setItem(REPORT_KEY, json); return true; } catch {}
      try { sessionStorage.setItem(REPORT_KEY, json); return true; } catch {}
      return false;
    };
    if (tryStore(r)) return true;
    // Storage full: retry with small photos
    const photos = {};
    for (const [k, v] of Object.entries(r.photos || {})) {
      try { photos[k] = await makeThumb(v); } catch {}
    }
    return tryStore(Object.assign({}, r, { photos }));
  }

  async function openReport(r) {
    if (!r) return;
    // Open the tab first (inside the click) so pop-up blockers allow it
    const win = window.open('', '_blank');
    const ok = await storeReport(r);
    if (!ok) {
      if (win) win.close();
      setSaveStatus('เปิดหน้ารายงานไม่ได้ (พื้นที่เก็บข้อมูลเต็ม) — ใช้การพิมพ์หน้านี้แทน', true);
      window.print();
      return;
    }
    if (win) win.location.href = '/report.html';
    else window.location.href = '/report.html';
  }

  // ---------------------------------------------------------------- Google Sheets
  function buildSheetEntry(r) {
    return {
      timestamp: r.analyzedAt || new Date().toISOString(),
      traceId: r.traceId || '',
      isDemo: r.isDemo ? 'true' : '',
      customerName: r.customerName || '',
      inspectorName: r.inspectorName || '',
      plantAge: r.plantAge || '',
      plantingSeason: r.plantingSeason || '',
      variety: r.variety || '',
      province: r.province || '',
      coordinates: r.coordinates || '',
      soilType: r.soilType || '',
      waterStatus: r.waterStatus || '',
      soilPh: r.soilPh || '',
      yieldPerRai: r.yieldPerRai || '',
      lastFertilizer: r.lastFertilizer || '',
      observedSymptoms: (r.observedSymptoms || []).join(', '),
      healthScore: r.healthScore,
      primaryIssue: r.primaryIssue || '',
      nutrientSummary: (r.nutrientStatus || []).filter((n) => n.status !== 'ปกติ').map((n) => `${n.code}: ${n.status}`).join(', ') || 'ปกติทุกธาตุ',
      diseaseSummary: (r.diseases || []).map((d) => `${d.name} (โอกาส${d.likelihood})`).join(', ') || 'ไม่พบ',
      fertilizerSummary: (r.fertilizerPlan || []).map((f) => `${f.product} ${f.rate} ${f.timing}`).join(' | '),
      productSummary: (r.smartGreenProducts || []).map((sg) => sg.name).join(', '),
      urgentActions: (r.urgentActions || []).join(' | '),
      overallSummary: r.overallSummary || '',
      recommendedNextStep: r.recommendedNextStep || '',
      confidence: r.confidence || '',
    };
  }

  function setSaveStatus(msg, isError) {
    const el = $('#saveStatus');
    el.textContent = msg || '';
    el.hidden = !msg;
    el.classList.toggle('err', Boolean(isError));
  }

  async function saveToSheet(r, { silent = false } = {}) {
    if (!r) return;
    if (r.savedToSheet) { if (!silent) setSaveStatus('✅ บันทึกผลนี้ลง Google Sheets แล้ว'); return; }
    const btn = $('#saveBtn');
    btn.disabled = true;
    if (!silent) setSaveStatus('กำลังบันทึก...');
    try {
      const res = await fetch('/api/save-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSheetEntry(r)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.sheetUpdated === false) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SHEETS_WEBHOOK_URL บน Vercel');
      r.savedToSheet = true;
      updateHistoryEntry(r);
      setSaveStatus('✅ บันทึกลง Google Sheets เรียบร้อย');
    } catch (err) {
      setSaveStatus(`บันทึกไม่สำเร็จ: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- History
  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }

  function writeHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5))); } catch {}
    }
  }

  async function saveHistory(r) {
    const thumb = r.photos && r.photos.mature ? await makeThumb(r.photos.mature) : '';
    // Keep stored entries small: drop full-size photos, keep one thumbnail
    const entry = Object.assign({}, r, { photos: thumb ? { mature: thumb } : {} });
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // keep 30 days, like the sugarcane app
    const recent = readHistory().filter((h) => !(new Date(h.analyzedAt).getTime() < cutoff));
    writeHistory([entry, ...recent].slice(0, MAX_HISTORY));
  }

  function updateHistoryEntry(r) {
    const list = readHistory();
    const idx = list.findIndex((h) => h.analyzedAt === r.analyzedAt);
    if (idx === -1) return;
    list[idx].savedToSheet = Boolean(r.savedToSheet);
    writeHistory(list);
  }

  function renderHistory() {
    const list = readHistory();
    $('#historyEmpty').hidden = list.length > 0;
    $('#historyList').innerHTML = list.map((h, idx) => `
      <li data-idx="${idx}" tabindex="0" role="button">
        ${h.photos && h.photos.mature ? `<img src="${h.photos.mature}" alt="" />` : '<span class="ph">🍠</span>'}
        <div>
          <div class="h-title">${esc(h.customerName || 'ไม่ระบุแปลง')}${h.isDemo ? ' [DEMO]' : ''}</div>
          <div class="h-sub">${esc(h.primaryIssue)}</div>
          <div class="h-sub">${esc(formatDate(h.analyzedAt))}</div>
        </div>
        <span class="score">${esc(HEALTH_LEVELS[healthLevel(Number(h.healthScore) || 0)].label)}</span>
      </li>`).join('');
    $('#historyList').querySelectorAll('li').forEach((li) => {
      const open = () => {
        lastResult = readHistory()[Number(li.dataset.idx)];
        if (!lastResult) return;
        renderResult(lastResult);
        setSaveStatus(lastResult.savedToSheet ? '✅ บันทึกผลนี้ลง Google Sheets แล้ว' : '');
        show('screenResults');
      };
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  // ---------------------------------------------------------------- Misc
  function openLightbox(src) {
    $('#lightboxImg').src = src;
    $('#lightbox').hidden = false;
  }

  function resetAll() {
    for (const k of Object.keys(images)) delete images[k];
    isDemoPhotos = false;
    renderLeafCards();
    show('screen1');
  }

  // ---------------------------------------------------------------- Init
  function init() {
    fillSelect('plantAge', AGES);
    fillSelect('variety', VARIETIES);
    renderQuick('plantAge', QUICK_AGES, (v) => `${v} ด.`);
    renderQuick('variety', QUICK_VARIETIES, (v) => v);
    renderPills();
    renderChips();
    renderLeafCards();
    initDemoPhotoButton();

    form().elements.coordinates.addEventListener('input', updateMapsLink);
    $('#gpsBtn').addEventListener('click', useGps);
    $('#fillDemoBtn').addEventListener('click', fillDemoInfo);
    $('#toStep2').addEventListener('click', () => {
      const err = validateStep1();
      showError(1, err);
      if (!err) show('screen2');
    });
    $('#backTo1').addEventListener('click', () => show('screen1'));
    $('#demoBtn').addEventListener('click', loadDemoPhotos);
    form().addEventListener('submit', onSubmit);

    document.querySelectorAll('[data-lightbox]').forEach((b) => b.addEventListener('click', () => openLightbox(b.dataset.lightbox)));
    $('#lightbox').addEventListener('click', () => { $('#lightbox').hidden = true; });

    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const go = b.dataset.go;
      if (go === 'history') window.location.href = '/summary.html'; // full history page (like the sugarcane app)
      // "หน้าแรก" = SmartGreen home site (crop picker), same as the "เลือกพืชอื่น" link
      else if (go === 'home') window.location.href = 'https://smartgreen-vision-ai-home.vercel.app';
      else show(validateStep1() ? 'screen1' : 'screen2');
    }));

    $('#printBtn').addEventListener('click', () => {
      saveToSheet(lastResult, { silent: true }); // printing also logs the result to Google Sheets
      openReport(lastResult);
    });
    $('#saveBtn').addEventListener('click', () => saveToSheet(lastResult));
    $('#lineBtn').addEventListener('click', shareLine);
    $('#newBtn').addEventListener('click', resetAll);
    $('#newBtnTop').addEventListener('click', resetAll);

    show('screen1');
    openFromHistoryLink();
  }

  // /?open=<analyzedAt> (from the history page): show that saved result straight away
  function openFromHistoryLink() {
    const at = new URLSearchParams(window.location.search).get('open');
    if (!at) return;
    history.replaceState(null, '', '/');
    const found = readHistory().find((h) => h.analyzedAt === at);
    if (!found) return;
    const splash = document.getElementById('appSplash');
    if (splash) splash.remove();
    lastResult = found;
    renderResult(lastResult);
    setSaveStatus(lastResult.savedToSheet ? '✅ บันทึกผลนี้ลง Google Sheets แล้ว' : '');
    show('screenResults');
  }

  // ---------------------------------------------------------------- Launch splash
  // Shows on every visit for ~2 s with a filling bar; tap to skip.
  function initSplash() {
    const splash = document.getElementById('appSplash');
    if (!splash) return;
    const fill = document.getElementById('splashFill');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 600 : 2100;
    const start = Date.now();
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      splash.classList.add('out');
      setTimeout(() => splash.remove(), 600);
    };
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
      if (fill) fill.style.width = pct + '%';
      if (pct >= 100) { clearInterval(timer); setTimeout(close, 220); }
    }, 25);
    splash.addEventListener('click', close);
  }

  initSplash();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
