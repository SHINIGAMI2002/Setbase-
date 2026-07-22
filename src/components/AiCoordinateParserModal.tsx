/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gemini AI Coordinate Extractor Modal with Offline Fallback
 */

import React, { useState } from 'react';
import { Bot, Sparkles, X, WifiOff, AlertCircle, Check, Copy } from 'lucide-react';
import { BasePoint } from '../types';

interface AiCoordinateParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPoints: (points: BasePoint[]) => void;
}

export default function AiCoordinateParserModal({
  isOpen,
  onClose,
  onAddPoints,
}: AiCoordinateParserModalProps) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPoints, setParsedPoints] = useState<BasePoint[]>([]);
  const isOnline = navigator.onLine;

  if (!isOpen) return null;

  // Fallback client-side regex extraction when offline or API fails
  const parseWithRegexFallback = (raw: string): BasePoint[] => {
    const lines = raw.split(/\r?\n/);
    const results: BasePoint[] = [];

    lines.forEach((line, idx) => {
      const clean = line.trim();
      if (!clean) return;

      // Match numbers: Easting (6 digits around 100k - 900k), Northing (7 digits around 500k - 2300k), MSL
      const numbers = clean.match(/-?\d+(\.\d+)?/g);
      if (numbers && numbers.length >= 2) {
        const floatNums = numbers.map(Number);
        let easting = 0;
        let northing = 0;
        let msl = 0;

        floatNums.forEach((n) => {
          if (n >= 100000 && n <= 900000 && easting === 0) easting = n;
          else if (n >= 500000 && n <= 2500000 && northing === 0) northing = n;
          else if (n > -50 && n < 9000 && msl === 0) msl = n;
        });

        if (easting > 0 && northing > 0) {
          results.push({
            id: `regex_${Date.now()}_${idx}`,
            name: `PT_${idx + 1}`,
            easting,
            northing,
            msl: msl || 0,
            zone: 47,
            description: 'สกัดด้วย Client-Side Regex Extractor (Offline)',
            isDefault: false,
          });
        }
      }
    });

    return results;
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      setError('กรุณาป้อนข้อความบันทึกพิกัดสนามที่ต้องการสกัด');
      return;
    }

    setLoading(true);
    setError(null);
    setParsedPoints([]);

    // If offline, directly trigger regex fallback
    if (!navigator.onLine) {
      const fallbackResults = parseWithRegexFallback(inputText);
      setParsedPoints(fallbackResults);
      setLoading(false);
      if (fallbackResults.length === 0) {
        setError('ไม่สามารถตรวจหาพิกัดตัวเลขด้วย Regex Client Fallback ได้ โปรดตรวจสอบข้อความ');
      }
      return;
    }

    // Online: Call Gemini Server Endpoint
    try {
      const res = await fetch('/api/parse-coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.offlineFallback) {
          // GEMINI_API_KEY missing, use regex fallback
          const fallbackResults = parseWithRegexFallback(inputText);
          setParsedPoints(fallbackResults);
          if (fallbackResults.length === 0) {
            setError(data.error || 'ไม่พบการตั้งค่า GEMINI_API_KEY');
          }
          return;
        }
        throw new Error(data.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      }

      if (data.points && Array.isArray(data.points) && data.points.length > 0) {
        const formatted: BasePoint[] = data.points.map((p: any, idx: number) => ({
          id: `ai_${Date.now()}_${idx}`,
          name: p.name || `PT_${idx + 1}`,
          easting: Number(p.easting) || 0,
          northing: Number(p.northing) || 0,
          msl: Number(p.msl) || 0,
          zone: (p.zone === 48 ? 48 : 47),
          description: p.remarks || 'สกัดอัตโนมัติด้วย Gemini AI',
          isDefault: false,
        }));
        setParsedPoints(formatted);
      } else {
        // Fallback
        const fallbackResults = parseWithRegexFallback(inputText);
        setParsedPoints(fallbackResults);
        if (fallbackResults.length === 0) {
          setError('AI ไม่พบโครงสร้างพิกัดในข้อความนี้');
        }
      }
    } catch (err: any) {
      // Fallback
      const fallbackResults = parseWithRegexFallback(inputText);
      setParsedPoints(fallbackResults);
      if (fallbackResults.length === 0) {
        setError(`เกิดข้อผิดพลาดในการเชื่อมต่อ AI: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedPoints.length > 0) {
      onAddPoints(parsedPoints);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#16171D] border border-amber-500/30 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-white/5 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              Gemini AI Smart Coordinate Extractor
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                OPTIONAL AI
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              วางข้อความโน้ตสนาม, แชทไลน์ หรือพิกัดไม่เป็นระเบียบ เพื่อให้ AI สกัดเป็นหมุดสำรวจ
            </p>
          </div>
        </div>

        {/* Offline Guard Banner */}
        {!isOnline && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <WifiOff className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold">⚡ กำลังอยู่ในโหมดออฟไลน์หน้างาน (Offline Mode)</p>
              <p className="text-[11px] text-amber-300/80 font-normal mt-0.5">
                Gemini AI ต้องการอินเทอร์เน็ต — ระบบกำลังเปิดใช้ <strong>Client-Side Regex Parser ฝั่งเครื่องอัตโนมัติ</strong> เพื่อสกัดตัวเลขพิกัดโดยไม่ใช้อินเทอร์เน็ต
              </p>
            </div>
          </div>
        )}

        {/* Input Text Area */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            วางข้อความพิกัดสนาม (Field Notes / Raw Text)
          </label>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`ตัวอย่างเช่น:
พิกัดหมุด BASE01 N: 1523456.789 E: 678123.456 ความสูง MSL 12.35m
หรือ หมุด TP2 x=678500 y=1524000 z=15.2
หรือข้อความโน้ตจากการสำรวจรังวัด...`}
            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex gap-3">
          <button
            onClick={handleProcess}
            disabled={loading}
            className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'กำลังวิเคราะห์พิกัด...' : isOnline ? 'สกัดพิกัดด้วย Gemini AI' : 'สกัดพิกัดด้วย Regex (Offline)'}</span>
          </button>
        </div>

        {/* Results Preview Table */}
        {parsedPoints.length > 0 && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> ตรวจพบพิกัดสำเร็จ ({parsedPoints.length} จุด)
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="text-slate-500 border-b border-white/10">
                  <tr>
                    <th className="p-1.5">ชื่อ</th>
                    <th className="p-1.5">Easting (X)</th>
                    <th className="p-1.5">Northing (Y)</th>
                    <th className="p-1.5">MSL</th>
                    <th className="p-1.5">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {parsedPoints.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 font-bold text-amber-400">{p.name}</td>
                      <td className="p-1.5">{p.easting.toFixed(3)}</td>
                      <td className="p-1.5">{p.northing.toFixed(3)}</td>
                      <td className="p-1.5">{p.msl.toFixed(3)}</td>
                      <td className="p-1.5 text-slate-400 truncate max-w-[120px]">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleApply}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              นำเข้าพิกัดทั้ง {parsedPoints.length} จุดเข้าตารางระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
