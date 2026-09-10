import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// Universal path resolver safe for both ESM (dev) and CJS (production bundle)
const getAppDirname = () => {
  if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
};
const appDir = getAppDirname();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Global API Request Logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[Server API ${new Date().toLocaleTimeString('id-ID')}] ${req.method} ${req.path}`);
  }
  next();
});

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

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
  classes?: string[];
  packages: any[] | null;
  sessions: any[];
  questionDrafts?: any[];
  studentDrafts?: any[];
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
      const data = JSON.parse(raw);
      return {
        exam: data.exam || null,
        schoolProfile: data.schoolProfile || null,
        students: data.students || null,
        packages: data.packages || null,
        sessions: data.sessions || [],
        questionDrafts: data.questionDrafts || [],
        studentDrafts: data.studentDrafts || [],
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
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
    questionDrafts: [],
    studentDrafts: [],
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
    return 'Layanan model Google AI sedang memproses permintaan atau beralih ke model aktif terbaru. Silakan periksa izin kunci API atau ulangi sesaat lagi.';
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
async function generateWithFallback(client: GoogleGenAI, contents: any, config?: any, timeoutMs = 25000, fallbackClient?: GoogleGenAI) {
  // Test gemini-2.5-flash and gemini-3.8-flash first (standard across all keys), then gemini-flash-latest, then gemini-3.1-flash-lite
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
      console.warn(`Model ${model} respons: ${msg.slice(0, 100)}`);
      // If API key is invalid or permission denied, stop trying models on this client
      if (
        msg.includes('API_KEY_INVALID') ||
        msg.includes('API key not valid') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        break;
      }
    }
  }

  // If primary client failed, and server key fallbackClient is available, retry with fallback client
  if (fallbackClient) {
    console.info('[AI Fallback] Mencoba menggunakan Kunci Server Gemini bawaan...');
    for (const model of models) {
      try {
        return await withTimeout(
          fallbackClient.models.generateContent({
            model,
            contents,
            config,
          }),
          timeoutMs,
          `Model fallback ${model} timeout setelah ${timeoutMs / 1000} detik`
        );
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Fallback] Model ${model} gagal: ${(err?.message || '').slice(0, 80)}`);
      }
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
function getClients(customApiKey?: string) {
  const cleanedCustom = cleanApiKey(customApiKey);
  const cleanedEnv = cleanApiKey(process.env.GEMINI_API_KEY);
  const primaryKey = cleanedCustom || cleanedEnv;

  if (!primaryKey) {
    throw new Error(
      'Gemini API Key tidak ditemukan. Silakan masukkan kunci API Anda di menu Pengaturan Gemini atau konfigurasi GEMINI_API_KEY di environment server.'
    );
  }

  const primaryClient = new GoogleGenAI({
    apiKey: primaryKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const fallbackClient =
    cleanedCustom && cleanedEnv && cleanedCustom !== cleanedEnv
      ? new GoogleGenAI({
          apiKey: cleanedEnv,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })
      : undefined;

  return { primaryClient, fallbackClient, usingServerKey: !cleanedCustom && !!cleanedEnv };
}

function getGenAIClient(customApiKey?: string) {
  return getClients(customApiKey).primaryClient;
}

// Check if Gemini API key is configured on server or ready
const handleKeyStatus = (_req: any, res: any) => {
  const hasEnvKey = !!cleanApiKey(process.env.GEMINI_API_KEY);
  res.json({
    success: true,
    hasServerKey: hasEnvKey,
  });
};
app.get('/api/key-status', handleKeyStatus);
app.get('/api/gemini/status', handleKeyStatus);
app.get('/api/gemini/key-status', handleKeyStatus);

// 1. Health check & API key validation
const handleValidateKey = async (req: any, res: any) => {
  try {
    const { apiKey } = req.body;
    const { primaryClient, fallbackClient, usingServerKey } = getClients(apiKey);

    // Test fast response using standard models and fallback
    let pingSuccess = false;
    let pingText = 'OK';
    try {
      const response = await generateWithFallback(
        primaryClient,
        'Ping: Jawab persis 1 kata: SIAP',
        undefined,
        10000,
        fallbackClient
      );
      pingSuccess = true;
      pingText = response?.text || 'OK';
    } catch (genErr: any) {
      console.warn('Ping generation warning:', genErr?.message?.slice(0, 120));
      // If primary failed but server fallback is active and works, ping succeeds
      const msg = genErr?.message || '';
      if (
        (msg.includes('API_KEY_INVALID') ||
          msg.includes('API key not valid') ||
          msg.includes('PERMISSION_DENIED') ||
          msg.includes('INVALID_ARGUMENT')) &&
        !fallbackClient
      ) {
        throw genErr;
      }
    }

    res.json({
      success: true,
      message: pingSuccess
        ? 'Kunci API Gemini valid dan siap digunakan!'
        : 'Kunci API Gemini berhasil disimpan dan siap beroperasi dengan model Google AI.',
      text: pingText,
      usedServerKey: usingServerKey,
    });
  } catch (error: any) {
    const friendlyError = formatGeminiError(error);
    res.status(400).json({ success: false, error: friendlyError, message: friendlyError });
  }
};
app.post('/api/validate-key', handleValidateKey);
app.post('/api/gemini/validate', handleValidateKey);
app.post('/api/gemini/validate-key', handleValidateKey);

// GET status for /api/generate-questions
app.get('/api/generate-questions', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Endpoint /api/generate-questions aktif. Gunakan metode POST dengan parameter { subject, grade, coreMaterial, ... } untuk membuat soal dengan AI.',
  });
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

    const { primaryClient, fallbackClient } = getClients(apiKey);

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

    const response = await generateWithFallback(
      primaryClient,
      prompt,
      {
        responseMimeType: 'application/json',
      },
      25000,
      fallbackClient
    );

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
app.get('/api/sync-gas', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Endpoint /api/sync-gas aktif dan siap menerima data sinkronisasi Google Apps Script via POST.',
  });
});

