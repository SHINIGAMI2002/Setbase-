/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { BasePoint } from '../types';
import { utmToLatLon, latLonToUtm } from '../utils/coordinateConverter';
import { parseSWMapsFile, ParsedSurveyPoint } from '../utils/swMapsParser';
import { generateShapefileZip, generateGeoJSON, ExportPoint } from '../utils/shapefileWriter';
import { 
  Upload, 
  FileSpreadsheet, 
  Trash2, 
  Download, 
  Layers, 
  Check, 
  RefreshCw, 
  FileCode, 
  Search, 
  Database,
  Grid,
  Info,
  Copy,
  AlertCircle,
  AlertTriangle,
  MapPin,
  CheckCircle2
} from 'lucide-react';

interface DataAggregatorProps {
  points: BasePoint[];
  onAddPoint: (pt: BasePoint) => void;
  onSelectPoint: (id: string) => void;
}

interface MasterRow {
  id: string;
  featureName: string;
  lat: number;
  lon: number;
  x: number; // Easting
  y: number; // Northing
  elevation: number;
  remarks: string;
  zone: 47 | 48;
  warnings?: string[];
  isDDMMConverted?: boolean;
  isOutOfBounds?: boolean;
  isAbnormalElevation?: boolean;
}

export default function DataAggregator({ points, onAddPoint, onSelectPoint }: DataAggregatorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; status: string }[]>([]);
  const [masterTable, setMasterTable] = useState<MasterRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [exportingShp, setExportingShp] = useState(false);
  
  // Auto-Base candidates extracted
  const [baseCandidates, setBaseCandidates] = useState<MasterRow[]>([]);
  const [selectedBaseCandidate, setSelectedBaseCandidate] = useState<MasterRow | null>(null);

  // User coordinate choices for GIS
  const [exportProjection, setExportProjection] = useState<'wgs84' | 'utm47' | 'utm48'>('wgs84');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler for multiple files (.csv, .xlsx, .xls)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    
    const newFilesList = files.map(file => ({
      name: file.name,
      size: file.size,
      status: 'กำลังประมวลผล...'
    }));
    setUploadedFiles(prev => [...prev, ...newFilesList]);

    let newRowsAccumulator: MasterRow[] = [];
    let newBasesAccumulator: MasterRow[] = [];

    for (const file of files) {
      try {
        const parsedPoints: ParsedSurveyPoint[] = await parseSWMapsFile(file);
        
        const fileRows: MasterRow[] = parsedPoints.map((p) => ({
          id: p.id,
          featureName: p.name,
          lat: p.lat,
          lon: p.lon,
          x: p.easting,
          y: p.northing,
          elevation: p.msl,
          remarks: p.remarks,
          zone: p.zone,
          warnings: p.warnings,
          isDDMMConverted: p.isDDMMConverted,
          isOutOfBounds: p.isOutOfBounds,
          isAbnormalElevation: p.isAbnormalElevation,
        }));

        const fileBases = fileRows.filter(r => r.remarks.toUpperCase().includes('BASE'));

        newRowsAccumulator = [...newRowsAccumulator, ...fileRows];
        newBasesAccumulator = [...newBasesAccumulator, ...fileBases];

        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: `สำเร็จ (${fileRows.length} จุด)` } : f));
      } catch (err) {
        console.error('Error parsing file: ' + file.name, err);
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'เกิดข้อผิดพลาด' } : f));
      }
    }

    // Merge with existing master table and drop duplicates
    const combined = [...masterTable, ...newRowsAccumulator];
    
    // Deduplication key: exact X and Y coordinates (or exact Lat/Lon)
    const seen = new Set<string>();
    const uniqueRows: MasterRow[] = [];
    let filteredOut = 0;

    for (const r of combined) {
      if (r.x === 0 && r.y === 0 && r.lat === 0 && r.lon === 0) continue; // skip empty coordinates

      const key = `${r.x.toFixed(3)}_${r.y.toFixed(3)}_${r.featureName.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRows.push(r);
      } else {
        filteredOut++;
      }
    }

    setMasterTable(uniqueRows);
    setDuplicateCount(prev => prev + filteredOut);

    // Update Auto-base candidates list
    if (newBasesAccumulator.length > 0) {
      setBaseCandidates(prev => {
        const combinedBases = [...prev, ...newBasesAccumulator];
        const uniqueBasesMap = new Map<string, MasterRow>();
        for (const b of combinedBases) {
          const key = `${b.x.toFixed(3)}_${b.y.toFixed(3)}`;
          uniqueBasesMap.set(key, b);
        }
        return Array.from(uniqueBasesMap.values());
      });
      // Suggest the first base found
      setSelectedBaseCandidate(newBasesAccumulator[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dataTransferInput = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(dataTransferInput);
    }
  };

  // Inject extracted base to our points database and make it active base station
  const applyCandidateBase = (cand: MasterRow) => {
    const freshPoint: BasePoint = {
      id: `imported-base-${Date.now()}`,
      name: cand.featureName,
      easting: cand.x,
      northing: cand.y,
      msl: cand.elevation,
      zone: cand.zone,
      description: `สถานีฐานที่ดึงพิกัดอัตโนมัติจากไฟล์ SW Maps/CSV (${cand.remarks})`,
      isDefault: false
    };

    onAddPoint(freshPoint);
    onSelectPoint(freshPoint.id);
    alert(`อัปเกรดและติดตั้งพิกัด ${cand.featureName} เป็นค่าสถานีอ้างอิงหลักเครื่องคำนวณ Base Station เรียบร้อยแล้ว!`);
  };

  const clearAllData = () => {
    if (confirm('กรุณายืนยันการล้างข้อมูลสำราจในตาราง Master Table และไฟล์ที่อัปโหลดทั้งหมด?')) {
      setUploadedFiles([]);
      setMasterTable([]);
      setBaseCandidates([]);
      setSelectedBaseCandidate(null);
      setDuplicateCount(0);
    }
  };

  // CSV Downloader
  const downloadCSV = () => {
    if (masterTable.length === 0) return;
    
    const headers = 'Feature Name,Lat,Lon,X,Y,Elevation,Remarks,Zone,Warnings\n';
    const rows = masterTable.map(r => 
      `"${r.featureName.replace(/"/g, '""')}",${r.lat.toFixed(6)},${r.lon.toFixed(6)},${r.x.toFixed(3)},${r.y.toFixed(3)},${r.elevation.toFixed(3)},"${r.remarks.replace(/"/g, '""')}",${r.zone},"${(r.warnings || []).join('; ')}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Master_Survey_Table_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 100% Client-Side Shapefile (.zip) Downloader
  const handleDownloadShapefile = async () => {
    if (masterTable.length === 0) return;
    setExportingShp(true);
    try {
      const exportPoints: ExportPoint[] = masterTable.map((r) => ({
        id: r.id,
        name: r.featureName,
        zone: r.zone,
        easting: r.x,
        northing: r.y,
        msl: r.elevation,
        remarks: r.remarks,
        lat: r.lat,
        lon: r.lon,
      }));

      const isUtm = exportProjection !== 'wgs84';
      const zipBlob = await generateShapefileZip(exportPoints, isUtm);

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Master_Survey_Shapefile_${exportProjection.toUpperCase()}_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`ไม่สามารถสร้าง Shapefile ได้: ${err.message}`);
    } finally {
      setExportingShp(false);
    }
  };

  // 100% Client-Side GeoJSON Downloader
  const downloadGeoJSON = () => {
    if (masterTable.length === 0) return;

    const exportPoints: ExportPoint[] = masterTable.map((r) => ({
      id: r.id,
      name: r.featureName,
      zone: r.zone,
      easting: r.x,
      northing: r.y,
      msl: r.elevation,
      remarks: r.remarks,
      lat: r.lat,
      lon: r.lon,
    }));

    const jsonStr = generateGeoJSON(exportPoints, exportProjection !== 'wgs84');

    const blob = new Blob([jsonStr], { type: 'application/geo+json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Master_Survey_Points_${exportProjection}_${Date.now()}.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // KML Downloader
  const downloadKML = () => {
    if (masterTable.length === 0) return;

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    kmlContent += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`;
    kmlContent += `  <Document>\n`;
    kmlContent += `    <name>Master Survey Geodetic Points</name>\n`;
    kmlContent += `    <Style id="surveyPoint">\n`;
    kmlContent += `      <IconStyle>\n`;
    kmlContent += `        <color>ff00c8ff</color>\n`;
    kmlContent += `        <scale>1.2</scale>\n`;
    kmlContent += `        <Icon>\n`;
    kmlContent += `          <href>http://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href>\n`;
    kmlContent += `        </Icon>\n`;
    kmlContent += `      </IconStyle>\n`;
    kmlContent += `    </Style>\n`;

    masterTable.forEach(p => {
      kmlContent += `    <Placemark>\n`;
      kmlContent += `      <name>${p.featureName}</name>\n`;
      kmlContent += `      <description><![CDATA[\n`;
      kmlContent += `        <strong>Easting (X):</strong> ${p.x.toFixed(3)} m<br/>\n`;
      kmlContent += `        <strong>Northing (Y):</strong> ${p.y.toFixed(3)} m<br/>\n`;
      kmlContent += `        <strong>Elevation (Z):</strong> ${p.elevation.toFixed(3)} m<br/>\n`;
      kmlContent += `        <strong>Remarks:</strong> ${p.remarks}<br/>\n`;
      kmlContent += `        <strong>Datum Zone:</strong> ${p.zone}N\n`;
      kmlContent += `      ]]></description>\n`;
      kmlContent += `      <styleUrl>#surveyPoint</styleUrl>\n`;
      kmlContent += `      <Point>\n`;
      kmlContent += `        <coordinates>${p.lon.toFixed(7)},${p.lat.toFixed(7)},${p.elevation.toFixed(3)}</coordinates>\n`;
      kmlContent += `      </Point>\n`;
      kmlContent += `    </Placemark>\n`;
    });

    kmlContent += `  </Document>\n`;
    kmlContent += `</kml>\n`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Master_Survey_Points_${Date.now()}.kml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Streamlit Python Script Generator
  const generatePythonScript = () => {
    const pythonCode = `import streamlit as st
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import io
import zipfile
import os

st.set_page_config(
    page_title="GeoSurvey Pro GIS Engine", 
    page_icon="🗺️", 
    layout="wide",
    initial_sidebar_state="expanded"
)

# Application Branded Banner with Custom Styling
st.title("🛰️ GeoSurvey Pro - GIS & Shapefile Engine")
st.markdown("""
    เครื่องมือรวบรวมพิกัดสำรวจ, สแกนสถานีฐานอัตโนมัติ และเซฟไฟล์เป็น Shapefile (.shp)
    ขับเคลื่อนด้วยไลบรารี **GeoPandas + Streamlit** ระดับเวิร์กสเปซประสิทธิภาพสูง
""")

st.sidebar.header("🛠️ การตั้งค่าแผนรังวัด")
target_crs_choice = st.sidebar.selectbox(
    "เลือกระบบพิกัดสำหรับ Shapefile",
    ["WGS84 (EPSG:4326)", "UTM Zone 47N (EPSG:32647)", "UTM Zone 48N (EPSG:32648)"],
    index=0
)

# Extract EPSG numeric code
epsg_code = 4326
if "47N" in target_crs_choice:
    epsg_code = 32647
elif "48N" in target_crs_choice:
    epsg_code = 32648

# Multi-file Input
uploaded_files = st.file_uploader(
    "อัปโหลดไฟล์สำรวจพิกัด CSV (เลือกทีละหลายไฟล์เพื่อรวบรวม)",
    type=["csv"],
    accept_multiple_files=True
)

master_list = []
base_stations = []

if uploaded_files:
    st.subheader("📁 การนำเข้าและประมวลผลข้อมูล")
    
    for file in uploaded_files:
        try:
            # Read single dataframe
            df = pd.read_csv(file)
            st.success(f"อ่านไฟล์สำเร็จ: {file.name} ({len(df)} แถวพิกัด)")

            # Standardize Columns naming (case-insensitive & supports TH/EN headers)
            col_map = {}
            for col in df.columns:
                c_clean = col.strip().lower()
                if any(x in c_clean for x in ['name', 'point', 'feature', 'หมุด', 'no']):
                    col_map[col] = 'Feature Name'
                elif any(x in c_clean for x in ['lat', 'ละติจูด']):
                    col_map[col] = 'Lat'
                elif any(x in c_clean for x in ['lon', 'lng', 'ลองจิจูด']):
                    col_map[col] = 'Lon'
                elif c_clean in ['x', 'easting', 'e'] or 'พิกัดe' in c_clean:
                    col_map[col] = 'X'
                elif c_clean in ['y', 'northing', 'n'] or 'พิกัดn' in c_clean:
                    col_map[col] = 'Y'
                elif any(x in c_clean for x in ['elev', 'msl', 'height', 'ระดับ']):
                    col_map[col] = 'Elevation'
                elif any(x in c_clean for x in ['remark', 'comment', 'note', 'หมายเหตุ']):
                    col_map[col] = 'Remarks'
                elif 'zone' in c_clean or 'โซน' in c_clean:
                    col_map[col] = 'Zone'

            df = df.rename(columns=col_map)
            
            # Ensure missing essential columns exist
            for req_col in ['Feature Name', 'Lat', 'Lon', 'X', 'Y', 'Elevation', 'Remarks']:
                if req_col not in df.columns:
                    df[req_col] = "" if req_col in ['Feature Name', 'Remarks'] else 0.0

            # 🔎 1. Auto-Base Extraction: Scan 'Remarks' column
            if 'Remarks' in df.columns:
                # Filter rows where remarks contain 'BASE' (case-insensitive)
                base_rows = df[df['Remarks'].astype(str).str.upper().str.contains('BASE', na=False)]
                for _, row in base_rows.iterrows():
                    base_stations.append({
                        'File': file.name,
                        'Name': row['Feature Name'],
                        'Easting (X)': row['X'],
                        'Northing (Y)': row['Y'],
                        'Elevation': row['Elevation'],
                        'Remarks': row['Remarks']
                    })

            master_list.append(df[['Feature Name', 'Lat', 'Lon', 'X', 'Y', 'Elevation', 'Remarks']])
            
        except Exception as e:
            st.error(f"ไม่สามารถแปลงไฟล์ได้ {file.name}: {str(e)}")

    # Display Extracted Base Stations Automatically!
    if base_stations:
        st.info("🎯 **Auto-Base Extraction Alert: ตรวจพบพิกัดสถานีฐาน (Base Station) อัตโนมัติ!**")
        base_df = pd.DataFrame(base_stations)
        st.dataframe(base_df, use_container_width=True)
        
        # Pull coordinates of the first base detected to showcase
        top_base = base_stations[0]
        st.metric(
            label=f"📡 ระบบเลือกพิกัดสถานีฐานอัตนโนมัติ: {top_base['Name']}", 
            value=f"E: {top_base['Easting (X)']}, N: {top_base['Northing (Y)']}",
            delta=f"MSL Elev: {top_base['Elevation']} m"
        )

    # 🗃️ 2. Master Data Aggregator
    if master_list:
        combined_df = pd.concat(master_list, ignore_index=True)
        
        # Deduplication logic: Drop duplicates based on X and Y coordinates directly
        initial_count = len(combined_df)
        combined_df = combined_df.drop_duplicates(subset=['X', 'Y', 'Feature Name']).reset_index(drop=True)
        final_count = len(combined_df)
        
        st.subheader("📑 Master Data Coordinates Table")
        st.markdown(f"รวบรวมข้อมูลพิกัดทั้งหมดเสร็จสิ้นแล้ว: **{final_count} แถวพิกัดหลัก** (กรองพิกัดซ้ำกันทิ้งพ้นระบบ {initial_count - final_count} แถว)")
        
        st.dataframe(combined_df, use_container_width=True)

        # 🗺️ 3. GIS Export Engine
        st.subheader("📥 ดาวน์โหลดส่งออกข้อมูล GIS / Shapefile")
        
        col_exp1, col_exp2 = st.columns(2)
        
        with col_exp1:
            st.write("📈 **ส่งออกค่าพิกัดสำรวจเป็นจุดแผนที่**")
            # Create GeoDataFrame
            try:
                # Convert Lat/Lon string inputs to float numbers
                combined_df['Lat'] = pd.to_numeric(combined_df['Lat'], errors='coerce')
                combined_df['Lon'] = pd.to_numeric(combined_df['Lon'], errors='coerce')
                combined_df = combined_df.dropna(subset=['Lat', 'Lon'])
                
                # Check geometries
                geometry = [Point(xy) for xy in zip(combined_df['Lon'], combined_df['Lat'])]
                
                # Initialize GDF in WGS84
                gdf = gpd.GeoDataFrame(combined_df, geometry=geometry, crs="EPSG:4326")
                
                # Project if desired
                if epsg_code != 4326:
                    gdf = gdf.to_crs(epsg=epsg_code)
                    st.write(f"แปลงระบบพิกัดเป้าส่งออกสำเร็จสู่ CRS ID: **EPSG:{epsg_code}**")
                
                # Shapefile can only hold 10 column-characters. Clean fields for safety
                gdf_export = gdf.copy()
                gdf_export.columns = [c[:10] for c in gdf_export.columns]

                # Generate Shapefile in virtual memory & download as ZIP!
                shp_buffer = io.BytesIO()
                with zipfile.ZipFile(shp_buffer, 'w', zipfile.ZIP_DEFLATED) as z:
                    # Write files to scratch directory
                    basename = "Survey_Master_Data"
                    gdf_export.to_file(f"{basename}.shp")
                    
                    # Package components
                    for ext in ['shp', 'shx', 'dbf', 'prj']:
                        fn = f"{basename}.{ext}"
                        if os.path.exists(fn):
                            z.write(fn)
                            os.remove(fn) # Clean scratch

                shp_buffer.seek(0)
                st.download_button(
                    label="📥 ดาวน์โหลด ESRI Shapefile (.ZIP)",
                    data=shp_buffer,
                    file_name=f"Master_Survey_Metadata_EPSG{epsg_code}.zip",
                    mime="application/zip",
                    use_container_width=True
                )
            except Exception as e:
                st.error(f"การแปลง Shapefile ล้มเหลว: {str(e)}")

        with col_exp2:
            st.write("📊 **ส่งออกไฟล์ออฟฟิศมาตรฐาน**")
            # Clear standard CSV download
            csv_data = combined_df.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 ดาวน์โหลดไฟล์รหัสพิกัดรวม .CSV",
                data=csv_data,
                file_name="Master_Survey_Database_Aggregated.csv",
                mime="text/csv",
                use_container_width=True
            )
else:
    st.info("💡 กรุณาอัปโหลดไฟล์รหัส CSV รังวัดรังแกนพิกัดสำรวจ จากแถบด้านซ้ายหรือช่องลากอัปโหลดเพื่อเปิดทำเวิร์กเสปซหลัก!")
`;

    const blob = new Blob([pythonCode], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'streamlit_addon.py');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('คัดลอกไลบรารีโค้ดเรียบร้อย!');
  };

  // Filter master records for displaying in grid / search
  const filteredTable = masterTable.filter(r => 
    r.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.remarks.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#16171D] rounded-2xl border border-white/10 shadow-lg p-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            เครื่องมือนำเข้าและประมวลผลข้อมูลรังวัด (GIS & Master Data Aggregator Suite)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            อัปโหลดไฟล์สมุดพิกัด CSV หลายชิ้น ทำการดึงพิกัดสถานีฐานอัตนโนมัติ ตรวจสอบพิกัดและข้อมูลข้ามไฟล์ พร้อมคัดกรองข้อมูลรวมพ้นพิกัดอย่างสะสางสมบูรณ์
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Column */}
        <div className="lg:col-span-1 space-y-6">
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="bg-[#121216]/60 border-2 border-dashed border-white/10 hover:border-amber-500/50 rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[190px] relative"
          >
            <input 
              type="file" 
              multiple 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv, .xlsx, .xls"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">ลากไฟล์ CSV / Excel (.xlsx, .xls) SW Maps มาวางที่นี่</h3>
            <p className="text-[11px] text-slate-500 mb-2">รองรับไฟล์จาก SW Maps, RTK Collector หรือ CSV มาตรฐาน (ประมวลผลบนเบราว์เซอร์ 100%)</p>
            <span className="text-[10px] text-amber-500/80 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              SW MAPS & COMNAV DDMM RECTIFIER ACTIVE
            </span>
          </div>

          {/* List of uploaded files status panel */}
          {uploadedFiles.length > 0 && (
            <div className="bg-[#16171D] border border-white/10 rounded-2xl p-5 space-y-3.5">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">สมุดไฟล์ข้อมูลนำเข้า ({uploadedFiles.length})</h4>
                <button
                  onClick={clearAllData}
                  className="text-[10px] text-rose-500 hover:text-rose-400 font-bold underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  ล้างข้อมูลย้อนหลัง
                </button>
              </div>

              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 text-xs scrollbar-thin">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-black/30 border border-white/5 p-2 rounded-lg gap-2 text-[11px]">
                    <div className="flex items-center gap-2 truncate pr-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate text-slate-300 font-medium" title={f.name}>{f.name}</span>
                    </div>
                    <span className={`shrink-0 font-bold text-[9px] px-1.5 py-0.5 rounded ${
                      f.status.includes('สำเร็จ') ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                    }`}>
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Auto-Base candidates alerts */}
          {baseCandidates.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">พบพิกัด Base Station จากไฟล์!</h4>
                  <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                    ระบบสแกนคอลัมน์ <strong className="text-amber-500">Remarks</strong> และตรวจพบพิกัดระบุอิง <strong className="text-white">"BASE"</strong> จำนวน ( {baseCandidates.length} ) จุดหลัก คุณสามารถอัปเกรดจุดรังวัดนี้ขึ้นเป็นหมุดใช้คำนวณฐานของระบบทันที:
                  </p>
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 p-3 rounded-xl space-y-2.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-sans">ชื่อหมุดฐาน:</span>
                  <span className="font-bold text-white">{selectedBaseCandidate?.featureName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-sans">พิกัด UTM:</span>
                  <span>E: {selectedBaseCandidate?.x.toFixed(3)} , N: {selectedBaseCandidate?.y.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-sans">MSL Elevation:</span>
                  <span className="text-amber-400 font-bold">{selectedBaseCandidate?.elevation.toFixed(3)} m</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-sans">หมายเหตุ:</span>
                  <span className="italic text-slate-400 text-[10px]">{selectedBaseCandidate?.remarks}</span>
                </div>

                <button
                  onClick={() => selectedBaseCandidate && applyCandidateBase(selectedBaseCandidate)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-lg active:scale-97 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-black stroke-[3]" />
                  ใช้พิกัดนี้แปรเป็นสถานีฐานจุดคำนวณรังวัดหลัก
                </button>
              </div>

              {baseCandidates.length > 1 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold font-sans">รายชื่อฟิลด์สถานีฐานที่เหลืออยู่ในตาราง:</span>
                  <div className="flex flex-wrap gap-1">
                    {baseCandidates.map((bc, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedBaseCandidate(bc)}
                        className={`text-[9.5px] px-2 py-0.75 rounded border ${
                          selectedBaseCandidate?.id === bc.id 
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 font-bold' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {bc.featureName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Master Table columns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#16171D] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Grid className="w-4.5 h-4.5 text-amber-500" />
                  ตารางสารสนเทศภูมิศาสตร์รวมพิกัด (Master Geodetic Table)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  บัญชีฐานข้อมูลสำรวจรวมเรียง แฟกทอรีข้อมูลจำนวน <strong className="text-white font-bold">{masterTable.length} แถวพิกัด</strong> {duplicateCount > 0 && `(ตัดข้อมูลตำแหน่งพิกัดซ้ำกันทิ้งพ้นตารางแล้ว ${duplicateCount} รายการ)`}
                </p>
              </div>

              {masterTable.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={downloadCSV}
                    type="button"
                    className="h-9 px-3.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-450 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                    title="ดาวน์โหลดไฟล์สำรองข้อมูลตารางพิกัดทั้งหมดเป็นฟอร์แมต CSV เพื่อป้องกันการสูญหาย"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-550" />
                    <span>สำรองค่าพิกัด (Backup CSV)</span>
                  </button>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหมุด, หมายเหตุ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-40 sm:w-48 h-9 pl-8 pr-3 bg-black/60 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.75" />
                  </div>
                </div>
              )}
            </div>

            {masterTable.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-2.5 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">ยังไม่มีข้อมูลในตารางรวบรวม</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-sm leading-normal">
                  อัปโหลดไฟล์รายงานหรือผลการสำรวจจาก SW Maps, Excel (.xlsx/.xls) หรือ CSV ตรงแถบซ้ายมือ ข้อมูลพิกัดของแต่ละไฟล์จะนำมาระดม คัดข้อมูลผิดปกติ และกรองข้อมูลซ้ำกันออกโดยอัตโนมัติ
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop View Table */}
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 max-h-[380px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-[#121216] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 w-10 text-center">ที่</th>
                        <th className="p-2.5">ชื่อหมุด (Feature Name)</th>
                        <th className="p-2.5">Easting E (X)</th>
                        <th className="p-2.5">Northing N (Y)</th>
                        <th className="p-2.5">MSL Elev (Z)</th>
                        <th className="p-2.5 text-slate-400">Lat (Decimal)</th>
                        <th className="p-2.5 text-slate-400">Lon (Decimal)</th>
                        <th className="p-2.5">Zone</th>
                        <th className="p-2.5">สถานะ/เตือน</th>
                        <th className="p-2.5">หมายเหตุ / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                      {filteredTable.map((r, index) => {
                        const isBase = r.remarks.toUpperCase().includes('BASE');
                        const hasWarnings = (r.warnings && r.warnings.length > 0) || r.isDDMMConverted || r.isOutOfBounds || r.isAbnormalElevation;

                        return (
                          <tr key={r.id} className={`hover:bg-white/3 transition-colors ${
                            isBase ? 'bg-amber-500/5 text-amber-300 font-bold' : hasWarnings ? 'bg-amber-500/5' : ''
                          }`}>
                            <td className="p-2.5 text-center text-slate-500 font-sans">{index + 1}</td>
                            <td className="p-2.5 text-white font-sans font-bold flex items-center gap-1.5">
                              {r.featureName}
                              {isBase && (
                                <span className="text-[8.5px] scale-90 font-black bg-amber-500 text-black px-1 rounded">BASE</span>
                              )}
                            </td>
                            <td className="p-2.5">{r.x.toFixed(3)}</td>
                            <td className="p-2.5">{r.y.toFixed(3)}</td>
                            <td className={`p-2.5 ${r.isAbnormalElevation ? 'text-rose-400 font-bold' : 'text-amber-400'}`}>
                              {r.elevation.toFixed(3)}
                            </td>
                            <td className={`p-2.5 text-[10px] ${r.isOutOfBounds ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                              {r.lat.toFixed(6)}
                            </td>
                            <td className={`p-2.5 text-[10px] ${r.isOutOfBounds ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                              {r.lon.toFixed(6)}
                            </td>
                            <td className="p-2.5 font-sans">Zone {r.zone}N</td>
                            <td className="p-2.5 font-sans">
                              {r.isDDMMConverted && (
                                <span className="inline-block text-[9px] bg-sky-500/10 border border-sky-500/30 text-sky-400 px-1.5 py-0.5 rounded font-bold mr-1" title="แปลง DDMM.MMMMM เป็น Decimal">
                                  DDMM Fixed
                                </span>
                              )}
                              {r.isOutOfBounds && (
                                <span className="inline-block text-[9px] bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded font-bold mr-1" title="พิกัดอยู่นอกเขตปกติ">
                                  Out Bounds
                                </span>
                              )}
                              {r.isAbnormalElevation && (
                                <span className="inline-block text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-bold" title="ความสูง MSL ผิดสังเกต">
                                  Elev Flag
                                </span>
                              )}
                              {!hasWarnings && (
                                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ปกติ
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-400 italic font-sans max-w-[150px] truncate" title={r.remarks}>{r.remarks || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Exporter UI Buttons Grid */}
                <div className="bg-black/35 border border-white/5 rounded-2xl p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                        <Download className="w-4 h-4 text-amber-500" />
                        GIS Direct Export Engine (100% Client-Side Generator)
                      </h4>
                      <p className="text-[10px] text-slate-400">ส่งออกเป็น Shapefile (.shp), GeoJSON หรือ KML ได้ทันทีโดยไม่ต้องผ่านเซิร์ฟเวอร์</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] text-slate-400">ระบบพิกัด:</span>
                      <select
                        value={exportProjection}
                        onChange={(e) => setExportProjection(e.target.value as any)}
                        className="h-8 px-2 bg-[#1C1D24] border border-white/10 rounded-lg text-xs text-amber-400 font-bold focus:outline-none"
                      >
                        <option value="wgs84">WGS84 Geodetic (Lat, Lon)</option>
                        <option value="utm47">UTM Zone 47N (Easting, Northing)</option>
                        <option value="utm48">UTM Zone 48N (Easting, Northing)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <button
                      onClick={handleDownloadShapefile}
                      disabled={exportingShp}
                      className="py-3 px-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-97 shadow-lg"
                    >
                      <Layers className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>{exportingShp ? 'กำลังสร้าง...' : 'ดาวน์โหลด Shapefile (.ZIP)'}</span>
                    </button>

                    <button
                      onClick={downloadGeoJSON}
                      className="py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/50 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-97"
                    >
                      <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>ส่งออก GeoJSON</span>
                    </button>
                    
                    <button
                      onClick={downloadKML}
                      className="py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/50 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-97"
                    >
                      <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>ส่งออก Google Earth KML</span>
                    </button>

                    <button
                      onClick={downloadCSV}
                      className="py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/50 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-97"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                      <span>บันทึกตาราง CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Python/Streamlit Code Integration Assistant Panel */}
      <div className="bg-[#16171D] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-start gap-2.5">
            <FileCode className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                โปรเซสเซอร์แปลงพิกัด Shapefile ด้วย Geopandas (Streamlit Python Addon)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                เนื่องจากโปรแกรมสำรวจแผนที่นี้ทำงานรวดเร็วบนหน้าเบราว์เซอร์ (React SPA) หากต้องการแปลงตารางมาสเตอร์นี้เป็นไฟล์ **ESRI Shapefile (.shp)** ทรงความสามารถสูงโดยตรงในระบบปฏิบัติการของคุณ คุณสามารถโหลดสคริปต์ Python ของเราไปใช้งานตามที่คุณร้องขอได้เลย!
              </p>
            </div>
          </div>
          <button
            onClick={generatePythonScript}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-xl cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-black stroke-[3]" />
            ดาวน์โหลดโค้ด Python (app.py)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans leading-relaxed text-slate-350">
          <div className="bg-black/25 border border-white/5 rounded-xl p-4.5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
              <Info className="w-4 h-4 text-amber-500 shrink-0" />
              การติดตั้งไลบรารีในไฟล์ requirements.txt
            </h4>
            <p className="text-[11px] text-slate-450 leading-normal">
              ให้คุณสร้างไฟล์ชื่อ <code className="text-amber-500 bg-black px-1.5 py-0.5 rounded font-mono">requirements.txt</code> ในห้องโปรเจกต์ของเครื่องคุณ แล้วคัดลอกรายชื่อไลบรารีดังด้านล่างนี้ลงไปเซฟรักษา:
            </p>
            <div className="relative">
              <pre className="p-3 bg-black/50 border border-white/10 rounded-lg text-[10.5px] font-mono text-slate-200">
                {`streamlit>=1.30.0
pandas>=2.0.0
geopandas>=0.14.0
shapely>=2.0.0
pyproj>=3.6.0`}
              </pre>
              <button
                maxLength={4}
                onClick={() => copyToClipboard(`streamlit>=1.30.0\npandas>=2.0.0\ngeopandas>=0.14.0\nshapely>=2.0.0\npyproj>=3.6.0`)}
                className="absolute right-2 top-2 p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] hover:text-white cursor-pointer"
              >
                คัดลอก
              </button>
            </div>
          </div>

          <div className="bg-black/25 border border-white/5 rounded-xl p-4.5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
              <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
              วีธีบูตระบบใช้งานเครื่องมือ Python/Streamlit
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px]">
              <li>
                สร้างแฟ้มทำงานใหม่ และนำไฟล์ดาวน์โหลด <code className="text-amber-500 font-mono bg-black px-1.5 py-0.5 rounded text-[10px]">streamlit_addon.py</code> ไปวางเก็บ
              </li>
              <li>
                รันคำสั่งในเทอร์มินัลเพื่อติดตั้งไลบรารีพล็อตแผนที่ทั้งหมด:<br />
                <code className="block pr-12 w-full mt-1 p-2 bg-black/40 border border-white/5 text-slate-200 font-mono rounded text-[10px] relative">
                  pip install -r requirements.txt
                  <button
                    onClick={() => copyToClipboard("pip install -r requirements.txt")}
                    className="absolute right-1.5 top-1.5 p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[8px] hover:text-white cursor-pointer font-sans"
                  >
                    คัดลอก
                  </button>
                </code>
              </li>
              <li>
                สั่งรันโปรแกรม Streamlit พิกัดเพื่อให้ระบบเสิร์ฟหน้าเว็บเสถียรภาพสูง:<br />
                <code className="block pr-12 w-full mt-1 p-2 bg-black/40 border border-white/5 text-slate-200 font-mono rounded text-[10px] relative">
                  streamlit run streamlit_addon.py
                  <button
                    onClick={() => copyToClipboard("streamlit run streamlit_addon.py")}
                    className="absolute right-1.5 top-1.5 p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[8px] hover:text-white cursor-pointer font-sans"
                  >
                    คัดลอก
                  </button>
                </code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
