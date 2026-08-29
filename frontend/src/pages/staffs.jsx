import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import PersonCard, { PersonGrid } from '../components/PersonCard';
import PaginationBar from '../components/PaginationBar';
import { buildPersonIdUrl } from '../utils/studentIdQr';
import {
  Search,
  Plus,
  User,
  Briefcase,
  Link2,
  Copy,
  RefreshCw,
  BookOpen,
  GraduationCap,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invalidateCache, peekCache, staleGet } from '../utils/requestCache';
import { parseListResponse, fetchAllPages, fetchRecord } from '../utils/listApi.js';
import { downloadPersonPack, downloadPeoplePacks, staffPack } from '../utils/personPackExport';
import { generateStrongPassword } from '../utils/strongPassword';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingAll, setDownloadingAll] = useState(false);
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
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchPortalLink();
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [page, debouncedSearch]);

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
    const cacheKey = `staff:${page}:${debouncedSearch}`;
    const apply = (data) => {
      const parsed = parseListResponse(data);
      setStaff(
        parsed.items.map((item) => ({
          ...item,
          secretCode: item.secretCode || item.secret_code || null,
          subjects: item.subjects || '',
          classNames: item.classNames || item.class_names || '',
        }))
      );
      setTotal(parsed.total);
    };
    const cached = peekCache(cacheKey);
    if (cached) {
      apply(cached);
      setLoading(false);
    }
    try {
      const data = await staleGet(
        cacheKey,
        async () => {
          const response = await axios.get('/api/staff', {
            params: { page, limit: 50, q: debouncedSearch || undefined },
          });
          return response.data;
        },
        45000,
        apply
      );
      apply(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSecretCode = () => generateStrongPassword(16);

  const resetForm = () => {
    setFormData({ name: '', role: '', secretCode: generateStrongPassword(16), subjects: '', classNames: '' });
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
      invalidateCache('dashboard');
      fetchStaff();
      } catch (error) {
      if (error.offlineQueued) {
        setShowModal(false);
        resetForm();
        return;
      }
      console.error('Error saving staff:', error);
      toast.error(error.response?.data?.error || 'Failed to save staff');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await axios.delete(`/api/staff/${id}`);
        invalidateCache('staff');
        invalidateCache('dashboard');
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

  if (loading && staff.length === 0) {
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
            <p className="mt-1 text-sm text-slate-400">{total} staff</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                setDownloadingAll(true);
                try {
                  const all = await fetchAllPages(axios, '/api/staff', {
                    q: debouncedSearch || undefined,
                    includePhotos: 1,
                  });
                  await downloadPeoplePacks(
                    all.map((member) => staffPack(member, buildPersonIdUrl(member.barcode))),
                    'all-staff.zip'
                  );
                } catch {
                  toast.error('Failed to download staff packs');
                } finally {
                  setDownloadingAll(false);
                }
              }}
              disabled={downloadingAll || total === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloadingAll ? 'Preparing…' : 'Download all'}
            </button>
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

        <div id="list-section">
          <PersonGrid>
            {staff.map((staffMember) => (
              <PersonCard
                key={staffMember.id}
                name={staffMember.name}
                badge={staffMember.role || 'Staff'}
                photoUrl={staffMember.photo_url}
                qrValue={buildPersonIdUrl(staffMember.barcode)}
                downloadLabel="Download pack"
                onEdit={() => handleEdit(staffMember)}
                onDelete={() => handleDelete(staffMember.id)}
                onDownloadPack={async () => {
                  const full = await fetchRecord(axios, `/api/staff/${staffMember.id}`, staffMember);
                  downloadPersonPack(staffPack(full, buildPersonIdUrl(full.barcode)));
                }}
                details={[
                  {
                    key: 'code',
                    icon: <Briefcase className="mt-0.5 h-2.5 w-2.5 shrink-0 text-slate-500" />,
                    text: `Access: ${staffMember.secretCode || staffMember.secret_code || 'N/A'}`,
                  },
                  staffMember.subjects
                    ? {
                        key: 'subjects',
                        icon: <BookOpen className="mt-0.5 h-2.5 w-2.5 shrink-0 text-slate-500" />,
                        text: staffMember.subjects,
                      }
                    : null,
                  staffMember.classNames
                    ? {
                        key: 'classes',
                        icon: <GraduationCap className="mt-0.5 h-2.5 w-2.5 shrink-0 text-slate-500" />,
                        text: staffMember.classNames,
                      }
                    : null,
                ].filter(Boolean)}
              />
            ))}
          </PersonGrid>
        </div>

        <PaginationBar page={page} total={total} limit={50} onPageChange={setPage} />

        {staff.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/50 py-16 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-slate-500" />
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
                  <label className="mb-2 block text-sm font-medium text-slate-200">Access Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.secretCode}
                      readOnly
                      className="w-full rounded-lg border border-slate-500 bg-slate-700 px-4 py-2 font-mono text-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, secretCode: generateStrongPassword(16) })}
                      className="shrink-0 rounded-lg border border-slate-500 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      New
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Automatically generated strong password. Share this with the staff member for portal login.
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
                        placeholder="Match class names from Setup"
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
