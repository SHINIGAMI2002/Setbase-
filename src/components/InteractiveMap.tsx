/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import proj4 from 'proj4';
import { BasePoint } from '../types';
import { Compass, MapPin, Globe, Maximize2, Sparkles, PlusCircle } from 'lucide-react';

const UTM_47N = '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs';
const UTM_48N = '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

export function utmToLatLng(easting: number, northing: number, zone: 47 | 48): [number, number] {
  const proj = zone === 47 ? UTM_47N : UTM_48N;
  try {
    const [lng, lat] = proj4(proj, WGS84, [easting, northing]);
    return [lat, lng];
  } catch (err) {
    console.error('UTM to LatLng projection error:', err);
    return [13.7367, 100.5231]; // Default to Bangkok in case of failure
  }
}

export function latLngToUtm(lat: number, lng: number, zone: 47 | 48): [number, number] {
  const proj = zone === 47 ? UTM_47N : UTM_48N;
  try {
    const [easting, northing] = proj4(WGS84, proj, [lng, lat]);
    return [easting, northing];
  } catch (err) {
    console.error('LatLng to UTM projection error:', err);
    return [0, 0];
  }
}

interface InteractiveMapProps {
  points: BasePoint[];
  selectedPointId: string;
  onSelectPoint: (id: string) => void;
  onAddPointAtCoordinates?: (easting: number, northing: number, zone: 47 | 48) => void;
  activeZone: 47 | 48;
  setActiveZone: (zone: 47 | 48) => void;
  antennaHeight: number;
}

