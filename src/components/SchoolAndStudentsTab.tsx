import React, { useState, useMemo } from 'react';
import {
  School,
  Users,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit,
  Save,
  FileSpreadsheet,
  CheckCircle,
  Phone,
  Mail,
  Search,
  Image as ImageIcon,
  Building,
  Layers,
  Eye,
  BookmarkPlus,
  Check,
  FolderPlus,
  ArrowUpDown,
} from 'lucide-react';
import { SchoolProfile, Student, StudentDraft } from '../types';
import { excelService } from '../services/gasSync';
import { apiService } from '../services/api';
import { StudentDraftModal } from './StudentDraftModal';
import { StudentTemplateModal } from './StudentTemplateModal';

interface SchoolAndStudentsTabProps {
  schoolProfile: SchoolProfile;
  onUpdateSchool: (updated: SchoolProfile) => void;
  students: Student[];
  onUpdateStudents: (updated: Student[]) => void;
  classes?: string[];
  onUpdateClasses?: (classes: string[]) => void;
  onTriggerBackup: () => void;
}

export const SchoolAndStudentsTab: React.FC<SchoolAndStudentsTabProps> = ({
  schoolProfile,
  onUpdateSchool,
  students,
  onUpdateStudents,
  classes = [],
  onUpdateClasses,
  onTriggerBackup,
}) => {
  const [profileForm, setProfileForm] = useState<SchoolProfile>({ ...schoolProfile });
  const [isSavedSchool, setIsSavedSchool] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importing, setImporting] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [renamingClass, setRenamingClass] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState('');

  // Combined distinct classes from both props and student roster
  const activeClasses = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      if (c && c.trim()) set.add(c.trim().toUpperCase());
    });
    students.forEach((s) => {
      if (s.classRoom && s.classRoom.trim()) set.add(s.classRoom.trim().toUpperCase());
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['IX-A', 'IX-B', 'IX-C'];
  }, [classes, students]);

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleLoadDraftStudent = (draft: StudentDraft, mode: 'append' | 'replace') => {
    const updated = mode === 'replace' ? draft.students : [...students, ...draft.students];
    onUpdateStudents(updated);
    onTriggerBackup();
    showToast(`Draft siswa dimuat (${draft.students.length} siswa)`);
  };

  const handleImportTemplateStudents = (imported: Student[], mode: 'append' | 'replace') => {
    const updated = mode === 'replace' ? imported : [...students, ...imported];
    onUpdateStudents(updated);
    onTriggerBackup();
    showToast(`${imported.length} siswa berhasil diimpor!`);
  };

  // Simpan Data Siswa dan Kelas ke LocalStorage & Sinkronkan ke Server
  const handleSaveStudentsAndClasses = async () => {
    setIsSavingAll(true);
    try {
      localStorage.setItem('educbt_students', JSON.stringify(students));
      localStorage.setItem('educbt_classes', JSON.stringify(activeClasses));

      await apiService.syncTeacherToServer({
        students,
        classes: activeClasses,
        schoolProfile,
      });

      onTriggerBackup();
      showToast(`✅ Data Tersimpan: ${students.length} Siswa & ${activeClasses.length} Rombel Kelas berhasil disinkronkan!`);
    } catch (err: any) {
      console.warn('Sync server warning:', err);
      // Still saved locally
      localStorage.setItem('educbt_students', JSON.stringify(students));
      localStorage.setItem('educbt_classes', JSON.stringify(activeClasses));
      showToast(`✅ Data ${students.length} Siswa & ${activeClasses.length} Kelas tersimpan di browser.`);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Filtered students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nisn.includes(searchTerm) ||
      s.classRoom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.classRoom === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchool(profileForm);
    setIsSavedSchool(true);
    onTriggerBackup();
    setTimeout(() => setIsSavedSchool(false), 2500);
  };

  const handleLogoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'schoolLogo' | 'pemkotLogo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Harap pilih file gambar (PNG, JPG, SVG, atau WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setProfileForm((prev) => ({ ...prev, [field]: event.target?.result as string }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim().toUpperCase();
    if (!trimmed) return;
    if (activeClasses.includes(trimmed)) {
      showToast(`Kelas ${trimmed} sudah terdaftar.`);
      setSelectedClass(trimmed);
      return;
    }
    const updated = Array.from(new Set([...activeClasses, trimmed])).sort();
    if (onUpdateClasses) onUpdateClasses(updated);
    setSelectedClass(trimmed);
    setNewClassName('');
    showToast(`Kelas ${trimmed} berhasil ditambahkan!`);
    onTriggerBackup();
  };

  const handleRenameClass = (oldName: string, newName: string) => {
    const trimmedNew = newName.trim().toUpperCase();
    if (!trimmedNew || trimmedNew === oldName) {
      setRenamingClass(null);
      return;
    }
    // Update student references
    const updatedStudents = students.map((s) =>
      s.classRoom === oldName ? { ...s, classRoom: trimmedNew } : s
    );
    onUpdateStudents(updatedStudents);

    // Update classes list
    const updatedClasses = activeClasses.map((c) => (c === oldName ? trimmedNew : c));
    const uniqueClasses = Array.from(new Set(updatedClasses)).sort();
    if (onUpdateClasses) onUpdateClasses(uniqueClasses);

    if (selectedClass === oldName) setSelectedClass(trimmedNew);
    setRenamingClass(null);
    showToast(`Kelas ${oldName} berhasil diubah menjadi ${trimmedNew}!`);
    onTriggerBackup();
  };

  const handleDeleteClass = (targetClass: string) => {
    const studentCount = students.filter((s) => s.classRoom === targetClass).length;
    if (studentCount > 0) {
      const confirmDelete = confirm(
        `Kelas ${targetClass} masih memiliki ${studentCount} siswa. Hapus kelas ini dan pindahkan siswa ke kelas 'Umum'?`
      );
      if (!confirmDelete) return;
      const updatedStudents = students.map((s) =>
        s.classRoom === targetClass ? { ...s, classRoom: 'Umum' } : s
      );
      onUpdateStudents(updatedStudents);
    }
    const updatedClasses = activeClasses.filter((c) => c !== targetClass);
    if (onUpdateClasses) onUpdateClasses(updatedClasses);
    if (selectedClass === targetClass) setSelectedClass('all');
    showToast(`Kelas ${targetClass} berhasil dihapus.`);
    onTriggerBackup();
  };

  const handleDeleteStudent = (id: string) => {
    if (confirm('Yakin ingin menghapus siswa ini dari daftar?')) {
      onUpdateStudents(students.filter((s) => s.id !== id));
      onTriggerBackup();
    }
  };

  const handleSaveStudent = (student: Student) => {
    const exists = students.some((s) => s.id === student.id);
    if (exists) {
      onUpdateStudents(students.map((s) => (s.id === student.id ? student : s)));
    } else {
      onUpdateStudents([...students, student]);
    }
    setIsStudentModalOpen(false);
    setEditingStudent(null);
    onTriggerBackup();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const imported = await excelService.parseStudentsFromExcel(file);
      if (imported.length === 0) {
        alert('File tidak memuat data siswa.');
        return;
      }
      onUpdateStudents([...students, ...imported]);
      onTriggerBackup();
      alert(`Berhasil mengimpor ${imported.length} data siswa dari Excel!`);
    } catch (err: any) {
      alert(`Gagal mengimpor file Excel: ${err.message || 'Format tidak cocok'}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* 1. School Information & Official Kop Surat Branding */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Menu Unggah Logo &amp; Kop Surat Resmi Sekolah
              </h2>
              <p className="text-xs text-slate-500">
                Atur logo pemkot/dinas, logo sekolah, serta identitas kop resmi untuk naskah soal dan leger nilai
              </p>
            </div>
          </div>

          {isSavedSchool && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <CheckCircle className="w-4 h-4" /> Data Kop &amp; Sekolah Tersimpan!
            </span>
          )}
        </div>

        {/* Branding Upload Section: Dua Logo (Pemkot & Sekolah) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
          {/* Logo Pemkot / Dinas */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Logo Pemkot / Pemerintah Daerah (Kiri Kop)
              </span>
              {profileForm.pemkotLogo && (
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, pemkotLogo: '' })}
                  className="text-[10px] text-rose-600 hover:underline"
                >
                  Hapus Logo
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                {profileForm.pemkotLogo ? (
                  <img
                    src={profileForm.pemkotLogo}
                    alt="Logo Pemkot"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 text-center font-medium px-1">
                    Belum ada logo
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Format PNG / JPG transparan atau SVG. Ditampilkan di sisi kiri kop surat kedinasan.
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah File Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'pemkotLogo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Sekolah */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <School className="w-4 h-4 text-emerald-600" />
                Logo Sekolah / Satuan Pendidikan (Kanan Kop)
              </span>
              {profileForm.schoolLogo && (
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, schoolLogo: '' })}
                  className="text-[10px] text-rose-600 hover:underline"
                >
                  Hapus Logo
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                {profileForm.schoolLogo ? (
                  <img
                    src={profileForm.schoolLogo}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 text-center font-medium px-1">
                    Belum ada logo
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Format PNG / JPG transparan atau SVG. Ditampilkan di sisi kanan kop surat kedinasan.
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah File Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'schoolLogo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Kop Surat Kedinasan */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            Pratinjau Kop Surat Resmi Terkini:
          </span>
          <div className="border-2 border-slate-800 rounded-xl p-4 bg-white space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-4">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {profileForm.pemkotLogo ? (
                  <img src={profileForm.pemkotLogo} alt="Logo Pemda" className="max-h-16 max-w-16 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded border border-slate-300 text-[8px] flex items-center justify-center text-slate-400 text-center">
                    Logo Pemda
                  </div>
                )}
              </div>

              <div className="flex-1 text-center space-y-0.5">
                <p className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                  {profileForm.govLevel || 'PEMERINTAH PROVINSI / KABUPATEN / KOTA'}
                </p>
                <p className="text-xs font-semibold uppercase text-slate-700">
                  {profileForm.govDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
                </p>
                <p className="text-sm sm:text-base font-black uppercase text-slate-950">
                  {profileForm.name || 'NAMA SATUAN PENDIDIKAN'}
                </p>
                <p className="text-[10px] text-slate-600">
                  {profileForm.address} • NPSN: {profileForm.npsn} • Telp: {profileForm.schoolPhone || '-'}
                </p>
              </div>

              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {profileForm.schoolLogo ? (
                  <img src={profileForm.schoolLogo} alt="Logo Sekolah" className="max-h-16 max-w-16 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded border border-slate-300 text-[8px] flex items-center justify-center text-slate-400 text-center">
                    Logo Sekolah
                  </div>
                )}
              </div>
            </div>
            <div className="border-b-[3px] border-slate-900 pt-1"></div>
            <div className="border-b border-slate-900 mt-0.5"></div>
          </div>
        </div>

        <form onSubmit={handleSaveSchool} className="space-y-4 text-xs">
          {/* Government Level & Department Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tingkat Pemerintahan (Baris 1 Kop)
              </label>
              <input
                type="text"
                value={profileForm.govLevel || ''}
                onChange={(e) => setProfileForm({ ...profileForm, govLevel: e.target.value })}
                placeholder="Contoh: PEMERINTAH PROVINSI DKI JAKARTA"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dinas Terkait (Baris 2 Kop)
              </label>
              <input
                type="text"
                value={profileForm.govDepartment || ''}
                onChange={(e) => setProfileForm({ ...profileForm, govDepartment: e.target.value })}
                placeholder="Contoh: DINAS PENDIDIKAN"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sub-Unit / Jenjang (Baris 3 Kop)
              </label>
              <input
                type="text"
                value={profileForm.schoolSubUnit || ''}
                onChange={(e) => setProfileForm({ ...profileForm, schoolSubUnit: e.target.value })}
                placeholder="Contoh: SEKOLAH MENENGAH PERTAMA"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Satuan Pendidikan / Sekolah</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                value={profileForm.npsn}
                onChange={(e) => setProfileForm({ ...profileForm, npsn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
              <input
                type="text"
                value={profileForm.academicYear}
                onChange={(e) => setProfileForm({ ...profileForm, academicYear: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Guru Mata Pelajaran</label>
              <input
                type="text"
                value={profileForm.teacherName}
                onChange={(e) => setProfileForm({ ...profileForm, teacherName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                value={profileForm.headmasterName}
                onChange={(e) => setProfileForm({ ...profileForm, headmasterName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas KKM Kelulusan (Standar Nilai)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={profileForm.defaultKkm}
                onChange={(e) => setProfileForm({ ...profileForm, defaultKkm: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Sekolah</label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode Pos</label>
              <input
                type="text"
                value={profileForm.postalCode || ''}
                onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                placeholder="10110"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">No. Telepon / Fax</label>
              <input
                type="text"
                value={profileForm.schoolPhone || ''}
                onChange={(e) => setProfileForm({ ...profileForm, schoolPhone: e.target.value })}
                placeholder="(021) 3840001"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Resmi Sekolah</label>
              <input
                type="email"
                value={profileForm.schoolEmail || ''}
                onChange={(e) => setProfileForm({ ...profileForm, schoolEmail: e.target.value })}
                placeholder="info@smpn1.sch.id"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Laman / Website</label>
              <input
                type="text"
                value={profileForm.schoolWebsite || ''}
                onChange={(e) => setProfileForm({ ...profileForm, schoolWebsite: e.target.value })}
                placeholder="https://smpn1.sch.id"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4 text-blue-400" />
              <span>Simpan Pengaturan Kop &amp; Profil Sekolah</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Class & Roster Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kelola Data Siswa &amp; Kelas</h2>
              <p className="text-xs text-slate-500">
                Kelompokkan siswa berdasarkan rombongan belajar untuk pengerjaan ujian dan rekap nilai otomatis
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Add Class Form */}
            <form onSubmit={handleAddClass} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Tambah Kelas (cth: IX-D)..."
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 uppercase"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shadow-2xs transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kelas</span>
              </button>
            </form>

            {/* Tombol Simpan Data Siswa dan Kelas */}
            <button
              type="button"
              id="btn-save-students-classes"
              onClick={handleSaveStudentsAndClasses}
              disabled={isSavingAll}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              title="Simpan perubahan data siswa dan daftar kelas ke browser & server terpusat"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAll ? 'Menyimpan...' : 'Simpan Data Siswa & Kelas'}</span>
            </button>
          </div>
        </div>

        {/* Class Cards Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
          <div
            onClick={() => setSelectedClass('all')}
            className={`p-3 rounded-xl border cursor-pointer transition text-center ${
              selectedClass === 'all'
                ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-2xs ring-1 ring-purple-300'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Semua Rombel</span>
            <span className="text-sm font-bold text-slate-900">{students.length} Siswa</span>
          </div>

          {activeClasses.map((cls) => {
            const classStudents = students.filter((s) => s.classRoom === cls);
            const count = classStudents.length;
            const lCount = classStudents.filter((s) => s.gender === 'L').length;
            const pCount = classStudents.filter((s) => s.gender === 'P').length;
            const isSelected = selectedClass === cls;

            if (renamingClass === cls) {
              return (
                <div key={cls} className="p-2.5 rounded-xl border border-indigo-300 bg-indigo-50/50 space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={renamedValue}
                    onChange={(e) => setRenamedValue(e.target.value.toUpperCase())}
                    className="w-full text-xs font-bold p-1 rounded border border-indigo-400 bg-white"
                  />
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => handleRenameClass(cls, renamedValue)}
                      className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white font-bold rounded"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingClass(null)}
                      className="text-[10px] px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 rounded"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`p-2.5 rounded-xl border cursor-pointer transition relative group ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-2xs ring-1 ring-blue-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold block truncate">Kelas {cls}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingClass(cls);
                        setRenamedValue(cls);
                      }}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                      title="Ubah Nama Kelas"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClass(cls);
                      }}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{count} Peserta</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    L:{lCount} P:{pCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Student Roster Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Daftar Siswa Peserta Ujian</h2>
              <p className="text-xs text-slate-500">
                Kelola data siswa, NISN, kelas, serta nomor WhatsApp &amp; Email orang tua
              </p>
            </div>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Simpan Data Siswa dan Kelas */}
            <button
              type="button"
              id="btn-save-students-classes-toolbar"
              onClick={handleSaveStudentsAndClasses}
              disabled={isSavingAll}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
              title="Simpan data siswa dan kelas sekarang"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAll ? 'Menyimpan...' : 'Simpan Data Siswa'}</span>
            </button>

            {/* Draft Siswa Button */}
            <button
              id="btn-open-student-drafts"
              onClick={() => setIsDraftModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 transition shadow-2xs"
              title="Kelola & Simpan Draft Roster Siswa"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-purple-600" />
              <span>Draft Siswa</span>
            </button>

            {/* Template Siswa (Unduh & Unggah) Button */}
            <button
              id="btn-open-student-templates"
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 transition shadow-2xs"
              title="Unduh & Unggah Template Format Siswa (Excel / CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Template Siswa</span>
            </button>

            <button
              id="btn-add-student-manual"
              onClick={() => {
                setEditingStudent({
                  id: `std-${Date.now()}`,
                  nisn: '',
                  name: '',
                  gender: 'L',
                  classRoom: selectedClass !== 'all' ? selectedClass : activeClasses[0] || 'IX-A',
                  parentPhone: '',
                  parentEmail: '',
                });
                setIsStudentModalOpen(true);
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Siswa</span>
            </button>

            {/* Upload Excel */}
            <label className="px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>{importing ? 'Mengimpor...' : 'Unggah File Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Export Excel */}
            <button
              onClick={() => excelService.exportStudentsToExcel(students)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Unduh Excel</span>
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 text-xs">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari siswa berdasarkan nama, NISN, atau kelas..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-500 font-medium shrink-0">Filter Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">Semua Kelas ({students.length})</option>
              {activeClasses.map((c) => (
                <option key={c} value={c}>
                  Kelas {c} ({students.filter((s) => s.classRoom === c).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">No</th>
                  <th className="px-4 py-3">NISN</th>
                  <th className="px-4 py-3">Nama Lengkap Siswa</th>
                  <th className="px-4 py-3 text-center">L/P</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">No. WhatsApp Orang Tua</th>
                  <th className="px-4 py-3">Email Orang Tua</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data siswa yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-medium text-indigo-700">{s.nisn}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                            s.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {s.gender}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded-md">
                          {s.classRoom}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">
                        {s.parentPhone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {s.parentPhone}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {s.parentEmail ? (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-indigo-500" />
                            {s.parentEmail}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingStudent(s);
                              setIsStudentModalOpen(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit Data Siswa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Form Modal */}
      {isStudentModalOpen && editingStudent && (
        <StudentModal
          student={editingStudent}
          availableClasses={activeClasses}
          onSave={handleSaveStudent}
          onClose={() => {
            setIsStudentModalOpen(false);
            setEditingStudent(null);
          }}
        />
      )}

      {/* Student Draft Modal */}
      <StudentDraftModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        students={students}
        classes={activeClasses}
        onLoadDraft={handleLoadDraftStudent}
        onNotification={(msg) => {
          setToastNotification(msg);
          setTimeout(() => setToastNotification(null), 3000);
        }}
      />

      {/* Student Template Modal */}
      <StudentTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        currentStudentCount={students.length}
        onImportStudents={handleImportTemplateStudents}
        onNotification={(msg) => {
          setToastNotification(msg);
          setTimeout(() => setToastNotification(null), 3000);
        }}
      />
    </div>
  );
};

// Student Edit Modal
interface StudentModalProps {
  student: Student;
  availableClasses?: string[];
  onSave: (s: Student) => void;
  onClose: () => void;
}

const StudentModal: React.FC<StudentModalProps> = ({
  student,
  availableClasses = [],
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<Student>({ ...student });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            {student.name ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">NISN (Nomor Induk Siswa Nasional)</label>
            <input
              type="text"
              required
              value={form.nisn}
              onChange={(e) => setForm({ ...form, nisn: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Contoh: 0089123456"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Siswa</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="Contoh: Muhammad Rizky Pratama"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="L">Laki-Laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kelas / Rombel</label>
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  list="registered-classes-list"
                  value={form.classRoom}
                  onChange={(e) => setForm({ ...form, classRoom: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 uppercase"
                  placeholder="Contoh: IX-A"
                />
                <datalist id="registered-classes-list">
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls} />
                  ))}
                </datalist>
                {availableClasses.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {availableClasses.slice(0, 5).map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setForm({ ...form, classRoom: cls })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition ${
                          form.classRoom === cls
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nomor WhatsApp Orang Tua / Wali
            </label>
            <input
              type="tel"
              value={form.parentPhone}
              onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Contoh: 081234567890"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Orang Tua / Wali</label>
            <input
              type="email"
              value={form.parentEmail}
              onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="orangtua@gmail.com"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
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
              Simpan Siswa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
