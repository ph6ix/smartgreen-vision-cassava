/**
 * Cassava Leaf Doctor — AI analysis service
 * วิเคราะห์ธาตุอาหาร โรค และแมลงศัตรูมันสำปะหลังจากภาพใบและต้น
 *
 * ความรู้อ้างอิงในคำสั่ง AI ด้านล่างเป็น "ร่าง" จากหลักวิชาการทั่วไป
 * ต้องให้ทีมนักวิชาการสมาร์ทกรีนตรวจทานก่อนใช้งานจริง
 */
import { isBusyError, BUSY_MESSAGE_TH } from './modelRetry.js';
import { generateJsonWithFallback, normalizeSmartGreenProductText } from './gemini.js';
import { getEnabledCassavaProducts, matchCassavaProduct } from './cassavaProducts.js';

// ตำแหน่งภาพที่รับ (3 ภาพบังคับ + 1 ภาพเสริม)
export const CASSAVA_IMAGE_SLOTS = [
  { key: 'young', label: 'ใบยอด / ใบอ่อน', required: true },
  { key: 'mature', label: 'ใบมาตรฐาน (ใบแรกที่คลี่เต็มที่ นับจากยอด)', required: true },
  { key: 'old', label: 'ใบล่าง / ใบแก่', required: true },
  { key: 'tree', label: 'ทั้งต้น / ลำต้น / หัว (ไม่บังคับ)', required: false },
];

export const CASSAVA_NUTRIENTS = [
  { code: 'N', name: 'ไนโตรเจน (N)' },
  { code: 'P', name: 'ฟอสฟอรัส (P)' },
  { code: 'K', name: 'โพแทสเซียม (K)' },
  { code: 'Mg', name: 'แมกนีเซียม (Mg)' },
  { code: 'Ca', name: 'แคลเซียม (Ca)' },
  { code: 'Zn', name: 'สังกะสี (Zn)' },
  { code: 'B', name: 'โบรอน (B)' },
  { code: 'Fe', name: 'เหล็ก (Fe)' },
];

const STATUS_LEVELS = ['ปกติ', 'เสี่ยงขาด', 'ขาดเล็กน้อย', 'ขาดปานกลาง', 'ขาดรุนแรง', 'ต้องตรวจเพิ่ม'];
const LIKELIHOODS = ['สูง', 'ปานกลาง', 'ต่ำ'];

function buildProductSection() {
  const products = getEnabledCassavaProducts();
  if (!products.length) {
    return 'ผลิตภัณฑ์สมาร์ทกรีน: ยังไม่มีรายการสำหรับมันสำปะหลัง ให้ตอบ "smart_green_products": []';
  }
  const lines = products.map(p =>
    `  * ${p.name}: ${p.description} (ช่วยเรื่อง: ${p.fixes.join(', ')})${p.usage ? ` — อัตราใช้: ${p.usage}` : ''}`
  );
  return `ผลิตภัณฑ์สมาร์ทกรีน (SMART GREEN) ที่อนุญาตให้แนะนำเสริม:
${lines.join('\n')}
กติกา: แนะนำได้เฉพาะชื่อในรายการนี้ 0-3 รายการ ที่ตรงกับปัญหาที่พบจริงเท่านั้น ห้ามคิดชื่อหรือสูตรใหม่
ห้ามระบุอัตราใช้เองหากรายการไม่ได้ให้อัตราไว้ ให้เขียนว่า "ใช้ตามอัตราบนฉลาก" ผลิตภัณฑ์เหล่านี้เป็นตัวเสริม ไม่ใช่ตัวแทนแผนปุ๋ยหลัก
หากต้นสมบูรณ์ดีหรือไม่มีรายการที่ตรงปัญหา ให้ตอบ []`;
}

