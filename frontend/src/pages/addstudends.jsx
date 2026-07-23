import React, { useState } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  GraduationCap,
  Mail,
  Hash,
  Phone,
  MapPin,
  Calendar,
  ArrowLeft,
  QrCode,
} from 'lucide-react';
import PhotoCaptureInput from '../components/PhotoCaptureInput';
import toast from 'react-hot-toast';

const CLASSES = [
  'CLASS 1', 'CLASS 2', 'CLASS 3', 'CLASS 4', 'CLASS 5', 'CLASS 6',
  'CLASS 7', 'CLASS 8', 'CLASS 9', 'CLASS 10', 'CLASS 11', 'CLASS 12',
];

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30';

const AddStudent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    parentEmail: '',
    parentPhone: '',
    houseAddress: '',
    dateOfBirth: '',
    rollNumber: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.parentPhone.trim()) {
      toast.error('Parent phone number is required for SMS');
      return;
    }
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
      <div className="relative mx-auto max-w-4xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-56"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(14, 165, 233, 0.14), transparent 55%)',
          }}
        />

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/students"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to students
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
              Enrollment
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Add new student
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Register a student with contact details for SMS, home address, and date of birth.
              A QR ID is generated automatically for attendance and phone-camera lookup.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Photo
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Shown on the student ID card and when a phone camera scans their QR.
            </p>
            <div className="mt-5">
              <PhotoCaptureInput
                theme="dark"
                label="Student photo"
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
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Student details
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  Full name <span className="text-sky-400">*</span>
                </label>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={`${fieldClass} pl-10`}
                    placeholder="Student's full name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  Class / grade <span className="text-sky-400">*</span>
                </label>
                <select
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  required
                  className={fieldClass}
                >
                  <option value="">Select a class</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  Date of birth <span className="text-sky-400">*</span>
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    required
                    className={`${fieldClass} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Roll number</label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="rollNumber"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    className={`${fieldClass} pl-10`}
                    placeholder="e.g. 2026-001"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Parent & home
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Parent phone is used for SMS alerts. Address appears on the public student ID card.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  Parent phone <span className="text-sky-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    name="parentPhone"
                    value={formData.parentPhone}
                    onChange={handleChange}
                    required
                    className={`${fieldClass} pl-10`}
                    placeholder="0551234567"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Parent email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    name="parentEmail"
                    value={formData.parentEmail}
                    onChange={handleChange}
                    className={`${fieldClass} pl-10`}
                    placeholder="parent@example.com"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  House location / address <span className="text-sky-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <textarea
                    name="houseAddress"
                    value={formData.houseAddress}
                    onChange={handleChange}
                    required
                    rows={3}
                    className={`${fieldClass} resize-y pl-10`}
                    placeholder="House number, street, area, city"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-5 py-4 text-sm text-sky-100">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
            <p>
              A unique QR code will be created for this student. School scanners mark attendance;
              a normal phone camera opens their public ID (photo, school, parent contact, address).
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/students')}
              className="rounded-full border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? 'Adding student…' : 'Add student'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default AddStudent;
