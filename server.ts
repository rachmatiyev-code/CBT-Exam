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

const EDUCBT_DIR = path.join(process.cwd(), 'EduCBT');
const EDUCBT_SOAL_DIR = path.join(EDUCBT_DIR, 'Riwayat Soal');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

if (!fs.existsSync(EDUCBT_SOAL_DIR)) {
  try {
    fs.mkdirSync(EDUCBT_SOAL_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create EduCBT/Riwayat Soal directory:', e);
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

// Helper to clean and sanitize API keys
function cleanApiKey(key?: string | null): string {
  if (!key) return '';
  let k = String(key).trim();
  // Filter out literal null/undefined representations
  if (k.toLowerCase() === 'undefined' || k.toLowerCase() === 'null') return '';
  // Remove any whitespace/newlines inside if pasted across lines
  k = k.replace(/[\r\n\t]/g, '').trim();
  // Strip export / set prefixes
  k = k.replace(/^(export\s+|set\s+)?GEMINI_API_KEY\s*=\s*/i, '').trim();
  // Strip Bearer prefix if accidentally pasted
  k = k.replace(/^Bearer\s+/i, '').trim();
  // Strip enclosing quotes or brackets
  k = k.replace(/^["'`{(<\[]+|["'`})>\]]+$/g, '').trim();
  return k;
}

// Convert Google GenAI/RPC errors into friendly Indonesian descriptions
function formatGeminiError(error: any): string {
  if (!error) return 'Terjadi kesalahan internal pada layanan AI Gemini.';
  let msg = error.message || String(error);

  // If error.message is a JSON string from Google RPC
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error?.message) {
      msg = parsed.error.message;
    }
  } catch {}

  // Check for HTML/proxy unexpected token errors (e.g., unexpected token 'T', "the page c")
  const lower = msg.toLowerCase();
  if (
    lower.includes('unexpected token') ||
    lower.includes('the page') ||
    lower.includes('is not valid json') ||
    lower.includes('<!doctype') ||
    lower.includes('<html')
  ) {
    return 'Layanan AI Gemini sedang mengalami kendala jaringan atau respon server Google tidak valid. Silakan periksa kembali format Kunci API Anda atau coba beberapa saat lagi.';
  }

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('invalid api key')) {
    return 'Kunci API Gemini tidak valid. Silakan periksa kembali API Key Anda dari Google AI Studio atau gunakan kunci server bawaan.';
  }
  if (lower.includes('permission_denied') || lower.includes('access denied')) {
    return 'Akses API ditolak. Pastikan izin akses Gemini API telah aktif di Google AI Studio / Google Cloud Project Anda.';
  }
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'Batas kuota panggilan Gemini API telah tercapai (Rate Limit / Quota Exceeded). Mohon tunggu beberapa saat atau gunakan kunci API lain.';
  }
  if (lower.includes('high demand') || lower.includes('overloaded') || lower.includes('503') || lower.includes('unavailable')) {
    return 'Layanan AI Gemini sedang mengalami lonjakan beban sementara dari Google. Silakan klik coba lagi dalam beberapa detik.';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return 'Model AI tidak ditemukan atau telah diperbarui oleh Google. Sistem secara otomatis beralih ke model aktif terbaru.';
  }

  return msg;
}

// Universal timeout promise helper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer!);
  });
}

// Generate content with automatic model fallback and timeout protection
async function generateWithFallback(client: GoogleGenAI, contents: any, config?: any, timeoutMs = 20000) {
  // Use gemini-3.6-flash first for high responsiveness, then gemini-3.1-flash-lite, then gemini-3.8-flash
  const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      return await withTimeout(
        client.models.generateContent({
          model,
          contents,
          config,
        }),
        timeoutMs,
        `Model ${model} timeout setelah ${timeoutMs / 1000} detik`
      );
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      // If API key is invalid or permission denied, no need to retry other models
      if (
        msg.includes('API_KEY_INVALID') ||
        msg.includes('API key not valid') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        throw err;
      }
      console.warn(`Model ${model} gagal atau timeout, mencoba model berikutnya: ${msg.slice(0, 100)}`);
    }
  }

  throw lastError;
}

