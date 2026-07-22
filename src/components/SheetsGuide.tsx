/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GOOGLE_SHEETS_STEPS } from '../data';
import { Copy, Check, Info, FileSpreadsheet, Keyboard, MousePointerClick } from 'lucide-react';

export default function SheetsGuide() {
  const [activeTab, setActiveTab] = useState<'interactive' | 'list'>('interactive');
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: string } | null>({ r: 10, c: 'B' });
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  // Simulated Google Sheets cells data
  const refTable = [
    { a: 'GPS-STN01', b: '645230.125', c: '1524310.458', d: '84.125' },
    { a: 'GPS-STN02', b: '645512.980', c: '1524675.210', d: '86.450' },
    { a: 'BM-TEM03', b: '644910.340', c: '1523990.150', d: '81.890' },
  ];

  const handleCopy = (formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedFormula(formula);
    setTimeout(() => {
      setCopiedFormula(null);
    }, 2000);
  };

  // Cell formula documentation mapping
  const getCellDetail = (r: number, c: string) => {
    if (r === 10) {
      if (c === 'A') {
        return {
          title: 'A10: ชื่อหมุดสถานีฐาน (Dropdown Menu)',
          desc: 'เซลล์สำหรับเลือกจุด Base โดยสร้าง Dropdown ดึงข้อมูลมาจากช่วง A3:A5',
          setup: 'ไปที่ ข้อมูล > การตรวจสอบความถูกต้องของข้อมูล > เพิ่มกฎ > เลือกเกณฑ์ "ดร็อปดาวน์ (จากช่วง)" > พิมพ์ตัวเลือกช่วงแผ่นงานเป็น =$A$3:$A$5 แล้วแตะ "เสร็จสิ้น"',
          formula: null,
        };
      }
      if (c === 'B') {
        const formula = '=XLOOKUP(A10, $A$3:$A$5, $B$3:$B$5, "ไม่พบ")';
        return {
          title: 'B10: ค่าพิกัด Easting (E)',
          desc: 'ดึงค่าพิกัด Easting อัตโนมัติจากตารางด้านบนอ้างอิงตามรายชื่อในตารางช่อง A10',
          setup: 'พิมพ์สูตรนี้ลงในช่อง B10 เพื่อใช้มองหาจุดหลักและดึงพิกัดทางทิศตะวันออก (E) ทศนิยม 3 ตำแหน่ง',
          formula,
        };
      }
      if (c === 'C') {
        const formula = '=XLOOKUP(A10, $A$3:$A$5, $C$3:$C$5, "ไม่พบ")';
        return {
          title: 'C10: ค่าพิกัด Northing (N)',
          desc: 'ดึงค่าพิกัด Northing อัตโนมัติจากตารางช่อง C3:C5 อ้างอิงตามชื่อแผ่นงานช่อง A10',
          setup: 'ใส่สูตรลงใน C10 ค้นหากลุ่มขอบเขตแนวตั้งเหนือ (N) ได้ถูกต้องทันที',
          formula,
        };
      }
      if (c === 'D') {
        const formula = '=XLOOKUP(A10, $A$3:$A$5, $D$3:$D$5, "ไม่พบ")';
        return {
          title: 'D10: ค่าพิกัดระดับทะเลปานกลาง (Original MSL)',
          desc: 'ดึงระดับความสูง MSL ดั้งเดิมของสถานีฐานก่อนปรับปรุงเสาอากาศ',
          setup: 'สูตรค้นคืนค่าระดับทะเลปานกลาง (MSL) ในช่อง D10 เพื่อปูทางสำหรับคำนวณเสาสูงถัดไป',
          formula,
        };
      }
      if (c === 'E') {
        return {
          title: 'E10: ค่าความสูงเสาอากาศ (Antenna Height)',
          desc: 'ช่องสำหรับพิมพ์ "ตัวเลขความสูงเสารองรับเครื่องรับสัญญาณ" ด้วยตัวคุณเอง เช่น 1.500 เมตร หรือ 2.000 เมตร',
          setup: 'กรอกตัวเลขด้วยตนเอง (Manual Input) คอลัมน์นี้ไม่มีสูตร แนะนำให้จัดรูปแบบรูปแบบตัวเลข (Format Number) ทศนิยม 3 ตำแหน่ง',
          formula: null,
        };
      }
      if (c === 'F') {
        const formula = '="MODE BASE " & TEXT(B10, "0.000") & " " & TEXT(C10, "0.000") & " " & TEXT(D10+E10, "0.000")';
        return {
          title: 'F10: คำสั่ง MODE BASE ปลายทาง (Command Output)',
          desc: 'ประสานข้อความและบวกความสูงเสาอากาศเข้ากับ MSL จนเกิดบรรทัดคำสั่งสำเร็จรูป พร้อมนำไปใช้ใน Terminal ภาคสนาม!',
          setup: 'พิมพ์สูตรนี้ลงใน F10 ตัวแปร D10+E10 จะช่วยทดระดับความสูงรวม พร้อมคลุมด้วยครอบ TEXT เพื่อบังคับทศนิยมสามหลัก',
          formula,
        };
      }
    }
    return null;
  };

  const selectedCellDetail = selectedCell ? getCellDetail(selectedCell.r, selectedCell.c) : null;

  return (
    <div id="sheets-guide" className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg p-6">
      <div className="border-b border-white/10 pb-4 mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-405 text-emerald-400 animate-pulse" />
          คู่มือจัดเตรียมข้อมูลใน Google Sheets บน iPad
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          แนะนำขั้นตอนการใช้สูตร XLOOKUP และสูตรประสานข้อความ เพื่อสร้างเครื่องมือคำนวณรังวัดถาวรบน iPad ของคุณเอง
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-black/45 p-1 rounded-xl border border-white/5 mb-6 max-w-sm">
        <button
          onClick={() => setActiveTab('interactive')}
          type="button"
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'interactive'
              ? 'bg-[#1C1D24] text-amber-500 border border-white/5 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ตารางจำลองสูตร (คลิกดูเซลล์)
        </button>
        <button
          onClick={() => setActiveTab('list')}
          type="button"
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'bg-[#1C1D24] text-amber-500 border border-white/5 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ขั้นตอนแบบรายข้อ
        </button>
      </div>

      {activeTab === 'interactive' ? (
        <div className="space-y-6">
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-start gap-3">
            <MousePointerClick className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-300 leading-relaxed">
              <span className="font-bold text-emerald-400">โปรดแตะเลือกเซลล์ในแถวที่ 10 (A10 ถึง F10)</span> เพื่อศึกษาโครงสร้างการเขียนสูตรลัด, ดูรายละเอียดคำอธิบายแบบไทย และรับซอร์สโค้ดสูตรลัดไปติดตั้งในไฟล์ Google Sheets บนเครื่อง iPad ของคุณได้เลย!
            </div>
          </div>

          {/* Simulated Spreadsheet Grid */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-2.5 select-none">
            <div className="min-w-[700px] bg-[#16171D] rounded-lg border border-white/10 overflow-hidden">
              {/* Columns headers */}
              <div className="grid grid-cols-[50px_repeat(6,1fr)] bg-[#121216] border-b border-white/10 text-center text-[10px] font-bold text-slate-350">
                <div className="py-2.5 bg-black/40 border-r border-white/5 flex items-center justify-center">#</div>
                <div className="py-2.5 border-r border-white/5">A</div>
                <div className="py-2.5 border-r border-white/5">B</div>
                <div className="py-2.5 border-r border-white/5">C</div>
                <div className="py-2.5 border-r border-white/5">D</div>
                <div className="py-2.5 border-r border-white/5">E</div>
                <div className="py-2.5 text-emerald-400 bg-emerald-500/5 font-extrabold">F (สร้างคำสั่งพิกัดฐาน)</div>
              </div>

              {/* Title Section (Row 1-2) */}
              <div className="grid grid-cols-[50px_1fr] border-b border-white/5 text-xs">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center text-[10px] font-mono font-bold text-slate-500">1</div>
                <div className="p-2.5 font-bold text-white bg-black/10 col-span-6">ตารางพิกัดอ้างอิงสถานีฐาน (Reference Points Table)</div>
              </div>

              {/* Row 2: Headers */}
              <div className="grid grid-cols-[50px_repeat(6,1fr)] border-b border-white/10 text-[10px] font-bold text-slate-300 bg-[#121216]/20">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-slate-500">2</div>
                <div className="p-2 border-r border-white/5">ชื่อจุด (Name)</div>
                <div className="p-2 border-r border-white/5">Easting (E)</div>
                <div className="p-2 border-r border-white/5">Northing (N)</div>
                <div className="p-2 border-r border-white/5">MSL (height)</div>
                <div className="p-2 border-r border-white/5 col-span-2 text-slate-500 italic">คำแนะนำ / รายละเอียดเพิ่มเติม</div>
              </div>

              {/* Rows 3-5: Ref Data */}
              {refTable.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[50px_repeat(6,1fr)] border-b border-white/5 text-xs text-slate-300">
                  <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-[10px] text-slate-500">{idx + 3}</div>
                  <div className="p-2 border-r border-white/5 font-bold bg-[#1C1D24]/10">{row.a}</div>
                  <div className="p-2 border-r border-white/5 font-mono text-right text-slate-400">{row.b}</div>
                  <div className="p-2 border-r border-white/5 font-mono text-right text-slate-400">{row.c}</div>
                  <div className="p-2 border-r border-white/5 font-mono text-right text-slate-400">{row.d}</div>
                  <div className="p-2 text-slate-500 text-[11px] col-span-2 italic">ตารางพิกัดค่านิ่ง สำหรับใช้อิงสูตร</div>
                </div>
              ))}

              {/* Gap Row 6-8 */}
              <div className="grid grid-cols-[50px_1fr] border-b border-white/5 h-6 bg-black/5">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-[10px] text-slate-500">6</div>
              </div>
              <div className="grid grid-cols-[50px_1fr] border-b border-white/5 h-6 bg-black/5">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-[10px] text-slate-500">7</div>
              </div>

              {/* Row 9: Calculator Header */}
              <div className="grid grid-cols-[50px_repeat(6,1fr)] border-b border-white/10 text-[10px] font-bold text-white bg-amber-500/10">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-slate-500">9</div>
                <div className="p-2 border-r border-white/5">Base ที่เลือก</div>
                <div className="p-2 border-r border-white/5">E (m)</div>
                <div className="p-2 border-r border-white/5">N (m)</div>
                <div className="p-2 border-r border-white/5">Original MSL (m)</div>
                <div className="p-2 border-r border-white/5">เสาคร่อม (m)</div>
                <div className="p-2 bg-emerald-500/5 text-emerald-400">บรรทัดคำสั่ง Base Command (F10)</div>
              </div>

              {/* Row 10: Interactive Excel Column Formula UI */}
              <div className="grid grid-cols-[50px_repeat(6,1fr)] h-14 text-xs font-semibold text-slate-200 bg-[#1C1D24]">
                <div className="bg-[#121216]/50 border-r border-white/5 flex items-center justify-center font-mono text-[10px] text-slate-500">10</div>

                {/* Col A */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'A' })}
                  type="button"
                  className={`p-2 border-r border-white/5 text-left transition-colors cursor-pointer flex items-center justify-between group ${
                    selectedCell?.c === 'A' ? 'bg-amber-500/10 ring-2 ring-amber-500/45 z-10' : 'hover:bg-[#252731]'
                  }`}
                >
                  <span className="text-amber-500 font-bold underline">GPS-STN01 ▾</span>
                </button>

                {/* Col B */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'B' })}
                  type="button"
                  className={`p-2 border-r border-white/5 text-right font-mono transition-colors cursor-pointer flex flex-col justify-center ${
                    selectedCell?.c === 'B' ? 'bg-amber-500/10 ring-2 ring-amber-500/45 z-10' : 'hover:bg-[#252731]'
                  }`}
                >
                  <span className="text-slate-400 text-[9px] block font-sans">XLOOKUP</span>
                  645230.125
                </button>

                {/* Col C */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'C' })}
                  type="button"
                  className={`p-2 border-r border-white/5 text-right font-mono transition-colors cursor-pointer flex flex-col justify-center ${
                    selectedCell?.c === 'C' ? 'bg-amber-500/10 ring-2 ring-amber-500/45 z-10' : 'hover:bg-[#252731]'
                  }`}
                >
                  <span className="text-slate-400 text-[9px] block font-sans">XLOOKUP</span>
                  1524310.458
                </button>

                {/* Col D */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'D' })}
                  type="button"
                  className={`p-2 border-r border-white/5 text-right font-mono transition-colors cursor-pointer flex flex-col justify-center ${
                    selectedCell?.c === 'D' ? 'bg-amber-500/10 ring-2 ring-amber-500/45 z-10' : 'hover:bg-[#252731]'
                  }`}
                >
                  <span className="text-slate-400 text-[9px] block font-sans">XLOOKUP</span>
                  84.125
                </button>

                {/* Col E */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'E' })}
                  type="button"
                  className={`p-2 border-r border-white/5 text-right font-mono transition-colors cursor-pointer flex flex-col justify-center ${
                    selectedCell?.c === 'E' ? 'bg-amber-500/10 ring-2 ring-amber-500/45 z-10' : 'hover:bg-[#252731]'
                  }`}
                >
                  <span className="text-slate-500 text-[9px] block font-sans">กรอกเอง</span>
                  1.500
                </button>

                {/* Col F (Command Output) */}
                <button
                  onClick={() => setSelectedCell({ r: 10, c: 'F' })}
                  type="button"
                  className={`p-2 text-left font-mono text-[10px] break-all bg-emerald-500/5 transition-colors cursor-pointer flex flex-col justify-center ${
                    selectedCell?.c === 'F' ? 'bg-emerald-500/15 ring-2 ring-emerald-500/50 z-10 text-emerald-300 font-bold' : 'hover:bg-[#252731] text-emerald-400'
                  }`}
                >
                  <span className="text-emerald-500 text-[8px] font-sans font-bold">สูตรรวม</span>
                  MODE BASE 645230.125 1524310.458 85.625
                </button>
              </div>
            </div>
          </div>

          {/* Cell documentation detail panel */}
          {selectedCellDetail && (
            <div className="bg-black/35 border border-white/10 rounded-xl p-5 shadow-inner">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-black text-xs font-black">
                    {selectedCell?.c}
                  </span>
                  <h4 className="text-sm font-bold text-white">{selectedCellDetail.title}</h4>
                </div>
                {selectedCellDetail.formula && (
                  <button
                    onClick={() => handleCopy(selectedCellDetail.formula!)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 rounded-md border border-amber-500/15 transition-all cursor-pointer font-bold"
                  >
                    {copiedFormula === selectedCellDetail.formula ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        คัดลอกสูตรแล้ว!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-550" />
                        คัดลอกสูตรนี้
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">{selectedCellDetail.desc}</p>

              {selectedCellDetail.formula ? (
                <div className="mb-3">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">สูตรที่คุณต้องนำไปพิมพ์ใส่ช่อง:</span>
                  <code className="block bg-black text-amber-400 font-mono text-xs p-3.5 rounded-lg overflow-x-auto leading-relaxed border border-white/10 select-all">
                    {selectedCellDetail.formula}
                  </code>
                </div>
              ) : null}

              <div className="flex items-start gap-2 bg-white/5 p-3.5 rounded-lg text-xs text-slate-400 leading-relaxed border border-white/5">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-200 mr-1.5">ขั้นตอนการตั้งค่าบน iPad:</span>
                  {selectedCellDetail.setup}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {GOOGLE_SHEETS_STEPS.map((step) => (
            <div key={step.step} className="border border-white/10 rounded-xl p-5 bg-[#1C1D24] hover:bg-[#252731] transition-all">
              <div className="flex items-start justify-between gap-4 mb-2.5">
                <h3 className="text-sm font-bold text-white">{step.title}</h3>
                {step.formula && (
                  <button
                    onClick={() => handleCopy(step.formula!)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-md border border-emerald-500/15 transition-all cursor-pointer"
                  >
                    {copiedFormula === step.formula ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        คัดลอกแล้ว!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-450" />
                        ก็อปปี้สูตร
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-xs text-[#E2E8F0]/80 leading-relaxed mb-3.5">{step.description}</p>

              {step.formula && (
                <div className="mb-3.5">
                  <code className="block p-3 bg-black text-emerald-450 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto border border-white/5">
                    {step.formula}
                  </code>
                </div>
              )}

              {step.tips && (
                <div className="bg-white/5 border-l-3 border-emerald-500 py-2 px-3 rounded-r-lg text-xs text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300">แนะนำสำหรับ iPad:</span> {step.tips}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
