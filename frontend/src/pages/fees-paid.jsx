import React from 'react';

const FeesPaid = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold text-white">Fees Paid</h1>
      <p className="mt-1 text-sm text-slate-400">Fee payment records will appear here when parents pay.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
        <p className="text-sm uppercase tracking-wide text-slate-300">Total paid</p>
        <p className="mt-4 text-4xl font-semibold text-white">0</p>
      </div>
      <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
        <p className="text-sm uppercase tracking-wide text-slate-300">Payments this month</p>
        <p className="mt-4 text-4xl font-semibold text-white">0</p>
      </div>
      <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
        <p className="text-sm uppercase tracking-wide text-slate-300">Amount</p>
        <p className="mt-4 text-4xl font-semibold text-white">0.00</p>
      </div>
    </div>
    <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-800/50 py-16 text-center">
      <p className="text-slate-300">No fee payments recorded yet.</p>
      <p className="mt-1 text-sm text-slate-500">Demo salary data has been removed from this page.</p>
    </div>
  </div>
);

export default FeesPaid;
