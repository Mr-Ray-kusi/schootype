import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { buildStudentIdUrl } from '../utils/studentIdQr';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import { parseListResponse, fetchAllPages } from '../utils/listApi.js';
import { downloadPersonPack, downloadPeoplePacks, studentPack } from '../utils/personPackExport';
import PaginationBar from '../components/PaginationBar';
import {
  ConsoleHeader,
  ConsoleSearch,
  ConsoleTabs,
  ConsoleStatus,
  ConsoleAvatar,
  ConsoleEmpty,
  ConsoleModal,
  ConsoleButton,
  consoleFieldClass,
} from '../components/consoleUi';
import { User, Phone, MapPin, Trophy, Mail, Download, Edit2, Trash2, Eye, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classOptions, setClassOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedClass]);

  useEffect(() => {
    fetchStudents();
  }, [page, debouncedSearch, selectedClass]);

  const fetchStudents = async () => {
    try {
      const data = await cachedGet(
        `students:${page}:${debouncedSearch}:${selectedClass}`,
        async () => {
          const response = await axios.get('/api/students', {
            params: {
              page,
              limit: 50,
              q: debouncedSearch || undefined,
              class: selectedClass !== 'all' ? selectedClass : undefined,
            },
          });
          return response.data;
        }
      );
      const parsed = parseListResponse(data);
      setStudents(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get('/api/classes')
      .then(({ data }) => setClassOptions(Array.isArray(data) ? data.map((c) => c.name).filter(Boolean) : []))
      .catch(() => setClassOptions([]));
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await axios.delete(`/api/students/${id}`);
        invalidateCache('students');
        fetchStudents();
      } catch (error) {
        console.error('Error deleting student:', error);
      }
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/students/${editingStudent.id}`, {
        name: editingStudent.name,
        class: editingStudent.class,
        parentName: editingStudent.parent_name,
        parentRelationship: editingStudent.parent_relationship,
        parentEmail: editingStudent.parent_email,
        parentPhone: editingStudent.parent_phone,
        houseAddress: editingStudent.house_address,
        dateOfBirth: editingStudent.date_of_birth,
        rollNumber: editingStudent.roll_number,
        skills: editingStudent.skills,
      });
      invalidateCache('students');
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error('Error updating student:', error);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const all = await fetchAllPages(axios, '/api/students', {
        q: debouncedSearch || undefined,
        class: selectedClass !== 'all' ? selectedClass : undefined,
      });
      if (!all.length) {
        toast.error('No students to download');
        return;
      }
      await downloadPeoplePacks(
        all.map((student) => studentPack(student, buildStudentIdUrl(student.barcode))),
        'all-students.zip'
      );
      toast.success(`Downloaded ${all.length} student folders`);
    } catch (error) {
      toast.error(error.message || 'Failed to download students');
    } finally {
      setDownloadingAll(false);
    }
  };

  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#list') {
      document.getElementById('list-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location]);

  if (loading) {
    return <div className="py-12 text-center text-[#6b7280]">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <ConsoleHeader
        title="Students"
        subtitle={`${total} student${total !== 1 ? 's' : ''} found`}
      >
        <ConsoleSearch
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search students..."
        />
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded-xl border border-[#d7deea] px-3 py-2.5 text-sm"
        >
          <option value="all">All classes</option>
          {classOptions.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        <ConsoleButton
          variant="ghost"
          onClick={handleDownloadAll}
          disabled={downloadingAll || total === 0}
        >
          <Download className="h-4 w-4" />
          {downloadingAll ? 'Preparing…' : 'Download all'}
        </ConsoleButton>
      </ConsoleHeader>

      <ConsoleTabs
        tabs={[
          { id: 'all', label: 'All students' },
          ...classOptions.slice(0, 6).map((cls) => ({ id: cls, label: cls })),
        ]}
        value={selectedClass === 'all' || classOptions.slice(0, 6).includes(selectedClass) ? selectedClass : 'all'}
        onChange={setSelectedClass}
      />

      {viewingStudent && (
        <ConsoleModal title={viewingStudent.name}>
          <div className="flex items-start gap-4">
            <ConsoleAvatar src={viewingStudent.photo_url} name={viewingStudent.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#6b7280]">{viewingStudent.class || 'No class'}</p>
              <p className="mt-1 text-xs text-[#9aa3b2]">Roll: {viewingStudent.roll_number || 'N/A'}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[#374151]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Parent / guardian</h3>
            <p>
              {viewingStudent.parent_name || '—'}
              {viewingStudent.parent_relationship ? ` (${viewingStudent.parent_relationship})` : ''}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-[#9aa3b2]" />
              {viewingStudent.parent_phone || '—'}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-[#9aa3b2]" />
              {viewingStudent.parent_email || '—'}
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9aa3b2]" />
              <span>{viewingStudent.house_address || '—'}</span>
            </p>
            {viewingStudent.skills ? (
              <p className="flex items-start gap-2">
                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9aa3b2]" />
                <span>{viewingStudent.skills}</span>
              </p>
            ) : null}
          </div>
          <ConsoleButton variant="ghost" className="mt-6 w-full" onClick={() => setViewingStudent(null)}>
            Close
          </ConsoleButton>
        </ConsoleModal>
      )}

      {editingStudent && (
        <ConsoleModal title="Edit Student">
          <form onSubmit={handleUpdate} className="space-y-3">
            <input type="text" value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} className={consoleFieldClass} placeholder="Name" required />
            <input type="text" value={editingStudent.class || ''} onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })} className={consoleFieldClass} placeholder="Class" list="setup-classes" />
            <datalist id="setup-classes">
              {classOptions.map((cls) => (
                <option key={cls} value={cls} />
              ))}
            </datalist>
            <input type="date" value={editingStudent.date_of_birth ? String(editingStudent.date_of_birth).slice(0, 10) : ''} onChange={(e) => setEditingStudent({ ...editingStudent, date_of_birth: e.target.value })} className={consoleFieldClass} />
            <input type="text" value={editingStudent.parent_name || ''} onChange={(e) => setEditingStudent({ ...editingStudent, parent_name: e.target.value })} className={consoleFieldClass} placeholder="Parent / guardian name" />
            <select value={editingStudent.parent_relationship || 'Parent'} onChange={(e) => setEditingStudent({ ...editingStudent, parent_relationship: e.target.value })} className={consoleFieldClass}>
              <option value="Parent">Parent</option>
              <option value="Mother">Mother</option>
              <option value="Father">Father</option>
              <option value="Guardian">Guardian</option>
              <option value="Other">Other</option>
            </select>
            <input type="tel" value={editingStudent.parent_phone || ''} onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })} className={consoleFieldClass} placeholder="Parent phone" required />
            <input type="email" value={editingStudent.parent_email || ''} onChange={(e) => setEditingStudent({ ...editingStudent, parent_email: e.target.value })} className={consoleFieldClass} placeholder="Parent Email" />
            <textarea value={editingStudent.house_address || ''} onChange={(e) => setEditingStudent({ ...editingStudent, house_address: e.target.value })} className={consoleFieldClass} placeholder="House address" rows={2} />
            <input type="text" value={editingStudent.roll_number || ''} onChange={(e) => setEditingStudent({ ...editingStudent, roll_number: e.target.value })} className={consoleFieldClass} placeholder="Roll Number" />
            <input type="text" value={editingStudent.skills || ''} onChange={(e) => setEditingStudent({ ...editingStudent, skills: e.target.value })} className={consoleFieldClass} placeholder="Skills (e.g. Football, Athletics)" />
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-xl bg-[#2f6eff] py-2.5 text-sm font-semibold text-white hover:bg-[#1f58e0]">
                Update
              </button>
              <ConsoleButton variant="ghost" className="flex-1" onClick={() => setEditingStudent(null)}>
                Cancel
              </ConsoleButton>
            </div>
          </form>
        </ConsoleModal>
      )}

      <div id="list-section" className="overflow-x-auto">
        {students.length === 0 ? (
          <ConsoleEmpty icon={User} title="No students found." text="Add your first student from the Add Student page." />
        ) : (
          <table className="console-table min-w-[720px]">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Class</th>
                <th>Parent</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const active = selectedId === student.id;
                return (
                  <tr
                    key={student.id}
                    className={`console-row ${active ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(student.id)}
                  >
                    <td className="font-semibold">#{String(student.roll_number || index + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ConsoleAvatar src={student.photo_url} name={student.name} />
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </td>
                    <td className="console-muted">{student.class || '—'}</td>
                    <td className="console-muted">{student.parent_name || '—'}</td>
                    <td className="console-muted">{student.parent_phone || '—'}</td>
                    <td>
                      <ConsoleStatus tone={active ? 'orange' : 'blue'} label="Enrolled" />
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setViewingStudent(student); }} className="rounded-full p-1.5 hover:bg-black/10" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(student); }} className="rounded-full p-1.5 hover:bg-black/10" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }} className="rounded-full p-1.5 hover:bg-black/10" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPersonPack(studentPack(student, buildStudentIdUrl(student.barcode)));
                          }}
                          className="rounded-full p-1.5 hover:bg-black/10"
                          title="Download pack"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PaginationBar page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
};

export default Students;
