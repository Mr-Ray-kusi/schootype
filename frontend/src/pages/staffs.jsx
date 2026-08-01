import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AttendanceQrCode from '../components/AttendanceQrCode';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import { buildPersonIdUrl } from '../utils/studentIdQr';
import {
  Edit2,
  Trash2,
  Search,
  Plus,
  User,
  Briefcase,
  Link2,
  Copy,
  RefreshCw,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cachedGet, invalidateCache } from '../utils/requestCache';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [portalToken, setPortalToken] = useState(null);
  const [portalPath, setPortalPath] = useState('');
  const [portalLoading, setPortalLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    secretCode: '',
    subjects: '',
    classNames: '',
  });

  useEffect(() => {
    fetchStaff();
    fetchPortalLink();
  }, []);

  useEffect(() => {
    filterStaff();
  }, [searchTerm, staff]);

  const portalUrl = portalPath
    ? `${window.location.origin}${portalPath}`
    : portalToken
      ? `${window.location.origin}/staff-portal/${portalToken}`
      : '';

  const fetchPortalLink = async () => {
    try {
      const response = await axios.get('/api/staff-portal/link');
      setPortalToken(response.data.token);
      setPortalPath(response.data.portalPath || '');
    } catch (error) {
      console.error('Failed to load staff portal link:', error);
    } finally {
      setPortalLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const data = await cachedGet('staff', async () => {
        const response = await axios.get('/api/staff');
        return response.data.map((item) => ({
          ...item,
          secretCode: item.secretCode || item.secret_code || null,
          subjects: item.subjects || '',
          classNames: item.classNames || item.class_names || '',
        }));
      });
      setStaff(data);
      setFilteredStaff(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const filterStaff = () => {
    let filtered = staff;
    if (searchTerm) {
      filtered = staff.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredStaff(filtered);
  };

  const resetForm = () => {
    setFormData({ name: '', role: '', secretCode: '', subjects: '', classNames: '' });
    setPhoto(null);
    setPhotoPreview(null);
    setEditingStaff(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        secretCode: formData.secretCode || generateSecretCode(),
        photo,
      };

      if (editingStaff) {
        await axios.put(`/api/staff/${editingStaff.id}`, payload);
        toast.success('Staff updated');
      } else {
        await axios.post('/api/staff', payload);
        toast.success('Staff added — attendance QR code generated');
      }
      setShowModal(false);
      resetForm();
      invalidateCache('staff');
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error(error.response?.data?.error || 'Failed to save staff');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await axios.delete(`/api/staff/${id}`);
        invalidateCache('staff');
        fetchStaff();
      } catch (error) {
        console.error('Error deleting staff:', error);
      }
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      role: staffMember.role || '',
      secretCode: staffMember.secretCode || staffMember.secret_code || generateSecretCode(),
      subjects: staffMember.subjects || '',
      classNames: staffMember.classNames || staffMember.class_names || '',
    });
    setPhoto(null);
    setPhotoPreview(staffMember.photo_url || null);
    setShowModal(true);
  };

  const copyPortalLink = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Staff portal link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const regeneratePortalLink = async () => {
    const confirmed = window.confirm(
      'Create a new staff portal link? The current link will stop working until you share the new one.'
    );
    if (!confirmed) return;
    try {
      const response = await axios.post('/api/staff-portal/regenerate');
      setPortalToken(response.data.token);
      setPortalPath(response.data.portalPath || '');
      toast.success('New staff portal link generated');
    } catch {
      toast.error('Failed to regenerate link');
    }
  };

  const roles = ['Teacher', 'Accountant', 'Librarian', 'Administrator', 'Principal', 'Counselor', 'Coach'];

  if (loading) {
    return (
      <>
<div className="text-center py-12 text-slate-300">Loading staff...</div>
</>
    );
  }

  return (
    <>
<div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Staff Management</h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        </div>

        <div className="rounded-2xl border border-slate-600 bg-slate-800/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Link2 className="h-4 w-4 text-sky-400" />
                Staff portal link
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyPortalLink}
                disabled={!portalUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={regeneratePortalLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          </div>
          <p className="mt-3 break-all rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-2 text-xs text-sky-200">
            {portalLoading ? 'Loading link…' : portalUrl || 'Could not load portal link'}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
          />
        </div>

        <div id="list-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStaff.map((staffMember) => (
            <article
              key={staffMember.id}
              className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary-500/40 transition-all"
            >
              <div className="flex gap-0">
                <div className="w-36 sm:w-40 shrink-0 bg-slate-700/50 flex items-center justify-center p-4 border-r border-slate-600">
                  {staffMember.photo_url ? (
                    <img
                      src={staffMember.photo_url}
                      alt={staffMember.name}
                      className="w-full aspect-[3/4] max-h-44 object-cover rounded-xl border-2 border-slate-500 shadow-md"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] max-h-44 rounded-xl bg-primary-500/20 border-2 border-primary-500/30 flex flex-col items-center justify-center gap-2">
                      <User className="w-12 h-12 text-primary-400" />
                      <span className="text-2xl font-bold text-primary-300">
                        {staffMember.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-white truncate">{staffMember.name}</h3>
                      <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
                        {staffMember.role || 'Staff'}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(staffMember)}
                        className="p-2 rounded-lg text-primary-400 hover:bg-primary-500/20 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(staffMember.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Access code:{' '}
                        <span className="text-slate-100 font-medium">
                          {staffMember.secretCode || staffMember.secret_code || 'N/A'}
                        </span>
                      </span>
                    </div>
                    {(staffMember.subjects || staffMember.classNames) && (
                      <>
                        {staffMember.subjects ? (
                          <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{staffMember.subjects}</span>
                          </div>
                        ) : null}
                        {staffMember.classNames ? (
                          <div className="flex items-start gap-2">
                            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{staffMember.classNames}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                    {staffMember.role === 'Teacher' && (
                      <p className="text-xs text-green-400">
                        Teachers use the portal link + this code to enter subject scores.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-600 bg-slate-900/50 px-5 py-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  Attendance QR Code
                </p>
                <AttendanceQrCode
                  value={buildPersonIdUrl(staffMember.barcode)}
                  name={staffMember.name}
                  size={148}
                />
              </div>
            </article>
          ))}
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-slate-600 bg-slate-800/50">
            <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300">No staff members found.</p>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingStaff ? 'Edit Staff' : 'Add New Staff'}
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
                  label="Staff Photo"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-500 rounded-lg text-slate-50"
                    required
                    placeholder="e.g., John Doe"
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

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Access Code</label>
                  <input
                    type="text"
                    value={formData.secretCode}
                    onChange={(e) => setFormData({ ...formData, secretCode: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-500 rounded-lg bg-slate-700 text-slate-50"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Used with the staff portal link. Auto-generated if left blank.
                  </p>
                </div>

                {formData.role === 'Teacher' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Subjects taught
                      </label>
                      <input
                        type="text"
                        value={formData.subjects}
                        onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-500 rounded-lg text-slate-50"
                        placeholder="Mathematics, English"
                      />
                      <p className="text-xs text-slate-400 mt-1">Comma-separated list</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Classes assigned
                      </label>
                      <input
                        type="text"
                        value={formData.classNames}
                        onChange={(e) => setFormData({ ...formData, classNames: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-500 rounded-lg text-slate-50"
                        placeholder="CLASS 1, CLASS 2"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Must match student class names exactly (comma-separated)
                      </p>
                    </div>
                  </>
                )}

                {!editingStaff && (
                  <p className="text-xs text-slate-400 bg-slate-900/50 border border-slate-600 rounded-lg p-3">
                    A unique attendance QR code is generated automatically when you save.
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
                  >
                    {editingStaff ? 'Update' : 'Add'} Staff
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
</>
  );
};

export default Staff;
