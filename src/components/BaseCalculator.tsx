/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BasePoint, CommandFormat } from '../types';
import { Copy, Check, ChevronDown, RefreshCw, Layers, AlertCircle, Sparkles, Scale, BookOpen, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { utmToLatLon, latLonToECEF, getGeoidUndulation } from '../utils/coordinateConverter';

interface BaseCalculatorProps {
  points: BasePoint[];
  selectedPointId: string;
  onSelectPointId: (id: string) => void;
  antennaHeight: number;
  setAntennaHeight: (h: number) => void;
  antennaHeightStr: string;
  setAntennaHeightStr: (s: string) => void;
}

export default function BaseCalculator({
  points,
  selectedPointId,
  onSelectPointId,
  antennaHeight,
  setAntennaHeight,
  antennaHeightStr,
  setAntennaHeightStr,
}: BaseCalculatorProps) {
  const [commandFormat, setCommandFormat] = useState<CommandFormat>('spaced');
  const [coordSystem, setCoordSystem] = useState<'utm' | 'ecef' | 'geodetic'>('utm');
  const [copied, setCopied] = useState<boolean>(false);
  const [shaking, setShaking] = useState<boolean>(false);

  // Geoid Model Selection State
  const [geoidModel, setGeoidModel] = useState<'NONE' | 'TMG2017' | 'EGM2008' | 'EGM96'>('NONE');

  // Slant to Vertical Antenna Height Calculator States
  const [showSlantCalc, setShowSlantCalc] = useState<boolean>(false);
  const [slantHeightStr, setSlantHeightStr] = useState<string>('');
  const [receiverModel, setReceiverModel] = useState<string>('emlid_rs2');
  const [customRadiusStr, setCustomRadiusStr] = useState<string>('0.0715');
  const [customOffsetStr, setCustomOffsetStr] = useState<string>('0.000');

  // Sync receiver specs on preset selection
  useEffect(() => {
    switch (receiverModel) {
      case 'emlid_rs2':
        setCustomRadiusStr('0.0715');
        setCustomOffsetStr('0.000');
        break;
      case 'emlid_rs2_apc':
        setCustomRadiusStr('0.0715');
        setCustomOffsetStr('-0.134'); // positive vertical addition, handled as subtracting from H offset
        break;
      case 'trimble_r12':
        setCustomRadiusStr('0.0790');
        setCustomOffsetStr('0.000');
        break;
      case 'chcnav_i90':
        setCustomRadiusStr('0.0860');
        setCustomOffsetStr('0.0410');
        break;
      case 'chcnav_i73':
        setCustomRadiusStr('0.0620');
        setCustomOffsetStr('0.0280');
        break;
      case 'hitarget_v30':
        setCustomRadiusStr('0.0980');
        setCustomOffsetStr('0.0765');
        break;
      case 'stonex_s900':
        setCustomRadiusStr('0.0850');
        setCustomOffsetStr('0.0454');
        break;
      case 'south_g1':
        setCustomRadiusStr('0.1030');
        setCustomOffsetStr('0.0530');
        break;
      default:
        break;
    }
  }, [receiverModel]);

  // Find the currently selected point
  const currentPoint = points.find(pt => pt.id === selectedPointId) || points[0];

  useEffect(() => {
    if (!points.some(pt => pt.id === selectedPointId) && points.length > 0) {
      onSelectPointId(points[0].id);
    }
  }, [points, selectedPointId, onSelectPointId]);

  // Handle Antenna height numeric inputs safely
  const handleHeightChange = (valStr: string) => {
    setAntennaHeightStr(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      setAntennaHeight(parsed);
    } else {
      setAntennaHeight(0);
    }
  };

  // Preset button actions
  const adjustHeight = (amount: number) => {
    const nextVal = Math.max(0, parseFloat((antennaHeight + amount).toFixed(4)));
    setAntennaHeight(nextVal);
    setAntennaHeightStr(nextVal.toFixed(3));
    triggerNudge();
  };

  const selectPreset = (height: number) => {
    setAntennaHeight(height);
    setAntennaHeightStr(height.toFixed(3));
    triggerNudge();
  };

  const triggerNudge = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  };

  // Convert current UTM point to Lat/Long
  const geodetic = currentPoint 
    ? utmToLatLon(currentPoint.easting, currentPoint.northing, currentPoint.zone)
    : { lat: 0, lon: 0 };

  // Geoid Undulation
  const geoidUndulation = currentPoint
    ? getGeoidUndulation(geodetic.lat, geodetic.lon, geoidModel)
    : 0;

  // Calculations
  const calculatedMsl = currentPoint ? currentPoint.msl + antennaHeight : 0;
  
  // Ellipsoidal height = MSL + Antenna height + Geoid height (N is negative in Thailand)
  const ellipsoidalHeight = currentPoint ? currentPoint.msl + antennaHeight + geoidUndulation : 0;

  // Convert Lat/Lon + ellipsoidalHeight to ECEF
  const ecef = currentPoint
    ? latLonToECEF(geodetic.lat, geodetic.lon, ellipsoidalHeight)
    : { x: 0, y: 0, z: 0 };

  // Generate terminal command string
  const generateCommandStr = () => {
    if (!currentPoint) return '';
    
    if (coordSystem === 'utm') {
      const e = currentPoint.easting.toFixed(3);
      const n = currentPoint.northing.toFixed(3);
      const msl = calculatedMsl.toFixed(3);

      if (commandFormat === 'comma') {
        return `MODE BASE,${e},${n},${msl}`;
      }
      if (commandFormat === 'json') {
        return `{"mode": "BASE", "easting": ${e}, "northing": ${n}, "elevation": ${msl}}`;
      }
      return `MODE BASE ${e} ${n} ${msl}`;
    }
    
    if (coordSystem === 'ecef') {
      const xStr = ecef.x.toFixed(4);
      const yStr = ecef.y.toFixed(4);
      const zStr = ecef.z.toFixed(4);

      if (commandFormat === 'comma') {
        return `MODE BASE,${xStr},${yStr},${zStr}`;
      }
      if (commandFormat === 'json') {
        return `{"mode": "BASE", "x": ${xStr}, "y": ${yStr}, "z": ${zStr}}`;
      }
      return `MODE BASE ${xStr} ${yStr} ${zStr}`;
    }

    // Geodetic Lat/Lon/Height (using calculated ellipsoidal height)
    const latStr = geodetic.lat.toFixed(8);
    const lonStr = geodetic.lon.toFixed(8);
    const hStr = ellipsoidalHeight.toFixed(4);

    if (commandFormat === 'comma') {
      return `MODE BASE,${latStr},${lonStr},${hStr}`;
    }
    if (commandFormat === 'json') {
      return `{"mode": "BASE", "latitude": ${latStr}, "longitude": ${lonStr}, "height": ${hStr}}`;
    }
    return `MODE BASE ${latStr} ${lonStr} ${hStr}`;
  };

  const commandText = generateCommandStr();

  const handleCopy = () => {
    if (!commandText) return;
    navigator.clipboard.writeText(commandText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.warn('Failed to copy command using clipboard API, attempting raw copy', err);
    });
  };

  // Warning conditions: Alert if Antenna height is suspicious (> 3.5m or < 0m )
  const isSuspiciousHeight = antennaHeight > 3.500 || antennaHeight < 0;

  return (
    <div id="survey-calculator" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* Left Input Section */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg p-5 sm:p-6">
          <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-amber-500 hover:scale-110 transition-transform"></span>
            ป้อนข้อมูลสถานีฐาน (Base Input Panel)
          </h2>

          <div className="space-y-5">
            {/* Base Point Directory Selection Dropdown */}
            <div>
              <label htmlFor="base-point-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                1. เลือกชื่อหมุดสถานีฐานอ้างอิง (Base Point Name)
              </label>
              <div className="relative">
                <select
                  id="base-point-select"
                  value={selectedPointId}
                  onChange={(e) => onSelectPointId(e.target.value)}
                  className="w-full h-12 pl-4 pr-10 bg-[#1C1D24] hover:bg-[#252731] border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all cursor-pointer appearance-none animate-none"
                >
                  {points.map((pt) => (
                    <option key={pt.id} value={pt.id} className="bg-[#16171D] text-white">
                      {pt.name} — Zone {pt.zone}N (E: {pt.easting.toFixed(3)}, N: {pt.northing.toFixed(3)}, MSL: {pt.msl.toFixed(3)}) {pt.description ? `[${pt.description}]` : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Selected Coordinates Information Cards */}
            {currentPoint && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/40 p-3 sm:p-4 rounded-xl border border-white/5">
                <div className="bg-[#1C1D24] p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">UTM Zone</span>
                  <span className="block text-xs md:text-sm font-mono font-black text-amber-500 mt-1 select-all">
                    {currentPoint.zone}N
                  </span>
                </div>
                <div className="bg-[#1C1D24] p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Easting (E)</span>
                  <span className="block text-xs md:text-sm font-mono font-bold text-white mt-1 select-all">
                    {currentPoint.easting.toFixed(3)}
                  </span>
                </div>
                <div className="bg-[#1C1D24] p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Northing (N)</span>
                  <span className="block text-xs md:text-sm font-mono font-bold text-white mt-1 select-all">
                    {currentPoint.northing.toFixed(3)}
                  </span>
                </div>
                <div className="bg-[#1C1D24] p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">MSL Elev</span>
                  <span className="block text-xs md:text-sm font-mono font-bold text-amber-550 text-amber-400 mt-1 select-all">
                    {currentPoint.msl.toFixed(3)}
                  </span>
                </div>
              </div>
            )}

            {/* Antenna Height Entry Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="antenna-height-input" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  2. ป้อนค่าความสูงเสาอากาศ (Antenna Height - เมตร)
                </label>
                <span className="text-[10px] text-slate-500 block italic">ระดับเครื่องรับจากหัวหมุด</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    id="antenna-height-input"
                    type="number"
                    step="0.001"
                    min="0"
                    max="10"
                    placeholder="0.000"
                    value={antennaHeightStr}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full h-14 pl-4 pr-12 bg-[#1C1D24] border border-white/10 rounded-xl text-lg font-bold font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:text-slate-600"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 border-l border-white/5 pl-3">
                    <span className="text-xs font-bold text-slate-400 select-none">เมตร</span>
                  </div>
                </div>

                {/* Quick Reset to 0 m */}
                <button
                  onClick={() => selectPreset(0)}
                  type="button"
                  aria-label="รีเซ็ตความสูงเสาอากาศ"
                  className="px-4 h-14 bg-[#1C1D24] hover:bg-[#252731] text-slate-300 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5 text-slate-400" />
                  รีเซ็ตเป็น 0
                </button>
              </div>

              {/* Geoid Model Selection Grid Area */}
              <div id="geoid-selector-panel" className="mt-4 bg-black/20 border border-white/5 rounded-xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    🌏 เลือกโมเดลจีออยด์อ้างอิง (Geoid model separation)
                  </label>
                  <span className="text-[10px] bg-amber-500/10 border border-amber-500/15 text-amber-500 px-2 py-0.5 rounded font-mono font-bold">
                    N = {geoidUndulation.toFixed(3)} m
                  </span>
                </div>
                
                <div className="grid grid-cols-4 bg-black/40 border border-white/10 p-0.5 rounded-lg text-center font-bold text-xs">
                  {[
                    { value: 'NONE', label: 'ไม่มี (Direct)' },
                    { value: 'TMG2017', label: 'TMG2017' },
                    { value: 'EGM2008', label: 'EGM2008' },
                    { value: 'EGM96', label: 'EGM96' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setGeoidModel(item.value as any)}
                      type="button"
                      className={`py-2 text-[10px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                        geoidModel === item.value
                          ? 'bg-amber-500 text-black font-extrabold border border-white/10 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Antenna Preset Touch targets for iPad / Phone (Highly ergonomic!) */}
              <div className="mt-4 space-y-2.5">
                <span className="block text-[10.5px] font-bold text-slate-400">ปุ่มคู่มือลัดความสูง / คีย์ลัดแบบไวสัมผัส:</span>
                
                {/* Fixed Heights */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  {[1.200, 1.500, 1.800, 2.000, 2.150].map((h) => (
                    <button
                      key={h}
                      onClick={() => selectPreset(h)}
                      type="button"
                      className={`px-3 py-2.5 text-xs font-bold font-mono rounded-lg border transition-all cursor-pointer text-center active:scale-95 ${
                        Math.abs(antennaHeight - h) < 0.0001
                          ? 'bg-amber-500 border-amber-500 text-black shadow-md font-extrabold'
                          : 'bg-[#1C1D24] hover:bg-[#252731] border-white/10 text-slate-300'
                      }`}
                    >
                      เสา {h.toFixed(3)}m
                    </button>
                  ))}
                </div>

                {/* Increments / Decrements */}
                <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 pt-1">
                  {[
                    { label: '-1.0m', amt: -1.0 },
                    { label: '-0.1m', amt: -0.1 },
                    { label: '-0.05m', amt: -0.05 },
                    { label: '-0.01m', amt: -0.01 },
                    { label: '+0.01m', amt: 0.01 },
                    { label: '+0.05m', amt: 0.05 },
                    { label: '+0.1m', amt: 0.1 },
                    { label: '+1.0m', amt: 1.0 },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => adjustHeight(btn.amt)}
                      type="button"
                      className="px-2 py-2 text-[10px] sm:text-[11px] font-bold font-mono bg-[#1C1D24]/60 hover:bg-[#1C1D24] border border-white/5 text-slate-400 hover:text-white rounded-md transition-all cursor-pointer text-center active:scale-95"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Antenna Height Calculator (Slant to Vertical) Card/Section */}
            <div className="mt-2 border-t border-white/5 pt-5">
              <button
                type="button"
                onClick={() => setShowSlantCalc(!showSlantCalc)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#1C1D24] hover:bg-[#252731] border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer active:scale-99"
              >
                <span className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-500" />
                  เครื่องมือคำนวณจากความสูงเฉียง (Antenna Height Calculator)
                </span>
                <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-black tracking-wider">
                  {showSlantCalc ? 'ซ่อน' : 'เปิดใช้งาน'}
                </span>
              </button>

              {showSlantCalc && (
                <div id="antenna-slant-calculator" className="mt-4 bg-black/40 border border-[#f59e0b]/20 rounded-xl p-4 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-amber-400 font-sans flex items-center gap-1.5 leading-none">
                      <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                      คำนวณแปลงความสูงเฉียง (Slant) เป็นแนวดิ่ง (Vertical)
                    </h3>
                  </div>

                  {/* Model Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      เลือกรุ่นเครื่องรับสัญญาณ GNSS (GNSS Receiver Model)
                    </label>
                    <div className="relative">
                      <select
                        value={receiverModel}
                        onChange={(e) => setReceiverModel(e.target.value)}
                        className="w-full h-10 px-3 pr-8 bg-[#121216] border border-white/15 hover:border-white/25 rounded-lg text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none animate-none"
                      >
                        <option value="emlid_rs2">Emlid Reach RS2 / RS2+ / RS3 (Notch)</option>
                        <option value="emlid_rs2_apc">Emlid Reach RS2 / RS2+ / RS3 (L1 APC)</option>
                        <option value="trimble_r12">Trimble R12 / R12i (Notch Hook)</option>
                        <option value="chcnav_i90">CHCNAV i90 / i93 (Notch)</option>
                        <option value="chcnav_i73">CHCNAV i73 / i50 (Notch)</option>
                        <option value="hitarget_v30">Hi-Target V30 / V90 (Notch)</option>
                        <option value="stonex_s900">Stonex S900 (Notch)</option>
                        <option value="south_g1">South Galaxy G1 / G7 (Notch)</option>
                        <option value="custom">กำหนดเอง (กรอกรัศมี R และระยะ H เอง)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Grid Inputs: Slant (S), Radius (R), Vertical Offset (H) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        ความสูงเฉียงวัดได้ (S)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={slantHeightStr}
                          onChange={(e) => setSlantHeightStr(e.target.value)}
                          className="w-full h-10 px-3 pr-8 bg-[#121216] border border-white/10 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-700"
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-slate-500">ม.</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        รัศมีจานรับ (R)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={customRadiusStr}
                          onChange={(e) => setCustomRadiusStr(e.target.value)}
                          disabled={receiverModel !== 'custom'}
                          className={`w-full h-10 px-3 pr-8 bg-[#121216] border border-white/10 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-700 ${
                            receiverModel !== 'custom' ? 'opacity-60 cursor-not-allowed text-slate-400 font-normal bg-black/40' : ''
                          }`}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-slate-500">ม.</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1" title="ระยะความสูงเพิ่มเติมจากขอบวัดแนวเฉียง">
                        ระยะเผื่อดิ่ง (H Offset)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={customOffsetStr}
                          onChange={(e) => setCustomOffsetStr(e.target.value)}
                          disabled={receiverModel !== 'custom'}
                          className={`w-full h-10 px-3 pr-8 bg-[#121216] border border-white/10 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-700 ${
                            receiverModel !== 'custom' ? 'opacity-60 cursor-not-allowed text-slate-400 font-normal bg-black/40' : ''
                          }`}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-slate-500">ม.</span>
                      </div>
                    </div>
                  </div>

                  {/* live mathematical calculation display */}
                  {(() => {
                    const S_val = parseFloat(slantHeightStr) || 0;
                    const R_val = parseFloat(customRadiusStr) || 0;
                    const H_val = parseFloat(customOffsetStr) || 0;
                    
                    let computedV = 0;
                    let errorMsg = null;

                    if (S_val > 0) {
                      if (S_val < R_val) {
                        errorMsg = "ความสูงเฉียง (S) ต้องมากกว่ารัศมีจานเครื่องรับ (R)";
                      } else {
                        computedV = Math.sqrt(S_val * S_val - R_val * R_val) - H_val;
                      }
                    }

                    return (
                      <div className="space-y-3.5">
                        {/* Formula Section */}
                        <div className="bg-black/50 border border-white/5 p-3 rounded-lg text-[10.5px] font-mono leading-relaxed space-y-2 text-slate-300">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>สูตรการคำนวณแปลงเรขาคณิตสด (Live Geometric Formula):</span>
                          </div>
                          
                          <div className="bg-[#121215] px-2.5 py-1.5 rounded border border-white/5 text-center font-bold text-amber-500 text-xs">
                            Vertical Height = &radic;(S&sup2; - R&sup2;) - H
                          </div>

                          <div className="space-y-1 text-slate-400 pl-1 font-mono text-[10px]">
                            <div>S = ความสูงเฉียงวัดได้ = <span className="text-white font-bold">{S_val.toFixed(4)}</span> ม.</div>
                            <div>R = รัศมีจานรับ (กึ่งกลางถึงขอบเอียง) = <span className="text-white font-bold">{R_val.toFixed(4)}</span> ม.</div>
                            <div>H = ระยะความเหลื่อมดิ่ง (Notch/Phase center offset) = <span className="text-white font-bold">{H_val.toFixed(4)}</span> ม.</div>
                          </div>

                          {S_val > 0 && !errorMsg && (
                            <div className="border-t border-white/10 pt-2 mt-2 space-y-1 text-slate-300 font-sans text-xs">
                              <span className="text-[10px] text-amber-500 uppercase tracking-widest font-mono font-bold block">กระบวนการแทนค่าเฉียงเป็นแนวดิ่ง:</span>
                              <div className="font-mono text-xs pl-1 text-emerald-400">
                                = &radic;({S_val.toFixed(4)}&sup2; - {R_val.toFixed(4)}&sup2;) - ({H_val.toFixed(4)})
                                <br />
                                = &radic;({(S_val*S_val).toFixed(5)} - {(R_val*R_val).toFixed(5)}) - ({H_val.toFixed(4)})
                                <br />
                                = {Math.sqrt(S_val*S_val - R_val*R_val).toFixed(4)} - ({H_val.toFixed(4)})
                                <br />
                                = <span className="text-amber-400 font-black text-sm select-all">{computedV.toFixed(4)} เมตร</span>
                              </div>
                            </div>
                          )}

                          {errorMsg && (
                            <div className="text-red-400 text-xs font-sans font-bold flex items-center gap-1.5 py-1">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{errorMsg}</span>
                            </div>
                          )}
                        </div>

                        {/* Interactive Vector SVG Diagram */}
                        <div className="bg-black/55 border border-white/5 rounded-xl p-3 flex flex-col items-center">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider self-start mb-2 font-mono">
                            📐 Diagram: Antenna Height Measurement Blueprint
                          </span>

                          <svg viewBox="0 0 320 220" className="w-full max-w-[280px] h-auto bg-black border border-white/10 rounded-lg p-1 select-none">
                            <defs>
                              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                              </marker>
                              <marker id="arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                              </marker>
                            </defs>

                            {/* Ground Line */}
                            <line x1="20" y1="200" x2="300" y2="200" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />
                            
                            {/* Survey Mark pinhead */}
                            <circle cx="160" cy="200" r="4.5" fill="#ef4444" />
                            <text x="168" y="212" fill="#ef4444" className="text-[8.5px] font-extrabold font-sans">Benchmark (Ground Mark)</text>

                            {/* Tripod legs */}
                            <line x1="160" y1="90" x2="100" y2="200" stroke="#4b5563" strokeWidth="2" />
                            <line x1="160" y1="90" x2="220" y2="200" stroke="#4b5563" strokeWidth="2" />
                            <line x1="160" y1="90" x2="160" y2="200" stroke="#4b5563" strokeWidth="1" strokeDasharray="2 2" />

                            {/* GNSS Antenna casing */}
                            {/* Base body */}
                            <rect x="130" y="55" width="60" height="25" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                            {/* Antenna Dome cap */}
                            <path d="M 130 55 C 130 32, 190 32, 190 55 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                            
                            {/* Antenna measurement outer notches */}
                            <circle cx="130" cy="70" r="3" fill="#f59e0b" />
                            <circle cx="190" cy="70" r="3" fill="#f59e0b" />

                            {/* Center Phase Origin (APC point) */}
                            <circle cx="160" cy="45" r="3" fill="#3b82f6" />
                            <line x1="150" y1="45" x2="170" y2="45" stroke="#3b82f6" strokeWidth="0.8" />
                            <line x1="160" y1="35" x2="160" y2="55" stroke="#3b82f6" strokeWidth="0.8" />

                            {/* Dimensions lines */}
                            {/* Slant line (S) from ground core to notch */}
                            <line x1="160" y1="200" x2="190" y2="70" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arrow)" />
                            <text x="182" y="145" fill="#f59e0b" className="text-[10px] font-black font-mono">S={S_val > 0 ? S_val.toFixed(3) : 'Slant'}m</text>

                            {/* Radius (R) from antenna center to notch */}
                            <line x1="160" y1="70" x2="190" y2="70" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2" />
                            <text x="166" y="81" fill="#3b82f6" className="text-[8px] font-bold font-mono">R={R_val.toFixed(3)}m</text>

                            {/* Offset (H) from notch plane up to Phase Center */}
                            <line x1="156" y1="45" x2="156" y2="70" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="2 1" />
                            <text x="110" y="50" fill="#ef4444" className="text-[8px] font-bold font-mono">H={H_val.toFixed(3)}m</text>

                            {/* Computed Vertical Height Line (V) */}
                            <line x1="135" y1="200" x2="135" y2="70" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow-green)" />
                            <text x="70" y="130" fill="#10b981" className="text-[10px] font-black font-mono">V={computedV > 0 ? computedV.toFixed(3) : 'Vertical'}m</text>
                          </svg>
                        </div>

                        {/* Apply Button */}
                        <button
                          type="button"
                          disabled={!slantHeightStr || S_val < R_val}
                          onClick={() => {
                            if (computedV > 0) {
                              setAntennaHeight(computedV);
                              setAntennaHeightStr(computedV.toFixed(3));
                              triggerNudge();
                              setShowSlantCalc(false);
                            }
                          }}
                          className={`w-full h-11 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-black active:scale-95 cursor-pointer ${
                            !slantHeightStr || S_val < R_val
                              ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-600 shadow-md font-extrabold active:scale-97'
                          }`}
                        >
                          <Check className="w-4 h-4 text-black stroke-[3]" />
                          ใช้ค่านี้ใส่ช่องความสูงเสาอากาศ (Apply Value)
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warning Indicator */}
        {isSuspiciousHeight && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-400">โปรดตรวจสอบพารามิเตอร์</h4>
              <p className="text-xs text-amber-500/85 leading-relaxed mt-0.5">
                ความสูงเสารองรับ {antennaHeight.toFixed(3)} เมตร สูงหรือต่ำกว่ามาตรฐานการติดตั้งตามเกณฑ์ทั่วไป (0 ถึง 3.5 เมตร) โปรดตรวจสอบระดับการปักและข้อต่อเพื่อไม่ให้ระยะหักบิดไปจากจุดอ้างอิงจริง
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Output Terminal Section */}
      <div className="lg:col-span-5 flex flex-col">
        <div className="bg-[#121216] text-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl flex-1 flex flex-col border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase inline-flex items-center gap-1.5 font-mono">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Terminal Output
            </h2>

            {/* Custom Output Format Selector Toggle */}
            <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-lg">
              <button
                onClick={() => setCommandFormat('spaced')}
                type="button"
                className={`px-3 py-1.5 text-[10px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                  commandFormat === 'spaced'
                    ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="เว้นวรรคช่องว่าง"
              >
                Space
              </button>
              <button
                onClick={() => setCommandFormat('comma')}
                type="button"
                className={`px-3 py-1.5 text-[10px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                  commandFormat === 'comma'
                    ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="คั่นด้วยเครื่องหมายจุลภาค"
              >
                Comma
              </button>
            </div>
          </div>

          <div className="space-y-4 flex-1 flex flex-col">
            {/* Coordinate System Selector Tab Control */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                ระบบพิกัดคำสั่ง (Terminal Coordinate Frame)
              </label>
              <div className="grid grid-cols-3 bg-black/40 border border-white/10 p-0.5 rounded-lg text-center font-semibold">
                <button
                  onClick={() => setCoordSystem('utm')}
                  type="button"
                  className={`py-2 text-[10.5px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                    coordSystem === 'utm'
                      ? 'bg-[#1C1D24] text-amber-500 font-extrabold border border-white/5 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="พิกัดกริด UTM (Easting, Northing, Elevation)"
                >
                  UTM (E,N)
                </button>
                <button
                  onClick={() => setCoordSystem('ecef')}
                  type="button"
                  className={`py-2 text-[10.5px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                    coordSystem === 'ecef'
                      ? 'bg-[#1C1D24] text-amber-500 font-extrabold border border-white/5 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="พิกัดจุดศูนย์กลางโลก Cartesian (X, Y, Z)"
                >
                  ECEF (X,Y,Z)
                </button>
                <button
                  onClick={() => setCoordSystem('geodetic')}
                  type="button"
                  className={`py-2 text-[10.5px] font-mono leading-none rounded-md transition-all cursor-pointer ${
                    coordSystem === 'geodetic'
                      ? 'bg-[#1C1D24] text-amber-500 font-extrabold border border-white/5 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="พิกัดภูมิศาสตร์ Latitude / Longitude"
                >
                  Geo (L,L)
                </button>
              </div>
            </div>

            {/* Height Addition Verification Panel (Comprehensive All Systems view!) */}
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl text-xs space-y-3.5 font-mono">
              <div className="flex justify-between items-center text-slate-400 pb-1 border-b border-white/5">
                <span>📍 Selected Base:</span>
                <span className="text-white font-bold">{currentPoint ? currentPoint.name : '-'}</span>
              </div>

              {/* UTM System Subpanel */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">
                  🗺️ UTM Grid (Zone {currentPoint ? currentPoint.zone : '-'}N)
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Easting (E):</span>
                  <span className="text-slate-200 select-all font-semibold">{currentPoint ? currentPoint.easting.toFixed(3) : '-'} m</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Northing (N):</span>
                  <span className="text-slate-200 select-all font-semibold">{currentPoint ? currentPoint.northing.toFixed(3) : '-'} m</span>
                </div>
              </div>

              {/* WGS84 Geodetic Subpanel */}
              <div className="border-t border-white/5 pt-2.5 space-y-1.5">
                <div className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider">
                  🌍 WGS84 Geodetic (LLA)
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Latitude (Lat):</span>
                  <span className="text-slate-200 select-all font-semibold">{geodetic.lat.toFixed(8)}° N</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Longitude (Lon):</span>
                  <span className="text-slate-200 select-all font-semibold">{geodetic.lon.toFixed(8)}° E</span>
                </div>
              </div>

              {/* WGS84 ECEF XYZ Subpanel  */}
              <div className="border-t border-white/5 pt-2.5 space-y-1.5">
                <div className="text-[10px] text-sky-400/80 font-bold uppercase tracking-wider">
                  📐 Cartesian ECEF (X, Y, Z)
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">X Coordinate:</span>
                  <span className="text-slate-200 select-all font-semibold">{ecef.x.toFixed(4)} m</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Y Coordinate:</span>
                  <span className="text-slate-200 select-all font-semibold">{ecef.y.toFixed(4)} m</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pl-1.5">
                  <span className="text-slate-400">Z Coordinate:</span>
                  <span className="text-slate-200 select-all font-semibold">{ecef.z.toFixed(4)} m</span>
                </div>
              </div>

              {/* Antenna and Elevation Panel */}
              <div className="border-t border-white/5 pt-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">📐 Original MSL Elev:</span>
                  <span className="text-slate-200 font-semibold">{currentPoint ? currentPoint.msl.toFixed(3) : '-'} m</span>
                </div>
                <div className="flex justify-between items-center text-blue-400">
                  <span>📏 Antenna Height (H):</span>
                  <span className="font-bold">+ {antennaHeight.toFixed(3)} m</span>
                </div>
                <div className="flex justify-between items-center text-purple-400 animate-fadeIn">
                  <span>🌏 Geoid Undulation (N):</span>
                  <span className="font-bold">
                    {geoidModel !== 'NONE' ? `${geoidUndulation.toFixed(3)} m (${geoidModel})` : '0.000 m (Direct)'}
                  </span>
                </div>
                <div className="border-t border-white/10 mt-1.5 pt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center font-bold text-amber-500 text-xs">
                    <span>🔋 Total Vertical MSL:</span>
                    <span className={`px-1.5 py-0.5 bg-amber-500/10 rounded tracking-wide border border-amber-500/10 transition-all ${shaking ? 'animate-bounce' : ''}`}>
                      {calculatedMsl.toFixed(3)} m
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-emerald-400 text-xs animate-fadeIn">
                    <span>🌍 Ellipsoidal Height (h):</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 rounded tracking-wide border border-emerald-500/10 select-all">
                      {ellipsoidalHeight.toFixed(4)} m
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Command Render Container */}
            <div className="flex-1 flex flex-col min-h-32">
              <label htmlFor="generated-terminal-output" className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                คำสั่งสถานีฐานพร้อมคัดลอก (Formatted Statement)
              </label>
              <textarea
                id="generated-terminal-output"
                readOnly
                value={commandText}
                className="w-full flex-1 p-4 bg-black border border-white/10 rounded-xl font-mono text-sm text-emerald-400 leading-relaxed font-bold tracking-wide resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                onClick={(e) => {
                  (e.target as HTMLTextAreaElement).select();
                }}
              />
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              type="button"
              aria-label="ก๊อปปี้บรรทัดคำสั่งสถานีฐาน"
              className={`w-full h-14 rounded-xl font-black text-xs flex items-center justify-center gap-2 uppercase tracking-widest transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-amber-500 hover:bg-amber-600 text-black font-extrabold active:scale-98 shadow-md'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-black" />
                  คัดลอกสำเร็จ! (COPIED)
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-black" />
                  COPY TO CLIPBOARD
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500 leading-normal font-mono">
              แตะหนึ่งครั้งเพื่อเซฟคำสั่ง แล้วนำไปวางใน Terminal คอนโทรลเลอร์ฐานได้ทันที
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
