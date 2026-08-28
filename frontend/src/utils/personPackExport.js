import { qrValueToPngBlob } from './qrCodeExport';
import { createZipBlob } from './zipStore';

const safeFolder = (name) =>
  String(name || 'person')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'person';

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sheetXml = (rows) => {
  const body = rows
    .map((row, index) => {
      const r = index + 1;
      return `<row r="${r}">
  <c r="A${r}" t="inlineStr"><is><t>${escapeXml(row[0])}</t></is></c>
  <c r="B${r}" t="inlineStr"><is><t>${escapeXml(row[1])}</t></is></c>
</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
};

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Details" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const buildXlsxBlob = async (rows) =>
  createZipBlob([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: RELS },
    { name: 'xl/workbook.xml', data: WORKBOOK },
    { name: 'xl/_rels/workbook.xml.rels', data: WORKBOOK_RELS },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml(rows) },
  ]);

const dataUrlToBlob = async (value) => {
  if (!value) return null;
  if (value instanceof Blob) return value;
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:')) {
    const res = await fetch(value);
    return res.blob();
  }
  if (value.startsWith('http')) {
    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      return res.blob();
    } catch {
      return null;
    }
  }
  return null;
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const detailsToRows = (details = {}) =>
  Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]);

async function personFiles(person) {
  const folderName = safeFolder(person.name);
  const files = [];
  const rows = detailsToRows(person.details || { Name: person.name });
  const xlsx = await buildXlsxBlob(rows);
  files.push({ name: `${folderName}/${folderName}-details.xlsx`, data: xlsx });

  if (person.qrValue) {
    const qrBlob = await qrValueToPngBlob(person.qrValue, 512);
    files.push({ name: `${folderName}/${folderName}-qr-code.png`, data: qrBlob });
  }

  const photoBlob = await dataUrlToBlob(person.photoUrl);
  if (photoBlob) {
    const ext = photoBlob.type?.includes('png') ? 'png' : 'jpg';
    files.push({ name: `${folderName}/${folderName}-photo.${ext}`, data: photoBlob });
  }
  return files;
}

export async function downloadPersonPack(person) {
  const blob = await createZipBlob(await personFiles(person));
  triggerDownload(blob, `${safeFolder(person.name)}-pack.zip`);
}

export async function downloadPeoplePacks(people, archiveName = 'people-packs.zip') {
  const files = [];
  for (const person of people) {
    files.push(...(await personFiles(person)));
  }
  const blob = await createZipBlob(files);
  triggerDownload(blob, archiveName);
}

export function studentPack(student, qrValue) {
  return {
    name: student.name,
    photoUrl: student.photo_url,
    qrValue,
    details: {
      Name: student.name,
      Class: student.class || '',
      'Roll number': student.roll_number || '',
      'Date of birth': student.date_of_birth || '',
      Skills: student.skills || '',
      'Parent name': student.parent_name || '',
      'Parent relationship': student.parent_relationship || '',
      'Parent phone': student.parent_phone || '',
      'Parent email': student.parent_email || '',
      Address: student.house_address || '',
      Barcode: student.barcode || '',
    },
  };
}

export function staffPack(member, qrValue) {
  return {
    name: member.name,
    photoUrl: member.photo_url,
    qrValue,
    details: {
      Name: member.name,
      Role: member.role || '',
      'Access code': member.secretCode || member.secret_code || '',
      Subjects: member.subjects || '',
      Classes: member.classNames || member.class_names || '',
      Barcode: member.barcode || '',
    },
  };
}

export function nonStaffPack(person, qrValue) {
  return {
    name: person.name,
    photoUrl: person.photo_url,
    qrValue,
    details: {
      Name: person.name,
      Role: person.role || '',
      Barcode: person.barcode || '',
    },
  };
}
