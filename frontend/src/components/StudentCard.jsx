import React, { useRef } from 'react';
import { Printer } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';
import QrCodeBlock from './QrCodeBlock';
import StudentDesignKit from './StudentDesignKit';
import { buildStudentIdUrl } from '../utils/studentIdQr';

export const CARD_WIDTH = '3.370in';
export const CARD_HEIGHT = '2.125in';

const ORANGE = '#f97316';
const ORANGE_DARK = '#ea580c';
const RED = '#dc2626';

const formatStudentId = (student) => {
  const roll = student.roll_number || student.rollNumber;
  if (roll) return roll;
  const bc = student.barcode || '';
  const tail = bc.split('-').slice(-2).join('-');
  return tail || bc.slice(-12) || 'N/A';
};

const getCardDates = (student) => {
  const raw = student.created_at || student.createdAt;
  const issued = raw ? new Date(raw) : new Date();
  const expires = new Date(issued);
  expires.setFullYear(expires.getFullYear() + 1);
  const fmt = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { issued: fmt(issued), expires: fmt(expires) };
};

const ChipIcon = () => (
  <svg viewBox="0 0 48 36" className="w-full h-full" aria-hidden>
    <rect x="1" y="1" width="46" height="34" rx="4" fill="#d4a017" stroke="#b8860b" strokeWidth="1.5" />
    <rect x="6" y="6" width="14" height="10" rx="1" fill="#c9940a" opacity="0.6" />
    <rect x="22" y="6" width="20" height="4" rx="1" fill="#c9940a" opacity="0.5" />
    <rect x="22" y="12" width="20" height="4" rx="1" fill="#c9940a" opacity="0.5" />
    <rect x="6" y="18" width="36" height="4" rx="1" fill="#c9940a" opacity="0.5" />
    <rect x="6" y="24" width="36" height="4" rx="1" fill="#c9940a" opacity="0.5" />
  </svg>
);

const OrangeCurveAccent = ({ variant = 'front' }) => (
  <svg
    className="absolute top-0 right-0 pointer-events-none"
    style={{ width: variant === 'front' ? '1.4in' : '1.6in', height: variant === 'front' ? '1.1in' : '2.125in' }}
    viewBox="0 0 140 110"
    preserveAspectRatio="none"
    aria-hidden
  >
    {variant === 'front' ? (
      <>
        <path d="M140 0 H60 Q20 0 10 40 Q0 80 0 110 H140 Z" fill={ORANGE} opacity="0.95" />
        <path d="M140 0 H90 Q50 10 40 50 Q30 90 20 110 H140 Z" fill={RED} opacity="0.85" />
      </>
    ) : (
      <>
        <path d="M0 0 H160 V220 Q80 200 40 160 Q0 120 0 0 Z" fill={ORANGE} opacity="0.95" />
        <path d="M0 180 H160 V220 Q100 210 60 190 Q20 170 0 150 Z" fill={RED} opacity="0.9" />
      </>
    )}
  </svg>
);

const SchoolBrand = ({ school, variant = 'front' }) => {
  const logoUrl = school?.logoUrl;
  const name = school?.name || 'School';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="object-contain"
        style={{
          height: variant === 'back' ? '0.38in' : '0.3in',
          maxWidth: variant === 'back' ? '1.4in' : '1.1in',
        }}
      />
    );
  }

  return (
    <div className="leading-tight text-right">
      <p style={{ fontSize: variant === 'back' ? '11px' : '9px', fontWeight: 800, color: ORANGE_DARK }}>
        {name}
      </p>
    </div>
  );
};

const DetailRow = ({ label, value, large = false }) => (
  <div className="mb-1">
    <p
      className="uppercase tracking-wide text-gray-500 font-semibold leading-none"
      style={{ fontSize: '6.5px' }}
    >
      {label}
    </p>
    <p
      className="font-bold text-gray-900 uppercase leading-tight"
      style={{ fontSize: large ? '10px' : '8.5px', marginTop: '1px' }}
    >
      {value}
    </p>
  </div>
);

