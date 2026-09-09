import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Check,
  X,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import { Student } from '../types';

interface StudentSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  selectedStudentId?: string;
  onSelectStudent: (student: Student) => void;
}

export const StudentSelectModal: React.FC<StudentSelectModalProps> = ({
  isOpen,
  onClose,
  students,
  selectedStudentId,
  onSelectStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Extract unique sorted classes
  const classes = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.classRoom).filter(Boolean))).sort();
  }, [students]);

  // Filter students based on search and class filter
  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.nisn.includes(q) ||
        s.classRoom.toLowerCase().includes(q);
      const matchClass = selectedClass === 'all' || s.classRoom === selectedClass;
      return matchSearch && matchClass;
    });
  }, [students, searchTerm, selectedClass]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pilih Identitas Siswa Peserta</h3>
              <p className="text-xs text-slate-400">
                Temukan nama atau NISN Anda untuk memulai asesmen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Class Filter */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama lengkap atau NISN Anda..."
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Class Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedClass('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedClass === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
              }`}
            >
              Semua Kelas ({students.length})
            </button>
            {classes.map((cls) => {
              const count = students.filter((s) => s.classRoom === cls).length;
              const isSelected = selectedClass === cls;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
                  }`}
                >
                  Kelas {cls} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <GraduationCap className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Nama siswa tidak ditemukan
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Periksa kembali ejaan nama atau NISN Anda, atau pilih tab "Semua Kelas".
              </p>
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedClass('all');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-indigo-400 hover:bg-slate-750"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredStudents.map((student) => {
                const isSelected = student.id === selectedStudentId;
                return (
                  <div
                    key={student.id}
                    onClick={() => {
                      onSelectStudent(student);
                      onClose();
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 text-left ${
                      isSelected
                        ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                        : 'bg-slate-850/80 border-slate-750 hover:bg-slate-800 hover:border-slate-600 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-750 text-slate-300'
                        }`}
                      >
                        {student.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {student.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">NISN: {student.nisn}</span>
                          <span>•</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-750 text-indigo-300 font-semibold">
                            {student.classRoom}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">
                            ({student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-500 group-hover:border-indigo-400">
                          <UserCheck className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Menampilkan {filteredStudents.length} dari {students.length} siswa</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-750 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
