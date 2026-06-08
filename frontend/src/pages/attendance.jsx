import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { Calendar as CalendarIcon, Filter, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

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

  useEffect(() => {
    fetchAttendance();
    fetchSummary();
  }, [selectedDate]);

  useEffect(() => {
    filterRecords();
  }, [selectedType, selectedClass, fromDate, toDate, attendanceRecords]);

  const fetchAttendance = async () => {
    try {
      const response = await axios.get(`/api/attendance?date=${selectedDate}`);
      setAttendanceRecords(response.data);
      setFilteredRecords(response.data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`/api/attendance/summary?date=${selectedDate}`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const getRecordDate = (record) => {
    return format(new Date(record.timestamp), 'yyyy-MM-dd');
  };

  const filterRecords = () => {
    let filtered = attendanceRecords;

    if (selectedType !== 'all') {
      filtered = filtered.filter((record) => record.user_type === selectedType);
    }

    if (selectedClass !== 'all') {
      filtered = filtered.filter((record) => record.user?.class === selectedClass || record.user?.role === selectedClass);
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

  const exportCsv = () => {
    const header = ['Name', 'Type', 'Role/Class', 'Date', 'Time', 'Status'];
    const rows = filteredRecords.map((record) => [
      record.user?.name || 'Unknown',
      record.user_type,
      record.user?.role || record.user?.class || 'N/A',
      getRecordDate(record),
      format(new Date(record.timestamp), 'hh:mm a'),
      'Present',
    ]);
    const csvContent = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance-${selectedDate || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'student': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      case 'non-staff': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading attendance records...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600 mt-1">View and manage daily attendance records</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500">Students Attendance</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{summary.students.present} / {summary.students.total}</p>
              <p className="text-sm text-green-600 mt-1">{summary.students.percentage}% Present</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500">Staff Attendance</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{summary.staff.present} / {summary.staff.total}</p>
              <p className="text-sm text-green-600 mt-1">{summary.staff.percentage}% Present</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500">Non-Staff Attendance</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{summary.nonStaff.present} / {summary.nonStaff.total}</p>
              <p className="text-sm text-green-600 mt-1">{summary.nonStaff.percentage}% Present</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Range From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Range To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="all">All Classes</option>
                {Array.from(new Set(attendanceRecords.map((record) => record.user?.class || record.user?.role).filter(Boolean))).map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={fetchAttendance}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={exportCsv}
                className="w-full px-6 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-100"
              >
                Export CSV
              </button>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={handlePrint}
                className="w-full px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
              >
                Print View
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role/Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {record.user?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(record.user_type)}`}>
                        {record.user_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.user?.role || record.user?.class || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(record.timestamp), 'hh:mm a')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Present
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No attendance records found for this date.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Attendance;