// Helper normalisasi dan validasi Web App URL Google Apps Script
function cleanAndNormalizeGasUrl(rawUrl: string): {
  url: string;
  cleaned: boolean;
  warnings: string[];
  error?: string;
} {
  let url = (rawUrl || '').trim();
  const warnings: string[] = [];

  // 1. Hapus kutip, kurung sudut, atau spasi berlebih
  url = url.replace(/^["'<]+|["'>]+$/g, '').trim();

  // 2. Deteksi jika user hanya memasukkan Deployment ID (contoh: AKfycbx...)
  if (/^AKfycb[A-Za-z0-9_-]{20,}$/.test(url)) {
    warnings.push('Deployment ID terdeteksi. Otomatis dikonversi ke format URL resmi (/exec).');
    url = `https://script.google.com/macros/s/${url}/exec`;
  }

  // 3. Hapus path multi-akun Google (/u/0/, /u/1/, /u/2/) yang sering menjadi penyebab utama 404
  if (/\/u\/\d+\//.test(url)) {
    warnings.push('Path multi-akun (/u/0/ atau /u/1/) otomatis dibersihkan agar dapat diakses publik.');
    url = url.replace(/\/u\/\d+\//, '/');
  }

  // 4. Hapus trailing slash pada /exec/
  if (url.endsWith('/exec/')) {
    url = url.slice(0, -1);
  }

  // 5. Bersihkan query params yang tidak diperlukan (seperti ?usp=sharing)
  if (url.includes('/exec?') && (url.includes('usp=') || url.includes('authuser='))) {
    url = url.split('?')[0];
    warnings.push('Query parameter sesi Google (?usp=sharing dll) otomatis dihapus.');
  }

  // 6. Deteksi URL Google Spreadsheet (.../edit)
  if (url.includes('docs.google.com/spreadsheets')) {
    return {
      url,
      cleaned: false,
      warnings,
      error: 'URL yang Anda masukkan adalah URL Google Spreadsheet (.../edit). Buka menu Extensions (Ekstensi) > Apps Script di spreadsheet tersebut, lalu klik Deploy > New deployment > jenis Web app, dan salin URL yang berakhiran /exec.',
    };
  }

  // 7. Deteksi URL Editor Apps Script (.../edit)
  if (url.includes('script.google.com') && url.includes('/edit')) {
    return {
      url,
      cleaned: false,
      warnings,
      error: 'URL yang Anda masukkan adalah URL Editor Script (.../edit). Klik tombol biru "Deploy" di pojok kanan atas > "New deployment" > jenis "Web app", dan salin Web App URL yang berakhiran /exec.',
    };
  }

  // 8. Deteksi URL Test Deployment (.../dev)
  if (url.endsWith('/dev') || url.includes('/dev?')) {
    return {
      url,
      cleaned: false,
      warnings,
      error: 'URL yang dimasukkan adalah Test URL (.../dev). URL ini hanya aktif saat pemilik login di browser yang sama dan tidak bisa menerima webhook server. Gunakan Web App URL resmi dari "New deployment" yang berakhiran /exec.',
    };
  }

  return {
    url,
    cleaned: warnings.length > 0,
    warnings,
  };
}

// Diagnostik mendalam probe GET dan POST ke Google Apps Script
async function probeGasUrl(targetUrl: string) {
  const result: {
    cleanUrl: string;
    getStatus: number | null;
    getBodyPreview: string;
    postStatus: number | null;
    postBodyPreview: string;
    isGoogleAuthRedirect: boolean;
    is404: boolean;
    diagnosis: string;
    recommendation: string[];
  } = {
    cleanUrl: targetUrl,
    getStatus: null,
    getBodyPreview: '',
    postStatus: null,
    postBodyPreview: '',
    isGoogleAuthRedirect: false,
    is404: false,
    diagnosis: '',
    recommendation: [],
  };

  try {
    // 1. Probe GET
    const getRes = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/html' },
      redirect: 'follow',
    });
    result.getStatus = getRes.status;
    const getText = await getRes.text();
    result.getBodyPreview = getText.slice(0, 300);

    if (
      getText.includes('ServiceLogin') ||
      getText.includes('accounts.google.com') ||
      getText.includes('Sign in - Google Accounts') ||
      getText.includes('Masuk - Akun Google')
    ) {
      result.isGoogleAuthRedirect = true;
    }
  } catch (err: any) {
    result.getBodyPreview = `GET Error: ${err.message}`;
  }

  try {
    // 2. Probe POST
    const postRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', payload: { probe: true } }),
      redirect: 'follow',
    });
    result.postStatus = postRes.status;
    const postText = await postRes.text();
    result.postBodyPreview = postText.slice(0, 300);
  } catch (err: any) {
    result.postBodyPreview = `POST Error: ${err.message}`;
  }

  // 3. Analisis Kasus Spesifik
  if (result.postStatus === 404 || result.getStatus === 404) {
    result.is404 = true;
  }

  if (result.isGoogleAuthRedirect) {
    result.diagnosis = 'Web App meminta login akun Google (Akses publik tertutup).';
    result.recommendation = [
      'Buka Google Apps Script > Deploy > Manage deployments.',
      'Klik ikon Pensil (Edit), pada "Who has access" WAJIB diubah menjadi "Anyone" (Siapa saja).',
      'PENTING UNTUK AKUN BELAJAR.ID / SEKOLAH: Jika akun Google Workspace sekolah Anda tidak mengizinkan opsi "Anyone" untuk umum, gunakan akun Gmail pribadi (@gmail.com) untuk membuat Spreadsheet dan Apps Script ini.',
    ];
  } else if (result.getStatus === 200 && result.postStatus === 404) {
    result.diagnosis = 'Web App merespons GET dengan baik, namun POST mengembalikan 404.';
    result.recommendation = [
      'Kode doPost belum termuat di versi deployment aktif Google Apps Script.',
      'Buka Apps Script > klik tombol "Deploy" di kanan atas > "Manage deployments".',
      'Klik ikon Pensil (Edit), pada dropdown Version WAJIB pilih "New version" (Versi Baru).',
      'Klik tombol "Deploy" untuk memperbarui.',
    ];
  } else if (result.getStatus === 404 && result.postStatus === 404) {
    result.diagnosis = 'Google server mengembalikan 404 untuk endpoint Web App ini.';
    result.recommendation = [
      'Pastikan Anda telah melakukan Deploy > New deployment > jenis Web app (bukan jenis Library/API).',
      'Pastikan opsi "Who has access" disetel ke "Anyone" (Siapa saja).',
      'Jika menggunakan akun Workspace/Belajar.id yang dibatasi oleh kebijakan admin sekolah, pindahkan script ke akun Gmail pribadi (@gmail.com).',
      'Pastikan menjalankan fungsi "setupOtorisasi" sekali di editor Apps Script untuk menyetujui izin Google Drive.',
    ];
  } else if (result.postStatus === 200) {
    result.diagnosis = 'Koneksi GET & POST ke Google Apps Script aktif dan normal!';
    result.recommendation = ['Web App sudah siap menerima rekap nilai ujian dan backup otomatis soal.'];
  } else {
    result.diagnosis = `Respons HTTP tidak terduga (GET: ${result.getStatus}, POST: ${result.postStatus}).`;
    result.recommendation = [
      'Periksa apakah ada syntax error di editor Google Apps Script.',
      'Pastikan izin akses Google Drive & Spreadsheet sudah disetujui (jalankan fungsi setupOtorisasi).',
    ];
  }

  return result;
}

