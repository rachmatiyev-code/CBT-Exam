export type QuestionType =
  | 'pilihan_ganda'
  | 'pilihan_ganda_kompleks'
  | 'isian_singkat'
  | 'uraian';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[]; // ['A. ...', 'B. ...'] for PG and PG Kompleks
  correctAnswer: string | string[]; // 'A' or ['A', 'C'] or 'mitokondria'
  image?: string; // Base64 data URL atau URL gambar soal
  keywords?: string[]; // Kata kunci untuk isian & uraian
  concept?: string; // Konsep materi pokok
  rubric?: string; // Rubrik penilaian
  maxScore: number;
  explanation?: string;
  indicator?: string; // Indikator Soal untuk Kisi-Kisi
  cognitiveLevel?: 'L1' | 'L2' | 'L3'; // L1=Mudah/Pemahaman, L2=Sedang/Aplikasi, L3=Sukar/Penalaran
}

export interface Exam {
  id: string;
  code: string; // Kode Soal, misal: 'IPA-09-01'
  title: string;
  subject: string;
  grade: string;
  semester: string;
  durationMinutes: number;
  token: string; // Token Ujian Siswa, misal: 'IPA26'
  kkm: number;
  educationGoal?: string;
  coreMaterial?: string;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
}

export interface ExamPackage {
  id: string;
  code: string; // Kode Soal
  token: string; // Token Ujian Siswa
  title: string;
  subject: string;
  grade: string;
  semester: string;
  durationMinutes: number;
  kkm: number;
  educationGoal?: string;
  coreMaterial?: string;
  questionsCount: number;
  questions: Question[];
  savedAt: string;
  note?: string;
}

export interface ClassRoom {
  id: string;
  name: string; // e.g. 'IX-A', 'IX-B'
  gradeLevel: string; // e.g. 'Kelas 9'
  academicYear: string;
  totalStudents?: number;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classRoom: string;
  parentPhone: string;
  parentEmail: string;
}

export interface StudentAnswer {
  questionId: string;
  answer: string | string[];
  isDoubtful?: boolean; // Ragu-ragu
  awardedScore?: number;
  maxScore?: number;
  feedback?: string;
  matchedKeywords?: string[];
}

export interface RemedialEnrichmentPlan {
  type: 'remidi' | 'pengayaan';
  headline: string;
  summary: string;
  actionSteps: string[];
  recommendedResources: string[];
  practiceQuestions: string[];
  motivationQuote: string;
}

export interface StudentExamSession {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNisn: string;
  classRoom: string;
  status: 'belum_mulai' | 'mengerjakan' | 'selesai' | 'terindikasi_curang';
  startTime: string;
  finishTime?: string;
  tabSwitchCount: number;
  cheatLogs: Array<{ timestamp: string; note: string }>;
  answers: Record<string, StudentAnswer>;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  typeScores?: {
    pg?: { score: number; max: number; percentage: number };
    isian?: { score: number; max: number; percentage: number };
    uraian?: { score: number; max: number; percentage: number };
    avgTypePercentage: number;
  };
  passedKKM: boolean;
  remedialPlan?: RemedialEnrichmentPlan;
  syncedToGoogleSheet?: boolean;
  backedUpToDrive?: boolean;
}

export interface SchoolProfile {
  name: string;
  npsn: string;
  address: string;
  academicYear: string;
  teacherName: string;
  headmasterName: string;
  defaultKkm: number;
  // Official Kop Surat & Logo
  govLevel?: string; // misal: 'PEMERINTAH PROVINSI DKI JAKARTA' atau 'PEMERINTAH KOTA SURABAYA'
  govDepartment?: string; // misal: 'DINAS PENDIDIKAN DAN KEBUDAYAAN'
  schoolSubUnit?: string; // misal: 'SEKOLAH MENENGAH PERTAMA'
  schoolPhone?: string; // misal: '(021) 3456789'
  schoolEmail?: string; // misal: 'smpn1nusantara@sekolah.sch.id'
  schoolWebsite?: string; // misal: 'www.smpn1nusantara.sch.id'
  postalCode?: string; // misal: '10110'
  schoolLogo?: string; // Base64 dataURL / preset
  pemkotLogo?: string; // Base64 dataURL / preset
}

export interface ItemAnalysis {
  questionId: string;
  questionNumber: number;
  type: QuestionType;
  questionText: string;
  maxScore: number;
  correctCount: number;
  totalAttempts: number;
  difficultyIndex: number; // 0.0 - 1.0 (tingkat kesukaran)
  difficultyCategory: 'Mudah' | 'Sedang' | 'Sukar';
  discriminationIndex: number; // Daya pembeda kelompok atas vs bawah
  discriminationCategory: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Perbaikan';
  optionDistribution?: Record<string, number>; // misal: { A: 10, B: 2, C: 1, D: 0 }
}

export interface ExamAnalysisSummary {
  totalParticipants: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  standardDeviation: number;
  passCount: number;
  remedialCount: number;
  passPercentage: number;
  itemAnalyses: ItemAnalysis[];
  scoreDistribution: {
    gradeA: number; // 90-100
    gradeB: number; // 80-89
    gradeC: number; // 70-79 (KKM zone)
    gradeD: number; // < 70
  };
}

export interface DriveBackupItem {
  id: string;
  folder: 'Soal' | 'Hasil-Ujian';
  name: string;
  fileType: string;
  size: string;
  createdAt: string;
  drivePath: string;
  itemCount: number;
}

export interface AppsScriptSettings {
  webAppUrl: string;
  sheetId: string;
  driveFolderName: string;
  isConnected: boolean;
  autoBackupEnabled: boolean;
  lastSyncTime: string;
}
