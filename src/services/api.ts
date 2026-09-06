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

export const apiService = {
  getStoredApiKey(): string {
    return localStorage.getItem('educbt_gemini_api_key') || '';
  },

  setStoredApiKey(key: string): void {
    localStorage.setItem('educbt_gemini_api_key', key.trim());
  },

  async validateKey(customKey?: string): Promise<{ success: boolean; message: string }> {
    const apiKey = customKey || this.getStoredApiKey();
    const res = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    return res.json();
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
    const data = await res.json();
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
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Gagal menganalisis hasil ujian');
    }
    return data.analysis;
  },

  async evaluateAnswer(params: {
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
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Gagal evaluasi jawaban');
    }
    return data.evaluation;
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
    const data = await res.json();
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
    return res.json();
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
};
