import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ATTITUDES = ['Excellent', 'Good', 'Bad', 'Worse'];

export const letterGrade = (percent) => {
  if (percent == null || Number.isNaN(percent)) return '—';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
};

/** Competition ranking: same score shares position; next skips. */
export function assignPositions(rows, getScore) {
  const sorted = [...rows].sort((a, b) => {
    const sb = getScore(b) ?? -Infinity;
    const sa = getScore(a) ?? -Infinity;
    if (sb !== sa) return sb - sa;
    return String(a.student_name || '').localeCompare(String(b.student_name || ''));
  });

  let position = 0;
  let lastScore = null;
  return sorted.map((row, index) => {
    const score = getScore(row);
    if (score !== lastScore) {
      position = index + 1;
      lastScore = score;
    }
    return { ...row, position };
  });
}

export function ordinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  const v = num % 100;
  if (v >= 11 && v <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

function pickAttitude(rows) {
  const counts = {};
  for (const row of rows) {
    const a = row.attitude;
    if (!a) continue;
    counts[a] = (counts[a] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked[0]) return ranked[0][0];
  const latest = [...rows].sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  )[0];
  return latest?.attitude || '—';
}

function buildStudentSummaries(scores, { className, term } = {}) {
  const filtered = scores.filter((row) => {
    if (className && className !== 'all' && row.class_name !== className) return false;
    if (term && term !== 'all' && row.term !== term) return false;
    return row.percent != null;
  });

  const byStudent = new Map();
  for (const row of filtered) {
    const key = row.student_id || `${row.student_name}-${row.class_name}`;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        student_id: row.student_id,
        student_name: row.student_name,
        class_name: row.class_name,
        roll_number: row.roll_number,
        term: row.term,
        subjects: [],
      });
    }
    byStudent.get(key).subjects.push(row);
  }

  const summaries = Array.from(byStudent.values()).map((entry) => {
    const percents = entry.subjects.map((s) => s.percent).filter((p) => p != null);
    const average =
      percents.length > 0
        ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10
        : null;
    return {
      ...entry,
      average,
      attitude: pickAttitude(entry.subjects),
    };
  });

  return assignPositions(summaries, (row) => row.average);
}

export function downloadSubjectRankingsPdf({
  scores,
  schoolName = 'School',
  className = 'all',
  term = 'all',
  subject = 'all',
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFontSize(16);
  doc.text(schoolName, pageWidth / 2, y, { align: 'center' });
  y += 22;
  doc.setFontSize(13);
  doc.text('Terminal Exam Subject Rankings', pageWidth / 2, y, { align: 'center' });
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(
    `Class: ${className === 'all' ? 'All' : className}  ·  Term: ${term === 'all' ? 'All' : term}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  doc.setTextColor(0);
  y += 16;

  const scoped = scores.filter((row) => {
    if (className !== 'all' && row.class_name !== className) return false;
    if (term !== 'all' && row.term !== term) return false;
    if (subject !== 'all' && row.subject !== subject) return false;
    return row.percent != null;
  });

  const subjects = [
    ...new Set(scoped.map((row) => row.subject).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  if (!subjects.length) {
    doc.setFontSize(11);
    doc.text('No scores available for the selected filters.', 40, y + 20);
    doc.save(`subject-rankings-${Date.now()}.pdf`);
    return;
  }

  subjects.forEach((subj, index) => {
    const rows = assignPositions(
      scoped.filter((row) => row.subject === subj),
      (row) => row.percent
    );

    if (index > 0) {
      const needed = 40 + rows.length * 18;
      if (y + needed > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 48;
      } else {
        y += 18;
      }
    }

    doc.setFontSize(12);
    doc.text(`${subj}`, 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Pos', 'Student', 'Class', 'Score', '%', 'Grade', 'Attitude']],
      body: rows.map((row) => [
        ordinal(row.position),
        row.student_name,
        row.class_name || '—',
        row.score == null ? '—' : `${row.score}/${row.max_score ?? 100}`,
        row.percent == null ? '—' : `${row.percent}%`,
        letterGrade(row.percent),
        row.attitude || '—',
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [14, 165, 233] },
      margin: { left: 40, right: 40 },
    });

    y = (doc.lastAutoTable?.finalY || y) + 16;
  });

  const classPart = className === 'all' ? 'all-classes' : className;
  doc.save(`subject-rankings-${classPart}-${term}-${Date.now()}.pdf`);
}

export function downloadStudentReportCardsPdf({
  scores,
  schoolName = 'School',
  className = 'all',
  term = 'all',
}) {
  const summaries = buildStudentSummaries(scores, { className, term });
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  if (!summaries.length) {
    doc.setFontSize(12);
    doc.text('No student scores available for the selected filters.', 40, 60);
    doc.save(`student-report-cards-${Date.now()}.pdf`);
    return;
  }

  summaries.forEach((student, index) => {
    if (index > 0) doc.addPage();

    let y = 48;
    doc.setFontSize(16);
    doc.text(schoolName, pageWidth / 2, y, { align: 'center' });
    y += 22;
    doc.setFontSize(13);
    doc.text('Student Report Card', pageWidth / 2, y, { align: 'center' });
    y += 28;

    doc.setFontSize(11);
    doc.text(`Student: ${student.student_name}`, 40, y);
    y += 16;
    doc.text(`Class: ${student.class_name || '—'}`, 40, y);
    y += 16;
    doc.text(`Term: ${term === 'all' ? student.term || '—' : term}`, 40, y);
    y += 16;
    doc.text(`Overall position: ${ordinal(student.position)}`, 40, y);
    y += 16;
    doc.text(
      `Average: ${student.average == null ? '—' : `${student.average}%`} (${letterGrade(student.average)})`,
      40,
      y
    );
    y += 16;
    doc.text(`Attitude: ${student.attitude || '—'}`, 40, y);
    y += 20;

    const subjectRows = assignPositions(student.subjects, (row) => row.percent);

    autoTable(doc, {
      startY: y,
      head: [['Subject', 'Score', '%', 'Grade', 'Subject pos.', 'Attitude', 'Remark']],
      body: subjectRows.map((row) => [
        row.subject,
        row.score == null ? '—' : `${row.score}/${row.max_score ?? 100}`,
        row.percent == null ? '—' : `${row.percent}%`,
        letterGrade(row.percent),
        ordinal(row.position),
        row.attitude || '—',
        row.remark || '—',
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [14, 165, 233] },
      margin: { left: 40, right: 40 },
    });

    const footY = (doc.lastAutoTable?.finalY || y) + 28;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Generated by SCHOOLTYPE', pageWidth / 2, footY, { align: 'center' });
    doc.setTextColor(0);
  });

  const classPart = className === 'all' ? 'all-classes' : className;
  doc.save(`student-report-cards-${classPart}-${term}-${Date.now()}.pdf`);
}
