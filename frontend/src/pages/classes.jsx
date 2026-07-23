import React, { useState, useEffect } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClassFilter, setActiveClassFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    form: '',
    capacity: '',
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    filterClasses();
  }, [searchTerm, activeClassFilter, classes]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/api/classes');
      setClasses(response.data || []);
      setFilteredClasses(response.data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterClasses = () => {
    let filtered = classes;
    if (activeClassFilter !== 'all') {
      filtered = filtered.filter((c) => c.form === activeClassFilter || c.name === activeClassFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.form?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredClasses(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClass) {
        await axios.put(`/api/classes/${editingClass.id}`, formData);
      } else {
        await axios.post('/api/classes', formData);
      }
      setShowModal(false);
      setEditingClass(null);
      setFormData({ name: '', form: '', capacity: '' });
      fetchClasses();
    } catch (error) {
      console.error('Error saving class:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        await axios.delete(`/api/classes/${id}`);
        fetchClasses();
      } catch (error) {
        console.error('Error deleting class:', error);
      }
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name || '',
      form: classItem.form || '',
      capacity: classItem.capacity || '',
    });
    setShowModal(true);
  };

  const classFilters = ['all', ...Array.from(new Set(classes.flatMap((c) => [c.form, c.name]).filter(Boolean)))];

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading classes...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
            <p className="text-gray-600 mt-1">Create and manage school class groups here.</p>
          </div>
          <button
            onClick={() => {
              setEditingClass(null);
              setFormData({ name: '', form: '', capacity: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Class
          </button>
        </div>

        {/* Class Navigation */}
        <div className="flex flex-wrap gap-2">
          {classFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveClassFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeClassFilter === filter ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {filter === 'all' ? 'All Classes' : filter}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search classes by name or form..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-50"
          />
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((classItem) => (
            <div key={classItem.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
                  <p className="text-sm text-primary-600 font-medium mt-1">Form: {classItem.form || 'N/A'}</p>
                  <p className="text-xs text-gray-500 mt-2">Capacity: {classItem.capacity || 'N/A'} students</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(classItem)}
                    className="text-primary-600 hover:text-primary-700 p-1"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(classItem.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClasses.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No classes found. Click "Add Class" to get started.</p>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
                    required
                    placeholder="e.g., Form 1A"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form/Level
                  </label>
                  <input
                    type="text"
                    value={formData.form}
                    onChange={(e) => setFormData({...formData, form: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
                    placeholder="e.g., Form 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
                  >
                    {editingClass ? 'Update' : 'Add'} Class
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingClass(null);
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

export default Classes;
