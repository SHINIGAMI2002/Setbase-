/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 100% Client-Side ESRI Shapefile (.shp, .shx, .dbf, .prj) & GeoJSON Exporter
 * Generates valid Shapefile ZIP packages directly in browser memory without server dependencies.
 */

import JSZip from 'jszip';
import { BasePoint } from '../types';
import { utmToLatLon } from './coordinateConverter';

export interface ExportPoint {
  id: string;
  name: string;
  zone: 47 | 48;
  easting: number;
  northing: number;
  msl: number;
  description?: string;
  remarks?: string;
  lat?: number;
  lon?: number;
}

/**
 * Generate WKT string for PRJ file
 */
export function getWKTProjection(zone?: 47 | 48): string {
  if (zone === 47) {
    return `PROJCS["WGS_1984_UTM_Zone_47N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",99.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  }
  if (zone === 48) {
    return `PROJCS["WGS_1984_UTM_Zone_48N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",105.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  }
  // Default WGS84 Geodetic
  return `GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`;
}

/**
 * Creates dBase III (.dbf) binary buffer from records
 */
function createDBF(points: ExportPoint[]): Uint8Array {
  // DBF Header field definitions:
  // Name (C, 12), Easting (N, 12, 3), Northing (N, 12, 3), MSL (N, 10, 3), Zone (N, 4, 0), Remark (C, 30)
  const fields = [
    { name: 'PT_NAME', type: 'C', size: 12, dec: 0 },
    { name: 'EASTING', type: 'N', size: 12, dec: 3 },
    { name: 'NORTHING', type: 'N', size: 12, dec: 3 },
    { name: 'MSL_ELEV', type: 'N', size: 10, dec: 3 },
    { name: 'UTM_ZONE', type: 'N', size: 4, dec: 0 },
    { name: 'REMARKS', type: 'C', size: 30, dec: 0 },
  ];

  const headerLength = 32 + fields.length * 32 + 1;
  const recordLength = 1 + fields.reduce((sum, f) => sum + f.size, 0);
  const totalLength = headerLength + points.length * recordLength + 1;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // DBF Version 0x03 (dBase III without memo)
  uint8[0] = 0x03;
  const now = new Date();
  uint8[1] = now.getFullYear() - 1900;
  uint8[2] = now.getMonth() + 1;
  uint8[3] = now.getDate();

  // Record count (32-bit uint little endian)
  view.setUint32(4, points.length, true);
  // Header length & Record length
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);

  // Field descriptors
  let offset = 32;
  const encoder = new TextEncoder();

  fields.forEach((field) => {
    const fieldNameBytes = encoder.encode(field.name);
    for (let i = 0; i < 11; i++) {
      uint8[offset + i] = i < fieldNameBytes.length ? fieldNameBytes[i] : 0;
    }
    uint8[offset + 11] = field.type.charCodeAt(0);
    uint8[offset + 16] = field.size;
    uint8[offset + 17] = field.dec;
    offset += 32;
  });

  // End of header terminator
  uint8[offset++] = 0x0d;

  // Records
  points.forEach((pt) => {
    // Record deletion flag (' ' = active, '*' = deleted)
    uint8[offset++] = 0x20;

    const values = [
      (pt.name || '').substring(0, 12),
      pt.easting.toFixed(3),
      pt.northing.toFixed(3),
      pt.msl.toFixed(3),
      pt.zone.toString(),
      (pt.description || pt.remarks || '').substring(0, 30),
    ];

    fields.forEach((field, i) => {
      let valStr = values[i];
      if (field.type === 'N') {
        valStr = valStr.padStart(field.size, ' ');
      } else {
        valStr = valStr.padEnd(field.size, ' ');
      }
      const valBytes = encoder.encode(valStr.substring(0, field.size));
      for (let b = 0; b < field.size; b++) {
        uint8[offset + b] = b < valBytes.length ? valBytes[b] : 0x20;
      }
      offset += field.size;
    });
  });

  // End of file marker
  uint8[offset] = 0x1a;

  return uint8;
}

/**
 * Creates .shp & .shx binary buffers for Point geometry (Shape Type 1)
 */
