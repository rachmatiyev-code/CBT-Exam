import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// =========================================================================
// CENTRALIZED SERVER-SIDE DATABASE (Multi-Device Sync for CBT)
// =========================================================================
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cbt-db.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

interface ServerCBTState {
  exam: any | null;
  schoolProfile: any | null;
  students: any[] | null;
  packages: any[] | null;
  sessions: any[];
  lastUpdated: string;
}

// In-memory active heartbeats of students currently taking the exam
const activePings: Record<
  string,
  {
    studentId: string;
    studentName: string;
    classRoom: string;
    tabViolations: number;
    lastSeen: number;
  }
> = {};

// Clean up stale pings (> 45s without heartbeat)
setInterval(() => {
  const now = Date.now();
  for (const [id, ping] of Object.entries(activePings)) {
    if (now - ping.lastSeen > 45000) {
      delete activePings[id];
    }
  }
}, 10000);

function readServerDB(): ServerCBTState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading server DB:', err);
  }
  return {
    exam: null,
    schoolProfile: null,
    students: null,
    packages: null,
    sessions: [],
    lastUpdated: new Date().toISOString(),
  };
}

function writeServerDB(state: Partial<ServerCBTState>): ServerCBTState {
  try {
    const current = readServerDB();
    const updated: ServerCBTState = {
      ...current,
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error writing server DB:', err);
    return {
      exam: null,
      schoolProfile: null,
      students: null,
      packages: null,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Helper to get GoogleGenAI client
function getGenAIClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key tidak ditemukan. Masukkan kunci API di menu atau atur GEMINI_API_KEY.');
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Health check & API key validation
app.post('/api/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const client = getGenAIClient(apiKey);
    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Ping: jawab dengan 1 kata "OK" jika siap.',
    });
    res.json({ success: true, message: 'Kunci API Gemini valid dan siap digunakan!', text: response.text });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Kunci API tidak valid' });
  }
});

