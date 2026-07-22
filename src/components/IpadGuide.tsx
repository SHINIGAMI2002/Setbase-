/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { IPAD_TIPS } from '../data';
import { AppWindow, Smartphone, Copy, HelpCircle, MonitorSmartphone } from 'lucide-react';

export default function IpadGuide() {
  return (
    <div id="ipad-guide" className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg p-6">
      <div className="border-b border-white/10 pb-4 mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-amber-500" />
          คู่มือการใช้งานบน iPad ให้มีประสิทธิภาพสูงสุด
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          เรียนรู้วิธีตั้งค่าเว็บแอปพับและแอปสำรวจให้อยู่ร่วมกันบนเบราว์เซอร์และหน้าจอสัมผัสของ iPad โดยไม่ต้องอาศัยคอมพิวเตอร์
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {IPAD_TIPS.map((tip, idx) => {
          let Icon = HelpCircle;
          if (idx === 0) Icon = AppWindow;
          if (idx === 1) Icon = Smartphone;
          if (idx === 2) Icon = Copy;

          return (
            <div
              key={idx}
              className="flex flex-col bg-[#1C1D24] rounded-xl p-5 border border-white/10 hover:border-white/20 hover:shadow-lg transition-all"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 mb-4 self-start">
                <Icon className="w-5 h-5" />
              </div>

              <h3 className="text-xs font-bold text-white mb-2 leading-snug">
                {idx + 1}. {tip.title}
              </h3>
              <p className="text-xs text-slate-350 leading-relaxed mt-auto">
                {tip.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Safari Add to Home Screen step-by-step visual */}
      <div className="mt-8 bg-black/60 text-slate-100 rounded-xl p-6 relative overflow-hidden border border-white/10">
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-sm font-bold text-amber-400 mb-3.5 uppercase tracking-wider">
            วิธีแปลงเว็บนี้เป็นแอปพลิเคชันเต็มรูปแบบบน iPad (Add to Home Screen)
          </h3>
          
          <ol className="space-y-3.5 text-xs text-slate-350 list-decimal pl-4 leading-relaxed">
            <li>
              เปิดหน้านี้ในเบราว์เซอร์ <span className="font-bold text-white">Safari</span> บนเครื่อง iPad ของคุณ
            </li>
            <li>
              แตะสัญลักษณ์แชร์ <span className="inline-flex px-1.5 py-0.5 bg-white/5 border border-white/15 rounded text-[10px] text-white">แชร์ (Share)</span> ที่แถบเครื่องมือด้านบนของ Safari (รูปกล่องสี่เหลี่ยมมีลูกศรชี้ขึ้น)
            </li>
            <li>
              เลื่อนหน้าจอลงด้านล่างของกล่องแชร์ แล้วมองหาเมนู <span className="text-amber-400 font-bold px-1.5 py-0.5 bg-white/5 border border-white/15 rounded">เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</span> แล้วแตะปุ่มนั้น
            </li>
            <li>
              ตั้งชื่อแอปตามต้องการ แล้วกด <span className="font-bold text-green-400">เพิ่ม (Add)</span>
            </li>
            <li>
              เปิดใช้งานโดยแตะไอคอนบนหน้าจอโฮมของคุณ! แถบเบราว์เซอร์ Safari จะซ่อนตัวลง ทำให้คุณได้หน้าจอใช้ทำงานเขียนสูตรแบบ Full Screen 100% ทันที
            </li>
          </ol>
        </div>
        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-12 translate-y-12">
          <Smartphone className="w-64 h-64 text-white" />
        </div>
      </div>
    </div>
  );
}
