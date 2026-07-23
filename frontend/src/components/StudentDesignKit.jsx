import React, { useState } from 'react';
import { Download, FolderArchive, Image, QrCode, FileText, Loader2 } from 'lucide-react';
import QrCodeBlock from './QrCodeBlock';
import {
  getStudentDesignDetails,
  downloadStudentDesignKitZip,
  photoUrlToBlob,
  triggerBlobDownload,
  formatDetailsText,
} from '../utils/studentDesignKit';
import { qrValueToPngBlob } from '../utils/qrCodeExport';
import { buildStudentIdUrl } from '../utils/studentIdQr';

const DetailField = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-sm font-bold text-gray-900 mt-0.5 break-words">{value || '—'}</p>
  </div>
);

const StudentDesignKit = ({ student, school }) => {
  const [downloading, setDownloading] = useState(null);
  const details = getStudentDesignDetails(student, school);
  const photoUrl = student.photoUrl || student.photo_url;
  const safeName = details.name.replace(/\s+/g, '-').toLowerCase() || 'student';

  const runDownload = async (key, action) => {
    setDownloading(key);
    try {
      await action();
    } catch (error) {
      console.error(error);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const downloadPhoto = async () => {
    const blob = await photoUrlToBlob(photoUrl);
    if (!blob) {
      alert('No photo uploaded for this student.');
      return;
    }
    triggerBlobDownload(blob, `${safeName}-photo.png`);
  };

  const downloadQr = async () => {
    if (!student.barcode) {
      alert('No QR code available for this student.');
      return;
    }
    const blob = await qrValueToPngBlob(buildStudentIdUrl(student.barcode), 600);
    triggerBlobDownload(blob, `${safeName}-qr-code.png`);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' });
    triggerBlobDownload(blob, `${safeName}-student-details.json`);
  };

  const downloadTxt = () => {
    const blob = new Blob([formatDetailsText(details)], { type: 'text/plain' });
    triggerBlobDownload(blob, `${safeName}-student-details.txt`);
  };

  const downloadFolder = () => downloadStudentDesignKitZip(student, school);

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Card Design Kit</h3>
        <p className="text-xs text-blue-100 mt-0.5">
          Separate photo, QR code, and details — download individually or as one folder for your designer.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Photo */}
          <div className="rounded-lg border border-gray-200 p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase text-gray-700">Photo</span>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 min-h-[140px] mb-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={details.name}
                  className="max-h-32 max-w-full object-contain rounded"
                />
              ) : (
                <p className="text-xs text-gray-400 px-2 text-center">No photo uploaded</p>
              )}
            </div>
            <button
              type="button"
              disabled={!photoUrl || downloading === 'photo'}
              onClick={() => runDownload('photo', downloadPhoto)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {downloading === 'photo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              photo.png
            </button>
          </div>

          {/* QR Code */}
          <div className="rounded-lg border border-gray-200 p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase text-gray-700">QR Code</span>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 min-h-[140px] mb-3">
              {student.barcode ? (
                <QrCodeBlock value={buildStudentIdUrl(student.barcode)} size={110} level="M" paddingClass="p-2" />
              ) : (
                <p className="text-xs text-gray-400">No barcode assigned</p>
              )}
            </div>
            <button
              type="button"
              disabled={!student.barcode || downloading === 'qr'}
              onClick={() => runDownload('qr', downloadQr)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {downloading === 'qr' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              qr-code.png
            </button>
          </div>

          {/* Details */}
          <div className="rounded-lg border border-gray-200 p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase text-gray-700">Details</span>
            </div>
            <div className="flex-1 space-y-2 mb-3">
              <DetailField label="Name" value={details.name} />
              <DetailField label="Roll Number" value={details.rollNumber} />
              <DetailField label="Parent Phone" value={details.parentPhone} />
              <DetailField label="Year Admitted" value={details.yearAdmitted} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={downloading === 'json'}
                onClick={() => runDownload('json', downloadJson)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                .json
              </button>
              <button
                type="button"
                disabled={downloading === 'txt'}
                onClick={() => runDownload('txt', downloadTxt)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                .txt
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={downloading === 'zip'}
          onClick={() => runDownload('zip', downloadFolder)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm disabled:opacity-50"
        >
          {downloading === 'zip' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FolderArchive className="w-4 h-4" />
          )}
          Download Complete Folder (ZIP)
        </button>
        <p className="text-[10px] text-gray-400 text-center">
          ZIP contains: photo.png, qr-code.png, student-details.json, student-details.txt, README.txt
        </p>
      </div>
    </div>
  );
};

export default StudentDesignKit;
