import React, { useState, useEffect } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import AttendanceQrCode from '../components/AttendanceQrCode';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import { Edit2, Trash2, Search, Plus, User, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

const NonStaff = () => {
  const [nonStaff, setNonStaff] = useState([]);
  const [filteredNonStaff, setFilteredNonStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNonStaff, setEditingNonStaff] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
  });

  useEffect(() => {
    fetchNonStaff();
  }, []);

  useEffect(() => {
    filterNonStaff();
  }, [searchTerm, nonStaff]);

  const fetchNonStaff = async () => {
    try {
      const response = await axios.get('/api/non-staff');
      setNonStaff(response.data);
      setFilteredNonStaff(response.data);
    } catch (error) {
      console.error('Error fetching non-staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNonStaff = () => {
    let filtered = nonStaff;
    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredNonStaff(filtered);
  };

  const resetForm = () => {
    setFormData({ name: '', role: '' });
    setPhoto(null);
    setPhotoPreview(null);
    setEditingNonStaff(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, photo };

      if (editingNonStaff) {
        await axios.put(`/api/non-staff/${editingNonStaff.id}`, payload);
        toast.success('Non-staff updated');
      } else {
        await axios.post('/api/non-staff', payload);
        toast.success('Non-staff added — attendance QR code generated');
      }
      setShowModal(false);
      resetForm();
      fetchNonStaff();
    } catch (error) {
      console.error('Error saving non-staff:', error);
      toast.error(error.response?.data?.error || 'Failed to save non-staff');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      try {
        await axios.delete(`/api/non-staff/${id}`);
        fetchNonStaff();
      } catch (error) {
        console.error('Error deleting non-staff:', error);
      }
    }
  };

  const handleEdit = (person) => {
    setEditingNonStaff(person);
    setFormData({
      name: person.name,
      role: person.role || '',
    });
    setPhoto(null);
    setPhotoPreview(person.photo_url || null);
    setShowModal(true);
  };

  const roles = ['Cleaner', 'Security Guard', 'Bus Driver', 'Cook', 'Maintenance', 'Gardener', 'Assistant'];

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-slate-300">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Non-Staff Management</h1>
            <p className="text-slate-300 mt-1">Support personnel with attendance QR codes</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Non-Staff
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-50"
          />
        </div>

        <div id="list-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredNonStaff.map((person) => (
            <article
              key={person.id}
              className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-purple-500/40 transition-all"
            >
              <div className="flex gap-0">
                <div className="w-36 sm:w-40 shrink-0 bg-slate-700/50 flex items-center justify-center p-4 border-r border-slate-600">
                  {person.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt={person.name}
                      className="w-full aspect-[3/4] max-h-44 object-cover rounded-xl border-2 border-slate-500 shadow-md"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] max-h-44 rounded-xl bg-purple-500/20 border-2 border-purple-500/30 flex flex-col items-center justify-center gap-2">
                      <User className="w-12 h-12 text-purple-400" />
                      <span className="text-2xl font-bold text-purple-300">
                        {person.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-white truncate">{person.name}</h3>
                      <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {person.role || 'Support Staff'}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(person)}
                        className="p-2 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(person.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                    <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Support staff attendance tracking</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-600 bg-slate-900/50 px-5 py-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  Attendance QR Code
                </p>
                <AttendanceQrCode value={person.barcode} name={person.name} size={148} />
              </div>
            </article>
          ))}
        </div>

        {filteredNonStaff.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-slate-600 bg-slate-800/50">
            <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300">No non-staff members found.</p>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingNonStaff ? 'Edit Non-Staff' : 'Add New Non-Staff'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <PhotoCaptureInput
                  preview={photoPreview}
                  onChange={(dataUrl) => {
                    setPhoto(dataUrl);
                    setPhotoPreview(dataUrl);
                  }}
                  onClear={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  label="Profile Photo"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-500 rounded-lg text-slate-50"
                    required
                    placeholder="e.g., Jane Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-500 rounded-lg text-slate-50"
                    required
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {!editingNonStaff && (
                  <p className="text-xs text-slate-400 bg-slate-900/50 border border-slate-600 rounded-lg p-3">
                    A unique attendance QR code is generated automatically when you save.
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
                  >
                    {editingNonStaff ? 'Update' : 'Add'} Person
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-slate-600 text-slate-100 py-2 rounded-lg hover:bg-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NonStaff;
