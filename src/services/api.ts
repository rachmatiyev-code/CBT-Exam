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

async function safeParseResponse(res: Response, defaultError: string): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
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
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await safeParseResponse(res, 'Gagal memvalidasi kunci API');
      if (!data) {
        return { success: false, message: 'Server tidak merespons.' };
      }
      if (!data.success) {
        return { success: false, message: data.error || data.message || 'Kunci API tidak valid.' };
      }
      return {
        success: true,
        message: data.message || 'Kunci API Gemini valid dan siap digunakan!',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Gagal menghubungi server.',
      };
    }
  },

  async generateQuestions(params: GenerateQuestionsParams): Promise<any> {
    const apiKey = this.getStoredApiKey();
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        ...params,
      }),
    });
    const data = await safeParseResponse(res, 'Gagal generate soal');
    if (!data.success) {
      throw new Error(data.error || 'Gagal generate soal');
    }
    return data.questions;
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
    const res = await fetch('/api/analyze-exam-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        ...params,
      }),
    });
    const data = await safeParseResponse(res, 'Gagal menganalisis hasil ujian');
    if (!data.success) {
      throw new Error(data.error || 'Gagal menganalisis hasil ujian');
    }
    return data.analysis;
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
    const res = await fetch('/api/evaluate-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        ...params,
      }),
    });
    const data = await safeParseResponse(res, 'Gagal evaluasi jawaban');
    if (!data.success) {
      throw new Error(data.error || 'Gagal evaluasi jawaban');
    }
    return data.evaluation;
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
    const res = await fetch('/api/generate-remedial-enrichment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        ...params,
      }),
    });
    const data = await safeParseResponse(res, 'Gagal membuat program remidi/pengayaan');
    if (!data.success) {
      throw new Error(data.error || 'Gagal membuat program remidi/pengayaan');
    }
    return data.program;
  },

  async syncWithGAS(action: string, payload: any, webAppUrl?: string): Promise<any> {
    const res = await fetch('/api/sync-gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, webAppUrl }),
    });
    return safeParseResponse(res, 'Gagal sinkronisasi Google Apps Script');
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

  // Teacher synchronizes exam, school profile, students, and packages to server
  async syncTeacherToServer(payload: {
    exam?: any;
    schoolProfile?: any;
    students?: any[];
    packages?: any[];
  }): Promise<any> {
    try {
      const res = await fetch('/api/cbt/sync-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
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
};
