/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BasePoint } from './types';

export const INITIAL_BASE_POINTS: BasePoint[] = [
  {
    id: 'base-01',
    name: 'GPS-STN01',
    easting: 645230.125,
    northing: 1524310.458,
    msl: 84.125,
    zone: 47,
    description: 'หมุดอ้างอิงคอนกรีตถาวร บริเวณหน้าสำนักงานสนาม (Zone 47N)',
    isDefault: true,
  },
  {
    id: 'base-02',
    name: 'GPS-STN02',
    easting: 645512.980,
    northing: 1524675.210,
    msl: 86.450,
    zone: 47,
    description: 'หมุดพิกัดกลาง ทิศเหนือของโครงการ (Zone 47N)',
    isDefault: true,
  },
  {
    id: 'base-03',
    name: 'BM-TEM03',
    easting: 644910.340,
    northing: 1523990.150,
    msl: 81.890,
    zone: 48,
    description: 'หมุดไม้ชั่วคราว ฝั่งตะวันตกใกล้จุดส่งน้ำ (Zone 48N)',
    isDefault: true,
  },
  {
    id: 'base-04',
    name: 'RTS-04',
    easting: 645105.000,
    northing: 1524180.500,
    msl: 83.050,
    zone: 48,
    description: 'หมุดควบคุมงานดินฝั่งทางเข้าหลัก (Zone 48N)',
    isDefault: true,
  },
];

export interface SheetsGuideStep {
  step: number;
  title: string;
  description: string;
  formula?: string;
  imageAlt?: string;
  tips?: string;
}

export const GOOGLE_SHEETS_STEPS: SheetsGuideStep[] = [
  {
    step: 1,
    title: '1. สร้างตารางข้อมูลอ้างอิงพิกัด (Reference Table)',
    description: 'จัดระเบียบพิกัดในตารางมาตรฐาน โดยกำหนดคอลัมน์หลัก ได้แก่: ชื่อจุด (A), Easting (B), Northing (C), MSL (D) ตัวอย่างเช่น เซลล์ A2 ถึง D5',
    tips: 'ควรจัดแนวตัวเลขชิดขวา และกำหนดทศนิยม 3 ตำแหน่งเพื่อความถูกต้องของงานรังวัด'
  },
  {
    step: 2,
    title: '2. สร้าง Dropdown เมนูสำหรับเลือกชื่อ Base',
    description: 'เลือกเซลล์ที่คุณต้องการทำช่องเลือกจุด (เช่น เซลล์ A10) -> ไปที่เมนู "ข้อมูล" (Data) -> เลือก "การตรวจสอบความถูกต้องของข้อมูล" (Data Validation) -> คลิก "เพิ่มกฎ" (Add rule) -> เลือกเกณฑ์เป็น "ดร็อปดาวน์ (จากช่วง)" (Dropdown from a range) -> เลือกช่วงเป็นชื่อจุดด้างอิง (เช่น A2:A5) -> กดบันทึก (Done)',
    tips: 'ในเบราว์เซอร์ iPad ให้แตะที่เมนูคำสั่ง 3 จุด (...) ด้านขวาบน หรือ แถบเครื่องมือข้อมูลเพื่อตั้งค่า Data Validation'
  },
  {
    step: 3,
    title: '3. ดึงค่าพิกัดพิกัดอัตโนมัติด้วยสูตร XLOOKUP',
    description: 'เพื่อให้พิกัดเปลี่ยนตามชื่อที่เลือกใน Dropdown อัตโนมัติ ให้ใช้สูตรค้นหาข้อมูลในคอลัมน์ถัดขวาไป',
    formula: '=XLOOKUP(A10, $A$2:$A$5, $B$2:$D$5, "ไม่พบข้อมูล")',
    tips: 'สูตรเดียวด้านบนจะคืนค่าพิกัด Easting, Northing, และ MSL แบบ Array ออกมาทีเดียว 3 คอลัมน์ทันที! หรือแยกเขียนรายเซลล์ เช่น =XLOOKUP(A10, $A$2:$A$5, $B$2:$B$5) สำหรับ E'
  },
  {
    step: 4,
    title: '4. สูตรคำนวณสร้างคำสั่ง MODE BASE',
    description: 'สร้างบรรทัดคำสั่งที่รวม ข้อความเข้ากับพิกัดที่ดึงมา และบวกความสูงเสาอากาศ (เช่น อยู่ที่ช่อง E10)',
    formula: '="MODE BASE " & TEXT(B10, "0.000") & " " & TEXT(C10, "0.000") & " " & TEXT(D10+E10, "0.000")',
    tips: 'ฟังก์ชัน TEXT ช่วยบังคับให้พิกัดแสดงทศนิยม 3 ตำแหน่งเสมอ (เช่น 12.000 แทนที่จะลดรูปเป็น 12)'
  },
  {
    step: 5,
    title: '5. แจ้งเตือนเมื่อค่าความสูง MSL ผิดปกติ (Conditional Formatting)',
    description: 'ตั้งค่าสีเตือนเมื่อค่า MSL รวมที่คำนวณได้สูงเกินช่วงความสูงจริงของพื้นที่สำรวจ (เช่น น้อยกว่า 0m หรือ มากกว่า 1,000m) โดยเลือกช่องสูตร -> ไปที่ "การจัดรูปแบบตามเงื่อนไข" (Conditional formatting) -> ตั้งกฎว่า "น้อยกว่า 0" หรือ "มากกว่า 1000" ให้แสดงพื้นหลังสีแดงเตือน',
    tips: 'ช่วยป้องกันการกรอกความสูงเสาอากาศผิดพลาดได้อย่างดีเยี่ยม'
  }
];

export const IPAD_TIPS = [
  {
    title: 'เปิดแอปทำงานเคียงคู่กัน (Split View หรือ Slide Over)',
    desc: 'ลากไอคอนเบราว์เซอร์ Safari/Chrome ของแอปนี้และวางด้านข้างของหน้าจอเพื่อให้ทำงานคู่กับ Google Sheets หรือ Terminal ได้โดยไม่ต้องสลับเข้า-ออก'
  },
  {
    title: 'ติดตั้งเป็น Web App บนหน้าจอโฮม (Add to Home Screen)',
    desc: 'แตะปุ่ม "แชร์" (Share ไอคอนสี่เหลี่ยมลูกศรชี้ขึ้น) ใน Safari -> เลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen) พิกัดแอปนี้จะทำงานในหน้าต่างแบบเต็มหน้าจอ (Full Screen) เปรียบเสมือนแอปเนทีฟเครื่องนึง และมีประสิทธิภาพในการประมวลผลสูงขึ้น'
  },
  {
    title: 'การ Copy ข้อมูลอย่างรวดเร็ว',
    desc: 'เพียงเคาะ แตะ ปุ่ม "ก๊อปปี้คำสั่ง" บนแอปนี้ แผงระบบจะคัดลอกลงคลิปบอร์ดของ iPad ทันที จากนั้นคุณสามารถแตะที่ Terminal/แอปสำรวจ แล้วเลือก "วาง" (Paste) เพื่อประยุกต์ใช้ในการส่งคำสั่งควบคุม GNSS Base ได้ทันที'
  }
];
