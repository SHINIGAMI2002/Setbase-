import streamlit as st
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import io
import zipfile
import os

st.set_page_config(
    page_title="GeoSurvey Pro GIS Engine", 
    page_icon="🛰️", 
    layout="wide"
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
    st.info("💡 กรุณาอัปโหลดไฟล์รหัส CSV รังวัดรังแกนพิกัดสำรวจ เพื่อเปิดทำเวิร์กเสปซหลัก!")