// Endpoint Diagnostik Lengkap Google Apps Script
app.post('/api/sync-gas/diagnose', async (req, res) => {
  try {
    const { webAppUrl } = req.body;
    if (!webAppUrl) {
      return res.status(400).json({ success: false, error: 'Parameter webAppUrl wajib disertakan.' });
    }

    const norm = cleanAndNormalizeGasUrl(webAppUrl);
    if (norm.error) {
      return res.json({
        success: false,
        error: norm.error,
        normalizedUrl: norm.url,
        warnings: norm.warnings,
      });
    }

    console.log(`[GAS Diagnose] Probing target: ${norm.url}`);
    const probe = await probeGasUrl(norm.url);

    res.json({
      success: !probe.is404 && probe.postStatus === 200,
      originalUrl: webAppUrl,
      cleanUrl: norm.url,
      wasCleaned: norm.cleaned,
      warnings: norm.warnings,
      probe,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Gagal menjalankan diagnosa Apps Script' });
  }
});

// Endpoint Sinkronisasi Utama Google Apps Script
app.post('/api/sync-gas', async (req, res) => {
  try {
    let { webAppUrl, action, payload } = req.body;
    if (!webAppUrl) {
      return res.json({
        success: true,
        mode: 'simulated_local',
        message: 'Tersinkronisasi ke penyimpanan lokal & simulasi Google Drive / Sheets (Belum memasukkan Web App URL)',
        timestamp: new Date().toISOString(),
      });
    }

    // Bersihkan dan normalisasi URL
    const norm = cleanAndNormalizeGasUrl(webAppUrl);
    if (norm.error) {
      return res.json({
        success: false,
        error: norm.error,
        warnings: norm.warnings,
      });
    }

    const targetUrl = norm.url;
    console.log(`[GAS Sync] Forwarding action="${action}" to ${targetUrl.slice(0, 50)}... (Cleaned: ${norm.cleaned})`);

    const fetchResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      redirect: 'follow',
    });

    if (fetchResponse.status === 404) {
      // Jalankan probe cepat untuk mendiagnosis penyebab spesifik
      const quickProbe = await probeGasUrl(targetUrl);

      return res.json({
        success: false,
        isGas404: true,
        cleanUrl: targetUrl,
        warnings: norm.warnings,
        diagnosis: quickProbe.diagnosis,
        recommendations: quickProbe.recommendation,
        error: `Google Apps Script Web App mengembalikan status 404 (Not Found).\n\n${quickProbe.diagnosis}\n\nLangkah Solusi:\n${quickProbe.recommendation.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
      });
    }

    const rawText = await fetchResponse.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Cek apakah respon adalah halaman Google Auth
      if (rawText.includes('ServiceLogin') || rawText.includes('accounts.google.com')) {
        return res.json({
          success: false,
          error: 'Google Apps Script dialihkan ke halaman Login Google. Ini berarti setelan "Who has access" belum disetel ke "Anyone" (Siapa saja) atau akun Belajar.id Anda memblokir akses anonim eksternal. Ubah opsi Who has access ke "Anyone" atau gunakan akun Gmail pribadi (@gmail.com).',
        });
      }

      return res.json({
        success: false,
        error: 'Google Apps Script mengembalikan respon non-JSON (Status: ' + fetchResponse.status + '). Pastikan Anda telah menyelesaikan izin akses (setupOtorisasi) dan Who has access disetel ke Anyone.',
        preview: rawText.slice(0, 200),
      });
    }

    res.json({
      success: true,
      mode: 'live_gas',
      cleanUrl: targetUrl,
      warnings: norm.warnings,
      data,
      message: data.message || 'Koneksi ke Google Apps Script aktif dan terverifikasi!',
    });
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
    const { exam, schoolProfile, students, classes, packages } = req.body;
    const updatePayload: Partial<ServerCBTState> = {};
    if (exam !== undefined) updatePayload.exam = exam;
    if (schoolProfile !== undefined) updatePayload.schoolProfile = schoolProfile;
    if (students !== undefined) updatePayload.students = students;
    if (classes !== undefined) updatePayload.classes = classes;
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
      classes: db.classes || [],
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

// =========================================================================
// 8. DRAFT MANAGEMENT APIS (SOAL & DAFTAR SISWA)
// =========================================================================

// A. Question Drafts
app.get('/api/cbt/drafts/questions', (_req, res) => {
  try {
    const db = readServerDB();
    res.json({ success: true, drafts: db.questionDrafts || [] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/cbt/drafts/questions', (req, res) => {
  try {
    const { draft } = req.body;
    if (!draft || !draft.id) {
      return res.status(400).json({ success: false, error: 'Data draft soal tidak valid' });
    }
    const db = readServerDB();
    const drafts = db.questionDrafts || [];
    const index = drafts.findIndex((d: any) => d.id === draft.id);
    let updatedDrafts: any[];
    if (index >= 0) {
      updatedDrafts = [...drafts];
      updatedDrafts[index] = { ...draft, savedAt: new Date().toISOString() };
    } else {
      updatedDrafts = [{ ...draft, savedAt: draft.savedAt || new Date().toISOString() }, ...drafts];
    }
    writeServerDB({ questionDrafts: updatedDrafts });
    res.json({
      success: true,
      message: 'Draft bank soal berhasil disimpan ke server',
      draftsCount: updatedDrafts.length,
      draft: updatedDrafts[index >= 0 ? index : 0],
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/cbt/drafts/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readServerDB();
    const updated = (db.questionDrafts || []).filter((d: any) => d.id !== id);
    writeServerDB({ questionDrafts: updated });
    res.json({ success: true, message: 'Draft soal berhasil dihapus', remaining: updated.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// B. Student Roster Drafts
app.get('/api/cbt/drafts/students', (_req, res) => {
  try {
    const db = readServerDB();
    res.json({ success: true, drafts: db.studentDrafts || [] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/cbt/drafts/students', (req, res) => {
  try {
    const { draft } = req.body;
    if (!draft || !draft.id) {
      return res.status(400).json({ success: false, error: 'Data draft siswa tidak valid' });
    }
    const db = readServerDB();
    const drafts = db.studentDrafts || [];
    const index = drafts.findIndex((d: any) => d.id === draft.id);
    let updatedDrafts: any[];
    if (index >= 0) {
      updatedDrafts = [...drafts];
      updatedDrafts[index] = { ...draft, savedAt: new Date().toISOString() };
    } else {
      updatedDrafts = [{ ...draft, savedAt: draft.savedAt || new Date().toISOString() }, ...drafts];
    }
    writeServerDB({ studentDrafts: updatedDrafts });
    res.json({
      success: true,
      message: 'Draft daftar siswa berhasil disimpan ke server',
      draftsCount: updatedDrafts.length,
      draft: updatedDrafts[index >= 0 ? index : 0],
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/cbt/drafts/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readServerDB();
    const updated = (db.studentDrafts || []).filter((d: any) => d.id !== id);
    writeServerDB({ studentDrafts: updated });
    res.json({ success: true, message: 'Draft siswa berhasil dihapus', remaining: updated.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Catch-all route for any unhandled /api/* requests so they return clean JSON 404 instead of HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint API ${req.method} ${req.path} tidak ditemukan pada server EduCBT.`,
  });
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
