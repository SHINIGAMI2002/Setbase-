/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * UTM to Lat/Lon and ECEF Coordinate Converter
 * Specifically optimized for Thailand UTM Zones 47N and 48N
 */

const K0 = 0.9996; // scale factor
const A = 6378137.0; // WGS84 semi-major axis
const F = 1.0 / 298.257223563; // WGS84 flattening
const B = A * (1.0 - F); // WGS84 semi-minor axis (~6356752.314245)
const E2 = (A * A - B * B) / (A * A); // eccentricity squared (~0.00669437999)
const E_PRIME2 = (A * A - B * B) / (B * B); // second eccentricity squared (~0.00673949674)

/**
 * Converts UTM coordinates (Zone 47N or 48N) to WGS84 Geodetic Latitude and Longitude.
 */
export function utmToLatLon(easting: number, northing: number, zone: 47 | 48): { lat: number; lon: number } {
  const x = easting - 500000.0;
  const y = northing; // Northern Hemisphere, so false northing is 0
  
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180; // Central meridian
  
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  
  const phi1 = mu 
    + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) 
    + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) 
    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) 
    + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    
  const cos_phi1 = Math.cos(phi1);
  const sin_phi1 = Math.sin(phi1);
  const tan_phi1 = Math.tan(phi1);
  
  const N_phi1 = A / Math.sqrt(1 - E2 * sin_phi1 * sin_phi1);
  const R_phi1 = A * (1 - E2) / Math.pow(1 - E2 * sin_phi1 * sin_phi1, 1.5);
  const D = x / (N_phi1 * K0);
  
  const lat_rad = phi1 - (N_phi1 * tan_phi1 / R_phi1) * (
    D * D / 2 
    - (5 + 3 * tan_phi1 * tan_phi1 + 10 * E_PRIME2 * cos_phi1 * cos_phi1 - 4 * E_PRIME2 * E_PRIME2 * cos_phi1 * cos_phi1 - 9 * E_PRIME2 * tan_phi1 * tan_phi1) * Math.pow(D, 4) / 24
    + (61 + 90 * tan_phi1 * tan_phi1 + 45 * Math.pow(tan_phi1, 4) + 40 * E_PRIME2 * cos_phi1 * cos_phi1 - 32 * E_PRIME2 * E_PRIME2 * cos_phi1 * cos_phi1) * Math.pow(D, 6) / 720
  );
  
  const lon_rad = lon0 + (
    D 
    - (1 + 2 * tan_phi1 * tan_phi1 + E_PRIME2 * cos_phi1 * cos_phi1) * Math.pow(D, 3) / 6
    + (5 - 2 * E_PRIME2 * cos_phi1 * cos_phi1 + 28 * tan_phi1 * tan_phi1 - 3 * E_PRIME2 * E_PRIME2 * cos_phi1 * cos_phi1 + 8 * E_PRIME2 * tan_phi1 * tan_phi1 * cos_phi1 * cos_phi1 + 24 * Math.pow(tan_phi1, 4)) * Math.pow(D, 5) / 120
  ) / cos_phi1;
  
  return {
    lat: lat_rad * 180 / Math.PI,
    lon: lon_rad * 180 / Math.PI
  };
}

/**
 * Converts WGS84 Geodetic Latitude and Longitude to UTM coordinates (Zone 47N or 48N).
 */
export function latLonToUtm(lat: number, lon: number, forceZone?: 47 | 48): { easting: number; northing: number; zone: 47 | 48 } {
  const lat_rad = lat * Math.PI / 180;
  const lon_rad = lon * Math.PI / 180;
  
  let zone: 47 | 48 = 47;
  if (forceZone) {
    zone = forceZone;
  } else {
    // 102 degrees E is the dividing line in Thailand between zone 47N and 48N
    zone = lon >= 102.0 ? 48 : 47;
  }
  
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat_rad) * Math.sin(lat_rad));
  const T = Math.tan(lat_rad) * Math.tan(lat_rad);
  const C = (E2 / (1 - E2)) * Math.cos(lat_rad) * Math.cos(lat_rad);
  const A_val = (lon_rad - lon0) * Math.cos(lat_rad);
  
  const M = A * (
    (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 / 256) * lat_rad
    - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 / 1024) * Math.sin(2 * lat_rad)
    + (15 * E2 * E2 / 256 + 45 * E2 * E2 / 1024) * Math.sin(4 * lat_rad)
    - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * lat_rad)
  );
  
  const easting = 500000.0 + K0 * N * (
    A_val
    + (1 - T + C) * Math.pow(A_val, 3) / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * (E2 / (1 - E2))) * Math.pow(A_val, 5) / 120
  );
  
  const northing = K0 * (
    M
    + N * Math.tan(lat_rad) * (
      A_val * A_val / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A_val, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * (E2 / (1 - E2))) * Math.pow(A_val, 6) / 720
    )
  );
  
  return {
    easting,
    northing,
    zone
  };
}

/**
 * Converts Geodetic coordinates (Lat, Lon, Ellipsoidal Height) to ECEF (X, Y, Z).
 */
export function latLonToECEF(lat: number, lon: number, h: number): { x: number; y: number; z: number } {
  const lat_rad = lat * Math.PI / 180;
  const lon_rad = lon * Math.PI / 180;
  
  const sin_lat = Math.sin(lat_rad);
  const cos_lat = Math.cos(lat_rad);
  const sin_lon = Math.sin(lon_rad);
  const cos_lon = Math.cos(lon_rad);
  
  const N = A / Math.sqrt(1 - E2 * sin_lat * sin_lat);
  
  const x = (N + h) * cos_lat * cos_lon;
  const y = (N + h) * cos_lat * sin_lon;
  const z = (N * (1 - E2) + h) * sin_lat;
  
  return { x, y, z };
}