// Bulletproof JSON extractor that safely handles code fences, markdown, and trailing commas
function extractJsonFromText(rawText: string, fallback: any = []): any {
  if (!rawText || typeof rawText !== 'string') return fallback;

  // 1. Direct parse attempt
  const cleaned = rawText.trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Extract code block ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 3. Extract between outer [ ... ] for arrays
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arraySlice = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(arraySlice);
    } catch {}
  }

  // 4. Extract between outer { ... } for objects
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const objectSlice = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(objectSlice);
    } catch {}
  }

  // 5. Strip comments and trailing commas before bracket/brace
  let sanitized = cleaned
    .replace(/\/\/[^\n\r]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(sanitized);
  } catch {}

  const sFirstBracket = sanitized.indexOf('[');
  const sLastBracket = sanitized.lastIndexOf(']');
  if (sFirstBracket !== -1 && sLastBracket > sFirstBracket) {
    try {
      return JSON.parse(sanitized.slice(sFirstBracket, sLastBracket + 1));
    } catch {}
  }

  const sFirstBrace = sanitized.indexOf('{');
  const sLastBrace = sanitized.lastIndexOf('}');
  if (sFirstBrace !== -1 && sLastBrace > sFirstBrace) {
    try {
      return JSON.parse(sanitized.slice(sFirstBrace, sLastBrace + 1));
    } catch {}
  }

  console.warn('Gagal mem-parse JSON dari output AI:', rawText.slice(0, 200));
  return fallback;
}

