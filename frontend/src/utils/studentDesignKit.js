import JSZip from 'jszip';
import { qrValueToPngBlob } from './qrCodeExport';

const CARD_SIZE = { widthInches: 3.370, heightInches: 2.125 };

export const sanitizeFolderName = (name, rollNumber) => {
  const base = [name, rollNumber].filter(Boolean).join('_');
  return base
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'student';
};

export const getYearAdmitted = (student) => {
  const raw = student.created_at || student.createdAt;
  if (!raw) return new Date().getFullYear().toString();
  return new Date(raw).getFullYear().toString();
};

export const getStudentDesignDetails = (student, school) => {
  const rollNumber = student.roll_number || student.rollNumber || '';
  const parentPhone = student.parent_phone || student.parentPhone || '';

  return {
    name: student.name || '',
    rollNumber,
    parentPhone,
    yearAdmitted: getYearAdmitted(student),
    class: student.class || '',
    parentEmail: student.parent_email || student.parentEmail || '',
    barcode: student.barcode || '',
    schoolName: school?.name || '',
    studentId: student.id || '',
    photoFile: 'photo.png',
    qrCodeFile: 'qr-code.png',
    detailsFile: 'student-details.json',
    cardSize: CARD_SIZE,
    exportedAt: new Date().toISOString(),
  };
};

export const formatDetailsText = (details) => {
  return [
    'STUDENT ID CARD — DESIGN ASSETS',
    '================================',
    '',
    `Name:           ${details.name}`,
    `Roll Number:    ${details.rollNumber || 'N/A'}`,
    `Parent Phone:   ${details.parentPhone || 'N/A'}`,
    `Year Admitted:  ${details.yearAdmitted}`,
    `Class:          ${details.class || 'N/A'}`,
    `School:         ${details.schoolName}`,
    `Barcode ID:     ${details.barcode}`,
    '',
    'FILES IN THIS FOLDER',
    '--------------------',
    `- ${details.photoFile}     Student portrait (for card front)`,
    `- ${details.qrCodeFile}  QR code (for card back / attendance)`,
    `- ${details.detailsFile}  Machine-readable data`,
    '- student-details.txt   This summary',
    '',
    `Recommended card size: ${CARD_SIZE.widthInches}" × ${CARD_SIZE.heightInches}" (CR80)`,
    `Exported: ${new Date(details.exportedAt).toLocaleString()}`,
  ].join('\n');
};

const README_TEXT = `STUDENT ID CARD DESIGN KIT
==========================

This folder contains separate assets for your graphic designer.

FILES
-----
photo.png            Student portrait photo
qr-code.png          QR code (encodes the barcode ID for attendance)
student-details.json Structured student data
student-details.txt  Human-readable summary

KEY FIELDS
----------
- Name
- Roll Number
- Parent Phone
- Year Admitted
- Class
- School Name
- Barcode ID (embedded in QR code)

CARD SIZE
---------
${CARD_SIZE.widthInches} inches wide × ${CARD_SIZE.heightInches} inches tall (standard CR80 ID card)

Place photo, QR code, and text fields into your design template using the values in student-details.json.
`;

export async function photoUrlToBlob(photoUrl) {
  if (!photoUrl) return null;

  if (photoUrl.startsWith('data:')) {
    const [header, data] = photoUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const response = await fetch(photoUrl);
  if (!response.ok) throw new Error('Failed to fetch student photo');
  return response.blob();
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function buildStudentDesignKitFiles(student, school) {
  const details = getStudentDesignDetails(student, school);
  const photoUrl = student.photoUrl || student.photo_url;
  const folderName = sanitizeFolderName(details.name, details.rollNumber);

  const files = {
    'student-details.json': JSON.stringify(details, null, 2),
    'student-details.txt': formatDetailsText(details),
    'README.txt': README_TEXT,
  };

  if (student.barcode) {
    const qrBlob = await qrValueToPngBlob(student.barcode, 600);
    files['qr-code.png'] = qrBlob;
  }

  const photoBlob = await photoUrlToBlob(photoUrl);
  if (photoBlob) {
    files['photo.png'] = photoBlob;
  } else {
    files['photo-missing.txt'] = 'No student photo was uploaded. Add a photo in the Students section before exporting.';
  }

  return { folderName, details, files };
}

export async function downloadStudentDesignKitZip(student, school) {
  const { folderName, files } = await buildStudentDesignKitFiles(student, school);
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  Object.entries(files).forEach(([filename, content]) => {
    folder.file(filename, content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(blob, `${folderName}-design-kit.zip`);
}

export async function downloadAllStudentsDesignKitZip(students, school) {
  const zip = new JSZip();
  const root = zip.folder('student-card-design-assets');

  await Promise.all(
    students.map(async (student) => {
      const { folderName, files } = await buildStudentDesignKitFiles(student, school);
      const folder = root.folder(folderName);
      Object.entries(files).forEach(([filename, content]) => {
        folder.file(filename, content);
      });
    })
  );

  root.file(
    'README.txt',
    `${README_TEXT}\n\nThis archive contains ${students.length} student folder(s). Each subfolder has photo, QR code, and details for one student.\n`
  );

  const schoolSlug = sanitizeFolderName(school?.name || 'school', '');
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(blob, `${schoolSlug}-all-students-design-kits.zip`);
}
