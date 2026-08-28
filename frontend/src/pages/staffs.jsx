import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import PaginationBar from '../components/PaginationBar';
import { buildPersonIdUrl } from '../utils/studentIdQr';
import {
  Plus,
  User,
  Link2,
  Copy,
  RefreshCw,
  Download,
  Edit2,
  Trash2,
  Settings,
} from 'lucide-react';
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
import toast from 'react-hot-toast';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import { parseListResponse, fetchAllPages } from '../utils/listApi.js';
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
  const [selectedId, setSelectedId] = useState(null);
  const [roleTab, setRoleTab] = useState('all');

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
    try {
      const data = await cachedGet(`staff:${page}:${debouncedSearch}`, async () => {
        const response = await axios.get('/api/staff', {
          params: { page, limit: 50, q: debouncedSearch || undefined },
        });
        return response.data;
      });
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
  const visibleStaff = roleTab === 'all' ? staff : staff.filter((member) => member.role === roleTab);

  if (loading) {
    return <div className="py-12 text-center text-[#6b7280]">Loading staff...</div>;
  }

  return (
    <div className="space-y-6">
      <ConsoleHeader title="Staff" subtitle={`${total} staff found`}>
        <ConsoleSearch
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search staff by name or role..."
        />
        <ConsoleButton
          variant="ghost"
          disabled={downloadingAll || total === 0}
          onClick={async () => {
            setDownloadingAll(true);
            try {
              const all = await fetchAllPages(axios, '/api/staff', { q: debouncedSearch || undefined });
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
        >
          <Download className="h-4 w-4" />
          {downloadingAll ? 'Preparing…' : 'Download all'}
        </ConsoleButton>
        <ConsoleButton
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Staff
        </ConsoleButton>
      </ConsoleHeader>

      <div className="rounded-2xl border border-[#e6ebf4] bg-[#f8fafc] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Link2 className="h-4 w-4 text-[#2f6eff]" />
            Staff portal link
          </p>
          <div className="flex gap-2">
            <ConsoleButton variant="ghost" className="py-1.5" onClick={copyPortalLink} disabled={!portalUrl}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </ConsoleButton>
            <ConsoleButton variant="ghost" className="py-1.5" onClick={regeneratePortalLink}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </ConsoleButton>
          </div>
        </div>
        <p className="mt-3 break-all rounded-xl border border-[#e6ebf4] bg-white px-3 py-2 text-xs text-[#2f6eff]">
          {portalLoading ? 'Loading link…' : portalUrl || 'Could not load portal link'}
        </p>
      </div>

      <ConsoleTabs
        tabs={[{ id: 'all', label: 'All staff' }, ...roles.map((role) => ({ id: role, label: role }))]}
        value={roleTab}
        onChange={setRoleTab}
      />

      <div id="list-section" className="overflow-x-auto">
        {visibleStaff.length === 0 ? (
          <ConsoleEmpty icon={User} title="No staff members found." />
        ) : (
          <table className="console-table min-w-[720px]">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Role</th>
                <th>Subjects</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((member, index) => {
                const active = selectedId === member.id;
                return (
                  <tr
                    key={member.id}
                    className={`console-row ${active ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(member.id)}
                  >
                    <td className="font-semibold">#{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ConsoleAvatar src={member.photo_url} name={member.name} />
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="console-muted">{member.role || 'Staff'}</td>
                    <td className="console-muted">{member.subjects || '—'}</td>
                    <td>
                      <ConsoleStatus tone={active ? 'orange' : 'blue'} label="Active" />
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(member); }} className="rounded-full p-1.5 hover:bg-black/10" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(member.id); }} className="rounded-full p-1.5 hover:bg-black/10" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPersonPack(staffPack(member, buildPersonIdUrl(member.barcode)));
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

      {showModal && (
        <ConsoleModal title={editingStaff ? 'Edit Staff' : 'Add New Staff'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PhotoCaptureInput
              theme="light"
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
              <label className="mb-2 block text-sm font-medium text-[#374151]">Full Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={consoleFieldClass} required placeholder="e.g., John Doe" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#374151]">Role *</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={consoleFieldClass} required>
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#374151]">Access Code</label>
              <div className="flex gap-2">
                <input type="text" value={formData.secretCode} readOnly className={`${consoleFieldClass} font-mono`} />
                <ConsoleButton variant="ghost" onClick={() => setFormData({ ...formData, secretCode: generateStrongPassword(16) })}>
                  New
                </ConsoleButton>
              </div>
              <p className="mt-2 text-xs text-[#6b7280]">Share this with the staff member for portal login.</p>
            </div>
            {formData.role === 'Teacher' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#374151]">Subjects taught</label>
                  <input type="text" value={formData.subjects} onChange={(e) => setFormData({ ...formData, subjects: e.target.value })} className={consoleFieldClass} placeholder="Mathematics, English" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#374151]">Classes assigned</label>
                  <input type="text" value={formData.classNames} onChange={(e) => setFormData({ ...formData, classNames: e.target.value })} className={consoleFieldClass} placeholder="Match class names from Setup" />
                </div>
              </>
            )}
            {!editingStaff && (
              <p className="rounded-xl border border-[#e6ebf4] bg-[#f8fafc] p-3 text-xs text-[#6b7280]">
                A unique attendance QR code is generated automatically when you save.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-xl bg-[#2f6eff] py-2.5 text-sm font-semibold text-white hover:bg-[#1f58e0]">
                {editingStaff ? 'Update' : 'Add'} Staff
              </button>
              <ConsoleButton
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </ConsoleButton>
            </div>
          </form>
        </ConsoleModal>
      )}
    </div>
  );
};

export default Staff;
