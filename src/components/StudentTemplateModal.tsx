import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Student } from '../types';
import { excelService } from '../services/gasSync';

interface StudentTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudentCount: number;
  onImportStudents: (students: Student[], mode: 'append' | 'replace') => void;
  onNotification?: (msg: string) => void;
}

export const StudentTemplateModal: React.FC<StudentTemplateModalProps> = ({
  isOpen,
  onClose,
  currentStudentCount,
  onImportStudents,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'xlsx' | 'csv') => {
    excelService.downloadStudentTemplate(format);
    if (onNotification) {
      onNotification(`Template Daftar Siswa EduCBT (.${format}) berhasil diunduh!`);
    }
  };

  const processFile = async (file: File) => {
    setParsing(true);
    setUploadError(null);
    setUploadedFileName(file.name);
    try {
      const results = await excelService.parseStudentsFromExcel(file);
      if (results.length === 0) {
        setUploadError('Tidak ada data siswa yang valid ditemukan dalam file. Pastikan kolom "NISN" atau "Nama Lengkap" terisi.');
        setParsedStudents([]);
      } else {
        setParsedStudents(results);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Gagal memproses file Excel / CSV.');
      setParsedStudents([]);
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
    if (parsedStudents.length === 0) return;
    onImportStudents(parsedStudents, importMode);
    if (onNotification) {
      onNotification(
        `Berhasil mengimpor ${parsedStudents.length} data siswa (${
          importMode === 'replace' ? 'mengganti semua data siswa' : 'ditambahkan ke daftar'
        })!`
      );
    }
    onClose();
  };

  // Group classes
  const uniqueClasses: string[] = Array.from(
    new Set(parsedStudents.map((s) => s.classRoom).filter(Boolean))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Template Daftar Siswa (Excel / CSV)</h3>
              <p className="text-xs text-slate-500">
                Unduh format baku atau impor data siswa secara massal untuk rombel dan peserta ujian
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
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Unduh Template Siswa</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Unggah &amp; Impor File Siswa</span>
            {parsedStudents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                {parsedStudents.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'download' ? (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 text-xs text-indigo-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Petunjuk Format Data Siswa</span>
                </div>
                <p className="text-indigo-900/90 leading-relaxed">
                  Template ini telah disesuaikan dengan data pokok siswa sekolah (NISN, Nama Lengkap, Jenis Kelamin, Kelas/Rombel, serta Kontak Orang Tua). NISN akan digunakan siswa sebagai kode otentikasi pengerjaan ujian.
                </p>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => handleDownload('xlsx')}
                  className="p-4 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100/70 text-left transition flex items-start gap-3 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Unduh Template Excel (.xlsx)</h4>
                    <p className="text-[11px] text-slate-600 pt-0.5">
                      Rekomendasi utama. Dilengkapi data percontohan dan lembar panduan kolom.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 pt-2">
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
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Unduh Template CSV (.csv)</h4>
                    <p className="text-[11px] text-slate-600 pt-0.5">
                      Format baris koma universal untuk integrasi cepat dari aplikasi lain.
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
                  Struktur Kolom dalam Template:
                </div>
                <div className="p-4 space-y-2.5 text-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <span className="font-bold text-indigo-700">1. NISN:</span> 10 Digit nomor induk unik siswa (ID Ujian)
                    </div>
                    <div>
                      <span className="font-bold text-indigo-700">2. Nama Lengkap:</span> Nama siswa sesuai data resmi
                    </div>
                    <div>
                      <span className="font-bold text-indigo-700">3. Jenis Kelamin (L/P):</span> Isi &quot;L&quot; atau &quot;P&quot;
                    </div>
                    <div>
                      <span className="font-bold text-indigo-700">4. Kelas:</span> Nama rombel (misal: IX-A, IX-B, VII-1)
                    </div>
                    <div>
                      <span className="font-bold text-indigo-700">5. No. WhatsApp Orang Tua:</span> Awali 08 atau 62
                    </div>
                    <div>
                      <span className="font-bold text-indigo-700">6. Email Orang Tua:</span> Alamat surel wali (opsional)
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs flex items-center gap-1.5 transition"
                >
                  <span>Sudah Ada File? Lanjut ke Unggah Siswa</span>
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
                    ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
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
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih file atau seret file ke area ini
                  </p>
                  <p className="text-[11px] text-slate-500">Mendukung file Excel (.xlsx, .xls) dan teks (.csv)</p>
                </div>
                {uploadedFileName && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    File: {uploadedFileName}
                  </span>
                )}
              </div>

              {parsing && (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Sedang memproses dan memvalidasi daftar siswa...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {parsedStudents.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Summary Bar */}
                  <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-indigo-950">
                        {parsedStudents.length} Data Siswa Terdeteksi
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-semibold text-slate-700">
                        {uniqueClasses.length} Rombel: {uniqueClasses.slice(0, 4).join(', ')}
                        {uniqueClasses.length > 4 ? '...' : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-semibold text-slate-700">
                        L: {parsedStudents.filter((s) => s.gender === 'L').length} | P:{' '}
                        {parsedStudents.filter((s) => s.gender === 'P').length}
                      </span>
                    </div>
                  </div>

                  {/* Mode Option */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                    <label className="font-bold text-slate-800 block">Metode Penggabungan Siswa:</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                          className="text-indigo-600"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">Tambahkan ke Siswa Saat Ini</span>
                          <span className="text-[10px] text-slate-500">
                            Total menjadi {currentStudentCount + parsedStudents.length} siswa
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
                          className="text-indigo-600"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">Ganti Seluruh Data Siswa</span>
                          <span className="text-[10px] text-slate-500">
                            Mengosongkan {currentStudentCount} siswa lama dan menggantinya
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                      <span>Pratinjau Data Siswa (Menampilkan {Math.min(parsedStudents.length, 5)} pertama)</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Total {parsedStudents.length} Siswa
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {parsedStudents.slice(0, 5).map((s, idx) => (
                        <div key={idx} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">{s.name}</span>
                              <span className="text-[11px] font-mono text-slate-500">NISN: {s.nisn}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {s.classRoom}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {s.gender === 'L' ? 'L' : 'P'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setParsedStudents([])}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                    >
                      Pilih File Lain
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Terapkan Impor Data Siswa</span>
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
