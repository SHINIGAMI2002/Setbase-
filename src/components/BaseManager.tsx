/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BasePoint } from '../types';
import { Plus, Trash2, Edit2, RotateCcw, AlertTriangle, Check, Layers, Sparkles } from 'lucide-react';
import { INITIAL_BASE_POINTS } from '../data';
import { parsePastedECEF, ecefToLatLon, latLonToUtm } from '../utils/coordinateConverter';

interface BaseManagerProps {
  points: BasePoint[];
  onUpdatePoints: (newPoints: BasePoint[]) => void;
  onSelectPoint: (id: string) => void;
  selectedPointId: string;
  prefilledPoint?: { easting: number; northing: number; zone: 47 | 48 } | null;
  onClearPrefilledPoint?: () => void;
}

export default function BaseManager({
  points,
  onUpdatePoints,
  onSelectPoint,
  selectedPointId,
  prefilledPoint,
  onClearPrefilledPoint,
}: BaseManagerProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [msl, setMsl] = useState('');
  const [zone, setZone] = useState<47 | 48>(47);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ECEF Paste helper states
  const [ecefInput, setEcefInput] = useState('');
  const [ecefSuccess, setEcefSuccess] = useState<string | null>(null);

  // Synchronize map-clicked coordinates pre-filling
  useEffect(() => {
    if (prefilledPoint) {
      setIsEditing(true);
      setEditingId(null);
      setName(`MAP-PT-${Date.now().toString().slice(-4)}`);
      setEasting(prefilledPoint.easting.toFixed(3));
      setNorthing(prefilledPoint.northing.toFixed(3));
      setZone(prefilledPoint.zone);
      setMsl('0.000');
      setDescription(`เลือกพิกัดจากแผนที่อ้างอิง (Zone ${prefilledPoint.zone}N)`);
      setError(null);
      setEcefInput('');
      setEcefSuccess(null);

      if (onClearPrefilledPoint) {
        onClearPrefilledPoint();
      }

      // Smooth scroll to the form container
      setTimeout(() => {
        const formEl = document.getElementById('add-edit-point-form');
        formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [prefilledPoint, onClearPrefilledPoint]);

  const startAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setName('');
    setEasting('');
    setNorthing('');
    setMsl('');
    setZone(47);
    setDescription('');
    setError(null);
    setEcefInput('');
    setEcefSuccess(null);
  };

  const startEdit = (pt: BasePoint) => {
    setIsEditing(true);
    setEditingId(pt.id);
    setName(pt.name);
    setEasting(pt.easting.toString());
    setNorthing(pt.northing.toString());
    setMsl(pt.msl.toString());
    setZone(pt.zone);
    setDescription(pt.description || '');
    setError(null);
    setEcefInput('');
    setEcefSuccess(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setError(null);
    setEcefInput('');
    setEcefSuccess(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('กรุณาระบุชื่อจุดสถานีฐาน');
      return;
    }

    const valEasting = parseFloat(easting);
    if (isNaN(valEasting) || valEasting <= 0) {
      setError('ค่าพิกัด Easting (E) ต้องเป็นตัวเลขจำนวนมากกว่า 0');
      return;
    }

    const valNorthing = parseFloat(northing);
    if (isNaN(valNorthing) || valNorthing <= 0) {
      setError('ค่าพิกัด Northing (N) ต้องเป็นตัวเลขจำนวนมากกว่า 0');
      return;
    }

    const valMsl = parseFloat(msl);
    if (isNaN(valMsl)) {
      setError('ค่าพิกัด MSL (Elevation) ต้องเป็นตัวเลข');
      return;
    }

    // Check unique name (except current being edited)
    const exists = points.some(
      (pt) => pt.name.toLowerCase() === trimmedName.toLowerCase() && pt.id !== editingId
    );
    if (exists) {
      setError('ชื่อสถานีฐานนี้มีอยู่แล้วในรายการ');
      return;
    }

    if (editingId) {
      // Edit
      const updated = points.map((pt) => {
        if (pt.id === editingId) {
          return {
            ...pt,
            name: trimmedName,
            easting: valEasting,
            northing: valNorthing,
            msl: valMsl,
            zone: zone,
            description: description.trim() || undefined,
            isDefault: false,
          };
        }
        return pt;
      });
      onUpdatePoints(updated);
    } else {
      // Add
      const newPt: BasePoint = {
        id: `custom-${Date.now()}`,
        name: trimmedName,
        easting: valEasting,
        northing: valNorthing,
        msl: valMsl,
        zone: zone,
        description: description.trim() || undefined,
        isDefault: false,
      };
      const updated = [...points, newPt];
      onUpdatePoints(updated);
      onSelectPoint(newPt.id); // auto-select new point
    }

    setIsEditing(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (points.length <= 1) {
      alert('อย่างน้อยต้องมีสถานีฐานอ้างอิงเหลืออยู่ 1 จุดหลัก');
      return;
    }
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบจุดสถานีนี้พ้นบัญชี?')) {
      const updated = points.filter((pt) => pt.id !== id);
      onUpdatePoints(updated);
      if (selectedPointId === id) {
        onSelectPoint(updated[0].id);
      }
    }
  };

  const handleResetToDefaults = () => {
    if (
      confirm(
        'คุณต้องการรีเซ็ตรายการหมุดหลักกลับสู่ค่าเริ่มต้นทั้งหมดใช่หรือไม่? (ข้อมูลหมุดที่คุณเพิ่มเองจะหายไป)'
      )
    ) {
      onUpdatePoints(INITIAL_BASE_POINTS);
      onSelectPoint(INITIAL_BASE_POINTS[0].id);
    }
  };

  return (
    <div id="base-manager" className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            บัญชีรายชื่อและจัดเก็บพิกัดสถานีฐาน (Survey Directory)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            บันทึกพิกัด E, N, MSL แยกตาม Zone 47 และ 48 เพื่อนำไปคำนวณและพล็อตกราฟิกแผนที่
          </p>
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <button
              onClick={handleResetToDefaults}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-[#1C1D24] hover:bg-[#252731] border border-white/10 hover:border-white/20 rounded-lg transition-all cursor-pointer"
              title="คืนค่าเริ่มต้น"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              คืนค่าหมุดเริ่มต้น
            </button>
            <button
              onClick={startAdd}
              type="button"
              aria-label="เพิ่มหมุดสถานีใหม่"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-black bg-amber-500 hover:bg-amber-600 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-black" />
              เพิ่มหมุดสถานีฐาน
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <form
          id="add-edit-point-form"
          onSubmit={handleSave}
          className="bg-[#1C1D24] border border-white/10 rounded-xl p-5 mb-5 space-y-4"
        >
          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
            <h3 className="text-sm font-bold text-white inline-flex items-center gap-1.5 uppercase tracking-wider">
              {editingId ? <Edit2 className="w-4 h-4 text-amber-550 text-amber-500" /> : <Plus className="w-4 h-4 text-amber-500" />}
              {editingId ? 'แก้ไขข้อมูลจุดพิกัด' : 'เพิ่มข้อมูลจุดอ้างอิงฐานใหม่'}
            </h3>
            <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10 animate-pulse">
              {editingId ? 'MODE: EDIT' : 'MODE: CREATE'}
            </span>
          </div>

          {/* Quick ECEF Decoder Area */}
          {!editingId && (
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <h4 className="text-xs font-bold text-slate-300">กล่องช่วยถอดรหัสพิกัด ECEF (X, Y, Z) ด่วนแบบไวสัมผัส</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                หากคุณมีพิกัด ECEF ที่คัดลอกจากเบสหรือคอนโทรลเลอร์ (เช่นพาสต์แบบตัวเลขติดกัน <span className="font-mono text-amber-500 text-[10px] bg-black px-1 py-0.5 rounded">-1084128.68715915670.0899</span> หรือแบบเว้นวรรค) ป้อนในช่องนี้เพื่อแกะพิกัด ยัด Zone, Easting, Northing, MSL ลงฟอร์มด้านล่างให้อัตโนมัติทันที!
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="วางพิกัด ECEF เช่น: -1084128.68715915670.0899 2117761.7956"
                    value={ecefInput}
                    onChange={(e) => {
                      setEcefInput(e.target.value);
                      setEcefSuccess(null);
                      setError(null);
                    }}
                    className="w-full h-11 px-3 bg-[#121216] border border-white/10 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEcefSuccess(null);
                    const parsed = parsePastedECEF(ecefInput);
                    if (!parsed) {
                      setError("ไม่เข้าใจรูปแบบพิกัด ECEF ที่คุณกรอก โปรดมั่นใจว่าระบุค่าพิกัดครบทั้ง X, Y, Z และตัวเลขถูกต้อง");
                      return;
                    }
                    
                    const { x, y, z } = parsed;
                    const geodetic = ecefToLatLon(x, y, z);
                    const utm = latLonToUtm(geodetic.lat, geodetic.lon);
                    
                    setName(name ? name : `STN-ECEF-${Math.round(geodetic.lat * 100)}`);
                    setZone(utm.zone);
                    setEasting(utm.easting.toFixed(3));
                    setNorthing(utm.northing.toFixed(3));
                    setMsl(geodetic.h.toFixed(3));
                    setDescription(`ถอดพิกัดอัตโนมัติจาก ECEF (X: ${x.toFixed(4)}, Y: ${y.toFixed(4)}, Z: ${z.toFixed(4)})`);
                    setEcefSuccess(`ถอดพิกัด ECEF สำเร็จ! แปลงได้พิกัด UTM Zone ${utm.zone}N (E: ${utm.easting.toFixed(3)}, N: ${utm.northing.toFixed(3)}, Ellipsoid Elev: ${geodetic.h.toFixed(3)}ม.)`);
                  }}
                  className="px-4 h-11 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center justify-center gap-1 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  ถอดพิกัด ECEF
                </button>
              </div>
              
              {ecefSuccess && (
                <div className="text-green-400 text-[10.5px] bg-green-500/5 border border-green-500/10 rounded-lg p-2.5 font-sans leading-relaxed">
                  {ecefSuccess}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="base-name-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
                ชื่อหมุด / Station Name
              </label>
              <input
                id="base-name-idb"
                type="text"
                required
                placeholder="เช่น GPS-STN05"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-600"
              />
            </div>

            <div>
              <label htmlFor="base-zone-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
                UTM Zone (จำเป็นเลือกระหว่าง 47/48)
              </label>
              <select
                id="base-zone-idb"
                value={zone}
                onChange={(e) => setZone(Number(e.target.value) as 47 | 48)}
                className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value={47}>Zone 47N (ภาคกลาง / เหนือ / ตะวันตก)</option>
                <option value={48}>Zone 48N (ภาคตะวันออก / ตะวันออกเฉียงเหนือ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="base-e-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
                Easting E (m)
              </label>
              <input
                id="base-e-idb"
                type="number"
                step="0.001"
                required
                placeholder="เช่น 645123.456"
                value={easting}
                onChange={(e) => setEasting(e.target.value)}
                className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label htmlFor="base-n-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
                Northing N (m)
              </label>
              <input
                id="base-n-idb"
                type="number"
                step="0.001"
                required
                placeholder="เช่น 1524108.980"
                value={northing}
                onChange={(e) => setNorthing(e.target.value)}
                className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label htmlFor="base-msl-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
                MSL Elevation (m)
              </label>
              <input
                id="base-msl-idb"
                type="number"
                step="0.001"
                required
                placeholder="เช่น 85.340"
                value={msl}
                onChange={(e) => setMsl(e.target.value)}
                className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="base-desc-idb" className="block text-xs font-bold text-slate-400 mb-1.5">
              รายละเอียดเพิ่มเติม / หมายเหตุ (เลือกกรอก)
            </label>
            <input
              id="base-desc-idb"
              type="text"
              placeholder="รายละเอียดตำแหน่ง เช่น ตอกตะปูบนเสาคอนกรีต, ใกล้อาคารเอนกประสงค์"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-11 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-650"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-rose-500 bg-rose-500/5 border border-rose-500/15 rounded-lg p-3 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button
              onClick={cancelEdit}
              type="button"
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 border border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-amber-500 hover:bg-amber-600 rounded-lg transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-black" />
              บันทึกจุดพิกัดนี้
            </button>
          </div>
        </form>
      ) : null}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-black/10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#121216] border-b border-white/10 text-slate-350 font-bold uppercase tracking-wider">
              <th className="p-3.5">ชื่อสถานี (Base Name)</th>
              <th className="p-3.5">UTM Zone</th>
              <th className="p-3.5">Easting E (m)</th>
              <th className="p-3.5">Northing N (m)</th>
              <th className="p-3.5">MSL Elev (m)</th>
              <th className="p-3.5">คำอธิบายเพิ่มเติม / หมายเหตุตำแหน่ง</th>
              <th className="p-3.5 text-center w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {points.map((pt) => {
              const isActive = pt.id === selectedPointId;
              return (
                <tr
                  key={pt.id}
                  className={`hover:bg-white/3 transition-colors ${
                    isActive ? 'bg-amber-500/5 text-amber-300' : ''
                  }`}
                >
                  <td className="p-3.5 font-bold text-white">
                    <div className="flex items-center gap-2">
                       <span className="truncate">{pt.name}</span>
                      {pt.isDefault && (
                        <span className="scale-85 origin-left text-[9px] font-semibold px-1.5 py-0.5 bg-white/5 text-slate-400 border border-white/10 rounded">
                          เริ่มต้น
                        </span>
                      )}
                      {isActive && (
                        <span className="scale-85 origin-left text-[9px] font-black px-1.5 py-0.5 bg-amber-500 text-black rounded uppercase tracking-wider">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 font-semibold">
                    <span className="bg-white/5 border border-white/10 px-2 py-0.75 rounded text-slate-300 font-mono">
                      Zone {pt.zone}N
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{pt.easting.toFixed(3)}</td>
                  <td className="p-3.5 font-mono text-slate-300">{pt.northing.toFixed(3)}</td>
                  <td className="p-3.5 font-mono text-amber-550 text-amber-400 font-bold">{pt.msl.toFixed(3)} m</td>
                  <td className="p-3.5 text-slate-400 italic max-w-xs truncate" title={pt.description}>
                    {pt.description || '-'}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center items-center gap-1.5">
                      <button
                        onClick={() => onSelectPoint(pt.id)}
                        type="button"
                        aria-label="เลือกใช้หมุดนี้"
                        className={`p-1 rounded border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-black border-amber-500 shadow-md'
                            : 'bg-[#1C1D24] text-slate-300 hover:text-white border-white/10 hover:bg-[#252731]'
                        }`}
                        title="ใช้คำนวณฐาน"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(pt)}
                        type="button"
                        aria-label="แก้ไขข้อมูลหมุด"
                        className="p-1 text-slate-300 hover:bg-white/5 hover:text-amber-500 rounded border border-white/10 transition-colors cursor-pointer"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pt.id)}
                        type="button"
                        aria-label="ลบหมุดตัวนี้"
                        className="p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-450 rounded border border-white/5 hover:border-rose-500/20 transition-colors cursor-pointer"
                        title="ลบจุดนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-Based List View */}
      <div className="md:hidden space-y-3">
        {points.map((pt) => {
          const isActive = pt.id === selectedPointId;
          return (
            <div
              key={pt.id}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-amber-500/5 border-amber-500/40 text-amber-300 shadow-lg'
                  : 'bg-[#1C1D24] border-white/10 text-slate-300'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-sm text-white truncate">{pt.name}</span>
                    {pt.isDefault && (
                      <span className="text-[9px] font-semibold px-1 py-0.2 bg-white/5 text-slate-400 border border-white/10 rounded">
                        เริ่มต้น
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-500 text-black rounded uppercase tracking-wider scale-90 origin-left">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {pt.description && (
                    <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-1 truncate" title={pt.description}>
                      {pt.description}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300 shrink-0">
                  Zone {pt.zone}N
                </span>
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3 bg-black/25 p-2 rounded-lg font-mono">
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wide font-sans font-bold">Easting E</span>
                  <span className="font-semibold text-white">{pt.easting.toFixed(3)}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wide font-sans font-bold">Northing N</span>
                  <span className="font-semibold text-white">{pt.northing.toFixed(3)}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wide font-sans font-bold">MSL Elev</span>
                  <span className="font-bold text-amber-500 text-amber-400">{pt.msl.toFixed(3)}m</span>
                </div>
              </div>

              {/* Touch-Optimized Mobile Action Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => onSelectPoint(pt.id)}
                  type="button"
                  className={`inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-black font-black'
                      : 'bg-[#121216] border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {isActive ? 'ใช้งานอยู่' : 'เลือกใช้'}
                </button>
                <button
                  onClick={() => startEdit(pt)}
                  type="button"
                  className="inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-[#121216] border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(pt.id)}
                  type="button"
                  className="inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-[#121216] border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  ลบจุด
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
