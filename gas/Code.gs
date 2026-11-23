/**
 * สมาร์ทกรีน Vision Ai — Google Sheets webhook (ใช้ร่วมกันทุกพืช: อ้อย ข้าว ข้าวโพด มันสำปะหลัง ยางพารา ปาล์ม)
 *
 * Google Sheets 1 ไฟล์ · Apps Script 1 ตัว · URL เดียวใส่ได้ทุกแอป
 * ผลตรวจแต่ละพืชจะแยกไปอยู่คนละแท็บ (ชีต) ให้อัตโนมัติ
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. สร้าง Google Sheets ใหม่ 1 ไฟล์ เช่น "สมาร์ทกรีน Vision Ai ผลตรวจทุกพืช"
 * 2. เมนู ส่วนขยาย → Apps Script → ลบโค้ดเดิม → วางโค้ดไฟล์นี้ทั้งหมด → บันทึก
 * 3. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *    - ดำเนินการในฐานะ: ฉัน
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 * 4. คัดลอก URL เว็บแอป (.../exec) ไปใส่ใน Vercel ของทุกแอป (อ้อยใส่ได้ด้วย)
 *    → Settings → Environment Variables → GOOGLE_SHEETS_WEBHOOK_URL → แล้ว Redeploy
 *
 * สำรองข้อมูลแยกรายเดือน (ทำครั้งเดียว):
 * - เลือกฟังก์ชัน installMonthlyBackup แล้วกด Run → กดอนุญาตสิทธิ์
 * - ระบบจะสร้างโฟลเดอร์ "สำรองผลตรวจ สมาร์ทกรีน Vision AI" ใน Google Drive
 *   แล้วทุกวันที่ 1 จะสร้างไฟล์ของเดือนที่ผ่านมาให้เอง เดือนละ 1 ไฟล์
 * - อยากสำรองเดือนนี้ทันที: Run backupThisMonth · อยากสำรองย้อนหลังทุกเดือน: Run backupAllMonths
 */
