import React, { useState } from 'react';
import Layout from '../components/layout';

const studentReports = [
  { id: 1, name: 'Aisha Ali', class: 'Grade 1', assessment: 'Excellent', attitude: 'Very positive', score: 92 },
  { id: 2, name: 'Emeka Chukwu', class: 'Grade 2', assessment: 'Good', attitude: 'Positive', score: 84 },
  { id: 3, name: 'Fatima Bello', class: 'Grade 3', assessment: 'Very Good', attitude: 'Cooperative', score: 88 },
  { id: 4, name: 'David Okoro', class: 'Grade 4', assessment: 'Satisfactory', attitude: 'Needs improvement', score: 76 },
  { id: 5, name: 'Maryam Yusuf', class: 'Grade 5', assessment: 'Excellent', attitude: 'Outstanding', score: 95 },
];

const initialTeacherReports = [
  { id: 1, teacher: 'Mr. Ade', class: 'Grade 1', course: 'Mathematics', title: 'Math term 1 results', status: 'Pending', uploadedAt: 'Today', accessCode: 'SCH-7K4N2V8B', fileName: 'math-grade1.pdf' },
  { id: 2, teacher: 'Ms. Aminah', class: 'Grade 2', course: 'English', title: 'English comprehension upload', status: 'Audited', uploadedAt: 'Yesterday', accessCode: 'SCH-R2Q9V1XL', fileName: 'english-grade2.pdf' },
  { id: 3, teacher: 'Mr. Chike', class: 'Grade 3', course: 'Science', title: 'Science lab report', status: 'Pending', uploadedAt: '2 days ago', accessCode: 'SCH-M5B8Z3PT', fileName: 'science-grade3.pdf' },
];

const gradeDistribution = [
  { grade: 'A', percent: 32, count: 16 },
  { grade: 'B', percent: 28, count: 14 },
  { grade: 'C', percent: 18, count: 9 },
  { grade: 'D', percent: 12, count: 6 },
  { grade: 'E', percent: 7, count: 3 },
  { grade: 'F', percent: 3, count: 2 },
];

const ReportCards = () => {
  const [selectedClass, setSelectedClass] = useState('all');
  const [teacherReports, setTeacherReports] = useState(initialTeacherReports);

  const classes = [
    'all',
    ...new Set([
      ...studentReports.map((report) => report.class),
      ...teacherReports.map((report) => report.class),
    ]),
  ];

  const filteredStudentReports = selectedClass === 'all'
    ? studentReports
    : studentReports.filter((report) => report.class === selectedClass);

  const filteredTeacherReports = selectedClass === 'all'
    ? teacherReports
    : teacherReports.filter((report) => report.class === selectedClass);

  const pendingReports = teacherReports.filter((report) => report.status === 'Pending').length;
  const auditedReports = teacherReports.filter((report) => report.status === 'Audited').length;

  const handleAudit = (id) => {
    setTeacherReports((prevReports) => prevReports.map((report) => (
      report.id === id ? { ...report, status: 'Audited' } : report
    )));
  };

  return (
    <Layout>
      <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Report Cards</h1>
        <p className="mt-3 text-slate-300">Teachers upload class and subject results using their secret access codes. Admins can audit submissions and review student performance.</p>
      </div>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Class Filters</h2>
            <p className="text-sm text-slate-300">Choose a class to view reports and uploaded results.</p>
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full md:w-64 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {classes.map((className) => (
              <option key={className} value={className} className="bg-slate-900 text-white">
                {className === 'all' ? 'All Classes' : className}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Student Reports</p>
            <p className="mt-4 text-3xl font-semibold text-white">{filteredStudentReports.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Pending teacher uploads</p>
            <p className="mt-4 text-3xl font-semibold text-white">{pendingReports}</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Audited reports</p>
            <p className="mt-4 text-3xl font-semibold text-white">{auditedReports}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Grade Distribution</h2>
            <p className="text-sm text-slate-300">Performance breakdown by overall grade range.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm text-white">
            Grade Performance
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {gradeDistribution.map((item) => (
            <div key={item.grade} className="rounded-3xl bg-slate-900 p-4">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Grade {item.grade}</span>
                <span>{item.count} students</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-300">{item.percent}% of graded submissions</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Teacher Uploads</h2>
            <p className="text-sm text-slate-300">Review reports submitted by teachers, then audit them to include them in the main report cards.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm text-white">
            Admin Audit Access
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-6 py-4">Teacher</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Uploaded</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeacherReports.map((report, index) => (
                <tr key={report.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                  <td className="px-6 py-4 text-white">{report.teacher}</td>
                  <td className="px-6 py-4">{report.class}</td>
                  <td className="px-6 py-4">{report.course}</td>
                  <td className="px-6 py-4">{report.uploadedAt}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${report.status === 'Audited' ? 'bg-emerald-600 text-white' : 'bg-yellow-600 text-white'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleAudit(report.id)}
                      className="rounded-full bg-primary-600 px-4 py-2 text-xs text-white hover:bg-primary-700"
                    >
                      Mark Audited
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Student Assessments</h2>
        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Assessment</th>
                <th className="px-6 py-4">Attitude</th>
                <th className="px-6 py-4">Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudentReports.map((report, index) => (
                <tr key={report.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                  <td className="px-6 py-4 text-white">{report.name}</td>
                  <td className="px-6 py-4">{report.class}</td>
                  <td className="px-6 py-4">{report.assessment}</td>
                  <td className="px-6 py-4">{report.attitude}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">{report.score}</span>
                      <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs text-white">
                        {report.score >= 90 ? 'A' : report.score >= 80 ? 'B' : 'C'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </Layout>
  );
};

export default ReportCards;