function createSHPAndSHX(points: ExportPoint[], isGeodetic = false): { shp: Uint8Array; shx: Uint8Array } {
  // Bounding box calculation
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const geometries = points.map((pt) => {
    let x = pt.easting;
    let y = pt.northing;
    if (isGeodetic) {
      const geo = pt.lat && pt.lon ? { lat: pt.lat, lon: pt.lon } : utmToLatLon(pt.easting, pt.northing, pt.zone);
      x = geo.lon;
      y = geo.lat;
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    return { x, y, z: pt.msl };
  });

  if (points.length === 0) {
    minX = minY = maxX = maxY = 0;
  }

  // Header = 100 bytes
  // Each Point record in SHP = 8 bytes record header + 4 bytes shape type + 16 bytes (X, Y) = 28 bytes
  const shpRecordSize = 28;
  const shpTotalBytes = 100 + points.length * shpRecordSize;
  const shxTotalBytes = 100 + points.length * 8;

  const shpBuffer = new ArrayBuffer(shpTotalBytes);
  const shpView = new DataView(shpBuffer);
  const shpUint8 = new Uint8Array(shpBuffer);

  const shxBuffer = new ArrayBuffer(shxTotalBytes);
  const shxView = new DataView(shxBuffer);
  const shxUint8 = new Uint8Array(shxBuffer);

  // Write Main Headers (100 bytes each)
  const writeHeader = (view: DataView, totalBytes: number) => {
    // File code 9994 (Big Endian)
    view.setInt32(0, 9994, false);
    // File length in 16-bit words (Big Endian)
    view.setInt32(24, totalBytes / 2, false);
    // Version 1000 (Little Endian)
    view.setInt32(28, 1000, true);
    // Shape Type 1 = Point (Little Endian)
    view.setInt32(32, 1, true);
    // Bounding Box (Little Endian doubles)
    view.setFloat64(36, minX, true);
    view.setFloat64(44, minY, true);
    view.setFloat64(52, maxX, true);
    view.setFloat64(60, maxY, true);
    // Z & M bounds (set 0.0)
    view.setFloat64(68, 0.0, true);
    view.setFloat64(76, 0.0, true);
    view.setFloat64(84, 0.0, true);
    view.setFloat64(92, 0.0, true);
  };

  writeHeader(shpView, shpTotalBytes);
  writeHeader(shxView, shxTotalBytes);

  // Write Records
  let shpOffset = 100;
  let shxOffset = 100;

  geometries.forEach((geom, idx) => {
    const recordNum = idx + 1;
    const recordLengthWords = 10; // (4 + 16) / 2 = 10

    // SHP Record Header
    shpView.setInt32(shpOffset, recordNum, false); // Big endian
    shpView.setInt32(shpOffset + 4, recordLengthWords, false); // Big endian

    // SHP Record Content
    shpView.setInt32(shpOffset + 8, 1, true); // Shape type Point = 1 (Little endian)
    shpView.setFloat64(shpOffset + 12, geom.x, true);
    shpView.setFloat64(shpOffset + 20, geom.y, true);

    // SHX Record
    const offsetWords = shpOffset / 2;
    shxView.setInt32(shxOffset, offsetWords, false); // Big endian
    shxView.setInt32(shxOffset + 4, recordLengthWords, false); // Big endian

    shpOffset += shpRecordSize;
    shxOffset += 8;
  });

  return { shp: shpUint8, shx: shxUint8 };
}

/**
 * Main Client-Side Function: Generates a complete zipped ESRI Shapefile (.zip)
 */
export async function generateShapefileZip(
  points: ExportPoint[],
  useUtmProjection = true
): Promise<Blob> {
  const zip = new JSZip();

  // Group by zone or export unified
  const primaryZone = points.length > 0 ? points[0].zone : 47;
  const isGeodetic = !useUtmProjection;

  const prjContent = getWKTProjection(isGeodetic ? undefined : primaryZone);
  const dbfBytes = createDBF(points);
  const { shp, shx } = createSHPAndSHX(points, isGeodetic);

  const prefix = isGeodetic
    ? 'Survey_Points_WGS84'
    : `Survey_Points_UTM_Zone${primaryZone}N`;

  zip.file(`${prefix}.shp`, shp);
  zip.file(`${prefix}.shx`, shx);
  zip.file(`${prefix}.dbf`, dbfBytes);
  zip.file(`${prefix}.prj`, prjContent);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Main Client-Side Function: Generates GeoJSON FeatureCollection
 */
export function generateGeoJSON(points: ExportPoint[], useUtmCoords = false): string {
  const features = points.map((pt) => {
    let coords: [number, number, number];
    if (useUtmCoords) {
      coords = [pt.easting, pt.northing, pt.msl];
    } else {
      const geo = pt.lat && pt.lon ? { lat: pt.lat, lon: pt.lon } : utmToLatLon(pt.easting, pt.northing, pt.zone);
      coords = [geo.lon, geo.lat, pt.msl];
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coords,
      },
      properties: {
        id: pt.id,
        name: pt.name,
        easting: pt.easting,
        northing: pt.northing,
        msl: pt.msl,
        zone: pt.zone,
        description: pt.description || pt.remarks || '',
      },
    };
  });

  const geoJson = {
    type: 'FeatureCollection',
    name: 'Survey_Master_Points',
    crs: useUtmCoords
      ? {
          type: 'name',
          properties: {
            name: `urn:ogc:def:crs:EPSG::${points[0]?.zone === 48 ? 32648 : 32647}`,
          },
        }
      : {
          type: 'name',
          properties: {
            name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
          },
        },
    features,
  };

  return JSON.stringify(geoJson, null, 2);
}