const CROPS = {
  sugarcane: {
    sheet: 'ผลตรวจใบอ้อย',
    headers: [
      ['timestamp', 'วันเวลาที่ตรวจ'],
      ['customerName', 'ชื่อลูกค้า / แปลงอ้อย'],
      ['inspectorName', 'ชื่อผู้ตรวจ / ผู้ดูแล'],
      ['caneType', 'ประเภทอ้อย'],
      ['caneAge', 'อายุอ้อย (เดือน)'],
      ['variety', 'พันธุ์อ้อย'],
      ['province', 'จังหวัด'],
      ['coordinates', 'พิกัดแปลง (GPS)'],
      ['soilType', 'ชนิดดิน'],
      ['waterStatus', 'สภาพน้ำ/ความชื้น'],
      ['soilPh', 'ค่า pH ดิน'],
      ['primaryIssue', 'อาการหลักที่พบ'],
      ['greennessLabel', 'ระดับความเขียว LCC'],
      ['overallSummary', 'สรุปผลการวิเคราะห์'],
      ['fertilizerFormula', 'สูตรปุ๋ยแนะนำ'],
      ['smartGreenSoilProduct', 'ปุ๋ยทางดิน SmartGreen'],
      ['smartGreenLiquidProduct', 'นวัตกรรมชนิดน้ำ SmartGreen'],
      ['recommendedNextStep', 'คำแนะนำการจัดการแปลง'],
      ['traceId', 'รหัสอ้างอิง'],
    ],
  },
  rice: {
    sheet: 'ผลตรวจใบข้าว',
    headers: [
    ['timestamp', 'วันเวลาที่ตรวจ'],
    ['customerName', 'ชื่อเกษตรกร / แปลง'],
    ['inspectorName', 'ผู้ตรวจ / ผู้ดูแล'],
    ['plantAge', 'อายุหลังปลูก (วัน)'],
    ['plantingSeason', 'ฤดู / วิธีปลูก'],
    ['variety', 'พันธุ์'],
    ['province', 'จังหวัด'],
    ['coordinates', 'พิกัดแปลง (GPS)'],
    ['soilType', 'ชนิดดิน'],
    ['waterStatus', 'สภาพน้ำ/ความชื้น'],
    ['soilPh', 'ค่า pH ดิน'],
    ['yieldPerRai', 'ผลผลิตข้าวเปลือกรอบก่อน (กก./ไร่)'],
    ['lastFertilizer', 'ปุ๋ยที่ใส่ล่าสุด'],
    ['observedSymptoms', 'อาการที่สังเกต'],
    ['healthScore', 'คะแนนสุขภาพ (0-100)'],
    ['greennessLevel', 'ระดับความเขียวใบ (1-5)'],
    ['greennessNote', 'หมายเหตุสีใบ'],
    ['primaryIssue', 'ปัญหาหลัก'],
    ['nutrientSummary', 'ธาตุที่ขาด/เสี่ยง'],
    ['diseaseSummary', 'โรค/แมลงที่พบ'],
    ['fertilizerSummary', 'แผนปุ๋ยแนะนำ'],
    ['productSummary', 'ผลิตภัณฑ์สมาร์ทกรีนแนะนำ'],
    ['urgentActions', 'สิ่งที่ควรทำทันที'],
    ['overallSummary', 'สรุปผลการวิเคราะห์'],
    ['recommendedNextStep', 'ขั้นตอนถัดไป'],
    ['confidence', 'ความมั่นใจ AI'],
    ['traceId', 'รหัสอ้างอิง'],
    ],
  },
  corn: {
    sheet: 'ผลตรวจใบข้าวโพด',
    headers: [
    ['timestamp', 'วันเวลาที่ตรวจ'],
    ['customerName', 'ชื่อเกษตรกร / แปลง'],
    ['inspectorName', 'ผู้ตรวจ / ผู้ดูแล'],
    ['plantAge', 'อายุหลังปลูก (วัน)'],
    ['plantingSeason', 'ฤดูปลูก'],
    ['variety', 'พันธุ์'],
    ['province', 'จังหวัด'],
    ['coordinates', 'พิกัดแปลง (GPS)'],
    ['soilType', 'ชนิดดิน'],
    ['waterStatus', 'สภาพน้ำ/ความชื้น'],
    ['soilPh', 'ค่า pH ดิน'],
    ['yieldPerRai', 'ผลผลิตเมล็ดรอบก่อน (กก./ไร่)'],
    ['lastFertilizer', 'ปุ๋ยที่ใส่ล่าสุด'],
    ['observedSymptoms', 'อาการที่สังเกต'],
    ['healthScore', 'คะแนนสุขภาพ (0-100)'],
    ['greennessLevel', 'ระดับความเขียวใบ (1-5)'],
    ['greennessNote', 'หมายเหตุสีใบ'],
    ['primaryIssue', 'ปัญหาหลัก'],
    ['nutrientSummary', 'ธาตุที่ขาด/เสี่ยง'],
    ['diseaseSummary', 'โรค/แมลงที่พบ'],
    ['fertilizerSummary', 'แผนปุ๋ยแนะนำ'],
    ['productSummary', 'ผลิตภัณฑ์สมาร์ทกรีนแนะนำ'],
    ['urgentActions', 'สิ่งที่ควรทำทันที'],
    ['overallSummary', 'สรุปผลการวิเคราะห์'],
    ['recommendedNextStep', 'ขั้นตอนถัดไป'],
    ['confidence', 'ความมั่นใจ AI'],
    ['traceId', 'รหัสอ้างอิง'],
    ],
  },
  cassava: {
    sheet: 'ผลตรวจใบมันสำปะหลัง',
    headers: [
    ['timestamp', 'วันเวลาที่ตรวจ'],
    ['customerName', 'ชื่อเกษตรกร / แปลง'],
    ['inspectorName', 'ผู้ตรวจ / ผู้ดูแล'],
    ['plantAge', 'อายุมัน (เดือน)'],
    ['plantingSeason', 'ฤดูปลูก'],
    ['variety', 'พันธุ์'],
    ['province', 'จังหวัด'],
    ['coordinates', 'พิกัดแปลง (GPS)'],
    ['soilType', 'ชนิดดิน'],
    ['waterStatus', 'สภาพน้ำ/ความชื้น'],
    ['soilPh', 'ค่า pH ดิน'],
    ['yieldPerRai', 'ผลผลิตหัวสด (ตัน/ไร่)'],
    ['lastFertilizer', 'ปุ๋ยที่ใส่ล่าสุด'],
    ['observedSymptoms', 'อาการที่สังเกต'],
    ['healthScore', 'คะแนนสุขภาพ (0-100)'],
    ['primaryIssue', 'ปัญหาหลัก'],
    ['nutrientSummary', 'ธาตุที่ขาด/เสี่ยง'],
    ['diseaseSummary', 'โรค/แมลงที่พบ'],
    ['fertilizerSummary', 'แผนปุ๋ยแนะนำ'],
    ['productSummary', 'ผลิตภัณฑ์สมาร์ทกรีนแนะนำ'],
    ['urgentActions', 'สิ่งที่ควรทำทันที'],
    ['overallSummary', 'สรุปผลการวิเคราะห์'],
    ['recommendedNextStep', 'ขั้นตอนถัดไป'],
    ['confidence', 'ความมั่นใจ AI'],
    ['traceId', 'รหัสอ้างอิง'],
    ],
  },
  rubber: {
    sheet: 'ผลตรวจใบยางพารา',
    headers: [
    ['timestamp', 'วันเวลาที่ตรวจ'],
    ['customerName', 'ชื่อเกษตรกร / แปลง'],
    ['inspectorName', 'ผู้ตรวจ / ผู้ดูแล'],
    ['treeAge', 'อายุต้นยาง (ปี)'],
    ['tappingStatus', 'สถานะการกรีด'],
    ['variety', 'พันธุ์ยาง'],
    ['province', 'จังหวัด'],
    ['coordinates', 'พิกัดแปลง (GPS)'],
    ['soilType', 'ชนิดดิน'],
    ['waterStatus', 'สภาพน้ำ/ความชื้น'],
    ['soilPh', 'ค่า pH ดิน'],
    ['yieldPerRai', 'ผลผลิตยางแห้ง (กก./ไร่/ปี)'],
    ['lastFertilizer', 'ปุ๋ยที่ใส่ล่าสุด'],
    ['observedSymptoms', 'อาการที่สังเกต'],
    ['healthScore', 'คะแนนสุขภาพ (0-100)'],
    ['primaryIssue', 'ปัญหาหลัก'],
    ['nutrientSummary', 'ธาตุที่ขาด/เสี่ยง'],
    ['diseaseSummary', 'โรค/แมลงที่พบ'],
    ['fertilizerSummary', 'แผนปุ๋ยแนะนำ'],
    ['productSummary', 'ผลิตภัณฑ์สมาร์ทกรีนแนะนำ'],
    ['urgentActions', 'สิ่งที่ควรทำทันที'],
    ['overallSummary', 'สรุปผลการวิเคราะห์'],
    ['recommendedNextStep', 'ขั้นตอนถัดไป'],
    ['confidence', 'ความมั่นใจ AI'],
    ['traceId', 'รหัสอ้างอิง'],
    ],
  },
  palm: {
    sheet: 'ผลตรวจใบปาล์ม',
    headers: [
    ['timestamp', 'วันเวลาที่ตรวจ'],
    ['customerName', 'ชื่อเกษตรกร / แปลง'],
    ['inspectorName', 'ผู้ตรวจ / ผู้ดูแล'],
    ['palmAge', 'อายุปาล์ม (ปี)'],
    ['variety', 'สายพันธุ์'],
    ['province', 'จังหวัด'],
    ['coordinates', 'พิกัดแปลง (GPS)'],
    ['soilType', 'ชนิดดิน'],
    ['waterStatus', 'สภาพน้ำ/ความชื้น'],
    ['soilPh', 'ค่า pH ดิน'],
    ['yieldPerRai', 'ผลผลิต (ตัน/ไร่/ปี)'],
    ['lastFertilizer', 'ปุ๋ยที่ใส่ล่าสุด'],
    ['observedSymptoms', 'อาการที่สังเกต'],
    ['healthScore', 'คะแนนสุขภาพ (0-100)'],
    ['primaryIssue', 'ปัญหาหลัก'],
    ['nutrientSummary', 'ธาตุที่ขาด/เสี่ยง'],
    ['diseaseSummary', 'โรค/แมลงที่พบ'],
    ['fertilizerSummary', 'แผนปุ๋ยแนะนำ'],
    ['productSummary', 'ผลิตภัณฑ์สมาร์ทกรีนแนะนำ'],
    ['urgentActions', 'สิ่งที่ควรทำทันที'],
    ['overallSummary', 'สรุปผลการวิเคราะห์'],
    ['recommendedNextStep', 'ขั้นตอนถัดไป'],
    ['confidence', 'ความมั่นใจ AI'],
    ['traceId', 'รหัสอ้างอิง'],
    ],
  },
};

