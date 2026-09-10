import React, { useState, useEffect } from 'react';
import {
  X,
  BookmarkPlus,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  DownloadCloud,
  Layers,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Exam, Question, QuestionDraft } from '../types';
import { apiService } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

interface QuestionDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onLoadDraft: (draft: QuestionDraft) => void;
  onSaveNotification?: (msg: string) => void;
}

export const QuestionDraftModal: React.FC<QuestionDraftModalProps> = ({
  isOpen,
  onClose,
  exam,
  onLoadDraft,
  onSaveNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'save'>('list');
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Form state for saving new draft
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');

  // Load drafts on modal open
  useEffect(() => {
    if (isOpen) {
      loadDrafts();
      setDraftTitle(`Draft ${exam.subject || 'Soal'} - ${exam.questions.length} Butir (${new Date().toLocaleDateString('id-ID')})`);
      setDraftNote(`Disimpan dari mata pelajaran ${exam.subject || 'Umum'} Kelas ${exam.grade || '9'}`);
      setFeedback(null);
    }
  }, [isOpen, exam]);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getQuestionDrafts();
      setDrafts(data);
      if (data.length === 0) {
        setActiveTab('save');
      }
    } catch (e) {
      console.warn('Gagal memuat draft:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) {
      setFeedback({ type: 'error', text: 'Judul draft soal tidak boleh kosong.' });
      return;
    }
    if (exam.questions.length === 0) {
      setFeedback({ type: 'error', text: 'Bank soal masih kosong. Tambahkan atau buat soal terlebih dahulu sebelum menyimpan draft.' });
      return;
    }

    setSaving(true);
    try {
      const newDraft: QuestionDraft = {
        id: `draft-q-${Date.now()}`,
        title: draftTitle.trim(),
        subject: exam.subject || 'Umum',
        grade: exam.grade || 'Kelas 9',
        semester: exam.semester || '1',
        questionsCount: exam.questions.length,
        questions: JSON.parse(JSON.stringify(exam.questions)),
        savedAt: new Date().toISOString(),
        note: draftNote.trim(),
      };

      const res = await apiService.saveQuestionDraft(newDraft);
      setDrafts(res.drafts);
      setFeedback({
        type: 'success',
        text: `Draft "${newDraft.title}" (${newDraft.questionsCount} butir) berhasil disimpan!`,
      });
      if (onSaveNotification) {
        onSaveNotification(`Draft "${newDraft.title}" berhasil disimpan!`);
      }
      setTimeout(() => {
        setActiveTab('list');
        setFeedback(null);
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menyimpan draft soal.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id: string, title: string) => {
    if (!confirm(`Hapus draft soal "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await apiService.deleteQuestionDraft(id);
      setDrafts(res.drafts);
      setFeedback({ type: 'success', text: `Draft "${title}" berhasil dihapus.` });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Gagal menghapus draft.' });
    }
  };

  const handleApplyDraft = (draft: QuestionDraft) => {
    if (
      exam.questions.length > 0 &&
      !confirm(`Muat draft "${draft.title}" (${draft.questionsCount} butir)? Butir soal di bank soal saat ini akan digantikan dengan butir soal dari draft ini.`)
    ) {
      return;
    }
    onLoadDraft(draft);
    if (onSaveNotification) {
      onSaveNotification(`Draft "${draft.title}" (${draft.questionsCount} butir) berhasil dimuat!`);
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
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Manajemen Draft Bank Soal</h3>
              <p className="text-xs text-slate-500">
                Simpan naskah sementara tanpa mengganti token atau mempublikasikan ujian
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-white gap-2">
          <button
            onClick={() => {
              setActiveTab('list');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Daftar Draft Tersimpan</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-50 text-blue-700 font-bold border border-blue-200">
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
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Simpan Soal Saat Ini sebagai Draft</span>
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

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' ? (
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">Memuat daftar draft soal...</div>
              ) : drafts.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-100">
                    <BookmarkPlus className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Belum ada Draft Soal Tersimpan</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Simpan naskah soal yang sedang Anda susun sekarang agar dapat dimuat kembali kapan saja.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('save')}
                    className="mt-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
                  >
                    Simpan Soal Saat Ini sebagai Draft
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                    <span>Ditemukan {drafts.length} draft soal</span>
                    <button
                      onClick={loadDrafts}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Segarkan
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{d.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {d.questionsCount} Butir Soal
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {d.subject} • {d.grade}
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
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            title="Muat draft ini ke bank soal aktif"
                          >
                            <DownloadCloud className="w-3.5 h-3.5" />
                            <span>Muat Draft</span>
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
              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200/80 text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Ringkasan Soal yang Akan Disimpan:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Total Soal</span>
                    <span className="text-sm font-bold text-blue-700">{exam.questions.length} Butir</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Mata Pelajaran</span>
                    <span className="text-sm font-bold text-slate-800 truncate block">{exam.subject || '-'}</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Tingkat Kelas</span>
                    <span className="text-sm font-bold text-slate-800">{exam.grade || '-'}</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Total Poin</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {exam.questions.reduce((acc, q) => acc + (q.maxScore || 10), 0)} Poin
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Judul / Label Draft Soal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Contoh: Draft PTS IPA Semester Genap - 25 Soal"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Catatan pengerjaan, bab materi pokok, atau revisi yang belum selesai..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-700"
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
                  disabled={saving || exam.questions.length === 0}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 transition"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Draft Soal'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