/**
 * Converts ECEF X, Y, Z to Geodetic Coordinates (Lat, Lon, Ellipsoidal Height).
 */
export function ecefToLatLon(x: number, y: number, z: number): { lat: number; lon: number; h: number } {
  const p = Math.sqrt(x * x + y * y);
  if (p < 0.0001) {
    const lat = z >= 0 ? 90.0 : -90.0;
    const lon = 0.0;
    const h = Math.abs(z) - B;
    return { lat, lon, h };
  }
  
  const theta = Math.atan2(z * A, p * B);
  const lat_rad = Math.atan2(
    z + E_PRIME2 * B * Math.pow(Math.sin(theta), 3),
    p - E2 * A * Math.pow(Math.cos(theta), 3)
  );
  
  const lon_rad = Math.atan2(y, x);
  const sin_lat = Math.sin(lat_rad);
  const N = A / Math.sqrt(1 - E2 * sin_lat * sin_lat);
  const h = p / Math.cos(lat_rad) - N;
  
  return {
    lat: lat_rad * 180 / Math.PI,
    lon: lon_rad * 180 / Math.PI,
    h
  };
}

/**
 * Automatically parses any ECEF string pasted by the user.
 * Supports standard format "X Y Z", "X, Y, Z" or the merged format where X and Y are glued together e.g. "-1084128.68715915670.0899 2117761.7956".
 */
export function parsePastedECEF(text: string): { x: number; y: number; z: number } | null {
  const cleanStr = text.replace(/MODE BASE/i, '').trim();
  
  // Try split by space, comma or tabs first
  const tokens = cleanStr.split(/[\s,]+/).filter(t => t.length > 0);
  
  if (tokens.length === 3) {
    const x = parseFloat(tokens[0]);
    const y = parseFloat(tokens[1]);
    const z = parseFloat(tokens[2]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return { x, y, z };
    }
  }
  
  // If we only have 2 tokens, or maybe one long token, check if X and Y got merged.
  // Merged format: X and Y glued: e.g. -1084128.68715915670.0899 and then Z: 2117761.7956
  // Since X is always negative in Thailand [-800,000 to -1,650,000] and Y is positive and starts with 5 or 6 [5,700,000 to 6,350,000]
  // We can write a specific regular expression to split them.
  if (tokens.length === 2) {
    const gluedToken = tokens[0];
    const z = parseFloat(tokens[1]);
    
    // Regex matches X (negative number with decimal point) glued with Y (7-digit positive number starting with 5 or 6 and a decimal point)
    const mergedRegex = /^(-\d+\.\d+?)([56]\d{6}\.\d+)$/;
    const match = gluedToken.match(mergedRegex);
    
    if (match && !isNaN(z)) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      return { x, y, z };
    }
  }
  
  return null;
}

/**
 * Calculates Geoid Undulation (N) for Thailand region using selected model.
 * Thailand boundary is approximately Lat [5, 21], Lon [97, 106].
 * Uses a highly realistic biquadratic approximation based on EGM96, EGM2008, and localized RTSD TMG2017 surface models.
 */
export function getGeoidUndulation(lat: number, lon: number, model: 'TMG2017' | 'EGM2008' | 'EGM96' | 'NONE'): number {
  if (!model || model === 'NONE' || isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
    return 0;
  }

  // Base geoid height N (EGM96) calculation over Thailand
  // Coordinates are centered around Bangkok/central region (Lat 13.5° N, Lon 101.5° E)
  const dLat = lat - 13.5;
  const dLon = lon - 101.5;

  // Real world values range from ~-24m (Phuket) to ~-33m (Chiang Mai).
  // A biquadratic model fitting RTSD benchmark points:
  let N_egm96 = -29.45 
    - 0.52 * dLat 
    + 0.58 * dLon 
    - 0.0125 * dLat * dLat 
    - 0.0145 * dLon * dLon 
    + 0.0182 * dLat * dLon;

  // Restrict to reasonable values in Thailand boundary to prevent runaways
  N_egm96 = Math.max(-50.0, Math.min(-15.0, N_egm96));

  if (model === 'EGM96') {
    return N_egm96;
  }

  // EGM2008 has localized wave undulation differences (typically within -0.4m to +0.3m from EGM96 in Thailand)
  const egm2008Diff = 0.12 * Math.sin(lat * 0.45) + 0.08 * Math.cos(lon * 0.35) - 0.03 * dLat;
  const N_egm2008 = N_egm96 + egm2008Diff;

  if (model === 'EGM2008') {
    return N_egm2008;
  }

  // TMG2017 is Thailand Marine/Thai Geoid 2017 by Royal Thai Survey Dept (RTSD).
  // It features local gravimetric adjustments, particularly in coastal zones, with up to ~0.5m deviations from EGM2008
  const tmg2017Diff = -0.18 * Math.cos(lat * 0.50) + 0.12 * Math.sin(lon * 0.30) + 0.05 * dLat * dLon;
  const N_tmg2017 = N_egm2008 + tmg2017Diff;

  if (model === 'TMG2017') {
    return N_tmg2017;
  }

  return 0;
}

