import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import Barcode from 'react-barcode';
import { Edit2, Trash2, Search, Download, Plus } from 'lucide-react';

const NonStaff = () => {
  const [nonStaff, setNonStaff] = useState([]);
  const [filteredNonStaff, setFilteredNonStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNonStaff, setEditingNonStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
  });
  const barcodeRefs = useRef({});

  const downloadBarcode = (person) => {
    const barcodeElement = barcodeRefs.current[person.id];
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
      link.download = `${person.name}-barcode.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

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
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredNonStaff(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNonStaff) {
        await axios.put(`/api/non-staff/${editingNonStaff.id}`, formData);
      } else {
        await axios.post('/api/non-staff', formData);
      }
      setShowModal(false);
      setEditingNonStaff(null);
      setFormData({ name: '', role: '' });
      fetchNonStaff();
    } catch (error) {
      console.error('Error saving non-staff:', error);
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
    setShowModal(true);
  };

  const roles = ['Cleaner', 'Security Guard', 'Bus Driver', 'Cook', 'Maintenance', 'Gardener', 'Assistant'];

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Non-Staff Management</h1>
            <p className="text-gray-600 mt-1">Manage support staff and other personnel</p>
          </div>
          <button
            onClick={() => {
              setEditingNonStaff(null);
              setFormData({ name: '', role: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Non-Staff
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-black"
          />
        </div>

        <div id="list-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNonStaff.map((person) => (
            <div key={person.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{person.name}</h3>
                  <p className="text-sm text-purple-600 font-medium mt-1">{person.role || 'Support Staff'}</p>
                  <p className="text-xs text-gray-500 mt-2">ID: {person.barcode?.slice(-8)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(person)} className="text-purple-600 hover:text-purple-700 p-1">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(person.id)} className="text-red-600 hover:text-red-700 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div ref={(el) => barcodeRefs.current[person.id] = el} className="flex items-center justify-center w-56 h-56 mx-auto bg-gray-50 rounded-lg">
                <Barcode value={person.barcode} width={1.2} height={120} margin={0} format="CODE128" style={{ maxWidth: '100%', maxHeight: '100%' }} />
              </div>
              
              <button
                onClick={() => downloadBarcode(person)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Barcode
              </button>
            </div>
          ))}
        </div>

        {filteredNonStaff.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No non-staff members found. Click "Add Non-Staff" to get started.</p>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">
                {editingNonStaff ? 'Edit Non-Staff' : 'Add New Non-Staff'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                    placeholder="e.g., Jane Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select a role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="submit" className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                    {editingNonStaff ? 'Update' : 'Add'} Person
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingNonStaff(null);
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

export default NonStaff;