/**
 * สมาร์ทกรีน Vision Ai วิเคราะห์ใบมันสำปะหลัง — Google Sheets webhook
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. สร้าง Google Sheets ใหม่สำหรับเก็บผลตรวจมันสำปะหลัง
 * 2. เมนู ส่วนขยาย → Apps Script → วางโค้ดไฟล์นี้ทั้งหมด → บันทึก
 * 3. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *    - ดำเนินการในฐานะ: ฉัน
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 * 4. คัดลอก URL เว็บแอป (.../exec) ไปใส่ใน Vercel → Environment Variables → GOOGLE_SHEETS_WEBHOOK_URL
 */
const SHEET_NAME = 'ผลตรวจใบมันสำปะหลัง';

const HEADERS = [
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
];

function doPost(e) {
  try {
    const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const sheet = getOrCreateSheet_();
    // Results from the "load sample" demo button are tagged so they are easy to filter out
    if (String(data.isDemo) === 'true' && String(data.customerName || '').indexOf('[DEMO]') !== 0) {
      data.customerName = '[DEMO] ' + (data.customerName || '');
    }
    const row = HEADERS.map(function (h) {
      if (h[0] === 'timestamp') return data.timestamp ? new Date(data.timestamp) : new Date();
      const v = data[h[0]];
      return v === undefined || v === null ? '' : String(v);
    });
    sheet.appendRow(row);
    return json_({ success: true });
  } catch (err) {
    return json_({ success: false, error: err.message });
  }
}

/** เปิด URL เว็บแอปในเบราว์เซอร์เพื่อเช็กว่าสคริปต์ทำงาน */
function doGet() {
  return json_({ ok: true, app: 'smartgreen-vision-cassava', sheet: SHEET_NAME });
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS.map(function (h) { return h[1]; }));
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