export default function InteractiveMap({
  points,
  selectedPointId,
  onSelectPoint,
  onAddPointAtCoordinates,
  activeZone,
  setActiveZone,
  antennaHeight,
}: InteractiveMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clickUtm, setClickUtm] = useState<{ easting: number; northing: number } | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    if (!mapRef.current) {
      // Create Leaflet Map Instance
      const map = L.map(mapElementRef.current, {
        center: [13.7367, 100.5231],
        zoom: 6,
        zoomControl: true,
      });

      // Load Beautiful Dark Matter tiles from CartoDB or standard OSM
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      // Handle Map Click to register custom click coordinates
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        // Limit coordinates mapping constraints to Thailand bounding boxes
        if (lat < 5.5 || lat > 20.5 || lng < 97.0 || lng > 106.0) return;

        setClickCoords({ lat, lng });
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Update dynamic UTM derived click values
  useEffect(() => {
    if (!clickCoords) return;
    const [easting, northing] = latLngToUtm(clickCoords.lat, clickCoords.lng, activeZone);
    setClickUtm({ easting, northing });
  }, [clickCoords, activeZone]);

  // Sync / Plot Points to the Map dynamically
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markersRef.current) return;

    // Clear existing plotted points
    markersRef.current.clearLayers();

    const normalIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-600 shadow-md flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
          </div>
        </div>
      `,
      className: 'custom-map-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const activeIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-11 w-11 rounded-full bg-amber-500/20 animate-ping"></span>
          <div class="w-9 h-9 rounded-full bg-slate-950 border-2 border-amber-500 shadow-lg text-amber-500 flex items-center justify-center z-10">
            <svg class="w-4.5 h-4.5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"/>
            </svg>
          </div>
        </div>
      `,
      className: 'custom-map-marker-active',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    let activeMarkerLatLng: L.LatLngExpression | null = null;

    points.forEach((pt) => {
      const isSelected = pt.id === selectedPointId;
      const [lat, lng] = utmToLatLng(pt.easting, pt.northing, pt.zone);

      if (isSelected) {
        activeMarkerLatLng = [lat, lng];
      }

      const calculatedMsl = pt.msl + (isSelected ? antennaHeight : 0);

      const marker = L.marker([lat, lng], {
        icon: isSelected ? activeIcon : normalIcon,
      });

      // Bind info popups
      const popupHtml = `
        <div class="font-sans text-xs p-2 text-slate-100 max-w-xs space-y-1">
          <div class="flex items-center gap-1.5 border-b border-white/10 pb-1.5">
            <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}"></span>
            <strong class="text-sm font-bold text-white">${pt.name}</strong>
            <span class="text-[9px] px-1 py-0.5 bg-white/10 rounded font-semibold text-slate-300">WGS84 Z${pt.zone}N</span>
          </div>
          <div class="space-y-0.5 font-mono text-[10px] text-slate-300">
            <div><span class="text-slate-400">Easting E:</span> ${pt.easting.toFixed(3)} m</div>
            <div><span class="text-slate-400">Northing N:</span> ${pt.northing.toFixed(3)} m</div>
            <div><span class="text-slate-400">Orig Elev:</span> <span class="font-bold text-slate-100">${pt.msl.toFixed(3)} m</span></div>
            ${isSelected ? `<div class="text-amber-400 font-bold"><span class="text-slate-400">Antenna MSL:</span> ${calculatedMsl.toFixed(3)} m</div>` : ''}
          </div>
          ${pt.description ? `<p class="italic text-[10px] text-slate-400 pt-1 border-t border-white/5 font-sans">${pt.description}</p>` : ''}
          <button
            onclick="window.__selectMapBase__ && window.__selectMapBase__('${pt.id}')"
            type="button"
            style="margin-top: 8px; width: 100%; text-align: center; font-size: 10px; font-weight: bold; background: #f59e0b; color: #000; padding: 4px; border-radius: 4px; cursor: pointer; border: none;"
          >
            ใช้หมุดสถานีนี้
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'dark-map-popup',
        closeButton: false,
      });

      marker.on('click', () => {
        onSelectPoint(pt.id);
      });

      markersRef.current?.addLayer(marker);
    });

    // Handle global exposure for popup selection button
    (window as any).__selectMapBase__ = (id: string) => {
      onSelectPoint(id);
      mapRef.current?.closePopup();
    };

    // If change highlighted selection, center map view smoothly
    if (activeMarkerLatLng && mapRef.current) {
      mapRef.current.setView(activeMarkerLatLng, mapRef.current.getZoom());
    }
  }, [points, selectedPointId, mapReady, antennaHeight]);

  const handleCreatePointFromClick = () => {
    if (!clickUtm || !clickCoords || !onAddPointAtCoordinates) return;
    onAddPointAtCoordinates(clickUtm.easting, clickUtm.northing, activeZone);
    setClickCoords(null);
    setClickUtm(null);
  };

  const handlePanToSelected = () => {
    if (!mapRef.current) return;
    const currentActive = points.find((pt) => pt.id === selectedPointId);
    if (currentActive) {
      const [lat, lng] = utmToLatLng(currentActive.easting, currentActive.northing, currentActive.zone);
      mapRef.current.setView([lat, lng], 15);
    }
  };

  return (
    <div id="survey-interactive-map" className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg overflow-hidden flex flex-col h-[520px]">
      {/* Header Panel */}
      <div className="bg-[#121216] px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/15">
            <Globe className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">แผนที่รังวัดอ้างอิงอัจฉริยะ (UTM Interactive Map)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">แสดงรายชื่อพิกัดของคุณบนโครงตะแกรงภูมิศาสตร์จำลอง Leaflet Engine</p>
          </div>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">UTM Active Zone:</span>
          <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActiveZone(47)}
              type="button"
              className={`px-3 py-1 font-mono font-bold rounded-md cursor-pointer transition-all ${
                activeZone === 47
                  ? 'bg-amber-500 text-black font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Zone 47N
            </button>
            <button
              onClick={() => setActiveZone(48)}
              type="button"
              className={`px-3 py-1 font-mono font-bold rounded-md cursor-pointer transition-all ${
                activeZone === 48
                  ? 'bg-amber-500 text-black font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Zone 48N
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {/* Leaflet map object */}
        <div ref={mapElementRef} className="absolute inset-0 z-0 h-full w-full bg-slate-900" />

        {/* Right Click Coords Panel Overlay */}
        {clickCoords && clickUtm && (
          <div className="absolute top-4 left-4 z-[400] bg-slate-950/90 border border-white/15 p-4 rounded-xl shadow-xl max-w-[280px] text-xs font-sans text-slate-200 backdrop-blur">
            <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-2.5">
              <strong className="text-amber-400 flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> แตะเพื่อดึงพิกัด
              </strong>
              <button
                onClick={() => setClickCoords(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-350 leading-relaxed mb-3">
              คุณได้แตะที่พิกัดแผนที่ สนใจเพิ่มหมุดสำรวจใหม่ที่จุดนี้ทันทีหรือไม่?
            </p>
            <div className="space-y-1 font-mono text-[10.5px] bg-black/50 p-2 rounded-lg border border-white/5 mb-3">
              <div><span class="text-slate-400">Lat:</span> {clickCoords.lat.toFixed(6)}</div>
              <div><span class="text-slate-400">Lng:</span> {clickCoords.lng.toFixed(6)}</div>
              <div className="border-t border-white/5 my-1 pt-1"><span class="text-slate-400">Easting E:</span> {clickUtm.easting.toFixed(3)}</div>
              <div><span class="text-slate-400">Northing N:</span> {clickUtm.northing.toFixed(3)}</div>
              <div><span class="text-slate-400">ความสูง:</span> (จะอิงตาม MSL 0)</div>
              <div><span class="text-slate-400">Zone:</span> Zone {activeZone}N</div>
            </div>
            <button
              onClick={handleCreatePointFromClick}
              type="button"
              className="w-full text-center py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg hover:shadow-lg transition-all cursor-pointer font-sans"
            >
              ดึงพิกัดนี้สร้างหมุดใหม่
            </button>
          </div>
        )}

        {/* Quick Pan Tool overlay */}
        <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={handlePanToSelected}
            type="button"
            className="p-3 bg-slate-950/95 hover:bg-slate-900 border border-white/15 rounded-xl shadow-xl text-amber-550 text-amber-400 transition-all cursor-pointer flex items-center gap-1.5 font-bold tracking-wide text-xs"
            title="ซูมไปยังจุดที่เลือกอยู่"
          >
            <Compass className="w-4 h-4 text-amber-500" />
            ซูมและติดตามจุดที่เลือก
          </button>
        </div>
      </div>

      {/* Footer explanation notes */}
      <div className="bg-[#1C1D24] border-t border-white/5 px-4 py-2 shrink-0 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>เคล็ดลับ: คุณสามารถกดจิ้มบนแผ่นดินไทยตรงไหนก็ได้เพื่อเปลี่ยนเป็นพิกัด UTM และกดบันทึกหมุดฐานใหม่ทันที!</span>
        </span>
      </div>

      {/* leaflet scope dark hacks */}
      <style>{`
        .dark-map-popup .leaflet-popup-content-wrapper {
          background: #121216 !important;
          color: #f8fafc !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .dark-map-popup .leaflet-popup-tip {
          background: #121216 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
