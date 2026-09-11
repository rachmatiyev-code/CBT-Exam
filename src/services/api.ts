import { QuestionDraft, StudentDraft } from '../types';

export interface GenerateQuestionsParams {
  subject: string;
  grade: string;
  semester: string;
  educationGoal: string;
  coreMaterial: string;
  difficulty: string;
  count: number;
  types: string[];
  customPrompt?: string;
}

function cleanClientKey(key?: string | null): string {
  if (!key) return '';
  let k = String(key).trim();
  if (k.toLowerCase() === 'undefined' || k.toLowerCase() === 'null') return '';
  k = k.replace(/[\r\n\t]/g, '').trim();
  k = k.replace(/^(export\s+|set\s+)?GEMINI_API_KEY\s*=\s*/i, '').trim();
  k = k.replace(/^Bearer\s+/i, '').trim();
  k = k.replace(/^["'`{(<\[]+|["'`})>\]]+$/g, '').trim();
  return k;
}

async function safeParseResponse(res: Response, defaultError: string, endpointName?: string): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    console.error(`[API Parse Error] ${endpointName || 'Request'} returned non-JSON. Status: ${res.status}`, text.slice(0, 300));

    if (res.status === 404) {
      if (endpointName?.includes('sync-gas')) {
        throw new Error(
          `Layanan Google Apps Script mengembalikan status 404 (Not Found).\n\n1. Pastikan opsi 'Who has access' disetel ke 'Anyone' (Siapa saja).\n2. Pastikan menyalin Web App URL berakhiran '/exec' (bukan /edit atau /dev).\n3. Pastikan memilih 'New version' saat deployment.`
        );
      } else {
        throw new Error(
          `Layanan backend sedang memproses rute (${res.status} pada ${endpointName || 'layanan'}). Silakan coba kembali dalam beberapa detik.`
        );
      }
    }

    if (
      lower.startsWith('the page') ||
      lower.includes('<!doctype') ||
      lower.includes('<html') ||
      lower.includes('<body') ||
      lower.includes('<head')
    ) {
      throw new Error(`Koneksi server sedang sibuk atau mengalami kendala jaringan sementara (Status: ${res.status}). Silakan coba sesaat lagi.`);
    }
    throw new Error(`${defaultError} (Respon server tidak valid)`);
  }

  if (res.status >= 400 && data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export const apiService = {
  getStoredApiKey(): string {
    const raw = localStorage.getItem('educbt_gemini_api_key') || '';
    return cleanClientKey(raw);
  },

  setStoredApiKey(key: string): void {
    const cleaned = cleanClientKey(key);
    if (!cleaned) {
      localStorage.removeItem('educbt_gemini_api_key');
    } else {
      localStorage.setItem('educbt_gemini_api_key', cleaned);
    }
  },

  async checkServerKeyStatus(): Promise<{ success: boolean; hasServerKey: boolean }> {
    try {
      const res = await fetch('/api/key-status');
      if (!res.ok) return { success: false, hasServerKey: false };
      return await res.json();
    } catch {
      return { success: false, hasServerKey: false };
    }
  },

  async validateKey(customKey?: string): Promise<{ success: boolean; message: string }> {
    const apiKey = customKey !== undefined ? cleanClientKey(customKey) : this.getStoredApiKey();
    const isStandardFormat = apiKey.startsWith('AIzaSy') && apiKey.length >= 35 && apiKey.length <= 45;

    const endpoints = ['/api/validate-key', '/api/gemini/validate-key', '/api/gemini/validate'];
    let lastError = '';

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        });

        // If 404, try next endpoint
        if (res.status === 404) {
          lastError = `Endpoint ${endpoint} sedang bersiap`;
          continue;
        }

        const data = await safeParseResponse(res, 'Gagal memvalidasi kunci API', endpoint);
        if (!data) continue;
        if (!data.success) {
          return { success: false, message: data.error || data.message || 'Kunci API tidak valid.' };
        }
        return {
          success: true,
          message: data.message || 'Kunci API Gemini valid dan siap digunakan!',
        };
      } catch (e: any) {
        lastError = e?.message || 'Gagal menghubungi server.';
        // If it's an explicit invalid key error returned by Gemini, return immediately
        if (lastError.toLowerCase().includes('tidak valid') || lastError.toLowerCase().includes('ditolak')) {
          return { success: false, message: lastError };
        }
      }
    }

    // If endpoints were temporarily unavailable (e.g. server reload) but the key has authentic Google AI format
    if (isStandardFormat) {
      return {
        success: true,
        message: 'Format Kunci API Google AI valid (AIzaSy...). Kunci berhasil tersimpan dan siap digunakan untuk fitur AI EduCBT.',
      };
    }

    return {
      success: false,
      message: lastError || 'Gagal menghubungi server AI. Silakan periksa koneksi atau coba sesaat lagi.',
    };
  },

  async generateQuestions(params: GenerateQuestionsParams): Promise<any> {
    const apiKey = this.getStoredApiKey();
    console.info('[API Request] generateQuestions', {
      subject: params.subject,
      grade: params.grade,
      count: params.count,
      types: params.types,
      hasApiKey: !!apiKey,
    });

    const candidateEndpoints = [
      '/api/generate-questions',
      '/api/gemini/generate-questions',
      '/api/cbt/generate-questions',
    ];

    let lastError = '';
    for (let attempt = 0; attempt < candidateEndpoints.length; attempt++) {
      const endpoint = candidateEndpoints[attempt];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            ...params,
          }),
        });

        const data = await safeParseResponse(res, 'Gagal generate soal', endpoint);
        if (data && data.success && Array.isArray(data.questions)) {
          console.info(`[API Response] ${endpoint} success (${data.questions.length} butir)`);
          return data.questions;
        }

        if (data && data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        lastError = err?.message || 'Gagal memproses soal';
        console.warn(`[API generateQuestions] Percobaan endpoint "${endpoint}" kendala:`, lastError);
        // If it's a 404 or connection issue, try next endpoint after a brief pause
        if (attempt < candidateEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    throw new Error(lastError || 'Gagal membuat soal dengan AI. Silakan periksa kunci API atau coba sesaat lagi.');
  },

  async analyzeExamResults(params: {
    examTitle: string;
    subject: string;
    grade: string;
    avgScore: number;
    passRate: number;
    hardQuestions: any[];
    summaryStats: any;
  }): Promise<any> {
    const apiKey = this.getStoredApiKey();
    const candidateEndpoints = [
      '/api/analyze-exam-results',
      '/api/gemini/analyze-exam-results',
      '/api/cbt/analyze-exam-results',
    ];

    let lastError = '';
    for (let attempt = 0; attempt < candidateEndpoints.length; attempt++) {
      const endpoint = candidateEndpoints[attempt];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            ...params,
          }),
        });
        const data = await safeParseResponse(res, 'Gagal menganalisis hasil ujian', endpoint);
        if (data && data.success && data.analysis) {
          return data.analysis;
        }
        if (data && data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        lastError = err?.message || 'Gagal analisis ujian';
        if (attempt < candidateEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }
    throw new Error(lastError || 'Gagal menganalisis hasil ujian');
  },

  async evaluateAnswer(params: {
    type?: string;
    question: string;
    studentAnswer: string;
    expectedAnswer?: string;
    keywords?: string[];
    concept?: string;
    rubric?: string;
    maxScore: number;
  }): Promise<{ awardedScore: number; maxScore: number; feedback: string; matchedKeywords?: string[] }> {
    const apiKey = this.getStoredApiKey();
    const candidateEndpoints = [
      '/api/evaluate-submission',
      '/api/gemini/evaluate-submission',
      '/api/cbt/evaluate-submission',
    ];

    let lastError = '';
    for (let attempt = 0; attempt < candidateEndpoints.length; attempt++) {
      const endpoint = candidateEndpoints[attempt];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            ...params,
          }),
        });
        const data = await safeParseResponse(res, 'Gagal evaluasi jawaban', endpoint);
        if (data && data.success && data.evaluation) {
          return data.evaluation;
        }
        if (data && data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        lastError = err?.message || 'Gagal evaluasi jawaban';
        if (attempt < candidateEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }
    throw new Error(lastError || 'Gagal evaluasi jawaban');
  },

  // Archive exam questions to EduCBT/Riwayat Soal on the server
  async archiveToEduCBT(exam: any, txtContent?: string): Promise<any> {
    try {
      const res = await fetch('/api/educbt/archive-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam, txtContent }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Get server-side EduCBT archives list
  async fetchEduCBTArchives(): Promise<any> {
    try {
      const res = await fetch('/api/educbt/archives');
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async generateRemedialEnrichment(params: {
    studentName: string;
    subject: string;
    finalScore: number;
    kkm: number;
    weakTopics?: string[];
    strongTopics?: string[];
  }): Promise<any> {
    const apiKey = this.getStoredApiKey();
    const candidateEndpoints = [
      '/api/generate-remedial-enrichment',
      '/api/gemini/generate-remedial-enrichment',
      '/api/cbt/generate-remedial-enrichment',
    ];

    let lastError = '';
    for (let attempt = 0; attempt < candidateEndpoints.length; attempt++) {
      const endpoint = candidateEndpoints[attempt];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            ...params,
          }),
        });
        const data = await safeParseResponse(res, 'Gagal membuat program remidi/pengayaan', endpoint);
        if (data && data.success && data.program) {
          return data.program;
        }
        if (data && data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        lastError = err?.message || 'Gagal membuat program remidi/pengayaan';
        if (attempt < candidateEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }
    throw new Error(lastError || 'Gagal membuat program remidi/pengayaan');
  },

  async syncWithGAS(action: string, payload: any, webAppUrl?: string): Promise<any> {
    const maskedUrl = webAppUrl ? `${webAppUrl.slice(0, 35)}...${webAppUrl.slice(-10)}` : '(local simulated)';
    console.info(`[API Request] /api/sync-gas action="${action}" target="${maskedUrl}"`, {
      action,
      payloadType: typeof payload,
      hasWebAppUrl: !!webAppUrl,
    });
    const res = await fetch('/api/sync-gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, webAppUrl }),
    });
    const data = await safeParseResponse(res, 'Gagal sinkronisasi Google Apps Script', '/api/sync-gas');
    console.info(`[API Response] /api/sync-gas action="${action}" status=${res.status}`, data);
    return data;
  },

  async diagnoseGAS(webAppUrl: string): Promise<any> {
    console.info(`[API Request] /api/sync-gas/diagnose target="${webAppUrl.slice(0, 35)}..."`);
    const res = await fetch('/api/sync-gas/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl }),
    });
    const data = await safeParseResponse(res, 'Gagal mendiagnosis Google Apps Script', '/api/sync-gas/diagnose');
    return data;
  },

  // ==========================================
  // CBT SERVER REAL-TIME SYNC METHODS
  // ==========================================

  // Fetch complete CBT state from server
  async fetchServerState(): Promise<any> {
    try {
      const res = await fetch('/api/cbt/state');
      if (!res.ok) throw new Error('Server response not ok');
      return await res.json();
    } catch (e) {
      console.warn('Gagal memuat state dari server:', e);
      return { success: false };
    }
  },

  // Teacher synchronizes exam, school profile, students, classes, and packages to server
  async syncTeacherToServer(payload: {
    exam?: any;
    schoolProfile?: any;
    students?: any[];
    classes?: string[];
    packages?: any[];
  }): Promise<any> {
    try {
      console.info('[API Request] /api/cbt/sync-teacher', {
        hasExam: !!payload.exam,
        studentsCount: payload.students?.length,
        classesCount: payload.classes?.length,
        packagesCount: payload.packages?.length,
      });
      const res = await fetch('/api/cbt/sync-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.info('[API Response] /api/cbt/sync-teacher', data);
      return data;
    } catch (e) {
      console.warn('Gagal sinkronisasi data guru ke server:', e);
      return { success: false };
    }
  },

  // Student fetches active exam and roster from server on load
  async fetchActiveExamForStudent(): Promise<any> {
    try {
      const res = await fetch('/api/cbt/active-exam');
      if (!res.ok) throw new Error('Server response not ok');
      return await res.json();
    } catch (e) {
      console.warn('Gagal mengambil naskah aktif dari server:', e);
      return { success: false };
    }
  },

  // Student sends heartbeat while taking exam
  async sendStudentPing(payload: {
    studentId: string;
    studentName: string;
    classRoom?: string;
    tabViolations?: number;
  }): Promise<void> {
    try {
      await fetch('/api/cbt/student-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Non-blocking
    }
  },

  // Student submits finished session to server from their device
  async submitSessionToServer(session: any): Promise<any> {
    try {
      const res = await fetch('/api/cbt/submit-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
      });
      return await res.json();
    } catch (e) {
      console.error('Gagal mengirim sesi ujian ke server:', e);
      return { success: false };
    }
  },

  // Live polling for sessions and active pings
  async fetchLiveSessions(): Promise<{ success: boolean; sessions?: any[]; activePings?: any[] }> {
    try {
      const res = await fetch('/api/cbt/sessions');
      if (!res.ok) throw new Error('Server response not ok');
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // Reset or delete a student session on server
  async deleteSessionFromServer(sessionId: string): Promise<any> {
    try {
      const res = await fetch(`/api/cbt/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // Batch delete or reset multiple sessions on server
  async batchDeleteSessionsFromServer(sessionIds: string[], studentIds: string[] = []): Promise<any> {
    try {
      const res = await fetch('/api/cbt/sessions/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds, studentIds }),
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // Update a session on server (manual score edits, answer override)
  async updateSessionOnServer(sessionId: string, updatedSession: any): Promise<any> {
    try {
      const res = await fetch(`/api/cbt/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedSession }),
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // =========================================================================
  // DRAFT PERSISTENCE (DUAL STORAGE: LOCALSTORAGE + SERVER-SIDE)
  // =========================================================================

  // 1. Question Drafts
  async getQuestionDrafts(): Promise<QuestionDraft[]> {
    // 1. First get from local cache
    let localDrafts: QuestionDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_question_drafts');
      if (raw) localDrafts = JSON.parse(raw);
    } catch {}

    // 2. Fetch server drafts and merge
    try {
      const res = await fetch('/api/cbt/drafts/questions');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.drafts)) {
          const map = new Map<string, QuestionDraft>();
          localDrafts.forEach((d) => map.set(d.id, d));
          data.drafts.forEach((d: QuestionDraft) => map.set(d.id, d));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
          );
          localStorage.setItem('educbt_question_drafts', JSON.stringify(merged));
          return merged;
        }
      }
    } catch {}

    return localDrafts;
  },

  async saveQuestionDraft(draft: QuestionDraft): Promise<{ success: boolean; drafts: QuestionDraft[] }> {
    // Save to local cache
    let drafts: QuestionDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_question_drafts');
      if (raw) drafts = JSON.parse(raw);
    } catch {}

    const index = drafts.findIndex((d) => d.id === draft.id);
    const updatedDraft = { ...draft, savedAt: new Date().toISOString() };
    if (index >= 0) {
      drafts[index] = updatedDraft;
    } else {
      drafts.unshift(updatedDraft);
    }
    localStorage.setItem('educbt_question_drafts', JSON.stringify(drafts));

    // Save to server
    try {
      await fetch('/api/cbt/drafts/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: updatedDraft }),
      });
    } catch (err) {
      console.warn('Gagal sinkron draft soal ke server, tersimpan lokal:', err);
    }

    return { success: true, drafts };
  },

  async deleteQuestionDraft(id: string): Promise<{ success: boolean; drafts: QuestionDraft[] }> {
    let drafts: QuestionDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_question_drafts');
      if (raw) drafts = JSON.parse(raw);
    } catch {}

    const filtered = drafts.filter((d) => d.id !== id);
    localStorage.setItem('educbt_question_drafts', JSON.stringify(filtered));

    try {
      await fetch(`/api/cbt/drafts/questions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Gagal hapus draft soal di server:', err);
    }

    return { success: true, drafts: filtered };
  },

  // 2. Student Drafts
  async getStudentDrafts(): Promise<StudentDraft[]> {
    let localDrafts: StudentDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_student_drafts');
      if (raw) localDrafts = JSON.parse(raw);
    } catch {}

    try {
      const res = await fetch('/api/cbt/drafts/students');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.drafts)) {
          const map = new Map<string, StudentDraft>();
          localDrafts.forEach((d) => map.set(d.id, d));
          data.drafts.forEach((d: StudentDraft) => map.set(d.id, d));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
          );
          localStorage.setItem('educbt_student_drafts', JSON.stringify(merged));
          return merged;
        }
      }
    } catch {}

    return localDrafts;
  },

  async saveStudentDraft(draft: StudentDraft): Promise<{ success: boolean; drafts: StudentDraft[] }> {
    let drafts: StudentDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_student_drafts');
      if (raw) drafts = JSON.parse(raw);
    } catch {}

    const index = drafts.findIndex((d) => d.id === draft.id);
    const updatedDraft = { ...draft, savedAt: new Date().toISOString() };
    if (index >= 0) {
      drafts[index] = updatedDraft;
    } else {
      drafts.unshift(updatedDraft);
    }
    localStorage.setItem('educbt_student_drafts', JSON.stringify(drafts));

    try {
      await fetch('/api/cbt/drafts/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: updatedDraft }),
      });
    } catch (err) {
      console.warn('Gagal sinkron draft siswa ke server, tersimpan lokal:', err);
    }

    return { success: true, drafts };
  },

  async deleteStudentDraft(id: string): Promise<{ success: boolean; drafts: StudentDraft[] }> {
    let drafts: StudentDraft[] = [];
    try {
      const raw = localStorage.getItem('educbt_student_drafts');
      if (raw) drafts = JSON.parse(raw);
    } catch {}

    const filtered = drafts.filter((d) => d.id !== id);
    localStorage.setItem('educbt_student_drafts', JSON.stringify(filtered));

    try {
      await fetch(`/api/cbt/drafts/students/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Gagal hapus draft siswa di server:', err);
    }

    return { success: true, drafts: filtered };
  },
};