function doPost(e) {
  // One request at a time, so two copies of the same result arriving together cannot both be written
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    // The sugarcane app sends no crop field; recognise it by its own fields
    if (!data.crop && (data.caneType !== undefined || data.caneAge !== undefined)) data.crop = 'sugarcane';
    const crop = CROPS[data.crop] ? data.crop : null;
    const def = crop ? CROPS[crop] : { sheet: 'อื่นๆ', headers: Object.keys(data).map(function (k) { return [k, k]; }) };
    const sheet = getOrCreateSheet_(def);
    // Same result sent again (retry after a network drop, double tap): keep the row that is already there
    if (data.traceId && hasTraceId_(sheet, def, String(data.traceId))) {
      return json_({ success: true, sheet: def.sheet, duplicate: true });
    }
    // Results from the "load sample" demo button are tagged so they are easy to filter out
    // The sugarcane app sends no isDemo flag: its sample customer is "คุณสมคิด ไร่อ้อยทอง แปลงที่ 1"
    if (crop === 'sugarcane' && String(data.customerName || '').indexOf('คุณสมคิด ไร่อ้อยทอง') !== -1) data.isDemo = 'true';
    if (String(data.isDemo) === 'true' && String(data.customerName || '').indexOf('[DEMO]') !== 0) {
      data.customerName = '[DEMO] ' + (data.customerName || '');
    }
    const row = def.headers.map(function (h) {
      if (h[0] === 'timestamp') return data.timestamp ? new Date(data.timestamp) : new Date();
      const v = data[h[0]];
      return v === undefined || v === null ? '' : String(v);
    });
    sheet.appendRow(row);
    return json_({ success: true, sheet: def.sheet });
  } catch (err) {
    return json_({ success: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** true when the "รหัสอ้างอิง" column already holds this traceId (checks the latest 2,000 rows) */
function hasTraceId_(sheet, def, traceId) {
  const h = def.headers.filter(function (x) { return x[0] === 'traceId'; })[0];
  if (!h) return false;
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return false;
  const col = sheet.getRange(1, 1, 1, lastCol).getValues()[0].indexOf(h[1]) + 1;
  if (col < 1) return false;
  const from = Math.max(2, lastRow - 1999);
  const ids = sheet.getRange(from, col, lastRow - from + 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === traceId) return true;
  return false;
}

/** เปิด URL เว็บแอปในเบราว์เซอร์เพื่อเช็กว่าสคริปต์ทำงาน */
function doGet() {
  return json_({ ok: true, app: 'smartgreen-vision-ai', crops: Object.keys(CROPS) });
}

/** กด Run ฟังก์ชันนี้ใน Apps Script เพื่อสร้างแท็บของทุกพืชไว้ล่วงหน้า (ไม่บังคับ) */
function setupAllSheets() {
  Object.keys(CROPS).forEach(function (k) { getOrCreateSheet_(CROPS[k]); });
}

function getOrCreateSheet_(def) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(def.sheet);
  if (!sheet) {
    sheet = ss.insertSheet(def.sheet);
    sheet.appendRow(def.headers.map(function (h) { return h[1]; }));
    sheet.getRange(1, 1, 1, def.headers.length)
      .setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  // A tab made by an older version of this script: add the new columns at the end (e.g. รหัสอ้างอิง for sugarcane)
  const have = sheet.getLastColumn();
  if (have > 0 && have < def.headers.length) {
    const labels = sheet.getRange(1, 1, 1, have).getValues()[0];
    const samePrefix = labels.every(function (l, i) { return String(l) === def.headers[i][1]; });
    if (samePrefix) {
      const extra = def.headers.slice(have).map(function (h) { return h[1]; });
      sheet.getRange(1, have + 1, 1, extra.length).setValues([extra])
        .setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold');
    }
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- สำรองข้อมูลแยกรายเดือน
const BACKUP_FOLDER = 'สำรองผลตรวจ สมาร์ทกรีน Vision AI';
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** กด Run ครั้งเดียว: ตั้งเวลาให้สำรองเองทุกวันที่ 1 และสำรองทุกเดือนที่มีข้อมูลอยู่ตอนนี้ */
function installMonthlyBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupLastMonth') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupLastMonth').timeBased().onMonthDay(1).atHour(2).create();
  backupAllMonths();
}

/** ระบบเรียกเองทุกวันที่ 1: สำรองเดือนที่เพิ่งจบ */
function backupLastMonth() {
  const now = new Date();
  backupMonth_(monthKey_(new Date(now.getFullYear(), now.getMonth(), 0, 12)));
}

/** สำรองเดือนปัจจุบันทันที (กดซ้ำได้ ไฟล์เดิมจะถูกอัปเดต) */
function backupThisMonth() {
  backupMonth_(monthKey_(new Date()));
}

/** สำรองย้อนหลังทุกเดือนที่มีข้อมูล */
function backupAllMonths() {
  const keys = {};
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sh) {
    sh.getDataRange().getValues().slice(1).forEach(function (r) {
      if (r[0] instanceof Date) keys[monthKey_(r[0])] = true;
    });
  });
  Object.keys(keys).sort().forEach(backupMonth_);
}

/** key = 'yyyy-MM' ตามเขตเวลาของไฟล์ Sheets */
function monthKey_(date) {
  return Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM');
}

function backupMonth_(key) {
  const src = SpreadsheetApp.getActiveSpreadsheet();
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const name = 'ผลตรวจ ' + key + ' (' + TH_MONTHS[month - 1] + ' ' + (year + 543) + ')';

  // One file per month in the backup folder; running again updates the same file
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
  const found = folder.getFilesByName(name);
  let out;
  if (found.hasNext()) {
    out = SpreadsheetApp.openById(found.next().getId());
  } else {
    out = SpreadsheetApp.create(name);
    DriveApp.getFileById(out.getId()).moveTo(folder);
  }
  const old = out.getSheets();
  const summary = out.insertSheet('สรุป ' + key + ' ' + Date.now());
  old.forEach(function (sh) { out.deleteSheet(sh); });

  const counts = [];
  src.getSheets().forEach(function (sh) {
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return;
    const rows = values.slice(1).filter(function (r) { return r[0] instanceof Date && monthKey_(r[0]) === key; });
    if (!rows.length) return;
    const copy = out.insertSheet(sh.getName());
    copy.getRange(1, 1, 1, values[0].length).setValues([values[0]])
      .setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold');
    copy.getRange(2, 1, rows.length, values[0].length).setValues(rows);
    copy.setFrozenRows(1);
    counts.push([sh.getName(), rows.length]);
  });

  const total = counts.reduce(function (n, c) { return n + c[1]; }, 0);
  const lines = [['สำรองผลตรวจ ' + TH_MONTHS[month - 1] + ' ' + (year + 543), ''], ['สำรองเมื่อ', new Date()], ['', ''], ['พืช', 'จำนวนแปลงที่ตรวจ']]
    .concat(counts.length ? counts : [['ไม่มีผลตรวจในเดือนนี้', 0]])
    .concat([['รวม', total]]);
  summary.getRange(1, 1, lines.length, 2).setValues(lines);
  summary.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  summary.getRange(4, 1, 1, 2).setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold');
  summary.getRange(lines.length, 1, 1, 2).setFontWeight('bold');
  summary.setName('สรุป');
  out.setActiveSheet(summary);
  out.moveActiveSheet(1);
  return total;
}