export function buildCassavaPrompt(payload) {
  const hasTree = Boolean(payload.images && payload.images.tree);
  const observed = Array.isArray(payload.observedSymptoms) && payload.observedSymptoms.length
    ? payload.observedSymptoms.join(', ')
    : '-';

  return `
คุณคือระบบ "Vision Ai วิเคราะห์ใบมันสำปะหลัง" ผู้เชี่ยวชาญด้านธาตุอาหารพืช โรคพืช และแมลงศัตรูมันสำปะหลัง (Manihot esculenta) ในประเทศไทย

ขั้นตอนที่ 1 — ตรวจสอบความถูกต้องของภาพ (บังคับ):
- ภาพต้องเป็นใบ/ยอด/ลำต้น/ทั้งต้น/หัวของ "มันสำปะหลัง" (ใบเดี่ยวแบบนิ้วมือ แยกเป็นแฉก 3-9 แฉก ก้านใบยาวมักมีสีแดงหรือเขียว)
- ดูจากภาพจริงเท่านั้น ห้ามใช้ข้อมูลแปลงหรืออาการที่ผู้ใช้กรอกมาแทนภาพ ข้อมูลแปลงใช้ประกอบการวินิจฉัยหลังจากภาพผ่านการตรวจแล้วเท่านั้น
- ให้บรรยายสิ่งที่เห็นจริงในแต่ละภาพลงใน "image_checks" ก่อนเสมอ (เช่น "ใบมันสำปะหลังมีลายด่างเหลืองเขียว", "ภาพสีเขียวทึบไม่มีรายละเอียด")
- ภาพถ่ายจริงจากแปลงที่เห็นใบหรือต้นมันเพียงบางส่วน หรือมีพื้นหลังรก ถือว่าผ่าน
- หากภาพใดไม่ใช่มันสำปะหลัง (เช่น คน สัตว์ สิ่งของ เอกสาร หน้าจอ ภาพวาด/ภาพกราฟิก ภาพสีพื้นทึบ ใบพืชชนิดอื่น เช่น ละหุ่ง ยางพารา อ้อย ข้าวโพด) หรือมืด/เบลอจนวิเคราะห์ไม่ได้ ให้ตอบ
  "is_cassava": false และ "invalid_image_reason" ระบุอย่างสุภาพว่าภาพตำแหน่งใดไม่ถูกต้อง พร้อมแนะนำให้ถ่ายใหม่ (ฟิลด์อื่นใส่ค่าว่างได้)
- หากถูกต้องให้ตอบ "is_cassava": true, "invalid_image_reason": ""

ขั้นตอนที่ 2 — ภาพที่ได้รับ (เรียงตามลำดับ):
1) ใบยอด / ใบอ่อน — ดูธาตุที่เคลื่อนย้ายยาก: Zn, B, Fe, Ca และโรคใบด่าง (CMD) เพลี้ยแป้ง (ยอดหงิกเป็นพุ่ม) ไรแดง
2) ใบมาตรฐาน — ใบแรกที่คลี่เต็มที่นับจากยอด (ตำแหน่งมาตรฐานสำหรับเก็บใบวิเคราะห์ ต้นอายุ 3-4 เดือน) — ภาพตัวแทนสถานะธาตุอาหารของต้น
3) ใบล่าง / ใบแก่ — ดูธาตุที่เคลื่อนย้ายได้: N, P, K, Mg และโรคใบจุดสีน้ำตาล ใบไหม้
${hasTree ? '4) ทั้งต้น / ลำต้น / หัว — ใช้ดูทรงต้น ความสูง การแตกกิ่ง ยอดหงิก ลำต้นเน่า โรคหัวเน่า และแมลงที่ลำต้น' : '(ไม่มีภาพทั้งต้น ให้ระบุ tree_analysis ว่า "ไม่มีภาพ")'}

ความรู้อ้างอิงอาการขาดธาตุของมันสำปะหลัง:
- N: ใบซีดเหลืองอ่อนสม่ำเสมอทั้งใบ เริ่มจากใบล่าง ต้นเล็ก แคระแกร็น (พบบ่อยในดินทราย)
- P: ต้นเล็ก ลำต้นเรียวผอม ใบล่างเหลืองซีดแล้วร่วง ใบเล็กแคบ — มักต้องยืนยันด้วยผลวิเคราะห์
- K: (พบบ่อยในดินทรายที่ปลูกมันซ้ำ) ใบล่างขอบใบและปลายแฉกเหลืองแล้วไหม้เป็นสีน้ำตาล ใบม้วนงอขึ้น ปล้องสั้น ลำต้นซิกแซก หัวเล็ก แป้งต่ำ
- Mg: ใบล่างเหลืองระหว่างเส้นใบ เส้นใบยังเขียว ขอบใบอาจเป็นสีส้มน้ำตาล
- Ca: ใบยอดเล็ก ปลายใบไหม้ ตายอดเสีย รากสั้น
- Zn: (พบบ่อยในดินด่าง/ดินร่วนปนปูน และท่อนพันธุ์ขาดสังกะสี) ใบยอดเล็ก แฉกใบแคบ ซีดเหลืองขาวระหว่างเส้นใบ มีจุดขาวที่ฐานใบ ใบชี้กางออกจากลำต้น
- B: ยอดชะงัก ใบอ่อนเล็กบิดเบี้ยว ข้อปล้องสั้น ก้านใบสั้น มียางไหลที่ลำต้นหรือก้านใบ
- Fe: ใบยอดซีดเหลืองขาวทั้งใบแต่เส้นใบยังเขียว (ดินด่าง/น้ำขัง)

ความรู้อ้างอิงโรคและแมลงสำคัญของมันสำปะหลัง:
- โรคใบด่างมันสำปะหลัง (Cassava mosaic disease, SLCMV): ใบยอดด่างเหลืองสลับเขียว ใบหงิกเสียรูป ขอบใบบิด ต้นแคระแกร็น หัวเล็ก — ร้ายแรง ระบาดในไทยตั้งแต่ปี 2561 ติดไปกับท่อนพันธุ์และแมลงหวี่ขาว ต้องแจ้งเร่งด่วน ห้ามนำท่อนพันธุ์ไปปลูกต่อ
- เพลี้ยแป้ง (โดยเฉพาะเพลี้ยแป้งสีชมพู): ยอดหงิกย่นเป็นพุ่ม (bunchy top) ข้อปล้องสั้น มีปุยแป้งสีขาวที่ยอด/ใต้ใบ ระบาดหนักช่วงแล้ง
- ไรแดง: ใบล่าง-กลางมีจุดประสีเหลืองซีด ใบเป็นสีน้ำตาลแดง ร่วง ระบาดช่วงแล้ง
- แมลงหวี่ขาว: ตัวเต็มวัยสีขาวเล็กใต้ใบ ใบเหลือง มีราดำ เป็นพาหะโรคใบด่าง
- โรคใบจุดสีน้ำตาล (Cercosporidium): จุดแผลเหลี่ยมสีน้ำตาลขอบเข้มบนใบล่าง ใบเหลืองร่วง
- โรคใบไหม้ (Cassava bacterial blight, Xanthomonas): จุดแผลเหลี่ยมฉ่ำน้ำ ใบไหม้เหี่ยว ยอดเหี่ยวตาย มียางไหลที่ลำต้น ระบาดช่วงฝน
- โรคแอนแทรกโนส: แผลสีน้ำตาลบนใบและลำต้น ลำต้นมีแผลยุบ ยอดแห้ง
- โรคหัวเน่า/โคนเน่า: ต้นเหี่ยวเฉา ใบเหลืองร่วง โคนต้นและหัวเน่ามีกลิ่น (พบในแปลงน้ำขัง)
- ปลวกกินท่อนพันธุ์/ลำต้น, หนอนกินใบ
- ความเครียดจากภาวะแล้ง: ใบล่างเหลืองร่วง ใบลู่ ต้นชะงัก — ต้องแยกจากไรแดงและการขาดธาตุ (แล้งมักเป็นทั้งแปลงพร้อมกัน)

${buildProductSection()}

ข้อมูลแปลงจากผู้ใช้:
- ชื่อเกษตรกร / แปลง: ${payload.customerName || '-'}
- ผู้ตรวจ / ผู้ดูแล: ${payload.inspectorName || '-'}
- อายุมันสำปะหลัง: ${payload.plantAge || '-'} เดือน
- ฤดูปลูก: ${payload.plantingSeason || '-'}
- พันธุ์: ${payload.variety || '-'}
- จังหวัด: ${payload.province || '-'}
- พิกัดแปลง (GPS): ${payload.coordinates || '-'}
- ชนิดดิน: ${payload.soilType || '-'}
- สภาพน้ำ/ความชื้น: ${payload.waterStatus || '-'}
- ค่า pH ดิน: ${payload.soilPh || 'ไม่ได้วัด'}
- ผลผลิตหัวสดรอบก่อน: ${payload.yieldPerRai || '-'} ตัน/ไร่
- ปุ๋ยที่ใส่ล่าสุด: ${payload.lastFertilizer || '-'}
- อาการที่ผู้ใช้สังเกตเห็นในแปลง: ${observed}
- หมายเหตุเพิ่มเติม: ${payload.notes || '-'}

กติกาการวิเคราะห์:
1. ห้ามฟันธงจากภาพอย่างเดียว ใช้ความต่างระหว่างใบยอด / ใบมาตรฐาน / ใบล่าง และข้อมูลแปลงประกอบ
2. แยกอาการขาดธาตุ ออกจากโรค (โดยเฉพาะโรคใบด่าง) แมลง ความเครียดน้ำ และอาการจากสารเคมีให้ชัดเจน
3. หากไม่มั่นใจ ให้ระบุสถานะ "ต้องตรวจเพิ่ม" และแนะนำวิธีตรวจ (เก็บใบมาตรฐานส่งวิเคราะห์ห้องแล็บ / ตรวจดิน)
4. ต้องประเมินธาตุครบทั้ง 8 ตัว: N, P, K, Mg, Ca, Zn, B, Fe โดยสถานะเลือกจาก: ${STATUS_LEVELS.join(' | ')}
5. ภาษาไทย อ่านง่าย ใช้ได้จริงสำหรับเกษตรกร
6. ตอบเป็น JSON เท่านั้น

แนวทางคำแนะนำปุ๋ย (ต่อไร่ ปรับตามชนิดดิน อายุ และผลวิเคราะห์ดิน):
- ปุ๋ยเคมีหลัก: สูตร 15-7-18 หรือ 16-8-14 (หรือ 15-15-15 เสริม 0-0-60) อัตรา 50-100 กก./ไร่ ใส่ครั้งเดียวเมื่อมันอายุ 1-2 เดือน หรือแบ่ง 2 ครั้ง (1 และ 3 เดือน) ขณะดินมีความชื้น
- ดินทราย/ปลูกมันซ้ำหลายรอบ: เน้นโพแทสเซียม เพิ่ม 0-0-60 10-25 กก./ไร่ และใส่ปุ๋ยอินทรีย์/ปุ๋ยคอก 500-1,000 กก./ไร่
- สังกะสี: แช่ท่อนพันธุ์ในสารละลายซิงค์ซัลเฟต 2-4% นาน 15 นาทีก่อนปลูก หรือพ่นซิงค์ซัลเฟต 1-2% ทางใบ 2-3 ครั้งช่วงอายุ 1-3 เดือน
- แมกนีเซียม: กีเซอร์ไรท์ หรือโดโลไมท์ในดินกรด
- วิธีใส่: ฝังปุ๋ยข้างต้นห่างโคน 10-15 ซม. แล้วกลบ หรือโรยข้างแถว กำจัดวัชพืชก่อนใส่ ห้ามใส่ขณะดินแห้ง
- หลังมันอายุ 4 เดือน การใส่ปุ๋ยทางดินได้ผลน้อย ให้เน้นแก้ปัญหาโรค/แมลงและพ่นธาตุรองทางใบ
- โรคใบด่าง: ถอนต้นที่เป็นโรคทำลายทันที ใช้ท่อนพันธุ์สะอาดจากแปลงปลอดโรค และพันธุ์ต้านทาน ควบคุมแมลงหวี่ขาว

ให้ตอบเป็น JSON โครงสร้างนี้เท่านั้น:
{
  "image_checks": [
    { "slot": "young", "is_cassava": true, "seen": "สิ่งที่เห็นจริงในภาพนี้ 1 ประโยค" }
  ],
  "is_cassava": true,
  "invalid_image_reason": "",
  "young_leaf_analysis": "สรุปอาการใบยอด/ใบอ่อน 1-2 ประโยค",
  "mature_leaf_analysis": "สรุปอาการใบมาตรฐาน 1-2 ประโยค",
  "old_leaf_analysis": "สรุปอาการใบล่าง 1-2 ประโยค",
  "tree_analysis": "สรุปจากภาพทั้งต้น/ลำต้น/หัว หรือ 'ไม่มีภาพ'",
  "health_score": 75,
  "primary_issue": "ปัญหาหลักสั้นๆ เช่น ขาดโพแทสเซียม (K) ระดับปานกลาง",
  "overall_summary": "สรุปภาพรวม 2-4 ประโยค ข้อสันนิษฐานและเหตุผล",
  "nutrient_status": [
    { "code": "N", "status": "ปกติ", "evidence": "เหตุผล/อาการที่เห็นสั้นๆ" }
  ],
  "diseases": [
    { "name": "ชื่อโรคหรือแมลง", "type": "โรค หรือ แมลง หรือ ความเครียด", "likelihood": "สูง|ปานกลาง|ต่ำ", "evidence": "อาการที่เห็น", "management": "วิธีจัดการที่ทำได้จริง" }
  ],
  "fertilizer_plan": [
    { "nutrient": "K", "product": "15-7-18", "rate": "50 กก./ไร่", "timing": "มันอายุ 1-2 เดือน ขณะดินชื้น", "method": "ฝังข้างต้นห่างโคน 10-15 ซม. แล้วกลบ" }
  ],
  "smart_green_products": [
    { "name": "ชื่อผลิตภัณฑ์จากรายการที่อนุญาตเท่านั้น", "reason": "ช่วยแก้ปัญหาที่พบอย่างไร 1 ประโยค", "usage": "วิธีใช้/อัตรา (ถ้าไม่มีข้อมูลให้เขียน 'ใช้ตามอัตราบนฉลาก')" }
  ],
  "urgent_actions": ["สิ่งที่ควรทำทันทีภายใน 1-2 สัปดาห์"],
  "recommended_next_step": "ขั้นตอนถัดไป เช่น เก็บใบมาตรฐานส่งวิเคราะห์ ตรวจซ้ำใน 1 เดือน",
  "confidence": "สูง|ปานกลาง|ต่ำ"
}
หมายเหตุ: "diseases" ให้ใส่เฉพาะที่มีหลักฐานจากภาพหรือข้อมูลแปลง หากไม่พบให้เป็น [] ; "health_score" 0-100 (100 = สมบูรณ์มาก)
`.trim();
}