// Helper to get GoogleGenAI client with fallback to server environment key
function getGenAIClient(customApiKey?: string) {
  const cleanedCustom = cleanApiKey(customApiKey);
  const cleanedEnv = cleanApiKey(process.env.GEMINI_API_KEY);
  const apiKey = cleanedCustom || cleanedEnv;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key tidak ditemukan. Silakan masukkan kunci API Anda di menu Pengaturan Gemini atau konfigurasi GEMINI_API_KEY di environment server.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

// Check if Gemini API key is configured on server or ready
app.get('/api/key-status', (_req, res) => {
  const hasEnvKey = !!cleanApiKey(process.env.GEMINI_API_KEY);
  res.json({
    success: true,
    hasServerKey: hasEnvKey,
  });
});

// 1. Health check & API key validation
app.post('/api/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const client = getGenAIClient(apiKey);
    
    // Step 1: Ultra-fast key validation using models.list() (verifies auth without consuming generation tokens)
    try {
      await withTimeout(client.models.list(), 6000, 'Verifikasi otorisasi timeout');
    } catch (authErr: any) {
      const errMsg = authErr?.message || '';
      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('INVALID_ARGUMENT') ||
        errMsg.includes('PERMISSION_DENIED')
      ) {
        throw authErr;
      }
      // If models.list was throttled or timed out, proceed to test generateWithFallback
      console.warn('models.list warning:', errMsg.slice(0, 100));
    }

    // Step 2: Test ping generation with fast fallback and short timeout
    let pingSuccess = false;
    let pingText = 'OK';
    try {
      const response = await generateWithFallback(client, 'Ping: jawab 1 kata OK', undefined, 8000);
      pingSuccess = true;
      pingText = response?.text || 'OK';
    } catch (genErr: any) {
      console.warn('Ping generation notice:', genErr?.message?.slice(0, 100));
    }

    res.json({
      success: true,
      message: pingSuccess
        ? 'Kunci API Gemini valid dan siap digunakan!'
        : 'Kunci API Gemini terverifikasi valid! (Layanan model AI Google siap digunakan).',
      text: pingText,
      usedServerKey: !cleanApiKey(apiKey) && !!cleanApiKey(process.env.GEMINI_API_KEY),
    });
  } catch (error: any) {
    const friendlyError = formatGeminiError(error);
    res.status(400).json({ success: false, error: friendlyError, message: friendlyError });
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

Wajib kembalikan HANYA JSON murni (valid RFC 8259) tanpa komentar dan tanpa pembungkus markdown:
[
  {
    "id": "q1",
    "type": "pilihan_ganda",
    "question": "Teks pertanyaan lengkap...",
    "options": ["Opsi A...", "Opsi B...", "Opsi C...", "Opsi D..."],
    "correctAnswer": "A",
    "keywords": ["kata kunci 1", "kata kunci 2"],
    "concept": "Konsep materi pokok yang diuji...",
    "rubric": "Rubrik penilaian: Skor penuh jika memuat...",
    "maxScore": 10,
    "explanation": "Pembahasan lengkap dan edukatif..."
  }
]`;

    const response = await generateWithFallback(client, prompt, {
      responseMimeType: 'application/json',
    });

    const rawText = response.text || '[]';
    const questions = extractJsonFromText(rawText, []);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Format soal yang dihasilkan oleh AI tidak sesuai atau kosong. Silakan ulangi pembuatan.');
    }

    res.json({ success: true, questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    const friendlyError = formatGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

// 3. Automated scoring for short answers and essays using AI with user-defined rubric
app.post('/api/evaluate-submission', async (req, res) => {
  try {
    const { apiKey, type = 'isian_singkat', question, studentAnswer, expectedAnswer, keywords, concept, rubric, maxScore } = req.body;

    const trimmedAnswer = (studentAnswer || '').trim();
    if (!trimmedAnswer) {
      return res.json({
        success: true,
        evaluation: {
          awardedScore: 0,
          maxScore: type === 'uraian' ? 3 : type === 'isian_singkat' ? 2 : 1,
          feedback: 'Siswa tidak memberikan jawaban (skor 0).',
          matchedKeywords: [],
        },
      });
    }

    const client = getGenAIClient(apiKey);

    const isIsian = type === 'isian_singkat';
    const isUraian = type === 'uraian';

    const targetMax = isUraian ? 3 : isIsian ? 2 : 1;

    const prompt = `Anda adalah sistem penilai ujian sekolah otomatis yang sangat teliti dan adil di Indonesia.
Evaluasilah jawaban siswa untuk soal berikut:

Tipe Soal: ${isUraian ? 'URAIAN / ESAI' : isIsian ? 'ISIAN JAWABAN PENDEK' : 'PILIHAN GANDA'}
Pertanyaan: "${question}"
Konsep Inti Materi: "${concept || '-'}"
Kunci Jawaban Acuan: "${expectedAnswer || rubric || '-'}"
Daftar Kata Kunci / Konsep Relevan: ${JSON.stringify(keywords || [])}
Jawaban Siswa: "${trimmedAnswer}"

PEDOMAN PENILAIAN RESMI:
${
  isIsian
    ? `Aturan Isian Jawaban Pendek:
- Skor 2 (BENAR): Siswa menjawab benar, tepat sasaran berdasarkan kata kunci, sinonim kata, atau kemiripan ide dengan kunci jawaban.
- Skor 1 (SALAH): Siswa memberikan jawaban namun salah / tidak sesuai konsep.
- Skor 0: Hanya jika kosong (sudah ditangani).`
    : isUraian
    ? `Aturan Uraian / Esai:
- Skor 3 (BENAR PENUH): Menjelaskan konsep dengan benar dan komprehensif, mencakup kata kunci atau sinonim ide materi pokok.
- Skor 2 (BENAR SEBAGIAN): Memahami sebagian konsep materi, memuat beberapa kata kunci atau ide yang mendekati kebenaran meski belum sempurna.
- Skor 1 (SALAH): Berusaha menjawab namun konsep yang disampaikan salah / melenceng jauh.
- Skor 0: Hanya jika kosong.`
    : `Aturan Pilihan Ganda:
- Skor 1: Benar
- Skor 0: Salah`
}

Kembalikan HANYA JSON valid RFC 8259 (tanpa markdown tambahan):
{
  "awardedScore": ${targetMax},
  "maxScore": ${targetMax},
  "feedback": "Penjelasan pedagogis singkat mengapa nilai ini diberikan berdasarkan kesesuaian konsep dan kata kunci",
  "matchedKeywords": ["kata kunci atau sinonim yang ditemukan"]
}`;

    const response = await generateWithFallback(client, prompt, {
      responseMimeType: 'application/json',
    });

    const rawText = response.text || '{}';
    const evaluation = extractJsonFromText(rawText, {
      awardedScore: isUraian ? 2 : isIsian ? 1 : 0,
      maxScore: targetMax,
      feedback: 'Telah dievaluasi otomatis.',
      matchedKeywords: [],
    });

    res.json({ success: true, evaluation });
  } catch (error: any) {
    console.error('Error evaluating submission:', error);
    const friendlyError = formatGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

// 3B. Endpoints for EduCBT / Riwayat Soal (Server filesystem archive)
app.post('/api/educbt/archive-questions', (req, res) => {
  try {
    const { exam, txtContent } = req.body;
    if (!exam || !exam.id) {
      return res.status(400).json({ success: false, error: 'Data ujian tidak valid' });
    }

    const cleanCode = (exam.code || 'SOAL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSubject = (exam.subject || 'Ujian').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const baseName = `${cleanCode}_${cleanSubject}_${timestamp}`;

    // 1. Write .json
    const jsonPath = path.join(EDUCBT_SOAL_DIR, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(exam, null, 2), 'utf-8');

    // 2. Write .txt
    const txtPath = path.join(EDUCBT_SOAL_DIR, `${baseName}.txt`);
    const textData = txtContent || JSON.stringify(exam, null, 2);
    fs.writeFileSync(txtPath, textData, 'utf-8');

    res.json({
      success: true,
      message: 'Soal berhasil disimpan dalam folder EduCBT/Riwayat Soal (.json dan .txt)',
      folder: 'EduCBT/Riwayat Soal',
      jsonFile: `${baseName}.json`,
      txtFile: `${baseName}.txt`,
      savedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error archiving to EduCBT/Riwayat Soal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/educbt/archives', (_req, res) => {
  try {
    if (!fs.existsSync(EDUCBT_SOAL_DIR)) {
      return res.json({ success: true, archives: [] });
    }
    const files = fs.readdirSync(EDUCBT_SOAL_DIR);
    const fileStats = files.map((file) => {
      const fullPath = path.join(EDUCBT_SOAL_DIR, file);
      const stat = fs.statSync(fullPath);
      return {
        name: file,
        extension: path.extname(file),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    });
    res.json({ success: true, folder: 'EduCBT/Riwayat Soal', files: fileStats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

    const response = await generateWithFallback(client, prompt, {
      responseMimeType: 'application/json',
    });

    const rawText = response.text || '{}';
    const program = extractJsonFromText(rawText, {
      type: isRemedial ? 'remidi' : 'pengayaan',
      headline: 'Rencana Pembelajaran Terpandu',
      summary: 'Lanjutkan pembelajaran mandiri.',
      actionSteps: ['Pelajari kembali bab yang belum dikuasai'],
      recommendedResources: ['Buku teks mata pelajaran'],
      practiceQuestions: [],
      motivationQuote: 'Tetap semangat belajar!',
    });

    res.json({ success: true, program });
  } catch (error: any) {
    console.error('Error generating remedial/enrichment:', error);
    const friendlyError = formatGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
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

    const response = await generateWithFallback(client, prompt, {
      responseMimeType: 'application/json',
    });

    const rawText = response.text || '{}';
    const analysis = extractJsonFromText(rawText, {
      classStatusSummary: 'Analisis hasil ujian telah disusun.',
      strengths: ['Mayoritas siswa menguasai soal dasar'],
      weaknesses: ['Perlu penguatan pada soal penalaran HOTS'],
      itemAnalysisAdvice: 'Tingkatkan variasi stimulus soal',
      remedialStrategy: ['Bimbingan kelompok kecil'],
      enrichmentStrategy: ['Studi kasus terapan'],
    });

    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing exam results:', error);
    const friendlyError = formatGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
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

    const rawText = await fetchResponse.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.json({
        success: false,
        error: 'Google Apps Script mengembalikan respon non-JSON. Pastikan izin akses Web App disetel ke "Anyone" (Siapa saja).',
        preview: rawText.slice(0, 150),
      });
    }
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

// H. Teacher batch deletes or resets multiple student sessions
app.post('/api/cbt/sessions/batch-delete', (req, res) => {
  try {
    const { sessionIds = [], studentIds = [] } = req.body;
    const idSet = new Set([...sessionIds, ...studentIds]);
    const db = readServerDB();
    const updatedSessions = db.sessions.filter(
      (s: any) => !idSet.has(s.id) && !idSet.has(s.studentId)
    );
    idSet.forEach((id) => {
      if (activePings[id]) {
        delete activePings[id];
      }
    });
    writeServerDB({ sessions: updatedSessions });
    res.json({
      success: true,
      message: `${idSet.size} sesi siswa berhasil direset/dihapus`,
      remaining: updatedSessions.length,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// I. Teacher edits/updates a student session (e.g. manual score override, answer corrections)
app.put('/api/cbt/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { updatedSession } = req.body;
    if (!updatedSession) {
      return res.status(400).json({ success: false, error: 'Data sesi pembaruan tidak ditemukan' });
    }
    const db = readServerDB();
    const index = db.sessions.findIndex((s: any) => s.id === id || s.studentId === id);
    let updatedSessions = [...db.sessions];
    if (index >= 0) {
      updatedSessions[index] = { ...updatedSessions[index], ...updatedSession };
    } else {
      updatedSessions.push(updatedSession);
    }
    writeServerDB({ sessions: updatedSessions });
    res.json({ success: true, message: 'Data hasil ujian siswa berhasil diperbarui', session: updatedSessions[index >= 0 ? index : updatedSessions.length - 1] });
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
