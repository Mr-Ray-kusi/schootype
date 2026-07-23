import React, { useState } from 'react';
import Layout from '../components/layout';

const initialTeacherSalary = [
  { id: 1, name: 'Mrs. Funke', role: 'Math Teacher', monthlySalary: 150000, status: 'Due', dueDate: '2026-06-10' },
  { id: 2, name: 'Mr. Emeka', role: 'Science Teacher', monthlySalary: 145000, status: 'Paid', dueDate: '2026-05-28', paidAt: '2026-05-29' },
  { id: 3, name: 'Ms. Grace', role: 'English Teacher', monthlySalary: 138000, status: 'Due', dueDate: '2026-06-12' },
  { id: 4, name: 'Mr. Ayo', role: 'ICT Teacher', monthlySalary: 152000, status: 'Paid', dueDate: '2026-05-27', paidAt: '2026-05-28' },
];

const FeesPaid = () => {
  const [teachers, setTeachers] = useState(initialTeacherSalary);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentNote, setPaymentNote] = useState('Salary payment for the current month');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const pendingCount = teachers.filter((t) => t.status === 'Due').length;
  const paidCount = teachers.filter((t) => t.status === 'Paid').length;
  const totalPaid = teachers.filter((t) => t.status === 'Paid').reduce((sum, t) => sum + t.monthlySalary, 0);

  const handleOpenPayment = (teacher) => {
    setSelectedTeacher(teacher);
    setPaymentMethod('Bank Transfer');
    setPaymentNote(`Salary payment for ${teacher.name}`);
    setShowPaymentModal(true);
    setConfirmationMessage('');
  };

  const handleConfirmPayment = () => {
    if (!selectedTeacher) return;
    setTeachers((prev) => prev.map((teacher) => (
      teacher.id === selectedTeacher.id
        ? { ...teacher, status: 'Paid', paidAt: new Date().toLocaleDateString() }
        : teacher
    )));
    setConfirmationMessage(`Successfully paid ${selectedTeacher.name} via ${paymentMethod}.`);
    setShowPaymentModal(false);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees Paid</h1>
          <p className="mt-3 text-slate-300">Track confirmed fee collections and handle teacher salary payments directly from the dashboard.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Total Teachers Paid</p>
            <p className="mt-4 text-4xl font-semibold text-white">{paidCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Pending Salary Payments</p>
            <p className="mt-4 text-4xl font-semibold text-white">{pendingCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Total Paid</p>
            <p className="mt-4 text-4xl font-semibold text-white">₦{totalPaid.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Teacher Salary Payments</h2>
              <p className="text-sm text-slate-300">Review due salaries and complete payments with confirmation notes.</p>
            </div>
            <span className="inline-flex rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Payroll Workflow</span>
          </div>

          <div className="mt-8 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Salary</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, index) => (
                  <tr key={teacher.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                    <td className="px-6 py-4 text-white">{teacher.name}</td>
                    <td className="px-6 py-4">{teacher.role}</td>
                    <td className="px-6 py-4">₦{teacher.monthlySalary.toLocaleString()}</td>
                    <td className="px-6 py-4">{teacher.dueDate}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs ${teacher.status === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-yellow-600 text-white'}`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {teacher.status === 'Due' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(teacher)}
                          className="rounded-full bg-primary-600 px-4 py-2 text-xs text-white hover:bg-primary-700"
                        >
                          Pay Salary
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">Paid on {teacher.paidAt}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {confirmationMessage && (
          <div className="rounded-3xl border border-emerald-500 bg-emerald-950 p-6 text-emerald-100">
            {confirmationMessage}
          </div>
        )}

        {showPaymentModal && selectedTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4 py-8">
            <div className="w-full max-w-xl rounded-3xl bg-slate-800 p-8 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Pay Salary</h2>
                  <p className="mt-2 text-slate-300">Confirm payment details for {selectedTeacher.name}.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-full bg-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-600"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-300">Teacher</p>
                  <p className="mt-2 text-white font-semibold">{selectedTeacher.name}</p>
                </div>
                <div className="rounded-3xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-300">Salary</p>
                  <p className="mt-2 text-white font-semibold">₦{selectedTeacher.monthlySalary.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-300">Due Date</p>
                  <p className="mt-2 text-white font-semibold">{selectedTeacher.dueDate}</p>
                </div>
                <div className="rounded-3xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-300">Method</p>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm text-slate-200">Payment Note</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows="4"
                  className="mt-2 w-full rounded-3xl border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
                >
                  Confirm Payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-700 px-6 py-3 text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FeesPaid;
