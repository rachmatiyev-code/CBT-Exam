import React, { useState } from 'react';
import {
  MonitorPlay,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Check,
  Edit3,
  Trash2,
  Eye,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  FileSpreadsheet,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { Exam, Student, StudentExamSession } from '../types';

interface LiveMonitoringTabProps {
  exam: Exam;
  students: Student[];
  sessions: StudentExamSession[];
  activePings?: Array<{
    studentId: string;
    studentName: string;
    classRoom: string;
    tabViolations: number;
    lastSeen: number;
  }>;
  onRefreshLive?: () => void;
  isSyncing?: boolean;
  onOpenShareLinkModal?: () => void;
  onUpdateSession: (updated: StudentExamSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onSelectStudentForDetail: (session: StudentExamSession) => void;
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  exam,
  students,
  sessions,
  activePings = [],
  onRefreshLive,
  isSyncing = false,
  onOpenShareLinkModal,
  onUpdateSession,
  onDeleteSession,
  onSelectStudentForDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingSession, setEditingSession] = useState<StudentExamSession | null>(null);

  // Merge active live heartbeats of students currently in exam
  const activePingSessions: StudentExamSession[] = (activePings || [])
    .filter(
      (ping) =>
        !sessions.some(
          (s) => (s.studentId === ping.studentId || s.id === ping.studentId) && s.status === 'selesai'
        )
    )
    .map((ping) => {
      const studentInfo = students.find((st) => st.id === ping.studentId);
      return {
        id: `live-${ping.studentId}`,
        examId: exam.id,
        studentId: ping.studentId,
        studentName: ping.studentName,
        studentNisn: studentInfo?.nisn || '00000000',
        classRoom: ping.classRoom || studentInfo?.classRoom || 'IX',
        status: ping.tabViolations > 5 ? 'terindikasi_curang' : 'mengerjakan',
        startTime: new Date(ping.lastSeen).toISOString(),
        tabSwitchCount: ping.tabViolations,
        cheatLogs:
          ping.tabViolations > 0
            ? [
                {
                  timestamp: new Date().toISOString(),
                  note: `${ping.tabViolations}x Peringatan Tab/Aplikasi (Live)`,
                },
              ]
            : [],
        answers: {},
        totalScore: 0,
        maxTotalScore: exam.questions.length * 10,
        percentage: 0,
        passedKKM: false,
      };
    });

  const mergedSessions = [
    ...activePingSessions,
    ...sessions.filter((s) => !activePingSessions.some((p) => p.studentId === s.studentId)),
  ];

  // Quick stats
  const totalStudents = students.length;
  const inProgress = mergedSessions.filter((s) => s.status === 'mengerjakan').length;
  const completed = mergedSessions.filter((s) => s.status === 'selesai').length;
  const flagged = mergedSessions.filter(
    (s) => s.tabSwitchCount > 0 || s.status === 'terindikasi_curang'
  ).length;

  // Filtered list
  const filteredSessions = mergedSessions.filter((s) => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentNisn.includes(searchTerm) ||
      s.classRoom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      s.status === statusFilter ||
      (statusFilter === 'curang' && s.tabSwitchCount > 0);
    return matchesSearch && matchesStatus;
  });

  const handleSaveEdit = (updated: StudentExamSession) => {
    onUpdateSession(updated);
    setEditingSession(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Terdaftar</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalStudents} Siswa</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Sedang Ujian</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{inProgress} Siswa</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Sudah Selesai</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{completed} Siswa</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Peringatan Tab / Curang</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{flagged} Terdeteksi</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari peserta berdasarkan nama, NISN, atau kelas..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {onOpenShareLinkModal && (
            <button
              onClick={onOpenShareLinkModal}
              className="px-3 py-1.5 rounded-xl font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 transition text-xs shadow-2xs whitespace-nowrap"
              title="Bagikan Tautan Ujian & Token ke Siswa"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan Link Siswa</span>
            </button>
          )}

          {onRefreshLive && (
            <button
              onClick={onRefreshLive}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 transition text-xs shadow-2xs whitespace-nowrap"
              title="Perbarui data ujian langsung dari server terpusat"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Segarkan Data Siswa'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'Semua Status' },
              { id: 'mengerjakan', label: 'Sedang Mengerjakan' },
              { id: 'selesai', label: 'Selesai' },
              { id: 'curang', label: 'Ada Peringatan Tab' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition text-xs ${
                  statusFilter === f.id
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12 text-center">No</th>
                <th className="px-4 py-3">Nama Siswa &amp; NISN</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Status Ujian</th>
                <th className="px-4 py-3">Progres Soal</th>
                <th className="px-4 py-3">Peringatan Tab Keluar</th>
                <th className="px-4 py-3">Nilai Akhir</th>
                <th className="px-4 py-3 text-right">Tombol Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Belum ada sesi siswa yang sedang berlangsung atau selesai.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((ses, idx) => {
                  const answeredCount = Object.keys(ses.answers).length;
                  const totalQuestions = exam.questions.length;
                  const progressPct = Math.round((answeredCount / (totalQuestions || 1)) * 100);

                  return (
                    <tr key={ses.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-center font-mono text-slate-400">{idx + 1}</td>

                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{ses.studentName}</span>
                        <span className="font-mono text-[11px] text-slate-500">NISN: {ses.studentNisn}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                          {ses.classRoom}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {ses.status === 'mengerjakan' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            Sedang Mengerjakan
                          </span>
                        )}
                        {ses.status === 'selesai' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Selesai Ujian
                          </span>
                        )}
                        {ses.status === 'terindikasi_curang' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Terindikasi Curang
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span>{answeredCount} dari {totalQuestions}</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {ses.tabSwitchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            {ses.tabSwitchCount}x Pindah Tab
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Tertib (0x)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {ses.status === 'selesai' ? (
                          <div>
                            <span className="text-sm font-bold text-slate-900 block">
                              {ses.percentage.toFixed(1)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                ses.passedKKM ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {ses.passedKKM ? 'TUNTAS' : 'REMIDI'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Berlangsung...</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Tombol PILIH (Sesuai Permintaan) */}
                          <button
                            id={`btn-select-student-${ses.id}`}
                            onClick={() => onSelectStudentForDetail(ses)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition shadow-2xs"
                            title="Pilih siswa untuk lihat lembar jawaban, kata kunci, dan analisis AI"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Pilih</span>
                          </button>

                          {/* 2. Tombol EDIT (Sesuai Permintaan) */}
                          <button
                            id={`btn-edit-student-${ses.id}`}
                            onClick={() => setEditingSession(ses)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1 transition"
                            title="Edit nilai akhir, status kelulusan, atau catatan pelanggaran"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>Edit</span>
                          </button>

                          {/* 3. Tombol HAPUS (Sesuai Permintaan) */}
                          <button
                            id={`btn-delete-student-${ses.id}`}
                            onClick={() => {
                              if (confirm(`Yakin ingin mereset/menghapus hasil ujian siswa "${ses.studentName}"? Siswa dapat mengulang ujian kembali.`)) {
                                onDeleteSession(ses.id);
                              }
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 transition"
                            title="Hapus sesi pengerjaan siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onSave={handleSaveEdit}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
};

// Sub-component for editing student session
interface EditSessionModalProps {
  session: StudentExamSession;
  onSave: (ses: StudentExamSession) => void;
  onClose: () => void;
}

const EditSessionModal: React.FC<EditSessionModalProps> = ({ session, onSave, onClose }) => {
  const [totalScore, setTotalScore] = useState(session.totalScore);
  const [maxTotalScore, setMaxTotalScore] = useState(session.maxTotalScore);
  const [status, setStatus] = useState(session.status);
  const [tabSwitchCount, setTabSwitchCount] = useState(session.tabSwitchCount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pct = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
    onSave({
      ...session,
      totalScore,
      maxTotalScore,
      percentage: pct,
      passedKKM: pct >= 75,
      status,
      tabSwitchCount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Edit Hasil &amp; Sesi Ujian Siswa</h3>
            <p className="text-xs text-slate-300">{session.studentName} ({session.studentNisn})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status Sesi Ujian</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="mengerjakan">Sedang Mengerjakan</option>
              <option value="selesai">Selesai</option>
              <option value="terindikasi_curang">Terindikasi Curang (Diskualifikasi)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Skor Diperoleh</label>
              <input
                type="number"
                min={0}
                value={totalScore}
                onChange={(e) => setTotalScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Skor Maksimal Total</label>
              <input
                type="number"
                min={1}
                value={maxTotalScore}
                onChange={(e) => setMaxTotalScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jumlah Peringatan Tab Keluar</label>
            <input
              type="number"
              min={0}
              value={tabSwitchCount}
              onChange={(e) => setTabSwitchCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
            Nilai Akhir Baru: <strong>{maxTotalScore > 0 ? ((totalScore / maxTotalScore) * 100).toFixed(1) : 0} / 100</strong>{' '}
            ({(totalScore / maxTotalScore) * 100 >= 75 ? 'TUNTAS' : 'BELUM TUNTAS / REMIDI'})
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