function asString(v, fallback = '-') {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function pickEnum(value, allowed, fallback) {
  const s = asString(value, '');
  return allowed.find(a => s === a) || allowed.find(a => s.includes(a)) || fallback;
}

/** Normalize the AI reply into a predictable shape for the frontend. */
export function normalizeCassavaResult(parsed, payload) {
  const p = parsed && typeof parsed === 'object' ? parsed : {};

  const nutrientMap = new Map();
  for (const item of Array.isArray(p.nutrient_status) ? p.nutrient_status : []) {
    if (!item || typeof item !== 'object') continue;
    const code = asString(item.code || item.nutrient, '').replace(/[^A-Za-z]/g, '');
    const match = CASSAVA_NUTRIENTS.find(n => n.code.toLowerCase() === code.toLowerCase());
    if (match) nutrientMap.set(match.code, item);
  }
  const nutrientStatus = CASSAVA_NUTRIENTS.map(n => {
    const item = nutrientMap.get(n.code) || {};
    return {
      code: n.code,
      name: n.name,
      status: pickEnum(item.status, STATUS_LEVELS, 'ต้องตรวจเพิ่ม'),
      evidence: asString(item.evidence, 'ไม่พบข้อมูลจากภาพ'),
    };
  });

  const diseases = (Array.isArray(p.diseases) ? p.diseases : [])
    .filter(d => d && typeof d === 'object' && d.name)
    .map(d => ({
      name: asString(d.name),
      type: asString(d.type, 'โรค'),
      likelihood: pickEnum(d.likelihood, LIKELIHOODS, 'ต่ำ'),
      evidence: asString(d.evidence),
      management: asString(d.management),
    }));

  const fertilizerPlan = (Array.isArray(p.fertilizer_plan) ? p.fertilizer_plan : [])
    .filter(f => f && typeof f === 'object' && (f.product || f.nutrient))
    .map(f => ({
      nutrient: asString(f.nutrient, ''),
      product: asString(f.product),
      rate: asString(f.rate),
      timing: asString(f.timing),
      method: asString(f.method),
    }));

  const seenProducts = new Set();
  const smartGreenProducts = [];
  for (const item of Array.isArray(p.smart_green_products) ? p.smart_green_products : []) {
    if (!item || typeof item !== 'object') continue;
    const product = matchCassavaProduct(normalizeSmartGreenProductText(asString(item.name, '')));
    if (!product || seenProducts.has(product.key)) continue; // drop anything not on the approved list
    seenProducts.add(product.key);
    smartGreenProducts.push({
      key: product.key,
      name: product.name,
      image: product.image,
      reason: normalizeSmartGreenProductText(asString(item.reason, product.description)),
      // Only show rates the technical team approved in cassavaProducts.js — never AI-invented ones
      usage: product.usage || 'ใช้ตามอัตราบนฉลาก',
    });
  }

  let score = parseInt(p.health_score, 10);
  if (Number.isNaN(score)) score = 60;
  score = Math.max(0, Math.min(100, score));

  const urgent = Array.isArray(p.urgent_actions)
    ? p.urgent_actions.map(a => asString(a, '')).filter(Boolean)
    : (p.urgent_actions ? [asString(p.urgent_actions)] : []);

  return {
    success: true,
    crop: 'cassava',
    customerName: payload.customerName || '',
    inspectorName: payload.inspectorName || '',
    plantAge: payload.plantAge || '',
    plantingSeason: payload.plantingSeason || '',
    variety: payload.variety || '',
    province: payload.province || '',
    coordinates: payload.coordinates || '',
    soilType: payload.soilType || '',
    waterStatus: payload.waterStatus || '',
    soilPh: payload.soilPh || 'ไม่ได้วัด',
    yieldPerRai: payload.yieldPerRai || '',
    lastFertilizer: payload.lastFertilizer || '',
    observedSymptoms: Array.isArray(payload.observedSymptoms) ? payload.observedSymptoms : [],
    youngLeafAnalysis: asString(p.young_leaf_analysis),
    matureLeafAnalysis: asString(p.mature_leaf_analysis),
    oldLeafAnalysis: asString(p.old_leaf_analysis),
    treeAnalysis: asString(p.tree_analysis, 'ไม่มีภาพ'),
    healthScore: score,
    primaryIssue: asString(p.primary_issue, 'ต้องตรวจเพิ่ม'),
    overallSummary: asString(p.overall_summary),
    nutrientStatus,
    diseases,
    fertilizerPlan,
    smartGreenProducts,
    urgentActions: urgent,
    recommendedNextStep: asString(p.recommended_next_step),
    confidence: pickEnum(p.confidence, LIKELIHOODS, 'ปานกลาง'),
  };
}

/** Returns an error message (Thai) when the payload is invalid, otherwise null. */
export function validateCassavaPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.images) {
    return 'ไม่พบข้อมูลรูปภาพ';
  }
  const missing = CASSAVA_IMAGE_SLOTS
    .filter(s => s.required && !(payload.images[s.key] && payload.images[s.key].base64))
    .map(s => s.label);
  if (missing.length) {
    return `กรุณาอัปโหลดรูปให้ครบ: ${missing.join(', ')}`;
  }
  return null;
}

