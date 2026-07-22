/**
 * GeoSurvey Pro Express + Vite Dev & Production Server with Gemini API Route
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Endpoint: Parse unstructured text or field notes into structured survey points using Gemini API
  app.post('/api/parse-coordinates', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'กรุณาระบุข้อความหรือบันทึกพิกัดสนามที่ต้องการให้ AI วิเคราะห์' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อม ( Environment Variable Missing )',
          offlineFallback: true
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
คุณเป็นผู้เชี่ยวชาญการประมวลผลพิกัดภูมิสารสนเทศและการสำรวจรังวัด (Geodetic Survey AI Assistant)
โปรดอ่านข้อความบันทึกภาคสนามหรือตารางที่ไม่เป็นระเบียบด้านล่างนี้ แล้วทำการสกัด (Extract) ค่าพิกัดจุดสำรวจออกมาในรูปแบบ JSON Array

กฎเกณฑ์ในการสกัด:
1. ค้นหา ชื่อหมุด (name), ค่า Easting E (x), ค่า Northing N (y), ค่าความสูง MSL Elevation (msl), UTM Zone (47 หรือ 48) และ หมายเหตุ (remarks)
2. หากค่าพิกัดเป็น Lat/Lon ให้แปลงเป็น Easting/Northing หรือระบุใน remarks
3. ส่งคืนผลลัพธ์ในรูปแบบ JSON Pure Object เท่านั้น ไม่ต้องมี Markdown backticks codeblock ดังนี้:
{
  "points": [
    {
      "name": "string",
      "easting": number,
      "northing": number,
      "msl": number,
      "zone": 47 หรือ 48,
      "remarks": "string"
    }
  ]
}

ข้อความบันทึกภาคสนามที่ต้องสกัด:
"${text}"
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsedData = JSON.parse(cleanJsonStr);
        return res.json(parsedData);
      } catch (e) {
        return res.json({ points: [], raw: responseText });
      }
    } catch (err: any) {
      console.error('Gemini API parse error:', err);
      return res.status(500).json({ error: `เกิดข้อผิดพลาดในการประมวลผล Gemini AI: ${err.message}` });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'GeoSurvey Pro', timestamp: new Date().toISOString() });
  });

  // Vite middleware for dev / static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GeoSurvey Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
