import React, { useState, useEffect } from 'react';
import {
  X,
  BookmarkPlus,
  Users,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  DownloadCloud,
  Layers,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { Student, StudentDraft } from '../types';
import { apiService } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

interface StudentDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: string[];
  onLoadDraft: (draft: StudentDraft, mode: 'append' | 'replace') => void;
  onNotification?: (msg: string) => void;
}

export const StudentDraftModal: React.FC<StudentDraftModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  onLoadDraft,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'save'>('list');
  const [drafts, setDrafts] = useState<StudentDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Form state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [selectedLoadMode, setSelectedLoadMode] = useState<'append' | 'replace'>('replace');

  useEffect(() => {
    if (isOpen) {
      loadDrafts();
      setDraftTitle(`Draft Siswa (${students.length} Siswa, ${classes.length} Rombel) - ${new Date().toLocaleDateString('id-ID')}`);
      setDraftNote(`Roster siswa rombel: ${classes.slice(0, 4).join(', ')}${classes.length > 4 ? '...' : ''}`);
      setFeedback(null);
    }
  }, [isOpen, students, classes]);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getStudentDrafts();
      setDrafts(data);
      if (data.length === 0) {
        setActiveTab('save');
      }
    } catch (e) {
      console.warn('Gagal memuat draft siswa:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) {
      setFeedback({ type: 'error', text: 'Judul draft siswa wajib diisi.' });
      return;
    }
    if (students.length === 0) {
      setFeedback({ type: 'error', text: 'Daftar siswa masih kosong. Tambahkan siswa sebelum menyimpan draft.' });
      return;
    }

    setSaving(true);
    try {
      const uniqueClasses: string[] = Array.from(
        new Set(students.map((s) => s.classRoom).filter(Boolean))
      );
      const newDraft: StudentDraft = {
        id: `draft-std-${Date.now()}`,
        title: draftTitle.trim(),
        studentsCount: students.length,
        classesCount: uniqueClasses.length,
        classes: uniqueClasses,
        students: JSON.parse(JSON.stringify(students)),
        savedAt: new Date().toISOString(),
        note: draftNote.trim(),
      };

      const res = await apiService.saveStudentDraft(newDraft);
      setDrafts(res.drafts);
      setFeedback({
        type: 'success',
        text: `Draft "${newDraft.title}" (${newDraft.studentsCount} siswa) berhasil disimpan!`,
      });
      if (onNotification) {
        onNotification(`Draft siswa "${newDraft.title}" berhasil disimpan!`);
      }
      setTimeout(() => {
        setActiveTab('list');
        setFeedback(null);
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menyimpan draft siswa.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id: string, title: string) => {
    if (!confirm(`Hapus draft siswa "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await apiService.deleteStudentDraft(id);
      setDrafts(res.drafts);
      setFeedback({ type: 'success', text: `Draft "${title}" berhasil dihapus.` });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Gagal menghapus draft.' });
    }
  };

  const handleApplyDraft = (draft: StudentDraft) => {
    onLoadDraft(draft, selectedLoadMode);
    if (onNotification) {
      onNotification(
        `Draft siswa "${draft.title}" (${draft.studentsCount} siswa) berhasil dimuat (${
          selectedLoadMode === 'replace' ? 'menggantikan daftar siswa' : 'ditambahkan ke daftar siswa'
        })!`
      );
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Manajemen Draft Daftar Siswa</h3>
              <p className="text-xs text-slate-500">
                Simpan dan pulihkan daftar siswa dan rombel tanpa menghapus data secara permanen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-white gap-2">
          <button
            onClick={() => {
              setActiveTab('list');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Daftar Draft Siswa</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-50 text-purple-700 font-bold border border-purple-200">
              {drafts.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('save');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'save'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Simpan Roster Siswa Saat Ini</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="select-text font-mono text-[11px] truncate sm:whitespace-normal">{feedback.text}</span>
            </div>
            {feedback.type === 'error' && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyToClipboard(feedback.text);
                  if (ok) {
                    setCopiedFeedback(true);
                    setTimeout(() => setCopiedFeedback(false), 2500);
                  }
                }}
                className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                  copiedFeedback
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white hover:bg-rose-100 text-rose-800 border border-rose-300'
                }`}
                title="Salin pesan error"
              >
                {copiedFeedback ? (
                  <>
                    <Check className="w-3 h-3 text-white" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-rose-700" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' ? (
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">Memuat daftar draft siswa...</div>
              ) : drafts.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center border border-purple-100">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Belum ada Draft Siswa Tersimpan</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Simpan data rombel atau kelas saat ini ke draft agar dapat dimuat kembali kapan saja.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('save')}
                    className="mt-2 px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition"
                  >
                    Simpan Data Siswa Saat Ini sebagai Draft
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pb-1">
                    <span>Ditemukan {drafts.length} draft siswa</span>
                    {/* Load mode choice */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700">Saat memuat:</span>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="radio"
                          name="loadMode"
                          value="replace"
                          checked={selectedLoadMode === 'replace'}
                          onChange={() => setSelectedLoadMode('replace')}
                          className="text-purple-600"
                        />
                        <span>Ganti Semua</span>
                      </label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="radio"
                          name="loadMode"
                          value="append"
                          checked={selectedLoadMode === 'append'}
                          onChange={() => setSelectedLoadMode('append')}
                          className="text-purple-600"
                        />
                        <span>Gabungkan</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{d.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              {d.studentsCount} Siswa
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {d.classesCount} Rombel: {d.classes.join(', ')}
                            </span>
                          </div>
                          {d.note && <p className="text-xs text-slate-600 line-clamp-1">{d.note}</p>}
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>Tersimpan: {new Date(d.savedAt).toLocaleString('id-ID')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0">
                          <button
                            onClick={() => handleApplyDraft(d)}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            title="Muat draft siswa ini"
                          >
                            <DownloadCloud className="w-3.5 h-3.5" />
                            <span>Muat Siswa</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDraft(d.id, d.title)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Hapus draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveDraft} className="space-y-4">
              <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200/80 text-xs text-purple-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Ringkasan Data Siswa yang Akan Disimpan:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="bg-white/90 p-2 rounded-lg border border-purple-100">
                    <span className="text-[10px] text-slate-500 block">Total Siswa</span>
                    <span className="text-sm font-bold text-purple-700">{students.length} Siswa</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-purple-100">
                    <span className="text-[10px] text-slate-500 block">Total Rombel</span>
                    <span className="text-sm font-bold text-slate-800">{classes.length} Kelas</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-purple-100 sm:col-span-1 col-span-2">
                    <span className="text-[10px] text-slate-500 block">Daftar Kelas</span>
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {classes.join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Judul / Label Draft Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Contoh: Roster Siswa Kelas IX Lengkap 2026"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 font-semibold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Keterangan per rombel, tanggal pemutakhiran Dapodik, atau catatan wali kelas..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 text-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || students.length === 0}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 transition"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Draft Siswa'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
