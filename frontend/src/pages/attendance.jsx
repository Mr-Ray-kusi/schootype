import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, Printer } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import {
  ConsoleHeader,
  ConsoleTabs,
  ConsoleStatus,
  ConsoleEmpty,
  ConsoleButton,
  ConsoleAvatar,
  consoleFieldClass,
} from '../components/consoleUi';

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
  const [selectedId, setSelectedId] = useState(null);

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

  const typeLabel = (type) => {
    if (type === 'non-staff') return 'Non-staff';
    if (type === 'staff') return 'Staff';
    if (type === 'student') return 'Student';
    return type || '—';
  };

  if (loading) {
    return <div className="py-12 text-center text-[#6b7280]">Loading attendance records...</div>;
  }

  return (
    <div className="space-y-6">
      <ConsoleHeader
        title="Attendance"
        subtitle={`${filteredRecords.length} record${filteredRecords.length !== 1 ? 's' : ''} found`}
      >
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`${consoleFieldClass} w-auto min-w-[10.5rem]`}
          title="Select date"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={`${consoleFieldClass} w-auto min-w-[10.5rem]`}
          title="Range from"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={`${consoleFieldClass} w-auto min-w-[10.5rem]`}
          title="Range to"
        />
        <ConsoleButton
          variant="ghost"
          onClick={() => {
            invalidateCache('attendance');
            setLoading(true);
            fetchAttendance();
            fetchSummary();
          }}
        >
          <Filter className="h-4 w-4" />
          Refresh
        </ConsoleButton>
        <ConsoleButton variant="ghost" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print
        </ConsoleButton>
      </ConsoleHeader>

      <ConsoleTabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'student', label: 'Students' },
          { id: 'staff', label: 'Staff' },
          { id: 'non-staff', label: 'Non-staff' },
        ]}
        value={selectedType}
        onChange={setSelectedType}
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e6ebf4] bg-white p-5">
            <h3 className="text-sm font-medium text-[#6b7280]">Students</h3>
            <p className="mt-2 text-2xl font-bold text-[#111827]">
              {summary.students.present} / {summary.students.total}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6ebf4] bg-white p-5">
            <h3 className="text-sm font-medium text-[#6b7280]">Staff</h3>
            <p className="mt-2 text-2xl font-bold text-[#111827]">
              {summary.staff.present} / {summary.staff.total}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6ebf4] bg-white p-5">
            <h3 className="text-sm font-medium text-[#6b7280]">Non-staff</h3>
            <p className="mt-2 text-2xl font-bold text-[#111827]">
              {summary.nonStaff.present} / {summary.nonStaff.total}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#e6ebf4] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Late after</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Scans at or before this time count as Early; after this time count as Late.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
            <div className="min-w-0 flex-1 lg:w-44">
              <label className="mb-1 block text-xs font-medium text-[#6b7280]">Cutoff time</label>
              <input
                type="time"
                value={lateAfterTime}
                onChange={(e) => setLateAfterTime(e.target.value)}
                className={consoleFieldClass}
              />
            </div>
            <ConsoleButton onClick={saveLateSettings} disabled={savingLateTime}>
              {savingLateTime ? 'Saving…' : 'Save'}
            </ConsoleButton>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className={`${consoleFieldClass} w-auto min-w-[12rem]`}
        >
          <option value="all">All classes / roles</option>
          {Array.from(
            new Set(attendanceRecords.map((record) => getPersonLabel(record)).filter((v) => v && v !== 'N/A'))
          ).map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        {filteredRecords.length === 0 ? (
          <ConsoleEmpty title="No attendance records found for this date." />
        ) : (
          <table className="console-table min-w-[640px]">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Type</th>
                <th>Role / Class</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => {
                const punctuality = getPunctuality(record);
                const isLate = punctuality === 'late';
                const active = selectedId === record.id;
                return (
                  <tr
                    key={record.id}
                    className={`console-row ${active ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td className="font-semibold">#{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ConsoleAvatar src={record.user?.photo_url} name={getPersonName(record)} />
                        <span className="font-medium">{getPersonName(record)}</span>
                      </div>
                    </td>
                    <td className="console-muted">{typeLabel(record.user_type)}</td>
                    <td className="console-muted">{getPersonLabel(record)}</td>
                    <td className="console-muted">{format(new Date(record.timestamp), 'hh:mm a')}</td>
                    <td>
                      <ConsoleStatus tone={isLate ? 'orange' : 'blue'} label={isLate ? 'Late' : 'Early'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Attendance;
