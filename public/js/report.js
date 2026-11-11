/**
 * สมาร์ทกรีน Vision Ai วิเคราะห์ใบมันสำปะหลัง — printable A4 report page (report.html)
 * The main app stores the latest result under REPORT_KEY and opens this page.
 * Toolbar: save as image (html2canvas), print / PDF, copy summary for LINE, LINE OA, close.
 */
(function () {
  'use strict';

  const REPORT_KEY = 'cassavaLeafDoctor.report.v1';
  const LINE_OA = 'https://lin.ee/nCmpTtw';

  const SLOTS = [
    { key: 'young', no: 1, label: 'ใบยอด / ใบอ่อน', sub: 'ธาตุที่เคลื่อนย้ายยาก: Zn, B, Fe · ใบด่าง', field: 'youngLeafAnalysis', cls: 'c1' },
    { key: 'mature', no: 2, label: 'ใบมาตรฐาน', sub: 'ใบแรกที่คลี่เต็มที่จากยอด', field: 'matureLeafAnalysis', cls: 'c2' },
    { key: 'old', no: 3, label: 'ใบล่าง / ใบแก่', sub: 'ธาตุที่เคลื่อนย้ายได้: N, K, Mg', field: 'oldLeafAnalysis', cls: 'c3' },
    { key: 'tree', no: 4, label: 'ทั้งต้น / ลำต้น', sub: 'ทรงต้น เพลี้ยแป้ง ลำต้น/หัวเน่า', field: 'treeAnalysis', cls: 'c4' },
  ];
  const STATUS_STYLE = {
    'ปกติ': { pct: 100, cls: 'ok' },
    'เสี่ยงขาด': { pct: 75, cls: 'warn' },
    'ขาดเล็กน้อย': { pct: 55, cls: 'warn' },
    'ขาดปานกลาง': { pct: 35, cls: 'bad' },
    'ขาดรุนแรง': { pct: 15, cls: 'bad' },
    'ต้องตรวจเพิ่ม': { pct: 50, cls: 'na' },
  };
  const HEALTH_LEVELS = [
    { min: 0, label: 'วิกฤต' }, { min: 20, label: 'ต้องแก้ไขด่วน' }, { min: 40, label: 'ต้องดูแล' },
    { min: 60, label: 'ค่อนข้างดี' }, { min: 80, label: 'สมบูรณ์ดี' },
  ];

  const $ = (sel) => document.querySelector(sel);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dash = (v) => (v == null || String(v).trim() === '' ? '-' : esc(v));

  let report = null;

  // ---------------------------------------------------------------- Data
  function loadReport() {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const raw = store.getItem(REPORT_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  function healthLevel(score) {
    let idx = 0;
    HEALTH_LEVELS.forEach((l, i) => { if (score >= l.min) idx = i; });
    return idx;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso || Date.now());
      return {
        date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
        time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        file: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`,
      };
    } catch { return { date: '', time: '', file: 'report' }; }
  }

  function mapLink(coords) {
    const m = String(coords || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    return m ? `https://www.google.com/maps?q=${m[1]},${m[2]}` : '';
  }

  // ---------------------------------------------------------------- Render
  function render(r) {
    const score = Number(r.healthScore) || 0;
    const lvl = healthLevel(score);
    const when = formatDate(r.analyzedAt);
    const map = mapLink(r.coordinates);

    const info = [
      ['ชื่อลูกค้า / แปลงมัน', r.customerName, 'strong'],
      ['ชื่อผู้ตรวจ / ผู้ดูแล', r.inspectorName, 'strong'],
      ['อายุมันสำปะหลัง', r.plantAge ? `${r.plantAge} เดือน` : ''],
      ['ฤดูปลูก', r.plantingSeason],
      ['สายพันธุ์', r.variety],
      ['จังหวัด / พื้นที่แปลง', r.province],
      ['พิกัดแปลง (GPS)', r.coordinates, 'gps'],
      ['ชนิดดิน', r.soilType],
      ['สภาพน้ำ / ความชื้น', r.waterStatus],
      ['ค่าความเป็นกรด-ด่าง (pH ดิน)', r.soilPh],
      ['ผลผลิตหัวสดรอบก่อน (ตัน/ไร่)', r.yieldPerRai],
      ['ปุ๋ยที่ใส่ครั้งล่าสุด', r.lastFertilizer, 'wide'],
      ['อาการที่สังเกตเห็น', (r.observedSymptoms || []).join(', '), 'wide'],
    ].filter(([, v], i) => i < 2 || (v != null && String(v).trim() !== ''));

    const infoHtml = info.map(([k, v, kind]) => `
      <div class="ig${kind === 'wide' ? ' wide' : ''}">
        <span class="ig-k">${esc(k)}</span>
        <span class="ig-v${kind === 'strong' ? ' strong' : ''}">${kind === 'gps' ? `📍 ${dash(v)}${map ? `<a href="${map}" target="_blank" rel="noopener noreferrer" class="map">เปิดแผนที่ Google Maps ↗</a>` : ''}` : dash(v)}</span>
      </div>`).join('');

    const photoSlots = SLOTS.filter((s) => r.photos && r.photos[s.key]);
    const photos = photoSlots.length ? `
      <section class="blk">
        <h2>📸 ภาพถ่ายบันทึกภาพใบมันสำปะหลัง ${photoSlots.length} ตำแหน่ง (Photo Evidence)</h2>
        <div class="photos n${photoSlots.length}">
          ${photoSlots.map((s) => `
            <figure>
              <div class="ph" role="img" aria-label="${esc(s.label)}" style="background-image:url('${r.photos[s.key]}')"></div>
              <figcaption><b>${s.no}. ${esc(s.label)}</b><small>${esc(s.sub)}</small></figcaption>
            </figure>`).join('')}
        </div>
      </section>` : '';

    const gauge = HEALTH_LEVELS.map((l, i) => `<div class="g g${i + 1}${i === lvl ? ' on' : ''}"><b>${i + 1}</b><span>${esc(l.label)}</span></div>`).join('');

    const urgent = (r.urgentActions || []).length ? `
      <section class="blk urgent"><h2>⚡ สิ่งที่ควรทำทันที</h2><ul>${r.urgentActions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : '';

    const nutrients = (r.nutrientStatus || []).length ? `
      <section class="blk">
        <h2>🧪 สถานะธาตุอาหาร ${r.nutrientStatus.length} ธาตุ</h2>
        <div class="nuts">${r.nutrientStatus.map((n) => {
          const st = STATUS_STYLE[n.status] || STATUS_STYLE['ต้องตรวจเพิ่ม'];
          return `<div class="nu ${st.cls}">
              <b class="code ${st.cls}">${esc(n.code)}</b>
              <div class="nu-body"><div class="nu-top"><span class="nu-name">${esc(n.name)}</span><span class="pill ${st.cls}">${esc(n.status)}</span></div>
              <small>${esc(n.evidence)}</small></div>
            </div>`;
        }).join('')}</div>
      </section>` : '';

    const fronds = `
      <section class="blk">
        <h2>🔍 รายละเอียดผลวิเคราะห์จำแนกตามตำแหน่งใบ</h2>
        <table class="tbl frond">
          <thead><tr><th>ตำแหน่ง</th><th>ลักษณะอาการและผลวินิจฉัย</th></tr></thead>
          <tbody>${SLOTS.filter((s) => r[s.field]).map((s) => `
            <tr><td><span class="pos ${s.cls}">${s.no}. ${esc(s.label)}</span></td><td>${esc(r[s.field])}</td></tr>`).join('')}</tbody>
        </table>
      </section>`;

    const diseases = `
      <section class="blk">
        <h2>🦠 โรค แมลง และความเครียด</h2>
        ${(r.diseases || []).length ? `<div class="dis">${r.diseases.map((d) => `
          <div class="dis-i${d.likelihood === 'สูง' ? ' high' : ''}">
            <div class="dis-h"><b>${esc(d.name)}</b><span class="pill na">${esc(d.type)}</span><span class="pill ${d.likelihood === 'สูง' ? 'bad' : d.likelihood === 'ปานกลาง' ? 'warn' : 'ok'}">โอกาส${esc(d.likelihood)}</span></div>
            <p><b>อาการ:</b> ${esc(d.evidence)}</p>
            <p><b>การจัดการ:</b> ${esc(d.management)}</p>
          </div>`).join('')}</div>` : '<p class="ok-line">✅ ไม่พบอาการของโรคหรือแมลงศัตรูที่ชัดเจนจากภาพ</p>'}
      </section>`;

    const needs = (r.nutrientStatus || []).filter((n) => n.status !== 'ปกติ' && n.status !== 'ต้องตรวจเพิ่ม');
    const fert = `
      <div class="col fert">
        <h3>🧾 รายการแนะนำธาตุอาหารสูตรปุ๋ย</h3>
        ${needs.length ? `<div class="need"><span>ธาตุอาหารที่ควรเสริม:</span>${needs.map((n) => `<em>💊 เสริม: ${esc(n.name)} (${esc(n.code)})</em>`).join('')}</div>` : ''}
        ${(r.fertilizerPlan || []).length ? `<div class="fps">${r.fertilizerPlan.map((f) => `
          <div class="fp">
            <b>${esc(f.product)}</b>${f.nutrient ? ` <span class="pill na">${esc(f.nutrient)}</span>` : ''}
            <dl><dt>อัตรา</dt><dd>${dash(f.rate)}</dd><dt>ช่วงเวลา</dt><dd>${dash(f.timing)}</dd><dt>วิธีใส่</dt><dd>${dash(f.method)}</dd></dl>
          </div>`).join('')}</div>` : '<p>ยังไม่มีคำแนะนำปุ๋ยเพิ่มเติม — รักษาแผนปุ๋ยเดิม</p>'}
      </div>`;
    const products = (r.smartGreenProducts || []).length ? `
      <div class="col sg">
        <h3>🌿 นวัตกรรมสมาร์ทกรีนที่แนะนำ</h3>
        <div class="sgs">${r.smartGreenProducts.map((sg) => `
          <div class="sg-i">
            ${sg.image ? `<span class="sg-pic"><img src="${esc(sg.image)}" alt="" onerror="this.parentNode.remove()" /></span>` : ''}
            <div><b>${esc(sg.name)}</b><p>${esc(sg.reason)}</p>${sg.usage ? `<small>วิธีใช้: ${esc(sg.usage)}</small>` : ''}</div>
          </div>`).join('')}</div>
      </div>` : '';

    $('#sheet').innerHTML = `
      <header class="rh">
        <div class="rh-brand">
          <span class="rh-logo"><img src="/assets/logo.png" alt="SMART GREEN" /></span>
          <div>
            <div class="rh-title">สมาร์ทกรีน Vision Ai วิเคราะห์ใบมันสำปะหลัง</div>
            <div class="rh-sub">ใบรายงานผลการตรวจวิเคราะห์สุขภาพใบมันสำปะหลังและการแนะนำธาตุอาหาร</div>
          </div>
        </div>
        <div class="rh-meta">
          <div>วันที่ตรวจ: <b>${esc(when.date)}${when.time ? ` เวลา ${esc(when.time)}` : ''}</b></div>
          <div>ระบบวิเคราะห์: <b>สมาร์ทกรีน Vision Ai</b></div>
          <span class="rh-badge">✅ วิเคราะห์ผลเรียบร้อย${r.isDemo ? ' · ข้อมูลตัวอย่าง' : ''}</span>
        </div>
      </header>

      <section class="info">${infoHtml}</section>

      ${photos}

      <section class="dx">
        <div class="dx-main">
          <div class="dx-label">🎯 สรุปอาการสำคัญหลักที่ตรวจพบ (PRIMARY DIAGNOSIS)</div>
          <div class="dx-issue">${esc(r.primaryIssue)}</div>
          <p>${esc(r.overallSummary)}</p>
          <small>ความมั่นใจของ AI: ${dash(r.confidence)}</small>
        </div>
        <div class="dx-gauge">
          <div class="dg-head"><span>สุขภาพต้นมันสำปะหลัง</span><b class="dg-lvl">ระดับ ${lvl + 1} / 5</b></div>
          <div class="gauge" role="img" aria-label="ระดับสุขภาพ ${lvl + 1} จาก 5">${gauge}</div>
          <div class="dg-score">${esc(HEALTH_LEVELS[lvl].label)}</div>
        </div>
      </section>

      ${urgent}
      ${fronds}
      ${nutrients}
      ${diseases}

      <section class="two">${fert}${products}</section>

      <section class="blk next"><h2>💡 คำแนะนำการจัดการแปลงในขั้นตอนถัดไป</h2><p>${esc(r.recommendedNextStep)}</p></section>

      <footer class="rf">
        <div class="rf-name">SMARTGREEN Innovation Care Center</div>
        <div class="rf-sub">ปรึกษาการจัดการแปลงและสั่งซื้อผลิตภัณฑ์</div>
        <div class="rf-row">
          <span class="rf-call">ศูนย์สมาร์ทกรีน <b>📞 085-2787110</b></span>
          <a class="rf-chip line" href="${LINE_OA}" target="_blank" rel="noopener noreferrer">LINE OA สมาร์ทกรีน</a>
          <a class="rf-chip fb" href="https://www.facebook.com/Smartgreenfarming/" target="_blank" rel="noopener noreferrer">Facebook สมาร์ทกรีน</a>
          <a class="rf-chip tt" href="https://www.tiktok.com/@smartgreen.farming" target="_blank" rel="noopener noreferrer">TikTok สมาร์ทกรีน</a>
        </div>
        <p class="rf-note">* รายงานนี้สร้างขึ้นโดยระบบ สมาร์ทกรีน Vision Ai เป็นการประเมินเบื้องต้นจากภาพถ่าย ควรปรึกษานักวิชาการก่อนตัดสินใจ</p>
      </footer>`;

    document.title = `รายงานผลวิเคราะห์ใบมันสำปะหลัง ${r.customerName || ''} | สมาร์ทกรีน Vision Ai`.trim();
  }

  // ---------------------------------------------------------------- Toolbar actions
  function status(msg, isErr) {
    const el = $('#tbStatus');
    el.textContent = msg || '';
    el.hidden = !msg;
    el.classList.toggle('err', Boolean(isErr));
  }

  function buildShareText(r) {
    const lines = [
      '🍠 ผลตรวจใบมันสำปะหลัง (สมาร์ทกรีน Vision Ai)',
      r.customerName ? `แปลง: ${r.customerName}` : '',
      r.plantAge ? `อายุ: ${r.plantAge} ปี` : '',
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

  async function copySummary() {
    if (!report) return;
    const text = buildShareText(report);
    try {
      await navigator.clipboard.writeText(text);
      status('📋 คัดลอกสรุปผลแล้ว — วางในแชท LINE ได้เลย');
    } catch {
      window.prompt('คัดลอกข้อความด้านล่าง', text);
    }
  }

  // Saved images: one PNG per A4-like page so each picture is not too tall
  let imageFiles = [];
  const PAGE_RATIO = 1.5; // split when the image is taller than this × width

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // One page picture: optional "continued" header, the content slice, and a clear page badge
  function cropCanvas(src, y0, y1, page, pages) {
    const w = src.width;
    const h = Math.max(1, Math.round(y1 - y0));
    const fs = Math.round(w / 52);
    const pad = Math.round(w * 0.028);
    const head = page > 1 ? Math.round(fs * 3) : 0;
    const foot = Math.round(fs * 3);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = head + h + foot;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, c.height);
    ctx.drawImage(src, 0, Math.round(y0), w, h, 0, head, w, h);
    ctx.textBaseline = 'middle';

    if (head) {
      ctx.fillStyle = '#064e3b';
      ctx.font = `800 ${fs}px Prompt, sans-serif`;
      ctx.textAlign = 'left';
      const who = report && report.customerName ? ` · ${report.customerName}` : '';
      ctx.fillText(`สมาร์ทกรีน Vision Ai วิเคราะห์ใบมันสำปะหลัง${who} (ต่อ)`, pad, head / 2);
      ctx.fillStyle = '#059669';
      ctx.fillRect(pad, head - Math.max(2, fs * 0.12), w - pad * 2, Math.max(2, fs * 0.12));
    }

    // Green "หน้า x / n" badge, bottom right
    const text = `หน้า ${page} / ${pages}`;
    ctx.font = `700 ${fs}px Prompt, sans-serif`;
    const tw = ctx.measureText(text).width;
    const bw = tw + fs * 1.6;
    const bh = fs * 1.9;
    const bx = w - pad - bw;
    const by = head + h + (foot - bh) / 2;
    ctx.fillStyle = '#059669';
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + bw / 2, by + bh / 2 + fs * 0.05);
    return c;
  }

  // Pick cut lines between top-level blocks, closest to each ideal page break
  function pageCuts(total, width, blockTops) {
    const pages = Math.max(1, Math.ceil(total / (width * PAGE_RATIO) - 0.15));
    if (pages === 1) return [0, total];
    const cuts = [0];
    for (let i = 1; i < pages; i++) {
      const ideal = (total / pages) * i;
      const best = blockTops.filter((y) => y > cuts[cuts.length - 1] + width * 0.4 && y < total - width * 0.3)
        .reduce((acc, y) => (acc == null || Math.abs(y - ideal) < Math.abs(acc - ideal) ? y : acc), null);
      if (best != null) cuts.push(best);
    }
    cuts.push(total);
    return cuts;
  }

  async function saveImage() {
    if (!report) return;
    if (typeof window.html2canvas !== 'function') return status('โหลดตัวสร้างรูปภาพไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่', true);
    const btn = $('#btnImage');
    btn.disabled = true;
    status('⏳ กำลังสร้างรูปภาพรายงาน...');
    try {
      await (document.fonts && document.fonts.ready);
      const scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
      let blockTops = [];
      const canvas = await window.html2canvas($('#sheet'), {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 900,
        onclone: (doc) => {
          doc.documentElement.classList.add('capturing');
          const sheet = doc.getElementById('sheet');
          const top = sheet.getBoundingClientRect().top;
          // Cut a few px above each block so its top border stays on the next page
          blockTops = Array.from(sheet.children).map((el) => (el.getBoundingClientRect().top - top - 5) * scale);
        },
      });
      const cuts = pageCuts(canvas.height, canvas.width, blockTops);
      const n = cuts.length - 1;
      const when = formatDate(report.analyzedAt);
      const who = String(report.customerName || 'แปลงมัน').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
      imageFiles = [];
      const box = $('#imImgs');
      box.innerHTML = '';
      const links = $('#imLinks');
      links.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const part = n === 1 ? canvas : cropCanvas(canvas, cuts[i], cuts[i + 1], i + 1, n);
        const dataUrl = part.toDataURL('image/png');
        const blob = await new Promise((res) => part.toBlob(res, 'image/png'));
        const name = `รายงานมันสำปะหลัง_${who}_${when.file}${n > 1 ? `_หน้า${i + 1}` : ''}.png`;
        if (blob) imageFiles.push(new File([blob], name, { type: 'image/png' }));
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = `รูปภาพรายงาน หน้า ${i + 1} จาก ${n}`;
        box.appendChild(img);
        const a = document.createElement('a');
        a.className = 'im-btn dl';
        a.href = blob ? URL.createObjectURL(blob) : dataUrl;
        a.download = name;
        a.textContent = n > 1 ? `⬇️ ดาวน์โหลดหน้า ${i + 1}` : '⬇️ ดาวน์โหลดรูป';
        links.appendChild(a);
      }
      $('#imTitle').textContent = n > 1 ? `🖼️ รูปภาพรายงาน (${n} รูป)` : '🖼️ รูปภาพรายงาน';
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/i.test(ua);
      const canShare = Boolean(imageFiles.length && navigator.canShare && navigator.canShare({ files: imageFiles }));
      $('#imShare').hidden = !canShare;
      $('#imShare').textContent = isIOS
        ? `📲 บันทึกลงคลังภาพ / แชร์${n > 1 ? ` (${n} รูป)` : ''}`
        : (n > 1 ? `📤 แชร์ทั้ง ${n} รูป (LINE / อื่น ๆ)` : '📤 แชร์รูป (LINE / อื่น ๆ)');
      // On iPhone a download link only saves to the Files app, so lead with the share sheet ("บันทึกภาพ")
      links.hidden = isIOS && canShare;

      if (isIOS && canShare) {
        status('');
        try {
          await navigator.share({ files: imageFiles, title: 'รายงานผลวิเคราะห์ใบมันสำปะหลัง' });
          status(`✅ ส่งรูปรายงาน ${n} รูปแล้ว`);
          return;
        } catch (err) {
          // Cancelled, or Safari needs a fresh tap: show the preview with the share button
        }
      } else if (!isIOS && !isAndroid) {
        // Computer: download every page straight away, like the sugarcane app
        links.querySelectorAll('a').forEach((link) => link.click());
        status(`⬇️ ดาวน์โหลดรูปรายงาน ${n} รูปแล้ว (ดูในโฟลเดอร์ Downloads)`);
      } else {
        status('');
      }
      $('#imgModal').hidden = false;
    } catch (err) {
      status(`สร้างรูปภาพไม่สำเร็จ: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function shareImage() {
    if (!imageFiles.length) return;
    try {
      await navigator.share({ files: imageFiles, title: 'รายงานผลวิเคราะห์ใบมันสำปะหลัง' });
    } catch (err) {
      if (err && err.name !== 'AbortError') status('แชร์ไม่สำเร็จ — กดค้างที่รูปเพื่อบันทึกแทน', true);
    }
  }

  function closePage() {
    window.close();
    // window.close() is ignored when the page was not opened by a script (e.g. inside LINE)
    setTimeout(() => { if (!window.closed) window.location.href = '/'; }, 200);
  }

  // ---------------------------------------------------------------- Init
  function init() {
    report = loadReport();
    if (!report) {
      $('#sheet').innerHTML = '<p class="empty">ไม่พบข้อมูลรายงาน — กรุณากลับไปหน้าตรวจใบมันสำปะหลัง แล้วกด "พิมพ์ / บันทึกรายงานสรุป" อีกครั้ง <br /><a href="/">← กลับหน้าตรวจใบมันสำปะหลัง</a></p>';
      ['#btnImage', '#btnPrint', '#btnCopy'].forEach((s) => { $(s).disabled = true; });
    } else {
      render(report);
    }
    $('#btnImage').addEventListener('click', saveImage);
    $('#btnPrint').addEventListener('click', () => window.print());
    $('#btnCopy').addEventListener('click', copySummary);
    $('#btnClose').addEventListener('click', closePage);
    $('#imClose').addEventListener('click', () => { $('#imgModal').hidden = true; });
    $('#imgModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#imgModal').hidden = true; });
    $('#imShare').addEventListener('click', shareImage);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#imgModal').hidden = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
