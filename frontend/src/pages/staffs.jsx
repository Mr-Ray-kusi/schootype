import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import Barcode from 'react-barcode';
import { Edit2, Trash2, Search, Download, Plus } from 'lucide-react';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    secretCode: '',
  });
  const barcodeRefs = useRef({});

  const downloadBarcode = (staffMember) => {
    const barcodeElement = barcodeRefs.current[staffMember.id];
    if (!barcodeElement) return;

    const svgElement = barcodeElement.querySelector('svg');
    if (!svgElement) return;

    // Create a canvas for the square barcode
    const canvas = document.createElement('canvas');
    const size = 300; // Square size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    img.onload = () => {
      // Calculate dimensions to fit square while maintaining aspect ratio
      const scale = Math.min(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      const link = document.createElement('a');
      link.download = `${staffMember.name}-barcode.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    filterStaff();
  }, [searchTerm, staff]);

  const fetchStaff = async () => {
    try {
      const response = await axios.get('/api/staff');
      const normalized = response.data.map((item) => ({
        ...item,
        secretCode: item.secretCode || item.secret_code || null,
      }));
      setStaff(normalized);
      setFilteredStaff(normalized);
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
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredStaff(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        secretCode: formData.secretCode || generateSecretCode(),
      };

      if (editingStaff) {
        await axios.put(`/api/staff/${editingStaff.id}`, payload);
      } else {
        await axios.post('/api/staff', payload);
      }
      setShowModal(false);
      setEditingStaff(null);
      setFormData({ name: '', role: '', secretCode: '' });
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await axios.delete(`/api/staff/${id}`);
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
      secretCode: staffMember.secretCode || staffMember.secret_code || (staffMember.role === 'Teacher' ? generateSecretCode() : ''),
    });
    setShowModal(true);
  };

  const handleDownloadBarcode = (staffMember) => {
    downloadBarcode(staffMember);
  };

  const roles = ['Teacher', 'Accountant', 'Librarian', 'Administrator', 'Principal', 'Counselor', 'Coach'];

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading staff...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600 mt-1">Manage teachers and administrative staff</p>
          </div>
          <button
            onClick={() => {
              setEditingStaff(null);
              setFormData({ name: '', role: '', secretCode: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
          />
        </div>

        {/* Staff Grid */}
        <div id="list-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((staffMember) => (
            <div key={staffMember.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{staffMember.name}</h3>
                  <p className="text-sm text-blue-600 font-medium mt-1">{staffMember.role || 'Staff'}</p>
                  <p className="text-xs text-gray-500 mt-2">ID: {staffMember.barcode?.slice(-8)}</p>
                  <p className="text-xs text-slate-600 mt-2">Access Code: <span className="font-semibold text-gray-700">{staffMember.secretCode || staffMember.secret_code || 'Not assigned'}</span></p>
                  {staffMember.role === 'Teacher' && (
                    <p className="text-xs text-green-600 mt-2">Teacher can upload class results with this code for the assigned subject.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(staffMember)}
                    className="text-blue-600 hover:text-blue-700 p-1"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(staffMember.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div ref={(el) => barcodeRefs.current[staffMember.id] = el} className="flex items-center justify-center w-56 h-56 mx-auto bg-gray-50 rounded-lg">
                <Barcode 
                  value={staffMember.barcode} 
                  width={1.2}
                  height={120}
                  margin={0}
                  format="CODE128"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
              
              <button
                onClick={() => handleDownloadBarcode(staffMember)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Barcode
              </button>
            </div>
          ))}
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No staff members found. Click "Add Staff" to get started.</p>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">
                {editingStaff ? 'Edit Staff' : 'Add New Staff'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                    required
                    placeholder="e.g., John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({...formData, role: newRole, secretCode: newRole === 'Teacher' ? formData.secretCode : ''});
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                    required
                  >
                    <option value="">Select a role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={formData.secretCode}
                    onChange={(e) => setFormData({ ...formData, secretCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-black"
                    disabled={formData.role !== 'Teacher'}
                  />
                  {formData.role === 'Teacher' ? (
                    <p className="text-xs text-gray-500 mt-2">This secret code grants the teacher access to report upload and result entry. You can edit it before saving, or one will be generated automatically.</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">Access code is only used for Teachers and will be ignored for other roles.</p>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    {editingStaff ? 'Update' : 'Add'} Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingStaff(null);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
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

export default Staff;