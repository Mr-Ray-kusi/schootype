import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/layout';
import axios from 'axios';
import AttendanceQrCode from '../components/AttendanceQrCode';
import { buildStudentIdUrl } from '../utils/studentIdQr';
import { Edit2, Trash2, Search, Hash, User, Phone, MapPin } from 'lucide-react';

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
      await axios.put(`/api/students/${editingStudent.id}`, {
        name: editingStudent.name,
        class: editingStudent.class,
        parentEmail: editingStudent.parent_email,
        parentPhone: editingStudent.parent_phone,
        houseAddress: editingStudent.house_address,
        dateOfBirth: editingStudent.date_of_birth,
        rollNumber: editingStudent.roll_number,
      });
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
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
                  type="date"
                  value={editingStudent.date_of_birth ? String(editingStudent.date_of_birth).slice(0, 10) : ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, date_of_birth: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                />
                <input
                  type="tel"
                  value={editingStudent.parent_phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Parent phone"
                  required
                />
                <input
                  type="email"
                  value={editingStudent.parent_email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="Parent Email"
                />
                <textarea
                  value={editingStudent.house_address || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, house_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-500 rounded-lg"
                  placeholder="House address"
                  rows={2}
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

        <div
          id="list-section"
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 320px))' }}
        >
          {filteredStudents.map((student) => (
            <article
              key={student.id}
              className="bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary-500/40 transition-all w-full max-w-[320px]"
            >
              <div className="flex gap-0">
                <div className="w-28 shrink-0 bg-slate-700/50 flex items-center justify-center p-2 border-r border-slate-600">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-500"
                    />
                  ) : (
                    <div className="flex w-full aspect-[3/4] flex-col items-center justify-center rounded-lg bg-primary-500/20 border border-primary-500/30">
                      <span className="text-xl font-bold text-primary-300">
                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 p-2.5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white leading-snug break-words">
                        {student.name}
                      </h3>
                      {student.class && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
                          {student.class}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleEdit(student)}
                        className="p-1 rounded-md text-primary-400 hover:bg-primary-500/20 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="p-1 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1.5 space-y-1 flex-1 text-[10px] text-slate-300">
                    <div className="flex items-center gap-1 truncate">
                      <Hash className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      <span className="truncate">{student.roll_number || 'N/A'}</span>
                    </div>
                    {student.parent_phone && (
                      <div className="flex items-center gap-1 truncate">
                        <Phone className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        <span className="truncate">{student.parent_phone}</span>
                      </div>
                    )}
                    {student.house_address && (
                      <div className="flex items-start gap-1">
                        <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{student.house_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-600 bg-slate-900/50 px-2.5 py-2">
                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Student QR ID
                </p>
                <AttendanceQrCode
                  value={buildStudentIdUrl(student.barcode)}
                  name={student.name}
                  size={80}
                  containerClassName="bg-white rounded-md p-1.5"
                  buttonClassName="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md transition-colors text-[10px] font-medium"
                  downloadLabel="Download QR"
                />
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
