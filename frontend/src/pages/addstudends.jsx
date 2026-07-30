import React, { useState } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserPlus, GraduationCap, Mail, Hash } from 'lucide-react';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import toast from 'react-hot-toast';

const AddStudent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    parentEmail: '',
    rollNumber: '',
  });

  const classes = ['CLASS 1', 'CLASS 2', 'CLASS 3', 'CLASS 4', 'CLASS 5', 'CLASS 6', 'CLASS 7', 'CLASS 8', 'CLASS 9', 'CLASS 10', 'CLASS 11', 'CLASS 12'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/students', { ...formData, photo });
      toast.success('Student added successfully!');
      navigate('/students');
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error.response?.data?.error || 'Failed to add student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8">
            <h1 className="text-2xl font-bold text-white">Add New Student</h1>
            <p className="text-primary-100 mt-1">Fill in the details below to register a new student</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <PhotoCaptureInput
              theme="light"
              label="Student Photo"
              preview={photoPreview}
              onChange={(dataUrl) => {
                setPhoto(dataUrl);
                setPhotoPreview(dataUrl);
              }}
              onClear={() => {
                setPhoto(null);
                setPhotoPreview(null);
              }}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter student's full name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class/Grade *
              </label>
              <select
                name="class"
                value={formData.class}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900"
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="parentEmail"
                  value={formData.parentEmail}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="parent@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Roll Number
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 2024-001"
                />
              </div>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="text-sm text-primary-800">
                <strong>Note:</strong> A unique QR code will be automatically generated for this student.
                The QR code can be used for attendance tracking and identification.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus className="w-5 h-5" />
                {loading ? 'Adding Student...' : 'Add Student'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/students')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Tips:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• All fields marked with * are required</li>
            <li>• Add a student photo for easier identification on ID cards</li>
            <li>• Tap &quot;Take Photo&quot; to use your webcam or phone camera</li>
            <li>• Use &quot;Upload Image&quot; to pick a file from your device</li>
            <li>• Parent email is optional but recommended for communication</li>
            <li>• After adding, download or print the QR code for ID cards</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default AddStudent;
