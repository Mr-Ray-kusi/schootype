import React from 'react';
import { Edit2, Trash2, Eye, User } from 'lucide-react';
import AttendanceQrCode from './AttendanceQrCode';

const GRID_STYLE = { gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 320px))' };

export const PersonGrid = ({ children }) => (
  <div className="grid gap-3" style={GRID_STYLE}>
    {children}
  </div>
);

const PersonCard = ({
  name,
  badge,
  photoUrl,
  details = [],
  qrValue,
  onView,
  onEdit,
  onDelete,
  onDownloadPack,
  accent = 'sky',
  downloadLabel = 'Download QR',
}) => {
  const accentMap = {
    sky: {
      border: 'hover:border-primary-500/40',
      badge: 'bg-primary-500/20 text-primary-300 border-primary-500/30',
      fallback: 'bg-primary-500/20 border-primary-500/30 text-primary-300',
    },
    purple: {
      border: 'hover:border-purple-500/40',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      fallback: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    },
  };
  const colors = accentMap[accent] || accentMap.sky;

  return (
    <article
      className={`w-full max-w-[320px] overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-sm transition-all hover:shadow-md ${colors.border}`}
    >
      <div className="flex gap-0">
        <div className="flex w-28 shrink-0 items-center justify-center border-r border-slate-600 bg-slate-700/50 p-2">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-lg border border-slate-500 object-cover"
            />
          ) : (
            <div className={`flex aspect-[3/4] w-full flex-col items-center justify-center rounded-lg border ${colors.fallback}`}>
              <span className="text-xl font-bold">{name?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-sm font-semibold leading-snug text-white">{name}</h3>
              {badge ? (
                <span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${colors.badge}`}>
                  {badge}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              {onView ? (
                <button type="button" onClick={onView} className="rounded-md p-1 text-slate-300 hover:bg-slate-700" title="View details">
                  <Eye className="h-3 w-3" />
                </button>
              ) : null}
              {onEdit ? (
                <button type="button" onClick={onEdit} className="rounded-md p-1 text-primary-400 hover:bg-primary-500/20" title="Edit">
                  <Edit2 className="h-3 w-3" />
                </button>
              ) : null}
              {onDelete ? (
                <button type="button" onClick={onDelete} className="rounded-md p-1 text-red-400 hover:bg-red-500/20" title="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-1.5 flex-1 space-y-1 text-[10px] text-slate-300">
            {details.map((row) =>
              row?.text ? (
                <div key={row.key || row.text} className="flex items-start gap-1">
                  {row.icon || <User className="mt-0.5 h-2.5 w-2.5 shrink-0 text-slate-500" />}
                  <span className={row.clamp === false ? 'truncate' : 'line-clamp-2'}>{row.text}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-600 bg-slate-900/50 px-2.5 py-2">
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">QR ID</p>
        <AttendanceQrCode
          value={qrValue}
          name={name}
          photoUrl={photoUrl}
          onDownloadPack={onDownloadPack}
          size={80}
          containerClassName="bg-white rounded-md p-1.5"
          buttonClassName="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md transition-colors text-[10px] font-medium"
          downloadLabel={downloadLabel}
        />
      </div>
    </article>
  );
};

export default PersonCard;