// 2. Generate questions with Gemini AI
app.post('/api/generate-questions', async (req, res) => {
  try {
    const {
      apiKey,
      subject,
      grade,
      semester,
      educationGoal,
      coreMaterial,
      difficulty = 'Sedang',
      count = 5,
      types = ['pilihan_ganda', 'pilihan_ganda_kompleks', 'isian_singkat', 'uraian'],
      customPrompt = '',
    } = req.body;

    const client = getGenAIClient(apiKey);

    const prompt = `Anda adalah seorang pakar kurikulum dan guru pembuat soal ujian profesional di Indonesia.
Buatkan ${count} butir soal ujian interaktif berkualitas tinggi dengan rincian berikut:
- Mata Pelajaran: ${subject}
- Tingkat/Kelas: ${grade}
- Semester: ${semester}
- Tujuan Pembelajaran / Tujuan Pendidikan: ${educationGoal}
- Materi Pokok / Topik: ${coreMaterial}
- Tingkat Kesulitan: ${difficulty} (sesuaikan indikator kognitif / HOTS bila sedang/sukar)
- Jenis Soal yang diminta: ${types.join(', ')}
${customPrompt ? `- Menu Prompt / Instruksi Khusus dari Guru:\n"${customPrompt}"` : ''}

Format soal yang harus didukung:
1. "pilihan_ganda": Soal pilihan ganda tunggal. Opsi A, B, C, D, (atau E untuk SMA). Kunci adalah huruf yang benar (misal: "A").
2. "pilihan_ganda_kompleks": Pilihan ganda dengan beberapa jawaban benar / pernyataan benar. Opsi minimal 4. Kunci jawaban adalah array string huruf/opsi yang benar (misal: ["A", "C"]).
3. "isian_singkat": Soal isian jawaban pendek. Sediakan kunci jawaban utama serta daftar variasi kata kunci konsep yang diterima.
4. "uraian": Soal esai/uraian. Sediakan penjelasan konsep materi pokok, daftar kata kunci wajib ("kata_kunci"), dan rubrik penilaian skoring (maksimal poin 10-20).

Wajib kembalikan HANYA JSON murni (valid RFC 8259) tanpa markdown formatting atau pembungkus \`\`\`json.
Format JSON harus berupa array objek soal:
[
  {
    "id": "q1",
    "type": "pilihan_ganda" | "pilihan_ganda_kompleks" | "isian_singkat" | "uraian",
    "question": "Teks pertanyaan lengkap...",
    "options": ["Opsi A...", "Opsi B...", "Opsi C...", "Opsi D..."], // Kosongkan [] jika isian_singkat atau uraian
    "correctAnswer": "A" | ["A", "C"] | "Jawaban singkat",
    "keywords": ["kata kunci 1", "kata kunci 2"], // Khusus isian_singkat & uraian
    "concept": "Konsep materi pokok yang diuji...",
    "rubric": "Rubrik penilaian: Skor penuh jika memuat...", // Khusus uraian
    "maxScore": 10,
    "explanation": "Pembahasan lengkap dan edukatif..."
  }
]`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let rawText = response.text || '[]';
    // Clean potential code fences
    rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const questions = JSON.parse(rawText);

    res.json({ success: true, questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal membuat soal dengan AI' });
  }
});

// 3. Automated scoring for short answers and essays using AI
app.post('/api/evaluate-submission', async (req, res) => {
  try {
    const { apiKey, question, studentAnswer, expectedAnswer, keywords, concept, rubric, maxScore } = req.body;

    const client = getGenAIClient(apiKey);

    const prompt = `Anda adalah asisten penilai otomatis guru ujian sekolah.
Nilailah jawaban siswa untuk soal berikut dengan objektif dan edukatif berdasarkan konsep materi dan kata kunci.

Pertanyaan: "${question}"
Konsep Inti: "${concept || '-'}"
Kata Kunci Wajib/Terkait: ${JSON.stringify(keywords || [])}
Jawaban Acuan / Rubrik: "${expectedAnswer || rubric || '-'}"
Jawaban Siswa: "${studentAnswer || '(Siswa tidak menjawab)'}"
Skor Maksimal: ${maxScore || 10}

Instruksi Penilaian:
1. Jika siswa tidak menjawab atau jawaban sama sekali tidak relevan, beri skor 0.
2. Analisis kesesuaian jawaban siswa terhadap konsep materi dan penggunaan kata kunci.
3. Berikan skor dari 0 sampai ${maxScore}.
4. Berikan alasan penilaian (feedback) yang membangun dalam Bahasa Indonesia untuk siswa.

Kembalikan HANYA JSON murni (valid RFC 8259):
{
  "awardedScore": 8,
  "maxScore": ${maxScore || 10},
  "feedback": "Penjelasan mengapa skor diberikan dan saran perbaikan...",
  "matchedKeywords": ["kata1", "kata2"]
}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let rawText = response.text || '{}';
    rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const evaluation = JSON.parse(rawText);

    res.json({ success: true, evaluation });
  } catch (error: any) {
    console.error('Error evaluating submission:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal mengevaluasi jawaban' });
  }
});

// 4. AI Remedial & Enrichment generation based on exam results
app.post('/api/generate-remedial-enrichment', async (req, res) => {
  try {
    const { apiKey, studentName, subject, finalScore, kkm = 75, weakTopics = [], strongTopics = [] } = req.body;

    const client = getGenAIClient(apiKey);

    const isRemedial = finalScore < kkm;

    const prompt = `Anda adalah konsultan pedagogi dan guru pembimbing akademik.
Berdasarkan hasil ujian siswa berikut:
- Nama Siswa: ${studentName}
- Mata Pelajaran: ${subject}
- Nilai Akhir: ${finalScore} / 100 (KKM: ${kkm})
- Status: ${isRemedial ? 'BELUM TUNTAS (Perlu Remidi)' : 'TUNTAS (Memerlukan Pengayaan)'}
- Topik Lemah: ${weakTopics.join(', ') || 'Pemahaman menyeluruh'}
- Topik Kuat: ${strongTopics.join(', ') || 'Dasar-dasar materi'}

Buatkan rencana program pembelajaran khusus ${isRemedial ? 'REMIDIAL' : 'PENGAYAAN'} yang dipersonalisasi.
Kembalikan HANYA JSON murni (valid RFC 8259):
{
  "type": "${isRemedial ? 'remidi' : 'pengayaan'}",
  "headline": "Judul rekomendasi singkat",
  "summary": "Analisis ringkas capaian kompetensi siswa",
  "actionSteps": [
    "Langkah/kegiatan 1...",
    "Langkah/kegiatan 2...",
    "Langkah/kegiatan 3..."
  ],
  "recommendedResources": [
    "Bahan bacaan / materi ringkasan...",
    "Latihan penguatan konsep..."
  ],
  "practiceQuestions": [
    "Contoh 1 soal penguatan konsep / tantangan kasus...",
    "Contoh 2 soal..."
  ],
  "motivationQuote": "Kalimat motivasi positif untuk siswa"
}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let rawText = response.text || '{}';
    rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(rawText);

    res.json({ success: true, program: result });
  } catch (error: any) {
    console.error('Error generating remedial/enrichment:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal menghasilkan analisis remidi/pengayaan' });
  }
});

// 5. Comprehensive AI Exam & Item Analysis for Teacher Decision Making
app.post('/api/analyze-exam-results', async (req, res) => {
  try {
    const { apiKey, examTitle, subject, grade, avgScore, passRate, hardQuestions, summaryStats } = req.body;
    const client = getGenAIClient(apiKey);

    const prompt = `Anda adalah ahli psikometri asesmen pendidikan dan konsultan kurikulum sekolah.
Lakukan evaluasi analisis hasil ujian dan analisis butir soal secara mendalam berdasarkan data berikut:
- Ujian: ${examTitle} (${subject} - ${grade})
- Nilai Rata-rata: ${avgScore} / 100
- Ketuntasan Klasikal: ${passRate}%
- Ringkasan Statistik: ${JSON.stringify(summaryStats || {})}
- Soal-soal dengan Tingkat Kesukaran Tinggi / Rendah Daya Pembeda:
${JSON.stringify(hardQuestions || [], null, 2)}

Berikan analisis pedagogis menyeluruh dalam format JSON murni:
{
  "classStatusSummary": "Ringkasan kesimpulan capaian pemahaman kelas secara keseluruhan...",
  "strengths": ["Kekuatan penguasaan materi 1", "Kekuatan 2"],
  "weaknesses": ["Materi pokok/indikator yang paling banyak salah dijawab", "Kelemahan 2"],
  "itemAnalysisAdvice": "Saran perbaikan untuk butir soal yang terlalu sukar atau daya pembedanya rendah...",
  "remedialStrategy": [
    "Langkah perbaikan pembelajaran di kelas 1...",
    "Langkah 2..."
  ],
  "enrichmentStrategy": [
    "Tantangan pengayaan untuk siswa yang telah tuntas..."
  ]
}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let rawText = response.text || '{}';
    rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const analysis = JSON.parse(rawText);

    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing exam results:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal menganalisis hasil ujian' });
  }
});

// 6. Proxy sync to Google Apps Script Web App (if teacher configures a GAS Web App URL)
app.post('/api/sync-gas', async (req, res) => {
  try {
    const { webAppUrl, action, payload } = req.body;
    if (!webAppUrl) {
      return res.json({
        success: true,
        mode: 'simulated_local',
        message: 'Tersinkronisasi ke penyimpanan lokal & simulasi Google Drive / Sheets (Belum memasukkan Web App URL)',
        timestamp: new Date().toISOString(),
      });
    }

    const fetchResponse = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });

    const data = await fetchResponse.json();
    res.json({ success: true, mode: 'live_gas', data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Gagal menyinkronkan ke Google Apps Script' });
  }
});

// =========================================================================
// 7. CENTRALIZED CBT REAL-TIME API (MULTI-DEVICE & STUDENT SYNC)
// =========================================================================

// A. Get entire CBT server state (for Teacher Dashboard initialization)
app.get('/api/cbt/state', (_req, res) => {
  try {
    const db = readServerDB();
    res.json({
      success: true,
      data: db,
      activePings: Object.values(activePings),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// B. Teacher updates active exam, school profile, student roster, or package history
app.post('/api/cbt/sync-teacher', (req, res) => {
  try {
    const { exam, schoolProfile, students, packages } = req.body;
    const updatePayload: Partial<ServerCBTState> = {};
    if (exam !== undefined) updatePayload.exam = exam;
    if (schoolProfile !== undefined) updatePayload.schoolProfile = schoolProfile;
    if (students !== undefined) updatePayload.students = students;
    if (packages !== undefined) updatePayload.packages = packages;

    const updated = writeServerDB(updatePayload);
    res.json({
      success: true,
      message: 'Data CBT tersimpan ke server terpusat!',
      lastUpdated: updated.lastUpdated,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// C. Student fetches active exam and student roster when loading on their device
app.get('/api/cbt/active-exam', (_req, res) => {
  try {
    const db = readServerDB();
    res.json({
      success: true,
      exam: db.exam,
      students: db.students || [],
      schoolProfile: db.schoolProfile,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// D. Student sends active heartbeat (so teacher sees live status on monitoring)
app.post('/api/cbt/student-ping', (req, res) => {
  try {
    const { studentId, studentName, classRoom, tabViolations = 0 } = req.body;
    if (studentId) {
      activePings[studentId] = {
        studentId,
        studentName: studentName || 'Siswa',
        classRoom: classRoom || '',
        tabViolations: Number(tabViolations) || 0,
        lastSeen: Date.now(),
      };
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// E. Student submits finished exam session from any device
app.post('/api/cbt/submit-session', (req, res) => {
  try {
    const { session } = req.body;
    if (!session || !session.id) {
      return res.status(400).json({ success: false, error: 'Data sesi tidak valid' });
    }

    // Clear active ping since student has submitted
    if (session.studentId && activePings[session.studentId]) {
      delete activePings[session.studentId];
    }

    const db = readServerDB();
    const existingIndex = db.sessions.findIndex(
      (s: any) => s.id === session.id || s.studentId === session.studentId
    );

    let updatedSessions = [...db.sessions];
    if (existingIndex >= 0) {
      updatedSessions[existingIndex] = session;
    } else {
      updatedSessions = [session, ...updatedSessions];
    }

    writeServerDB({ sessions: updatedSessions });
    res.json({
      success: true,
      message: 'Sesi ujian berhasil disimpan ke server terpusat!',
      totalSessions: updatedSessions.length,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// F. Get all submitted sessions and active pings (for Teacher Live Monitoring polling)
app.get('/api/cbt/sessions', (_req, res) => {
  try {
    const db = readServerDB();
    res.json({
      success: true,
      sessions: db.sessions || [],
      activePings: Object.values(activePings),
      lastUpdated: db.lastUpdated,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// G. Teacher deletes or resets a student session
app.delete('/api/cbt/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readServerDB();
    const updatedSessions = db.sessions.filter((s: any) => s.id !== id && s.studentId !== id);
    if (activePings[id]) {
      delete activePings[id];
    }
    writeServerDB({ sessions: updatedSessions });
    res.json({ success: true, message: 'Sesi ujian berhasil direset dari server' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server EduCBT AI running on http://localhost:${PORT}`);
  });
}

startServer();