/** Labels of submitted image slots the model marked as not-cassava in image_checks. */
export function failedImageChecks(parsed, payload) {
  const checks = parsed && Array.isArray(parsed.image_checks) ? parsed.image_checks : [];
  return CASSAVA_IMAGE_SLOTS
    .filter((slot) => payload.images && payload.images[slot.key])
    .filter((slot) => checks.some((c) => c && c.slot === slot.key && (c.is_cassava === false || c.is_cassava === 'false')))
    .map((slot) => slot.label);
}

const PRECHECK_PROMPT = `
ตรวจภาพแต่ละภาพด้านบนอย่างเข้มงวด โดยดูจากภาพเท่านั้น (ไม่มีข้อมูลอื่นประกอบ)
ภาพผ่านได้เมื่อเป็น "ภาพถ่ายจริง" ที่เห็นส่วนของต้นมันสำปะหลังชัดเจน: ใบ ยอด ลำต้น ทั้งต้น หรือหัว
(ใบมันสำปะหลังเป็นใบเดี่ยวแบบนิ้วมือ แยกเป็นแฉก 3-9 แฉก; ภาพแปลงจริงที่มีพื้นหลังรกหรือเห็นต้นมันเพียงบางส่วนถือว่าผ่าน)
ภาพไม่ผ่าน: ภาพวาด ภาพกราฟิก ลวดลาย/รูปทรงเรขาคณิต ภาพสีพื้น ภาพหน้าจอ เอกสาร คน สัตว์ สิ่งของ
พืชชนิดอื่น (ละหุ่ง ยางพารา อ้อย ข้าวโพด ฯลฯ) หรือภาพมืด/เบลอจนมองไม่เห็นใบหรือต้น
ตอบ JSON เท่านั้น: {"image_checks":[{"slot":"young","is_cassava":true,"seen":"สิ่งที่เห็นจริงในภาพ 1 ประโยค"}]}
`.trim();

