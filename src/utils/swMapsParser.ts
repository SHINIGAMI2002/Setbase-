/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SW Maps (.xlsx, .xls, .csv) Importer & ComNav DDMM.MMMMM Coordinate Rectifier
 * Runs 100% Client-Side with zero server requests.
 */

import * as XLSX from 'xlsx';
import { latLonToUtm } from './coordinateConverter';

export interface ParsedSurveyPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  easting: number;
  northing: number;
  msl: number;
  zone: 47 | 48;
  remarks: string;
  sourceFile: string;
  // Warning & Anomaly Flags
  warnings: string[];
  isDDMMConverted: boolean;
  isOutOfBounds: boolean;
  isAbnormalElevation: boolean;
}

/**
 * Parses raw coordinate values (handles DDMM.MMMMM from ComNav/RTK, DMS strings, or standard decimal)
 */
export function parseCoordinateStringToDecimal(
  rawVal: any,
  type: 'lat' | 'lon'
): { val: number; wasDDMM: boolean } {
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return { val: 0, wasDDMM: false };
  }

  // Convert to string and clean spaces
  let str = String(rawVal).trim().toUpperCase();
  let sign = 1;

  if (str.includes('S') || str.includes('W') || str.startsWith('-')) {
    sign = -1;
  }
  
  // Remove directional letters and non-numeric except dot
  const cleanStr = str.replace(/[N|S|E|W|°|'|"|]/g, ' ').trim();
  const numVal = parseFloat(cleanStr);

  if (isNaN(numVal)) {
    return { val: 0, wasDDMM: false };
  }

  // 1. Check if value is in DDMM.MMMMM format
  // For Thailand, Latitude is 5.5 to 20.5 degrees.
  // In DDMM.MMMMM format, Lat 13°45.1234' becomes 1345.1234 (value range ~ 500 to 2100)
  // Longitude is 97 to 106 degrees.
  // In DDMM.MMMMM format, Lon 100°30.1234' becomes 10030.1234 (value range ~ 9700 to 10600)
  if (type === 'lat' && Math.abs(numVal) >= 500 && Math.abs(numVal) <= 2500) {
    const absVal = Math.abs(numVal);
    const deg = Math.floor(absVal / 100);
    const min = absVal % 100;
    const decimal = (deg + min / 60) * sign;
    return { val: decimal, wasDDMM: true };
  }

  if (type === 'lon' && Math.abs(numVal) >= 9000 && Math.abs(numVal) <= 11000) {
    const absVal = Math.abs(numVal);
    const deg = Math.floor(absVal / 100);
    const min = absVal % 100;
    const decimal = (deg + min / 60) * sign;
    return { val: decimal, wasDDMM: true };
  }

  // 2. Standard decimal degrees
  return { val: numVal * sign, wasDDMM: false };
}

/**
 * Main parser function to process SW Maps Excel (.xlsx, .xls) or CSV files
 */
export async function parseSWMapsFile(file: File): Promise<ParsedSurveyPoint[]> {
  let workbook: XLSX.WorkBook;

  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type.includes('text');

  if (isCsv) {
    try {
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string', raw: true });
    } catch {
      const data = await file.arrayBuffer();
      workbook = XLSX.read(data, { type: 'array' });
    }
  } else {
    try {
      const data = await file.arrayBuffer();
      workbook = XLSX.read(data, { type: 'array' });
    } catch (err) {
      // Fallback if binary fails or is CSV string
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string', raw: true });
    }
  }

  const results: ParsedSurveyPoint[] = [];

  // Iterate over all sheets in workbook
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    rows.forEach((row, rowIdx) => {
      // Helper to find column case-insensitively
      const findColValue = (...keys: string[]) => {
        for (const k of Object.keys(row)) {
          const cleanK = k.trim().toLowerCase();
          if (keys.some((target) => cleanK.includes(target.toLowerCase()))) {
            return row[k];
          }
        }
        return '';
      };

      const nameVal = String(
        findColValue('feature name', 'point', 'name', 'หมุด', 'id', 'no', 'code') ||
          `PT_${rowIdx + 1}`
      ).trim();

      const latRaw = findColValue('latitude', 'lat', 'ละติจูด');
      const lonRaw = findColValue('longitude', 'lon', 'lng', 'ลองจิจูด');
      const eastingRaw = findColValue('easting', 'x', 'พิกัดe', 'e');
      const northingRaw = findColValue('northing', 'y', 'พิกัดn', 'n');
      const elevRaw = findColValue('elevation', 'elev', 'msl', 'height', 'z', 'ระดับ');
      const remarkVal = String(
        findColValue('remarks', 'remark', 'comment', 'note', 'หมายเหตุ') || ''
      ).trim();

      const parsedLat = parseCoordinateStringToDecimal(latRaw, 'lat');
      const parsedLon = parseCoordinateStringToDecimal(lonRaw, 'lon');

      let lat = parsedLat.val;
      let lon = parsedLon.val;
      let isDDMMConverted = parsedLat.wasDDMM || parsedLon.wasDDMM;

      let easting = parseFloat(String(eastingRaw)) || 0;
      let northing = parseFloat(String(northingRaw)) || 0;
      let msl = parseFloat(String(elevRaw)) || 0;

      const warnings: string[] = [];

      // If Easting/Northing provided but no Lat/Lon, reverse compute or vice versa
      if ((!lat || !lon) && easting > 0 && northing > 0) {
        // Assume Zone 47 if lon around 99 or Easting < 500000
        const guessedZone: 47 | 48 = lon > 102 ? 48 : 47;
        // Keep UTM values
      }

      // Convert Lat/Lon to UTM Zone 47/48 if Easting/Northing are missing
      let zone: 47 | 48 = lon >= 102 ? 48 : 47;
      if (lat !== 0 && lon !== 0 && (easting === 0 || northing === 0)) {
        const utm = latLonToUtm(lat, lon);
        easting = utm.easting;
        northing = utm.northing;
        zone = utm.zone;
      }

      // Anomaly Detection
      let isOutOfBounds = false;
      if (lat !== 0 || lon !== 0) {
        if (lat < 5.0 || lat > 21.0 || lon < 96.0 || lon > 106.0) {
          isOutOfBounds = true;
          warnings.push(`พิกัดหลุดขอบเขตประเทศไทย/UTM (Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)})`);
        }
      } else if (easting < 100000 || easting > 900000 || northing < 500000 || northing > 2300000) {
        isOutOfBounds = true;
        warnings.push(`ค่าพิกัด UTM ผิดสังเกต (E: ${easting}, N: ${northing})`);
      }

      let isAbnormalElevation = false;
      if (isNaN(msl) || msl < -50 || msl > 9000) {
        isAbnormalElevation = true;
        warnings.push(`ระดับความสูง MSL ผิดสังเกต (${msl} m)`);
      }

      if (isDDMMConverted) {
        warnings.push('แปลงฟอร์แมต ComNav DDMM.MMMMM เป็น Decimal Degrees อัตโนมัติ');
      }

      // Only add row if it has at least a name or valid coordinates
      if (nameVal || easting > 0 || lat !== 0) {
        results.push({
          id: `sw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: nameVal,
          lat,
          lon,
          easting,
          northing,
          msl,
          zone,
          remarks: remarkVal,
          sourceFile: file.name,
          warnings,
          isDDMMConverted,
          isOutOfBounds,
          isAbnormalElevation,
        });
      }
    });
  }

  return results;
}
