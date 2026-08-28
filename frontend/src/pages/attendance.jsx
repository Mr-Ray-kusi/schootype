import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import useLiteMode from '../hooks/useLiteMode';

const Attendance = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedType, setSelectedType] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [lateAfterTime, setLateAfterTime] = useState('08:00');
  const [savingLateTime, setSavingLateTime] = useState(false);
  const { liteMode } = useLiteMode();

  useEffect(() => {
    fetchAttendance();
    fetchSummary();
    fetchLateSettings();
  }, [selectedDate]);

  useEffect(() => {
    filterRecords();
  }, [selectedType, selectedClass, fromDate, toDate, attendanceRecords]);

  const fetchLateSettings = async () => {
    try {
      const response = await axios.get('/api/attendance/settings');
      setLateAfterTime(response.data.lateAfterTime || '08:00');
    } catch (error) {
      console.error('Error fetching attendance settings:', error);
    }
  };

  const saveLateSettings = async () => {
    setSavingLateTime(true);
    try {
      const response = await axios.put('/api/attendance/settings', { lateAfterTime });
      setLateAfterTime(response.data.lateAfterTime || lateAfterTime);
      toast.success('Late cutoff time saved');
      invalidateCache('attendance');
      fetchAttendance();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save late time');
    } finally {
      setSavingLateTime(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const data = await cachedGet(`attendance:${selectedDate}`, async () => {
        const response = await axios.get(`/api/attendance?date=${selectedDate}`);
        return response.data;
      });
      setAttendanceRecords(data);
      setFilteredRecords(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await cachedGet(`attendance-summary:${selectedDate}`, async () => {
        const response = await axios.get(`/api/attendance/summary?date=${selectedDate}`);
        return response.data;
      });
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const getRecordDate = (record) => {
    return format(new Date(record.timestamp), 'yyyy-MM-dd');
  };

  const getPersonLabel = (record) => {
    if (record.user_type === 'student') {
      return record.user?.class || record.user_label || 'N/A';
    }
    return record.user?.role || record.user_label || 'N/A';
  };

  const getPersonName = (record) =>
    record.user?.name || record.user_name || 'Unknown';

  const getPunctuality = (record) =>
    record.punctuality ||
    (record.status === 'early' || record.status === 'late' ? record.status : null) ||
    'early';

  const filterRecords = () => {
    let filtered = attendanceRecords;

    if (selectedType !== 'all') {
      filtered = filtered.filter((record) => record.user_type === selectedType);
    }

    if (selectedClass !== 'all') {
      filtered = filtered.filter((record) => getPersonLabel(record) === selectedClass);
    }

    if (fromDate) {
      filtered = filtered.filter((record) => getRecordDate(record) >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter((record) => getRecordDate(record) <= toDate);
    }

    setFilteredRecords(filtered);
  };

  const handlePrint = () => {
    window.print();
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'student':
        return 'bg-primary-100 text-primary-800';
      case 'staff':
        return 'bg-green-100 text-green-800';
      case 'non-staff':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <>
<div className="text-center py-12">Loading attendance records...</div>
</>
    );
  }

  return (
    <>
<div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500">Students Attendance</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {summary.students.present} / {summary.students.total}
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Staff Attendance</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {summary.staff.present} / {summary.staff.total}
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Non-Staff Attendance</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {summary.nonStaff.present} / {summary.nonStaff.total}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Late after</h2>
              <p className="mt-1 text-sm text-gray-500">
                Scans at or before this time count as Early; after this time count as Late.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">Cutoff time</label>
                <input
                  type="time"
                  value={lateAfterTime}
                  onChange={(e) => setLateAfterTime(e.target.value)}
                  className="min-h-[48px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={saveLateSettings}
                disabled={savingLateTime}
                className="min-h-[48px] w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
              >
                {savingLateTime ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Range From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Range To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
              >
                <option value="all">All Types</option>
                <option value="student">Students</option>
                <option value="staff">Staff</option>
                <option value="non-staff">Non-Staff</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Class / Role</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-slate-50"
              >
                <option value="all">All Classes / Roles</option>
                {Array.from(
                  new Set(attendanceRecords.map((record) => getPersonLabel(record)).filter((v) => v && v !== 'N/A'))
                ).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={() => {
                  invalidateCache('attendance');
                  setLoading(true);
                  fetchAttendance();
                  fetchSummary();
                }}
                className="w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={handlePrint}
                className="w-full px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
              >
                Print View
              </button>
            </div>
          </div>
        </div>

        {!liteMode && (
        <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role/Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => {
                  const punctuality = getPunctuality(record);
                  const isLate = punctuality === 'late';
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{getPersonName(record)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(record.user_type)}`}>
                          {record.user_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getPersonLabel(record)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(record.timestamp), 'hh:mm a')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1 ${
                            isLate ? 'text-amber-600' : 'text-green-600'
                          }`}
                        >
                          {isLate ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                          {isLate ? 'Late' : 'Early'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredRecords.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-500">No attendance records found for this date.</p>
            </div>
          )}
        </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm md:hidden">
          <p className="text-sm font-medium text-slate-300">Records today</p>
          <p className="mt-2 text-3xl font-bold text-white">{filteredRecords.length}</p>
          <p className="mt-1 text-xs text-slate-400">
            Open this page on a larger screen to view the full attendance table.
          </p>
        </div>
      </div>
</>
  );
};

export default Attendance;