function imageParts(payload) {
  const parts = [];
  for (const slot of CASSAVA_IMAGE_SLOTS) {
    const img = payload.images[slot.key];
    if (img && img.base64) {
      parts.push({ text: `ภาพ slot="${slot.key}": ${slot.label}` });
      parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } });
    }
  }
  return parts;
}

/**
 * Step 1: judge the photos alone, without the farmer's text. With symptoms in the prompt the
 * model tends to "see" them in any image, so this check must not see the context.
 * Returns labels of failed slots; fails open (returns []) if the check itself errors or times out.
 */
export async function precheckImages(payload, traceId) {
  try {
    const parsed = await generateJsonWithFallback([...imageParts(payload), { text: PRECHECK_PROMPT }],
      `${traceId}-precheck`, { timeoutMs: 12000, totalBudgetMs: 18000 });
    const failed = failedImageChecks(parsed, payload);
    if (failed.length) console.warn(`[${traceId}] precheck rejected:`, JSON.stringify(parsed.image_checks));
    return failed;
  } catch (err) {
    console.warn(`[${traceId}] precheck skipped:`, err.message);
    return [];
  }
}

export async function analyzeCassava(payload, traceId) {
  const rejected = await precheckImages(payload, traceId);
  if (rejected.length) {
    const err = new Error(`ภาพตำแหน่ง ${rejected.join(', ')} ไม่ใช่ภาพถ่ายมันสำปะหลังที่วิเคราะห์ได้ กรุณาถ่ายภาพใบมันสำปะหลังจริงใหม่อีกครั้ง`);
    err.isInvalidImage = true;
    throw err;
  }

  // Images go first (each labelled with its slot key) so the model looks at the photos
  // before it reads the farmer's context, which otherwise invites made-up findings.
  const contents = [...imageParts(payload), { text: buildCassavaPrompt(payload) }];

  const parsed = await generateJsonWithFallback(contents, traceId, { timeoutMs: 22000, totalBudgetMs: 38000 });

  const failed = failedImageChecks(parsed, payload);
  if (parsed && (parsed.is_cassava === false || failed.length)) {
    const err = new Error(
      parsed.invalid_image_reason ||
      (failed.length ? `ภาพตำแหน่ง ${failed.join(', ')} ไม่ใช่ภาพมันสำปะหลังที่วิเคราะห์ได้ กรุณาถ่ายภาพใหม่อีกครั้ง` : '') ||
      'ระบบตรวจพบว่าภาพที่อัปโหลดไม่ใช่มันสำปะหลัง กรุณาถ่ายภาพใบมันสำปะหลังใหม่อีกครั้ง'
    );
    err.isInvalidImage = true;
    throw err;
  }

  return normalizeCassavaResult(parsed, payload);
}

/**
 * Framework-agnostic request handler: takes a parsed payload, returns { status, body }.
 * Used by the Vercel function api/analyze.js (also run by the local server.js).
 */
export async function handleCassavaRequest(payload) {
  const traceId = `CASSAVA-${Date.now()}`;
  const invalid = validateCassavaPayload(payload);
  if (invalid) return { status: 400, body: { error: invalid } };

  try {
    const result = await analyzeCassava(payload, traceId);
    result.traceId = traceId;
    console.log(`[${traceId}] SUCCESS | ${result.primaryIssue} | score ${result.healthScore}`);
    return { status: 200, body: result };
  } catch (err) {
    if (err.isInvalidImage) {
      console.warn(`[${traceId}] REJECTED image:`, err.message);
      return { status: 400, body: { success: false, isInvalidImage: true, error: err.message } };
    }
    console.error(`[${traceId}] FAILED:`, err);
    const msg = String(err?.message || err);
    if (isBusyError(err) || /หมดเวลา/.test(msg)) {
      return { status: 503, body: { error: BUSY_MESSAGE_TH } };
    }
    return { status: 500, body: { error: `เกิดข้อผิดพลาดในการวิเคราะห์: ${err?.message || err}` } };
  }
}