export const IdCardFront = ({ student, school }) => {
  const photoUrl = student.photoUrl || student.photo_url;
  const { issued, expires } = getCardDates(student);
  const studentId = formatStudentId(student);

  return (
    <div
      className="id-card-face relative bg-white overflow-hidden rounded-md"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <OrangeCurveAccent variant="front" />

      <div className="relative z-10 flex h-full px-2 pt-2 pb-[0.42in]">
        <div className="shrink-0 flex flex-col" style={{ width: '0.95in' }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={student.name}
              className="object-cover bg-gray-100"
              style={{ width: '0.88in', height: '0.95in', border: '2px solid #1e293b' }}
            />
          ) : (
            <div
              className="flex items-center justify-center font-black text-white bg-slate-700"
              style={{ width: '0.88in', height: '0.95in', fontSize: '28px', border: '2px solid #1e293b' }}
            >
              {student.name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        <div className="flex-1 pl-2 pt-0.5 min-w-0">
          <DetailRow label="Full Name" value={student.name || 'N/A'} large />
          <DetailRow label="Class" value={student.class || 'N/A'} />
          <div className="flex gap-3 mt-1">
            <DetailRow label="Issued" value={issued} />
            <DetailRow label="Expires" value={expires} />
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex items-center bg-white border-t border-gray-200"
        style={{ height: '0.42in' }}
      >
        <div className="px-2 shrink-0" style={{ width: '1.15in' }}>
          <p className="font-bold text-gray-900 uppercase leading-none" style={{ fontSize: '7px' }}>
            Student ID
          </p>
          <p className="font-bold text-gray-900 leading-tight mt-0.5" style={{ fontSize: '9px', letterSpacing: '0.02em' }}>
            {studentId}
          </p>
        </div>
        <div className="w-px self-stretch bg-gray-300 my-1" />
        <div className="flex-1 flex items-center justify-end pr-2 pl-2">
          <SchoolBrand school={school} variant="front" />
        </div>
      </div>
    </div>
  );
};

export const IdCardBack = ({ student, school, qrRef }) => {
  const emergencyPhone =
    student.parent_phone || student.parentPhone || 'Contact school office';
  const schoolName = school?.name || 'this school';

  return (
    <div
      className="id-card-face relative bg-white overflow-hidden rounded-md flex"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="relative shrink-0 overflow-hidden" style={{ width: '1.15in', background: ORANGE }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${ORANGE} 0%, ${ORANGE_DARK} 55%, ${RED} 100%)` }} />
        <OrangeCurveAccent variant="back" />
        <div className="relative z-10 flex flex-col h-full px-2 py-2">
          <div style={{ width: '0.55in', height: '0.42in', marginTop: '0.15in' }}>
            <ChipIcon />
          </div>
          <div className="mt-auto pb-1">
            <p className="text-white font-semibold leading-tight" style={{ fontSize: '5.5px' }}>
              EMERGENCY CONTACT: {emergencyPhone}
            </p>
            <p className="text-white leading-tight mt-1" style={{ fontSize: '5px', opacity: 0.95 }}>
              THIS CARD IS THE PROPERTY OF {schoolName.toUpperCase()}. IF FOUND PLEASE CONTACT{' '}
              {emergencyPhone}.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10 px-2 py-1.5 min-w-0">
        <div>
          <p className="text-center uppercase text-gray-400 font-semibold tracking-wider" style={{ fontSize: '5.5px' }}>
            Official student card
          </p>
          <div className="mx-2 mt-1 border-t-2 border-dashed border-gray-300" />
        </div>

        <div className="flex-1 flex flex-col justify-center px-1">
          <p className="text-gray-500 uppercase font-semibold" style={{ fontSize: '6px' }}>
            Signature
          </p>
          <div className="border-b border-gray-400 mt-4" style={{ width: '1.1in' }} />
        </div>

        <div className="flex items-end justify-between gap-1">
          <div className="flex-1 flex justify-center pb-0.5">
            <SchoolBrand school={school} variant="back" />
          </div>
          <div className="shrink-0 bg-white border-2 border-gray-200 rounded-sm p-1">
            <QrCodeBlock
              ref={qrRef}
              value={buildStudentIdUrl(student.barcode)}
              size={64}
              level="M"
              paddingClass="p-0.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentCard = ({ student, onPrint }) => {
  const { school } = useAuth();
  const printRef = useRef(null);
  const qrRef = useRef(null);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID - ${student.name}</title>
          <style>
            @page { size: ${CARD_WIDTH} ${CARD_HEIGHT}; margin: 0; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
            .print-sheet { display: flex; flex-direction: column; align-items: center; }
            .id-card-face {
              width: ${CARD_WIDTH};
              height: ${CARD_HEIGHT};
              page-break-after: always;
              overflow: hidden;
              border-radius: 4px;
            }
            .id-card-face:last-child { page-break-after: auto; }
            .screen-only { display: none !important; }
          </style>
        </head>
        <body>
          <div class="print-sheet">${printContent.innerHTML}</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
            window.onafterprint = () => window.close();
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <StudentDesignKit student={student} school={school} />

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
          ID Card Preview (Front &amp; Back)
        </p>
        <div ref={printRef} className="flex flex-col items-center gap-8">
        <div className="w-full">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
            Front
          </p>
          <div className="flex justify-center">
            <div className="shadow-xl rounded-md">
              <IdCardFront student={student} school={school} />
            </div>
          </div>
        </div>

        <div className="w-full">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
            Back
          </p>
          <div className="flex justify-center">
            <div className="shadow-xl rounded-md">
              <IdCardBack student={student} school={school} qrRef={qrRef} />
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Print Front &amp; Back
        </button>
      </div>
      <p className="text-[10px] text-gray-400 text-center">
        Prints two pages (front then back) at 3.370″ × 2.125″ — use double-sided printing.
      </p>
    </div>
  );
};

export default StudentCard;
