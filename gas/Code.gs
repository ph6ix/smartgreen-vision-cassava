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
  try {
    const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    // The sugarcane app sends no crop field; recognise it by its own fields
    if (!data.crop && (data.caneType !== undefined || data.caneAge !== undefined)) data.crop = 'sugarcane';
    const crop = CROPS[data.crop] ? data.crop : null;
    const def = crop ? CROPS[crop] : { sheet: 'อื่นๆ', headers: Object.keys(data).map(function (k) { return [k, k]; }) };
    const sheet = getOrCreateSheet_(def);
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
  }
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
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
