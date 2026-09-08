import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Sparkles,
  Info,
  HelpCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Question, Exam } from '../types';
import { excelService } from '../services/gasSync';

interface QuestionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onImportQuestions: (questions: Question[], mode: 'append' | 'replace') => void;
  onNotification?: (msg: string) => void;
}

export const QuestionTemplateModal: React.FC<QuestionTemplateModalProps> = ({
  isOpen,
  onClose,
  exam,
  onImportQuestions,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'xlsx' | 'csv') => {
    excelService.downloadQuestionTemplate(format);
    if (onNotification) {
      onNotification(`Template Soal EduCBT (.${format}) berhasil diunduh!`);
    }
  };

  const processFile = async (file: File) => {
    setParsing(true);
    setUploadError(null);
    setUploadedFileName(file.name);
    try {
      const results = await excelService.parseQuestionsFromExcel(file);
      if (results.length === 0) {
        setUploadError('Tidak ada butir soal yang valid ditemukan dalam file. Pastikan kolom "Pertanyaan" atau "Soal" terisi.');
        setParsedQuestions([]);
      } else {
        setParsedQuestions(results);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Gagal memproses file Excel / CSV.');
      setParsedQuestions([]);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApplyImport = () => {
    if (parsedQuestions.length === 0) return;
    onImportQuestions(parsedQuestions, importMode);
    if (onNotification) {
      onNotification(
        `Berhasil mengimpor ${parsedQuestions.length} butir soal (${
          importMode === 'replace' ? 'mengganti semua soal' : 'ditambahkan ke bank soal'
        })!`
      );
    }
    onClose();
  };

  // Group counts by type
  const typeCounts = {
    pg: parsedQuestions.filter((q) => q.type === 'pilihan_ganda').length,
    pgk: parsedQuestions.filter((q) => q.type === 'pilihan_ganda_kompleks').length,
    isian: parsedQuestions.filter((q) => q.type === 'isian_singkat').length,
    uraian: parsedQuestions.filter((q) => q.type === 'uraian').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Template Soal Asesmen (Excel / CSV)</h3>
              <p className="text-xs text-slate-500">
                Unduh format baku atau unggah file soal untuk pengisian cepat secara massal
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

        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-white gap-2">
          <button
            onClick={() => setActiveTab('download')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'download'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Unduh Template Baku</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Unggah &amp; Impor File Soal</span>
            {parsedQuestions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {parsedQuestions.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'download' ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>Petunjuk Penggunaan Template Soal</span>
                </div>
                <p className="text-emerald-900/90 leading-relaxed">
                  Template ini telah dilengkapi dengan contoh 4 bentuk soal resmi: <b>Pilihan Ganda</b>,{' '}
                  <b>Pilihan Ganda Kompleks</b>, <b>Isian Singkat</b>, dan <b>Uraian/Esai</b>, serta lembar petunjuk pengisian lengkap.
                </p>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => handleDownload('xlsx')}
                  className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/70 text-left transition flex items-start gap-3 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Unduh Format Excel (.xlsx)</h4>
                    <p className="text-[11px] text-slate-600 pt-0.5">
                      Rekomendasi utama. Dilengkapi 2 lembar kerja (Sheet Soal &amp; Sheet Petunjuk).
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 pt-2">
                      <Download className="w-3.5 h-3.5" /> Unduh .xlsx
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => handleDownload('csv')}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition flex items-start gap-3 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Unduh Format CSV (.csv)</h4>
                    <p className="text-[11px] text-slate-600 pt-0.5">
                      Format teks sederhana yang cocok untuk Google Sheets, LibreOffice, atau sistem lain.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 pt-2">
                      <Download className="w-3.5 h-3.5" /> Unduh .csv
                    </span>
                  </div>
                </button>
              </div>

              {/* Column Structure Reference */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-200">
                  Kolom-Kolom dalam Template:
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="font-bold text-blue-700">1. Bentuk Soal:</span> pilihan_ganda, pilihan_ganda_kompleks, isian_singkat, uraian
                    </div>
                    <div>
                      <span className="font-bold text-blue-700">2. Pertanyaan:</span> Teks naskah butir soal lengkap
                    </div>
                    <div>
                      <span className="font-bold text-blue-700">3. Pilihan A - E:</span> Teks pilihan opsi (PG &amp; PG Kompleks)
                    </div>
                    <div>
                      <span className="font-bold text-blue-700">4. Kunci Jawaban:</span> 1 huruf (A), koma (A, C), atau kata kunci
                    </div>
                    <div>
                      <span className="font-bold text-blue-700">5. Kata Kunci Konsep:</span> Kumpulan kata kunci penilaian otomatis AI
                    </div>
                    <div>
                      <span className="font-bold text-blue-700">6. Skor Maks:</span> Bobot nilai per soal (contoh: 10 atau 20)
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 transition"
                >
                  <span>Sudah Punya File? Lanjut ke Menu Unggah</span>
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-emerald-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih file atau seret file ke area ini
                  </p>
                  <p className="text-[11px] text-slate-500">Mendukung format .xlsx, .xls, dan .csv</p>
                </div>
                {uploadedFileName && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    File: {uploadedFileName}
                  </span>
                )}
              </div>

              {parsing && (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Sedang memproses dan memvalidasi butir soal...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {parsedQuestions.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Summary Bar */}
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-950">
                        {parsedQuestions.length} Butir Soal Terdeteksi
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {typeCounts.pg > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-semibold text-slate-700">
                          PG: {typeCounts.pg}
                        </span>
                      )}
                      {typeCounts.pgk > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-semibold text-slate-700">
                          PG Kompleks: {typeCounts.pgk}
                        </span>
                      )}
                      {typeCounts.isian > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-semibold text-slate-700">
                          Isian: {typeCounts.isian}
                        </span>
                      )}
                      {typeCounts.uraian > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-semibold text-slate-700">
                          Uraian: {typeCounts.uraian}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mode Option */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                    <label className="font-bold text-slate-800 block">Metode Penggabungan Soal:</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                          className="text-emerald-600"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">Tambahkan ke Soal Saat Ini</span>
                          <span className="text-[10px] text-slate-500">
                            Total menjadi {exam.questions.length + parsedQuestions.length} butir
                          </span>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-emerald-600"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">Ganti Seluruh Soal Aktif</span>
                          <span className="text-[10px] text-slate-500">
                            Mengosongkan {exam.questions.length} soal lama dan menggantinya
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                      <span>Pratinjau Butir Soal (Menampilkan {Math.min(parsedQuestions.length, 5)} pertama)</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Total {parsedQuestions.length} Soal
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {parsedQuestions.slice(0, 5).map((q, idx) => (
                        <div key={idx} className="p-3 hover:bg-slate-50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700">
                              {q.type.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              Kunci: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-bold ml-auto">
                              Skor: {q.maxScore}
                            </span>
                          </div>
                          <p className="text-slate-800 line-clamp-2 pl-7">{q.question}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setParsedQuestions([])}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                    >
                      Pilih File Lain
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Terapkan Impor ke Bank Soal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
