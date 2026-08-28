-- Speed up list, dashboard, attendance, and report-card queries.
CREATE INDEX IF NOT EXISTS idx_students_school_created ON students (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students (school_id, class);
CREATE INDEX IF NOT EXISTS idx_students_barcode ON students (barcode);
CREATE INDEX IF NOT EXISTS idx_staffs_school_created ON staffs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staffs_barcode ON staffs (barcode);
CREATE INDEX IF NOT EXISTS idx_nonstaffs_school_created ON nonstaffs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nonstaffs_barcode ON nonstaffs (barcode);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance (school_id, date);
CREATE INDEX IF NOT EXISTS idx_messages_school_reply ON messages (school_id, reply);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects (school_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_school_updated ON student_scores (school_id, updated_at DESC);
