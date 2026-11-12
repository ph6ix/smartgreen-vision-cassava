/**
 * History page (ประวัติสะสม): every analysis kept on this device, as a table (desktop) or cards (phone).
 * Search, open the result, open the A4 summary sheet, delete one, clear all, print / PDF.
 * Records older than 30 days are removed automatically.
 */
(function () {
  'use strict';

  const CFG = window.SUMMARY_CONFIG;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const HEALTH_LEVELS = [
    { min: 0, label: 'วิกฤต' }, { min: 20, label: 'ต้องแก้ไขด่วน' }, { min: 40, label: 'ต้องดูแล' },
    { min: 60, label: 'ค่อนข้างดี' }, { min: 80, label: 'สมบูรณ์ดี' },
  ];

  const $ = (sel) => document.querySelector(sel);
  let rows = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(val) {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function healthIdx(h) {
    const score = Number(h.healthScore) || 0;
    let idx = 0;
    HEALTH_LEVELS.forEach((l, i) => { if (score >= l.min) idx = i; });
    return idx;
  }

  function ageText(h) {
    const v = h[CFG.ageField];
    if (!v) return '-';
    return /^\d+(\.\d+)?$/.test(String(v)) ? `${v} ${CFG.ageUnit}` : String(v);
  }

  function thumb(h) {
    return h.photos && h.photos[CFG.thumbKey] ? h.photos[CFG.thumbKey] : '';
  }

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(CFG.historyKey) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  function write() {
    try { localStorage.setItem(CFG.historyKey, JSON.stringify(rows)); } catch (e) { console.warn(e); }
  }

  function load() {
    const all = read();
    const now = Date.now();
    rows = all.filter((h) => {
      const t = new Date(h.analyzedAt).getTime();
      return isNaN(t) || now - t <= THIRTY_DAYS_MS;
    });
    if (rows.length !== all.length) write();
    render();
  }

  function openResultUrl(h) {
    return '/?open=' + encodeURIComponent(h.analyzedAt || '');
  }

  function openReport(i) {
    const h = rows[i];
    if (!h) return;
    const win = window.open('', '_blank');
    try {
      sessionStorage.removeItem(CFG.reportKey);
      localStorage.setItem(CFG.reportKey, JSON.stringify(h));
    } catch {
      if (win) win.close();
      toast('เปิดใบสรุปไม่ได้ (พื้นที่เก็บข้อมูลเต็ม)');
      return;
    }
    if (win) win.location.href = '/report.html';
    else window.location.href = '/report.html';
  }

  function deleteRow(i) {
    const h = rows[i];
    if (!h) return;
    const name = h.customerName ? `แปลง "${h.customerName}"` : 'รายการนี้';
    if (!window.confirm(`คุณต้องการลบประวัติการตรวจ ${name}\n(วันที่ตรวจ: ${formatDate(h.analyzedAt)})\n\nใช่หรือไม่? ข้อมูลที่ลบจะไม่สามารถกู้คืนได้`)) return;
    rows.splice(i, 1);
    write();
    render();
    toast(`🗑️ ลบประวัติ ${name} เรียบร้อยแล้ว`);
  }

  function clearAll() {
    if (!rows.length) { alert('ไม่มีรายการประวัติการตรวจในอุปกรณ์นี้ให้ลบ'); return; }
    if (!window.confirm(`⚠️ คำเตือน: คุณต้องการล้างประวัติการตรวจทั้งหมด (${rows.length} รายการ) ในอุปกรณ์นี้ใช่หรือไม่?\n\nข้อมูลจะถูกลบออกจากเครื่องและไม่สามารถกู้คืนได้ (ข้อมูลที่บันทึกลง Google Sheets ไม่ถูกลบ)`)) return;
    rows = [];
    try {
      localStorage.removeItem(CFG.historyKey);
      localStorage.removeItem(CFG.reportKey);
      sessionStorage.removeItem(CFG.reportKey);
    } catch {}
    render();
    toast('🗑️ ล้างประวัติการตรวจทั้งหมดในอุปกรณ์เรียบร้อยแล้ว');
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function render() {
    const kw = ($('#searchInput').value || '').trim().toLowerCase();
    const list = rows.map((h, i) => ({ h, i })).filter(({ h }) => !kw || [
      h.customerName, h.inspectorName, h[CFG.ageField], h.variety, h.province, h.primaryIssue, h.overallSummary,
      HEALTH_LEVELS[healthIdx(h)].label,
    ].join(' ').toLowerCase().includes(kw));

    $('#summaryMeta').textContent = kw ? `พบ ${list.length} จาก ${rows.length} รายการ` : `แสดงทั้งหมด ${list.length} รายการ`;
    $('#emptyBox').hidden = rows.length > 0;
    document.querySelector('.sum-table-wrap').hidden = rows.length === 0;

    $('#tableBody').innerHTML = list.length ? list.map(({ h, i }) => {
      const lvl = healthIdx(h);
      const img = thumb(h);
      return `
      <tr>
        <td class="nowrap">${esc(formatDate(h.analyzedAt))}</td>
        <td>
          ${img ? `<img class="sum-thumb" src="${img}" alt="" />` : ''}
          <div class="sum-name"><a href="${openResultUrl(h)}">${esc(h.customerName || 'ไม่ระบุแปลง')}</a></div>
          ${h.isDemo ? '<div class="demo">[DEMO]</div>' : ''}
          ${h.inspectorName ? `<div class="sum-inspector">👨‍🌾 ${esc(h.inspectorName)}</div>` : ''}
        </td>
        <td class="nowrap">${esc(ageText(h))}</td>
        <td>${esc(h.variety || '-')}</td>
        <td>${esc(h.province || '-')}</td>
        <td><span class="pill h${lvl}">${esc(HEALTH_LEVELS[lvl].label)}</span></td>
        <td class="diag">${h.primaryIssue ? `🎯 <strong>${esc(h.primaryIssue)}</strong><br>` : ''}${esc(h.overallSummary || '')}</td>
        <td class="actions">
          <button type="button" class="sum-btn sm" data-report="${i}">🖨️ ใบสรุป</button>
          <button type="button" class="sum-btn sm del" data-del="${i}" title="ลบรายการนี้">🗑️ ลบ</button>
        </td>
      </tr>`;
    }).join('') : (rows.length ? '<tr><td colspan="8" class="c">ไม่พบรายการที่ค้นหา</td></tr>' : '');

    $('#cardsContainer').innerHTML = list.length ? list.map(({ h, i }) => {
      const lvl = healthIdx(h);
      const img = thumb(h);
      return `
      <div class="sum-mcard">
        <div class="sum-mcard-head">
          <div class="left">
            ${img ? `<img class="sum-thumb" src="${img}" alt="" />` : ''}
            <div>
              <strong>${esc(h.customerName || 'ไม่ระบุแปลง')}${h.isDemo ? ' <span class="demo">[DEMO]</span>' : ''}</strong>
              <span class="pill h${lvl}">${esc(HEALTH_LEVELS[lvl].label)}</span>
            </div>
          </div>
          <button type="button" class="sum-btn sm del" data-del="${i}" title="ลบรายการนี้">🗑️ ลบ</button>
        </div>
        <div class="sum-mcard-meta">
          📅 ${esc(formatDate(h.analyzedAt))} • 📍 ${esc(h.province || '-')}${h.coordinates ? ` (<a href="https://www.google.com/maps?q=${encodeURIComponent(h.coordinates)}" target="_blank" rel="noopener">GPS</a>)` : ''}
          • อายุ ${esc(ageText(h))} • พันธุ์: ${esc(h.variety || '-')}
          ${h.inspectorName ? `<div class="sum-inspector">👨‍🌾 ผู้ตรวจ / ผู้ดูแล: <strong>${esc(h.inspectorName)}</strong></div>` : ''}
        </div>
        ${h.primaryIssue ? `<div class="sum-mcard-issue">🎯 <strong>${esc(h.primaryIssue)}</strong></div>` : ''}
        <div class="sum-mcard-summary">${esc(h.overallSummary || '-')}</div>
        <div class="sum-mcard-actions">
          <a class="sum-btn sm" href="${openResultUrl(h)}">🔍 ดูผลตรวจ</a>
          <button type="button" class="sum-btn sm primary" data-report="${i}">🖨️ ใบสรุป (A4)</button>
        </div>
      </div>`;
    }).join('') : (rows.length ? '<p class="sum-empty">ไม่พบรายการที่ค้นหา</p>' : '');
  }

  document.addEventListener('click', (e) => {
    const rep = e.target.closest('[data-report]');
    if (rep) { openReport(Number(rep.dataset.report)); return; }
    const del = e.target.closest('[data-del]');
    if (del) deleteRow(Number(del.dataset.del));
  });
  $('#searchInput').addEventListener('input', render);
  $('#refreshBtn').addEventListener('click', load);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#clearBtn').addEventListener('click', clearAll);
  load();
})();
