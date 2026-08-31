import React from 'react';
import { Download, Edit2, Trash2, User, X } from 'lucide-react';
import AttendanceQrCode from './AttendanceQrCode';

const PersonDetailModal = ({
  open,
  name,
  badge,
  photoUrl,
  qrValue,
  fields = [],
  onClose,
  onEdit,
  onDelete,
  onDownload,
  downloadLabel = 'Download pack',
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-600 bg-slate-800 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-4">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="h-28 w-24 rounded-xl border border-slate-500 object-cover"
              />
            ) : (
              <div className="flex h-28 w-24 flex-col items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/20">
                <User className="h-6 w-6 text-primary-300" />
                <span className="mt-1 text-2xl font-bold text-primary-300">
                  {name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white">{name || 'Details'}</h2>
              {badge ? <p className="mt-1 text-sm text-slate-300">{badge}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {qrValue ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Attendance QR
            </p>
            <AttendanceQrCode
              value={qrValue}
              name={name}
              size={140}
              showDownload={false}
              containerClassName="bg-white rounded-xl p-3"
            />
          </div>
        ) : null}

        <dl className="mt-6 space-y-3 text-sm">
          {fields.map((field) =>
            field?.label ? (
              <div key={field.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {field.label}
                </dt>
                <dd className="mt-1 text-slate-100">{field.value || '—'}</dd>
              </div>
            ) : null
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          ) : null}
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
            >
              <Download className="h-4 w-4" />
              {downloadLabel}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600/80 px-3 py-2 text-sm text-white hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg bg-slate-600 py-2 text-slate-100 hover:bg-slate-500"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PersonDetailModal;
