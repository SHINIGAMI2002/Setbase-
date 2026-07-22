/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BasePoint } from './types';
import { INITIAL_BASE_POINTS } from './data';
import BaseCalculator from './components/BaseCalculator';
import BaseManager from './components/BaseManager';
import SheetsGuide from './components/SheetsGuide';
import IpadGuide from './components/IpadGuide';
import InteractiveMap from './components/InteractiveMap';
import UserAuth from './components/UserAuth';
import DataAggregator from './components/DataAggregator';
import { AuthService, PointService, UserSession, initDB } from './utils/db';
import { Compass, FileSpreadsheet, MonitorSmartphone, Layers, MapPin, Sparkles, User, Wifi, WifiOff, RefreshCw, KeyRound, Database } from 'lucide-react';

export default function App() {
  const [activeSession, setActiveSession] = useState<UserSession | null>(AuthService.getCurrentSession());
  const [points, setPoints] = useState<BasePoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'calculator' | 'map' | 'security' | 'sheets' | 'ipad' | 'aggregator'>('calculator');
  
  // Raised Antenna Height states to synchronize Calculator & Map Popup instantly!
  const [antennaHeight, setAntennaHeight] = useState<number>(0.000);
  const [antennaHeightStr, setAntennaHeightStr] = useState<string>('0.000');

  // Network & Sync States
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Prefilled click coordinate state passed down to point manager additions
  const [prefilledPoint, setPrefilledPoint] = useState<{ easting: number; northing: number; zone: 47 | 48 } | null>(null);
  const [activeZone, setActiveZone] = useState<47 | 48>(47);

  // Fetch count of unsynced items in IndexedDB queue
  const updateQueueCount = useCallback(async () => {
    try {
      const db = await initDB();
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.count();
      request.onsuccess = () => {
        setQueueCount(request.result);
      };
    } catch (e) {
      console.error('Failed to query sync queue length', e);
    }
  }, []);

  // Sync / Load Points of current logged in user (or guest 'anonymous' mode) from IDB
  const loadPoints = useCallback(async () => {
    const uid = activeSession ? activeSession.uid : 'anonymous';
    try {
      let loaded = await PointService.getPoints(uid);
      
      // If a brand new user logged in / registered and has 0 custom pins, 
      // let's seed the core initial points so they have base points ready to use!
      if (loaded.length === 0) {
        const defaultSeeds = INITIAL_BASE_POINTS.map(pt => ({
          ...pt,
          id: pt.isDefault ? `def-${pt.id}-${uid}` : pt.id
        }));
        
        for (const pt of defaultSeeds) {
          await PointService.savePoint(pt, uid, true);
        }
        loaded = await PointService.getPoints(uid);
      }

      setPoints(loaded);

      // Restore active selected point reference
      const savedSelectedId = localStorage.getItem(`selected_pt_id_${uid}`);
      if (savedSelectedId && loaded.some(pt => pt.id === savedSelectedId)) {
        setSelectedPointId(savedSelectedId);
      } else if (loaded.length > 0) {
        setSelectedPointId(loaded[0].id);
        localStorage.setItem(`selected_pt_id_${uid}`, loaded[0].id);
      }
    } catch (err) {
      console.error('Failed to load points from secure db', err);
    }
    updateQueueCount();
  }, [activeSession, updateQueueCount]);

  // Load points on session change
  useEffect(() => {
    loadPoints();
  }, [activeSession, loadPoints]);

  // Sync selected point selection to cache
  const handleSelectPointId = (id: string) => {
    setSelectedPointId(id);
    const uid = activeSession ? activeSession.uid : 'anonymous';
    localStorage.setItem(`selected_pt_id_${uid}`, id);
  };

  // Sync network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto trigger sync upon network restoration
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateQueueCount]);

  // Sync action trigger
  const triggerSync = async () => {
    if (!navigator.onLine) {
      setSyncFeedback({ type: 'error', text: 'ไม่สามารถทำงานซิงค์ได้เนื่องจากอิมัลชันระบบออฟไลน์อยู่' });
      return;
    }

    setSyncing(true);
    setSyncFeedback(null);
    const uid = activeSession ? activeSession.uid : 'anonymous';

    try {
      const summary = await PointService.syncOfflineData(uid);
      if (summary.syncedCount > 0) {
        setSyncFeedback({
          type: 'success',
          text: `ซิงค์พิกัดออฟไลน์สะสมสำเร็จ ${summary.syncedCount} รายการพิกัดสู่ระบบเก็บข้อมูลปลอดภัยความมั่นคงสูง!`
        });
      }
      await loadPoints();
    } catch (err: any) {
      setSyncFeedback({ type: 'error', text: `การซิงค์ล้มเหลว: ${err.message || err}` });
    } finally {
      setSyncing(false);
      updateQueueCount();
    }
  };

  // Update Points wrapper matching CRUD triggers
  const handleUpdatePoints = async (newList: BasePoint[]) => {
    const uid = activeSession ? activeSession.uid : 'anonymous';
    
    // Find additions vs modifications vs deletions by comparing lists
    try {
      // Find deleted points
      const deleted = points.filter(oldPt => !newList.some(newPt => newPt.id === oldPt.id));
      for (const pt of deleted) {
        await PointService.deletePoint(pt.id, uid);
      }

      // Find created or updated points
      for (const pt of newList) {
        const oldPt = points.find(o => o.id === pt.id);
        if (!oldPt) {
          // New added point
          await PointService.savePoint(pt, uid, true);
        } else if (JSON.stringify(oldPt) !== JSON.stringify(pt)) {
          // Modified point
          await PointService.savePoint(pt, uid, false);
        }
      }

      await loadPoints();
    } catch (err) {
      console.error('Failed to update points list securely:', err);
    }
  };

  const handleAddImportedPoint = async (newPt: BasePoint) => {
    const uid = activeSession ? activeSession.uid : 'anonymous';
    try {
      await PointService.savePoint(newPt, uid, true);
      await loadPoints();
    } catch (err) {
      console.error('Failed to save imported station point:', err);
    }
  };

  const handleMapAddPoint = (easting: number, northing: number, zone: 47 | 48) => {
    setPrefilledPoint({ easting, northing, zone });
    setActiveTab('calculator');
  };

  const handleSessionChange = (session: UserSession | null) => {
    setActiveSession(session);
    // Switch to calculator after login for smooth navigation flow
    if (session) {
      setActiveTab('calculator');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] font-sans text-[#E2E8F0] antialiased flex flex-col">
      {/* Visual Accent Banner */}
      <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-600 w-full shrink-0" />

      {/* Main Header Container */}
      <header className="bg-[#121216] border-b border-white/10 py-6 shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-amber-500 flex items-center justify-center text-black shadow-lg">
              <Compass className="w-5.5 h-5.5 animate-spin-slow text-black" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-display">
                GeoSurvey <span className="text-amber-500">Pro</span>
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
                SURVEY BASE COMMAND GENERATOR & COORDINATES DIRECTORY
              </p>
            </div>
          </div>

          {/* Quick status information banner consistent with Sophisticated Dark theme */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 bg-white/5 border border-white/10 px-3 py-1.75 sm:px-4 sm:py-2 rounded-xl font-mono text-[10.5px] sm:text-[11px] text-slate-350">
            {/* Online State Status Indicator */}
            <div className={`flex items-center gap-1.2 sm:gap-1.5 font-bold ${isOnline ? 'text-green-400' : 'text-slate-400'}`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400 animate-pulse shrink-0" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>

            <div className="hidden sm:block h-3 w-px bg-white/10" />

            {/* Sync Queue indicator */}
            <div className="flex items-center gap-1.2 sm:gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${queueCount > 0 ? 'bg-amber-500 animate-bounce' : 'bg-slate-500'}`} />
              <span>ดึงคิว: {queueCount} บันทึก</span>
              {queueCount > 0 && isOnline && (
                <button
                  onClick={triggerSync}
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-black rounded font-bold hover:shadow-md cursor-pointer flex items-center gap-1 text-[9px] sm:text-[9.5px] whitespace-nowrap"
                  disabled={syncing}
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'ซิงค์...' : 'ซิงค์ด่วน'}
                </button>
              )}
            </div>

            <div className="hidden sm:block h-3 w-px bg-white/10" />

            {/* User credentials identifier */}
            <div className="flex items-center gap-1 text-slate-200">
              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[100px] sm:max-w-[120px]" title={activeSession ? activeSession.email : 'โหมดพิกัดจำลอง'}>
                {activeSession ? activeSession.email.split('@')[0] : 'เกสต์สำรวจ'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Top navigation rails */}
      <div className="bg-[#121216]/50 border-b border-white/10 shadow-xs shrink-0 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <nav className="flex gap-4 sm:gap-6 md:gap-7 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('calculator')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'calculator'
                  ? 'border-amber-500 text-amber-500 font-black'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>เครื่องมือคำนวณ<span className="hidden sm:inline"> Base Word</span></span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'map'
                  ? 'border-amber-500 text-amber-500 font-black'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>แผนที่รังวัด<span className="hidden sm:inline"> (Map)</span></span>
            </button>

            <button
              onClick={() => setActiveTab('aggregator')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'aggregator'
                  ? 'border-amber-500 text-amber-500 font-black'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>รวบรวมพิกัด GIS <span className="hidden sm:inline">(Aggregator)</span></span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'security'
                  ? 'border-amber-500 text-amber-500 font-black'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>บัญชี & ซิงค์<span className="hidden sm:inline">ระบบความปลอดภัย</span></span>
            </button>

            <button
              onClick={() => setActiveTab('sheets')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'sheets'
                  ? 'border-amber-500 text-amber-500 font-black'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>คู่มือ Sheets<span className="hidden sm:inline"> (iPad)</span></span>
            </button>

            <button
              onClick={() => setActiveTab('ipad')}
              type="button"
              className={`py-3.5 sm:py-4 px-1 text-xs md:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                activeTab === 'ipad'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <MonitorSmartphone className="w-4 h-4 shrink-0" />
              <span>ใช้คู่กัน<span className="hidden sm:inline">ขณะทำงาน</span></span>
            </button>
          </nav>
        </div>
      </div>

      {/* Sync global feedback warning alert */}
      {syncFeedback && (
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4">
          <div className={`p-4 rounded-xl border text-xs flex justify-between items-center ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15' 
              : 'bg-rose-500/5 text-rose-500 border-rose-500/15'
          }`}>
            <span className="font-semibold leading-relaxed">{syncFeedback.text}</span>
            <button
              onClick={() => setSyncFeedback(null)}
              className="text-[10px] font-bold underline pl-4 cursor-pointer"
            >
              ซ่อนขวดข้อความ
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-8">
        {activeTab === 'calculator' && (
          <div className="space-y-8 animate-none">
            {/* The Tactile Controller and Copy Terminal Grid panel */}
            <BaseCalculator
              points={points}
              selectedPointId={selectedPointId}
              onSelectPointId={handleSelectPointId}
              antennaHeight={antennaHeight}
              setAntennaHeight={setAntennaHeight}
              antennaHeightStr={antennaHeightStr}
              setAntennaHeightStr={setAntennaHeightStr}
              onAddPoints={(pts) => pts.forEach(handleAddImportedPoint)}
            />

            {/* List Manager to Create, Edit, or Delete custom pins */}
            <BaseManager
              points={points}
              onUpdatePoints={handleUpdatePoints}
              onSelectPoint={handleSelectPointId}
              selectedPointId={selectedPointId}
              prefilledPoint={prefilledPoint}
              onClearPrefilledPoint={() => setPrefilledPoint(null)}
            />
          </div>
        )}

        {/* Map tab workspace view */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            <InteractiveMap
              points={points}
              activeZone={activeZone}
              setActiveZone={setActiveZone}
              selectedPointId={selectedPointId}
              onSelectPoint={handleSelectPointId}
              onAddPointAtCoordinates={handleMapAddPoint}
              antennaHeight={antennaHeight}
            />
          </div>
        )}

        {/* Data Aggregator GIS Tab View */}
        {activeTab === 'aggregator' && (
          <DataAggregator
            points={points}
            onAddPoint={handleAddImportedPoint}
            onSelectPoint={handleSelectPointId}
          />
        )}

        {/* Security / Auth tab workspace view */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <UserAuth
              currentSession={activeSession}
              onSessionChange={handleSessionChange}
            />
          </div>
        )}

        {activeTab === 'sheets' && (
          <SheetsGuide />
        )}

        {activeTab === 'ipad' && (
          <IpadGuide />
        )}
      </main>

      {/* Footer Branding Area */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-850 shrink-0 text-xs text-center mt-auto font-mono">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[11px] text-slate-500 leading-normal">
            &copy; {new Date().getFullYear()} Survey Base Command Generator | Designed for iPad Retina & Touch Input Integration
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>พิกัด Datum อ้างอิง UTM (WGS84) ทศนิยม 3 ตำแหน่ง (Zone 47 / Zone 48)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
