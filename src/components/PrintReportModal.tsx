import React, { useState } from 'react';
import { Printer, X, Download, School, Check, AlertTriangle, Eye, EyeOff, FileText } from 'lucide-react';
import { Exam, SchoolProfile, StudentExamSession } from '../types';

interface PrintReportModalProps {
  type: 'individual' | 'classical' | 'questions' | 'kisi_kisi';
  exam: Exam;
  schoolProfile: SchoolProfile;
  sessions: StudentExamSession[];
  individualSession?: StudentExamSession;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  type,
  exam,
  schoolProfile,
  sessions,
  individualSession,
  onClose,
}) => {
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const completedSessions = sessions.filter((s) => s.status === 'selesai');
  const sortedSessions = [...completedSessions].sort((a, b) => b.percentage - a.percentage);

  // Stats for classical
  const totalCount = sortedSessions.length;
  const avg =
    totalCount > 0 ? sortedSessions.reduce((acc, s) => acc + s.percentage, 0) / totalCount : 0;
  const highest = totalCount > 0 ? Math.max(...sortedSessions.map((s) => s.percentage)) : 0;
  const lowest = totalCount > 0 ? Math.min(...sortedSessions.map((s) => s.percentage)) : 0;
  const passedCount = sortedSessions.filter((s) => s.passedKKM).length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        {/* Modal Controls (Hidden when printing) */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-xs sm:text-sm">
              {type === 'individual' && `Pratinjau Cetak Lembar Hasil Siswa: ${individualSession?.studentName}`}
              {type === 'classical' && `Pratinjau Cetak Leger Nilai Klasikal: Kelas ${exam.grade}`}
              {type === 'questions' && `Pratinjau Cetak Naskah Soal Ujian: ${exam.title}`}
              {type === 'kisi_kisi' && `Pratinjau Cetak Kisi-Kisi Soal Asesmen: ${exam.title}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {type === 'questions' && (
              <button
                type="button"
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
              >
                {showAnswerKey ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{showAnswerKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci & Rubrik'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 sm:p-12 overflow-y-auto print:p-6 print:overflow-visible space-y-6 text-slate-900 bg-white font-sans">
          {/* 1. Official School Kop Surat Kedinasan (Dua Logo: Pemkot & Sekolah) */}
          <div className="border-b-[3px] border-slate-900 pb-3">
            <div className="flex items-center justify-between gap-4">
              {/* Logo Pemkot / Dinas (Kiri) */}
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {schoolProfile.pemkotLogo ? (
                  <img
                    src={schoolProfile.pemkotLogo}
                    alt="Logo Pemkot"
                    className="max-h-20 max-w-20 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-slate-400 flex items-center justify-center text-[9px] font-bold text-slate-500 text-center">
                    LOGO PEMDA
                  </div>
                )}
              </div>

              {/* Teks Kop Tengah */}
              <div className="flex-1 text-center space-y-0.5">
                {schoolProfile.govLevel && (
                  <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-800">
                    {schoolProfile.govLevel}
                  </h3>
                )}
                {schoolProfile.govDepartment && (
                  <h4 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-800">
                    {schoolProfile.govDepartment}
                  </h4>
                )}
                {schoolProfile.schoolSubUnit && (
                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-700">
                    {schoolProfile.schoolSubUnit}
                  </h4>
                )}
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-950">
                  {schoolProfile.name}
                </h1>
                <p className="text-[11px] text-slate-600 leading-tight">
                  {schoolProfile.address}
                  {schoolProfile.postalCode ? ` Kode Pos ${schoolProfile.postalCode}` : ''}
                  {schoolProfile.schoolPhone ? ` • Telp: ${schoolProfile.schoolPhone}` : ''}
                </p>
                <p className="text-[10px] text-slate-500">
                  {schoolProfile.schoolEmail ? `Email: ${schoolProfile.schoolEmail}` : ''}
                  {schoolProfile.schoolWebsite ? ` • Website: ${schoolProfile.schoolWebsite}` : ''}
                  {` • NPSN: ${schoolProfile.npsn}`}
                </p>
              </div>

              {/* Logo Sekolah (Kanan) */}
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {schoolProfile.schoolLogo ? (
                  <img
                    src={schoolProfile.schoolLogo}
                    alt="Logo Sekolah"
                    className="max-h-20 max-w-20 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-slate-400 flex items-center justify-center text-[9px] font-bold text-slate-500 text-center">
                    LOGO SEKOLAH
                  </div>
                )}
              </div>
            </div>

            {/* Garis Kop Ganda Standar Kedinasan */}
            <div className="mt-2 border-b border-slate-900"></div>
          </div>

          {/* 2. Document Title */}
          <div className="text-center space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold uppercase underline tracking-wider">
              {type === 'individual' && 'LEMBAR LAPORAN HASIL ASESMEN UJIAN SISWA (CBT)'}
              {type === 'classical' && 'LEGER REKAPITULASI HASIL ASESMEN UJIAN KLASIKAL'}
              {type === 'questions' && 'NASKAH SOAL ASESMEN SUMATIF / UJIAN AKHIR SEMESTER'}
            </h2>
            <p className="text-xs text-slate-600">
              Mata Pelajaran: <strong>{exam.subject}</strong> • Tingkat/Kelas: <strong>{exam.grade}</strong> • Semester: <strong>{exam.semester}</strong>
            </p>
          </div>

          {/* ==================================================== */}
          {/* CASE A: INDIVIDUAL PRINT REPORT                      */}
          {/* ==================================================== */}
          {type === 'individual' && individualSession && (
            <div className="space-y-6 text-xs">
              {/* Student Metadata Table */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-32 text-slate-500 font-medium">Nama Siswa</span>
                    <span className="font-bold text-slate-900">: {individualSession.studentName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500 font-medium">NISN</span>
                    <span className="font-mono font-medium text-slate-900">: {individualSession.studentNisn}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500 font-medium">Kelas / Rombel</span>
                    <span className="font-medium text-slate-900">: {individualSession.classRoom}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-36 text-slate-500 font-medium">Nilai Akhir Ujian</span>
                    <span className="font-bold text-blue-700 text-sm">: {individualSession.percentage.toFixed(1)} / 100</span>
                  </div>
                  <div className="flex">
                    <span className="w-36 text-slate-500 font-medium">Kriteria Ketuntasan (KKM)</span>
                    <span className="font-bold text-slate-900">: {schoolProfile.defaultKkm}</span>
                  </div>
                  <div className="flex">
                    <span className="w-36 text-slate-500 font-medium">Status Asesmen</span>
                    <span className="font-bold">
                      : {individualSession.passedKKM ? '✅ TUNTAS' : '⚠️ BELUM TUNTAS / REMIDI'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Question By Question Table */}
              <div>
                <h3 className="font-bold text-slate-800 mb-2 uppercase text-[11px]">
                  Rincian Penilaian Per Butir Soal (Skoring Otomatis AI)
                </h3>
                <table className="w-full text-[11px] border border-slate-300">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center w-8">No</th>
                      <th className="p-2 border-r border-slate-300">Butir Pertanyaan &amp; Tipe</th>
                      <th className="p-2 border-r border-slate-300">Jawaban Peserta</th>
                      <th className="p-2 border-r border-slate-300">Kunci / Kata Kunci AI</th>
                      <th className="p-2 text-center w-14">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {exam.questions.map((q, idx) => {
                      const ans = individualSession.answers[q.id];
                      return (
                        <tr key={q.id}>
                          <td className="p-2 text-center border-r border-slate-300 font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-300">
                            <span className="font-semibold text-slate-800 block">{q.question}</span>
                            <span className="text-[10px] text-slate-400 font-mono">[{q.type}]</span>
                          </td>
                          <td className="p-2 border-r border-slate-300 font-medium text-blue-900">
                            {ans?.answer ? (Array.isArray(ans.answer) ? ans.answer.join(', ') : ans.answer) : '-'}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-slate-600">
                            <div>Kunci: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}</div>
                            {ans?.matchedKeywords && ans.matchedKeywords.length > 0 && (
                              <div className="text-[10px] text-emerald-700">
                                Cocok: {ans.matchedKeywords.join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-900">
                            {ans?.awardedScore ?? 0} / {q.maxScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* AI Remedial or Enrichment Plan */}
              {individualSession.remedialPlan && (
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">
                    Rekomendasi Program Edukatif AI ({individualSession.remedialPlan.type.toUpperCase()})
                  </h4>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {individualSession.remedialPlan.summary}
                  </p>
                  <div className="text-[11px] text-slate-700">
                    <strong>Rencana Langkah:</strong> {individualSession.remedialPlan.actionSteps.join(' • ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* CASE B: CLASSICAL PRINT REPORT                       */}
          {/* ==================================================== */}
          {type === 'classical' && (
            <div className="space-y-6 text-xs">
              {/* Summary Stats Table */}
              <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300 text-center">
                <div>
                  <span className="text-slate-500 text-[10px] block">Jumlah Siswa</span>
                  <span className="font-bold text-slate-900 text-sm">{totalCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Nilai Rata-Rata</span>
                  <span className="font-bold text-blue-700 text-sm">{avg.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Nilai Tertinggi</span>
                  <span className="font-bold text-emerald-700 text-sm">{highest.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Nilai Terendah</span>
                  <span className="font-bold text-rose-700 text-sm">{lowest.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Ketuntasan Klasikal</span>
                  <span className="font-bold text-purple-700 text-sm">{passRate}% ({passedCount}/{totalCount})</span>
                </div>
              </div>

              {/* Classical Table */}
              <table className="w-full text-[11px] border border-slate-300">
                <thead className="bg-slate-100 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-8">No</th>
                    <th className="p-2 border-r border-slate-300">NISN</th>
                    <th className="p-2 border-r border-slate-300">Nama Siswa</th>
                    <th className="p-2 border-r border-slate-300 text-center">Kelas</th>
                    <th className="p-2 border-r border-slate-300 text-center">Skor / Max</th>
                    <th className="p-2 border-r border-slate-300 text-center">Nilai Akhir</th>
                    <th className="p-2 border-r border-slate-300 text-center">Status KKM</th>
                    <th className="p-2 text-center">Kedisiplinan Tab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {sortedSessions.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="p-2 text-center border-r border-slate-300 font-mono">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono">{s.studentNisn}</td>
                      <td className="p-2 border-r border-slate-300 font-semibold">{s.studentName}</td>
                      <td className="p-2 border-r border-slate-300 text-center">{s.classRoom}</td>
                      <td className="p-2 border-r border-slate-300 text-center">{s.totalScore} / {s.maxTotalScore}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold">{s.percentage.toFixed(1)}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-semibold">
                        {s.passedKKM ? 'TUNTAS' : 'REMIDI'}
                      </td>
                      <td className="p-2 text-center">
                        {s.tabSwitchCount === 0 ? 'Tertib' : `${s.tabSwitchCount}x Peringatan`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ==================================================== */}
          {/* CASE C: QUESTIONS PRINT REPORT (CETAK NASKAH SOAL)   */}
          {/* ==================================================== */}
          {type === 'questions' && (
            <div className="space-y-6 text-xs">
              {/* Exam Identity Box & Student Identity Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-400 p-3.5 rounded-lg bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-medium">Mata Pelajaran</span>
                    <span className="font-bold text-slate-900">: {exam.subject}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-medium">Tingkat / Kelas</span>
                    <span className="font-bold text-slate-900">: {exam.grade} ({exam.semester})</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-medium">Alokasi Waktu</span>
                    <span className="font-medium text-slate-900">: {exam.durationMinutes} Menit</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-medium">Kode / Token</span>
                    <span className="font-mono font-bold text-slate-900">: {exam.code || 'IPA-09-01'} / {exam.token}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0 sm:pl-4">
                  <div className="flex items-center">
                    <span className="w-28 text-slate-600 font-medium">Nama Peserta</span>
                    <span className="font-medium text-slate-400">: .....................................................</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 text-slate-600 font-medium">Nomor / NISN</span>
                    <span className="font-medium text-slate-400">: .....................................................</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 text-slate-600 font-medium">Kelas / Ruang</span>
                    <span className="font-medium text-slate-400">: .....................................................</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 text-slate-600 font-medium">Tanda Tangan</span>
                    <span className="font-medium text-slate-400">: .....................................................</span>
                  </div>
                </div>
              </div>

              {/* General Instructions */}
              <div className="border border-slate-300 p-3 rounded-lg bg-slate-50 text-[11px] space-y-1">
                <span className="font-bold uppercase tracking-wider block text-slate-900">Petunjuk Pengerjaan:</span>
                <ol className="list-decimal pl-4 space-y-0.5 text-slate-700">
                  <li>Berdoalah sebelum memulai mengerjakan soal ujian.</li>
                  <li>Tuliskan identitas Anda dengan jelas pada kolom lembar jawaban yang tersedia.</li>
                  <li>Periksa dan bacalah setiap butir soal dengan teliti sebelum Anda menjawabnya.</li>
                  <li>Untuk soal pilihan ganda, berilah tanda silang (X) pada huruf opsi yang paling tepat.</li>
                  <li>Dilarang berbuat curang, membuka catatan, atau bekerja sama selama ujian berlangsung.</li>
                </ol>
              </div>

                {/* Questions List */}
              <div className="space-y-6 pt-2">
                {exam.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-2 break-inside-avoid">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 w-6 shrink-0">{idx + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-slate-900 leading-relaxed">{q.question}</p>

                        {/* Question Image if present */}
                        {q.image && (
                          <div className="my-2 max-w-md">
                            <img
                              src={q.image}
                              alt={`Gambar soal nomor ${idx + 1}`}
                              className="max-h-56 max-w-full rounded-lg border border-slate-300 object-contain"
                            />
                          </div>
                        )}

                        {/* Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="text-slate-800">
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* If short answer */}
                        {q.type === 'isian_singkat' && (
                          <div className="pl-2 pt-1 text-slate-400 italic">
                            Jawaban: ............................................................................................
                          </div>
                        )}

                        {/* If essay */}
                        {q.type === 'uraian' && (
                          <div className="pl-2 pt-2">
                            <div className="border border-dashed border-slate-300 h-24 rounded p-2 text-slate-400 italic text-[10px]">
                              Lembar jawaban uraian / coretan peserta...
                            </div>
                          </div>
                        )}

                        {/* Optional Answer Key for Teachers */}
                        {showAnswerKey && (
                          <div className="mt-2 p-2.5 rounded bg-amber-50/80 border border-amber-300 text-[11px] text-amber-950 space-y-1">
                            <div className="font-bold">
                              Kunci Jawaban:{' '}
                              <span className="text-emerald-700">
                                {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                              </span>
                              {' '}(Bobot:{' '}
                              {q.type === 'pilihan_ganda' || q.type === 'pilihan_ganda_kompleks'
                                ? '1 Poin'
                                : q.type === 'isian_singkat'
                                ? '2 Poin'
                                : '3 Poin'}
                              )
                            </div>
                            {q.keywords && q.keywords.length > 0 && (
                              <div>Kata Kunci: {q.keywords.join(', ')}</div>
                            )}
                            {q.rubric && <div>Rubrik: {q.rubric}</div>}
                            {q.explanation && <div>Pembahasan: {q.explanation}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* CASE D: KISI-KISI SOAL ASESMEN PRINT REPORT          */}
          {/* ==================================================== */}
          {type === 'kisi_kisi' && (
            <div className="space-y-6 text-xs">
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900">
                  KISI-KISI PENULISAN SOAL ASESMEN SUMATIF / UJIAN SEKOLAH
                </h3>
                <p className="text-slate-600 font-medium">
                  Tahun Ajaran {schoolProfile.academicYear || '2025/2026'}
                </p>
              </div>

              {/* Identity Matrix */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-36 text-slate-600 font-medium">Satuan Pendidikan</span>
                    <span className="font-bold text-slate-900">: {schoolProfile.name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-36 text-slate-600 font-medium">Mata Pelajaran</span>
                    <span className="font-bold text-slate-900">: {exam.subject}</span>
                  </div>
                  <div className="flex">
                    <span className="w-36 text-slate-600 font-medium">Kelas / Semester</span>
                    <span className="font-bold text-slate-900">: {exam.grade} / {exam.semester}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-32 text-slate-600 font-medium">Alokasi Waktu</span>
                    <span className="font-bold text-slate-900">: {exam.durationMinutes} Menit</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-600 font-medium">Jumlah Soal</span>
                    <span className="font-bold text-slate-900">: {exam.questions.length} Butir</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-600 font-medium">Bentuk Soal</span>
                    <span className="font-medium text-slate-900">: PG (1 Poin), Isian (2 Poin), Uraian (3 Poin)</span>
                  </div>
                </div>
              </div>

              {/* Kisi-Kisi Table */}
              <div className="border border-slate-400 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="bg-slate-100 font-bold border-b border-slate-400 text-slate-900">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center w-8">No</th>
                      <th className="p-2 border-r border-slate-300 text-left w-48">Tujuan / CP</th>
                      <th className="p-2 border-r border-slate-300 text-left w-36">Materi Pokok</th>
                      <th className="p-2 border-r border-slate-300 text-left">Indikator Soal</th>
                      <th className="p-2 border-r border-slate-300 text-center w-24">Bentuk</th>
                      <th className="p-2 border-r border-slate-300 text-center w-16">Level</th>
                      <th className="p-2 border-r border-slate-300 text-center w-14">Bobot</th>
                      <th className="p-2 text-center w-20">Kunci</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {exam.questions.map((q, idx) => {
                      const typeLabel =
                        q.type === 'pilihan_ganda'
                          ? 'PG'
                          : q.type === 'pilihan_ganda_kompleks'
                          ? 'PG Kompleks'
                          : q.type === 'isian_singkat'
                          ? 'Isian'
                          : 'Uraian';
                      const defaultBobot =
                        q.type === 'pilihan_ganda' || q.type === 'pilihan_ganda_kompleks'
                          ? '1'
                          : q.type === 'isian_singkat'
                          ? '2'
                          : '3';
                      const cognitiveLevel = q.cognitiveLevel || (idx % 3 === 0 ? 'L1' : idx % 3 === 1 ? 'L2' : 'L3 (HOTS)');
                      const indicator = q.indicator || `Disajikan stimulus, peserta didik mampu mengidentifikasi ${q.concept || 'konsep materi'} dengan tepat.`;

                      return (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center border-r border-slate-300 font-mono font-bold">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-300 leading-tight">
                            {exam.educationGoal || 'Memahami dan menerapkan konsep pembelajaran sesuai kurikulum.'}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-medium">
                            {q.concept || exam.coreMaterial || 'Materi Pokok'}
                          </td>
                          <td className="p-2 border-r border-slate-300 leading-tight text-slate-800">
                            {indicator}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-medium">
                            {typeLabel}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-semibold">
                            {cognitiveLevel}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-bold text-indigo-700">
                            {defaultBobot} Poin
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-700 truncate max-w-20">
                            {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Signatures Section */}
          <div className="pt-8 grid grid-cols-2 text-xs text-center break-inside-avoid">
            <div>
              <p className="text-slate-500">Mengetahui,</p>
              <p className="font-semibold text-slate-800">Kepala Satuan Pendidikan</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{schoolProfile.headmasterName}</p>
              <p className="text-slate-500 font-mono text-[10px]">NIP. 19780514 200212 1 002</p>
            </div>

            <div>
              <p className="text-slate-500">Guru Mata Pelajaran,</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{schoolProfile.teacherName}</p>
              <p className="text-slate-500 font-mono text-[10px]">NIP. 19850320 200903 2 005</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

