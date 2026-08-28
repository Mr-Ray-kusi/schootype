import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import PaginationBar from '../components/PaginationBar';
import { buildPersonIdUrl } from '../utils/studentIdQr';
import { Plus, User, Download, Edit2, Trash2, Settings } from 'lucide-react';
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
import { downloadPersonPack, downloadPeoplePacks, nonStaffPack } from '../utils/personPackExport';

const NonStaff = () => {
  const [nonStaff, setNonStaff] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingNonStaff, setEditingNonStaff] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
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
    fetchNonStaff();
  }, [page, debouncedSearch]);

  const fetchNonStaff = async () => {
    try {
      const data = await cachedGet(`non-staff:${page}:${debouncedSearch}`, async () => {
        const response = await axios.get('/api/non-staff', {
          params: { page, limit: 50, q: debouncedSearch || undefined },
        });
        return response.data;
      });
      const parsed = parseListResponse(data);
      setNonStaff(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      console.error('Error fetching non-staff:', error);
    } finally {
      setLoading(false);
    }
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
      invalidateCache('non-staff');
      fetchNonStaff();
    } catch (error) {
      if (error.offlineQueued) {
        setShowModal(false);
        resetForm();
        return;
      }
      console.error('Error saving non-staff:', error);
      toast.error(error.response?.data?.error || 'Failed to save non-staff');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      try {
        await axios.delete(`/api/non-staff/${id}`);
        invalidateCache('non-staff');
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
  const visiblePeople = roleTab === 'all' ? nonStaff : nonStaff.filter((person) => person.role === roleTab);

  if (loading) {
    return <div className="py-12 text-center text-[#6b7280]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <ConsoleHeader title="Non-Staff" subtitle={`${total} ${total === 1 ? 'person' : 'people'} found`}>
        <ConsoleSearch
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or role..."
        />
        <ConsoleButton
          variant="ghost"
          disabled={downloadingAll || total === 0}
          onClick={async () => {
            setDownloadingAll(true);
            try {
              const all = await fetchAllPages(axios, '/api/non-staff', { q: debouncedSearch || undefined });
              await downloadPeoplePacks(
                all.map((person) => nonStaffPack(person, buildPersonIdUrl(person.barcode))),
                'all-non-staff.zip'
              );
            } catch {
              toast.error('Failed to download packs');
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
          Add Non-Staff
        </ConsoleButton>
      </ConsoleHeader>

      <ConsoleTabs
        tabs={[{ id: 'all', label: 'All' }, ...roles.map((role) => ({ id: role, label: role }))]}
        value={roleTab}
        onChange={setRoleTab}
      />

      <div id="list-section" className="overflow-x-auto">
        {visiblePeople.length === 0 ? (
          <ConsoleEmpty icon={User} title="No non-staff members found." />
        ) : (
          <table className="console-table min-w-[720px]">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((person, index) => {
                const active = selectedId === person.id;
                return (
                  <tr
                    key={person.id}
                    className={`console-row ${active ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(person.id)}
                  >
                    <td className="font-semibold">#{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ConsoleAvatar src={person.photo_url} name={person.name} />
                        <span className="font-medium">{person.name}</span>
                      </div>
                    </td>
                    <td className="console-muted">{person.role || 'Support Staff'}</td>
                    <td>
                      <ConsoleStatus tone={active ? 'orange' : 'blue'} label="Active" />
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(person); }} className="rounded-full p-1.5 hover:bg-black/10" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }} className="rounded-full p-1.5 hover:bg-black/10" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPersonPack(nonStaffPack(person, buildPersonIdUrl(person.barcode)));
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
        <ConsoleModal title={editingNonStaff ? 'Edit Non-Staff' : 'Add New Non-Staff'}>
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
              label="Profile Photo"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-[#374151]">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={consoleFieldClass}
                required
                placeholder="e.g., Jane Smith"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#374151]">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={consoleFieldClass}
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
              <p className="rounded-xl border border-[#e6ebf4] bg-[#f8fafc] p-3 text-xs text-[#6b7280]">
                A unique attendance QR code is generated automatically when you save.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-xl bg-[#2f6eff] py-2.5 text-sm font-semibold text-white hover:bg-[#1f58e0]">
                {editingNonStaff ? 'Update' : 'Add'} Person
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

export default NonStaff;
