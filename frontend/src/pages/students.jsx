import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/layout';
import axios from 'axios';
import AttendanceQrCode from '../components/AttendanceQrCode';
import { Edit2, Trash2, Search, Mail, GraduationCap, Hash, User } from 'lucide-react';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, selectedClass, students]);

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
      setFilteredStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.roll_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedClass !== 'all') {
      filtered = filtered.filter((s) => s.class === selectedClass);
    }

    setFilteredStudents(filtered);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await axios.delete(`/api/students/${id}`);
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
      await axios.put(`/api/students/${editingStudent.id}`, editingStudent);
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error('Error updating student:', error);
    }
  };

  const classes = [...new Set(students.map((s) => s.class).filter(Boolean))];
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#list') {
      document.getElementById('list-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-slate-300">Loading students...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Students</h1>
            <p className="text-slate-300 mt-1">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} enrolled</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500 min-w-[200px]"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 border border-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Classes</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {editingStudent && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-white mb-4">Edit Student</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Name"
                  required
                />
                <input
                  type="text"
                  value={editingStudent.class || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Class"
                />
                <input
                  type="email"
                  value={editingStudent.parent_email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Parent Email"
                />
                <input
                  type="text"
                  value={editingStudent.roll_number || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, roll_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Roll Number"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700">
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="flex-1 bg-slate-600 text-slate-100 py-2 rounded-lg hover:bg-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div id="list-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStudents.map((student) => (
            <article
              key={student.id}
              className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary-500/40 transition-all"
            >
              {/* Profile header */}
              <div className="flex gap-0">
                <div className="w-36 sm:w-40 shrink-0 bg-slate-700/50 flex items-center justify-center p-4 border-r border-slate-600">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-full aspect-[3/4] max-h-44 object-cover rounded-xl border-2 border-slate-500 shadow-md"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] max-h-44 rounded-xl bg-primary-500/20 border-2 border-primary-500/30 flex flex-col items-center justify-center gap-2">
                      <User className="w-12 h-12 text-primary-400" />
                      <span className="text-2xl font-bold text-primary-300">
                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-white truncate">{student.name}</h3>
                      {student.class && (
                        <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
                          {student.class}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(student)}
                        className="p-2 rounded-lg text-primary-400 hover:bg-primary-500/20 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5 flex-1">
                    <div className="flex items-center gap-2.5 text-sm text-slate-300">
                      <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Roll No: <span className="text-slate-100 font-medium">{student.roll_number || 'N/A'}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-slate-300">
                      <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Class: <span className="text-slate-100 font-medium">{student.class || 'Not assigned'}</span>
                      </span>
                    </div>
                    {student.parent_email && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-300">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-100">{student.parent_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* QR code section */}
              <div className="border-t border-slate-600 bg-slate-900/50 px-5 py-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Attendance QR Code</p>
                <AttendanceQrCode value={student.barcode} name={student.name} size={148} />
              </div>
            </article>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-slate-600 bg-slate-800/50">
            <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300">No students found.</p>
            <p className="text-sm text-slate-400 mt-1">Add your first student from the Add Student page.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Students;
