import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase initialization
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Email transporter configuration - uses Gmail SMTP or custom SMTP
let emailTransporter = null;
let emailReady = false;

const hasValidEmailConfig = () => {
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASSWORD || '';
  return emailUser && emailPass && 
         emailUser !== 'your-email@gmail.com' && 
         emailPass !== 'your-app-password';
};

if (hasValidEmailConfig()) {
  const emailTransportOptions = process.env.EMAIL_HOST
    ? {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      }
    : {
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      };

  emailTransporter = nodemailer.createTransport(emailTransportOptions);

  // Test email transporter on startup with timeout
  const verifyTimeout = setTimeout(() => {
    console.warn('Email verification timeout - continuing without email service');
    emailReady = false;
  }, 5000);

  emailTransporter.verify((error, success) => {
    clearTimeout(verifyTimeout);
    if (error) {
      emailReady = false;
      console.warn('Email service is not ready:', error.message);
    } else {
      emailReady = true;
      console.log('Email service ready');
    }
  });
} else {
  console.warn('Email credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env to enable email delivery.');
  emailReady = false;
}

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ AUTHENTICATION ROUTES ============

// Signup - Create new school
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { schoolName, email, password } = req.body;

    // Check if school already exists
    const { data: existingSchool } = await supabase
      .from('schools')
      .select('id')
      .eq('email', email)
      .single();

    if (existingSchool) {
      return res.status(400).json({ error: 'School already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new school
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert([
        {
          name: schoolName,
          email,
          password_hash: hashedPassword,
          created_at: new Date(),
        }
      ])
      .select()
      .single();

    if (schoolError) {
      console.error('School creation error:', schoolError);
      return res.status(500).json({ error: 'Failed to create school' });
    }

    // Generate JWT
    const token = jwt.sign(
      { schoolId: school.id, email: school.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      school: {
        id: school.id,
        name: school.name,
        email: school.email,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find school by email
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('email', email)
      .single();

    if (schoolError || !school) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, school.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { schoolId: school.id, email: school.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      school: {
        id: school.id,
        name: school.name,
        email: school.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await supabase
      .from('schools')
      .select('id', { count: 'exact' })
      .limit(1);

    const databaseHealthy = !dbHealth.error;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: databaseHealthy ? 'connected' : 'error',
      email: {
        configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        ready: emailReady,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'failed',
      email: {
        configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        ready: emailReady,
      },
      error: error.message,
    });
  }
});

// ============ STUDENT ROUTES ============

// Get all students for a school
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new student
app.post('/api/students', authenticateToken, async (req, res) => {
  try {
    const { name, class: className, parentEmail, rollNumber } = req.body;
    const barcode = `${req.user.schoolId}-STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { data: student, error } = await supabase
      .from('students')
      .insert([
        {
          school_id: req.user.schoolId,
          name,
          class: className,
          parent_email: parentEmail,
          roll_number: rollNumber,
          barcode,
          created_at: new Date(),
        }
      ])
      .select()
      .single();

    if (error) throw error;
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
app.put('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: student, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STAFF ROUTES ============

// helper to normalize DB records for the frontend
const normalizeStaffRecord = (rec) => {
  if (!rec) return rec;
  return {
    ...rec,
    secretCode: rec.secret_code || null,
  };
};

app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('staffs')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Auto-assign codes to Teachers without them
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const updates = [];
    
    for (const member of staff) {
      if (member.role === 'Teacher' && !member.secret_code) {
        const newCode = generateSecretCode();
        updates.push(
          supabase
            .from('staffs')
            .update({ secret_code: newCode })
            .eq('id', member.id)
            .then(() => {
              member.secret_code = newCode;
            })
            .catch(err => {
              console.warn(`Failed to update secret code for teacher ${member.id}:`, err.message);
            })
        );
      }
    }
    
    // Wait for all updates to complete
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    // normalize records for frontend (add camelCase secretCode)
    res.json(staff.map(normalizeStaffRecord));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { name, role, secretCode } = req.body;
    const barcode = `${req.user.schoolId}-STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Generate a secret code for Teachers if not provided
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const preservedSecretCode = role === 'Teacher' ? (secretCode || generateSecretCode()) : null;

    // only include secret_code when the role is Teacher
    const insertObj = {
      school_id: req.user.schoolId,
      name,
      role,
      barcode,
      created_at: new Date(),
    };
    if (preservedSecretCode) insertObj.secret_code = preservedSecretCode;

    // attempt to insert; if DB lacks secret_code column, retry without it
    let staff;
    try {
      const result = await supabase
        .from('staffs')
        .insert([insertObj])
        .select()
        .single();
      if (result.error) throw result.error;
      staff = result.data;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('secret_code')) {
        console.warn('Database does not have secret_code column, retrying without it');
        delete insertObj.secret_code;
        const retry = await supabase
          .from('staffs')
          .insert([insertObj])
          .select()
          .single();
        if (retry.error) throw retry.error;
        staff = retry.data;
      } else {
        throw err;
      }
    }

    // Ensure secretCode is in the response even if DB column doesn't exist
    const response = normalizeStaffRecord(staff);
    if (preservedSecretCode && !response.secretCode) {
      response.secretCode = preservedSecretCode;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, secretCode } = req.body;
    
    // First fetch the current staff member to get existing data
    const { data: currentStaff, error: fetchError } = await supabase
      .from('staffs')
      .select('*')
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .single();
    
    if (fetchError || !currentStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;

    // Handle secret code logic for Teachers
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const newRole = role || currentStaff.role;
    
    if (newRole === 'Teacher') {
      // If updating to Teacher role, use provided code, preserve existing, or generate new
      if (secretCode) {
        updates.secret_code = secretCode;
      } else if (!currentStaff.secret_code) {
        // No existing code and no new code provided, generate one
        updates.secret_code = generateSecretCode();
      }
      // If existing code exists and no new code provided, don't update (preserve it)
    } else {
      // If changing away from Teacher role, clear the code
      updates.secret_code = null;
    }

    // attempt update; if secret_code column is missing, retry without it
    let staff;
    try {
      const result = await supabase
        .from('staffs')
        .update(updates)
        .eq('id', id)
        .eq('school_id', req.user.schoolId)
        .select()
        .single();
      if (result.error) throw result.error;
      staff = result.data;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('secret_code')) {
        console.warn('Database does not have secret_code column, retrying without it');
        delete updates.secret_code;
        const retry = await supabase
          .from('staffs')
          .update(updates)
          .eq('id', id)
          .eq('school_id', req.user.schoolId)
          .select()
          .single();
        if (retry.error) throw retry.error;
        staff = retry.data;
      } else {
        throw err;
      }
    }

    // Ensure secretCode is in the response
    const response = normalizeStaffRecord(staff);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('staffs')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ NON-STAFF ROUTES ============

app.get('/api/non-staff', authenticateToken, async (req, res) => {
  try {
    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(nonStaff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/non-staff', authenticateToken, async (req, res) => {
  try {
    const { name, role } = req.body;
    const barcode = `${req.user.schoolId}-NONSTAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .insert([
        {
          school_id: req.user.schoolId,
          name,
          role,
          barcode,
          created_at: new Date(),
        }
      ])
      .select()
      .single();

    if (error) throw error;
    res.json(nonStaff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/non-staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .update(updates)
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(nonStaff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/non-staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('nonstaffs')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    res.json({ message: 'Non-staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ATTENDANCE ROUTES ============

// Mark attendance
app.post('/api/attendance/mark', authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.body;
    
    // Check in students table
    let { data: student } = await supabase
      .from('students')
      .select('id, name')
      .eq('barcode', barcode)
      .eq('school_id', req.user.schoolId)
      .single();

    let userType = 'student';
    let userId = student?.id;
    let userName = student?.name;

    if (!userId) {
      // Check in staffs table
      const { data: staff } = await supabase
        .from('staffs')
        .select('id, name')
        .eq('barcode', barcode)
        .eq('school_id', req.user.schoolId)
        .single();

      if (staff) {
        userId = staff.id;
        userName = staff.name;
        userType = 'staff';
      } else {
        // Check in non-staffs table
        const { data: nonStaff } = await supabase
          .from('nonstaffs')
          .select('id, name')
          .eq('barcode', barcode)
          .eq('school_id', req.user.schoolId)
          .single();

        if (nonStaff) {
          userId = nonStaff.id;
          userName = nonStaff.name;
          userType = 'non-staff';
        }
      }
    }

    if (!userId) {
      return res.status(404).json({ error: 'Invalid barcode' });
    }

    // Check if already marked today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('school_id', req.user.schoolId)
      .eq('user_type', userType)
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existingAttendance) {
      return res.status(400).json({ error: 'Attendance already marked for today' });
    }

    // Mark attendance
    const { data: attendance, error } = await supabase
      .from('attendance')
      .insert([
        {
          school_id: req.user.schoolId,
          user_type: userType,
          user_id: userId,
          date: today,
          timestamp: new Date().toISOString(),
          status: 'present',
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: `Attendance marked for ${userName}`,
      attendance,
      user: { name: userName, type: userType },
    });
  } catch (error) {
    console.error('Attendance marking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance records
app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const { date, type } = req.query;
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('school_id', req.user.schoolId);

    if (date) {
      query = query.eq('date', date);
    }
    if (type && type !== 'all') {
      query = query.eq('user_type', type);
    }

    const { data: attendance, error } = await query.order('timestamp', { ascending: false });

    if (error) throw error;

    // Enrich with user details
    const enrichedAttendance = await Promise.all(
      attendance.map(async (record) => {
        let table;
        switch (record.user_type) {
          case 'student':
            table = 'students';
            break;
          case 'staff':
            table = 'staffs';
            break;
          case 'non-staff':
            table = 'nonstaffs';
            break;
          default:
            return record;
        }

        const { data: user } = await supabase
          .from(table)
          .select('name, role, class')
          .eq('id', record.user_id)
          .single();

        return { ...record, user };
      })
    );

    res.json(enrichedAttendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance summary for today
app.get('/api/attendance/summary', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const requestedDate = req.query.date || today;
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;

    const [students, staff, nonStaff, attendance] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('attendance').select('user_type').eq('school_id', req.user.schoolId).eq('date', selectedDate),
    ]);

    const presentStudents = attendance.data?.filter(a => a.user_type === 'student').length || 0;
    const presentStaff = attendance.data?.filter(a => a.user_type === 'staff').length || 0;
    const presentNonStaff = attendance.data?.filter(a => a.user_type === 'non-staff').length || 0;

    res.json({
      date: selectedDate,
      students: {
        total: students.count || 0,
        present: presentStudents,
        percentage: students.count ? (presentStudents / students.count * 100).toFixed(2) : 0,
      },
      staff: {
        total: staff.count || 0,
        present: presentStaff,
        percentage: staff.count ? (presentStaff / staff.count * 100).toFixed(2) : 0,
      },
      nonStaff: {
        total: nonStaff.count || 0,
        present: presentNonStaff,
        percentage: nonStaff.count ? (presentNonStaff / nonStaff.count * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGES ROUTES ============

// Get messages for a school
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message with email functionality
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { senderName, senderRole, sendMode, recipients, individualRole, recipientEmail, message } = req.body;

    // Save message to database
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert([
        {
          school_id: req.user.schoolId,
          sender_name: senderName,
          sender_role: senderRole || 'Admin',
          send_mode: sendMode || 'Group',
          recipients: recipients || 'Parents',
          individual_role: individualRole,
          recipient_email: recipientEmail,
          message,
          created_at: new Date(),
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Send email if email service is configured and ready
    if (emailReady && emailTransporter) {
      const emailList = [];
      const defaultBroadcastEmail = process.env.BROADCAST_EMAIL || process.env.EMAIL_USER;

      if (sendMode === 'Individual' && recipientEmail) {
        emailList.push(recipientEmail);
      } else if (recipients === 'Parents') {
        emailList.push(process.env.PARENTS_EMAIL || defaultBroadcastEmail);
      } else if (recipients === 'Teachers') {
        emailList.push(process.env.TEACHERS_EMAIL || defaultBroadcastEmail);
      } else if (recipients === 'Staff') {
        emailList.push(process.env.STAFF_EMAIL || defaultBroadcastEmail);
      } else {
        emailList.push(defaultBroadcastEmail);
      }

      const validEmails = emailList.filter(Boolean);
      for (const toEmail of validEmails) {
        try {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `Message from ${senderName} (${senderRole})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #333; margin-top: 0;">New Message from School</h2>
                  <p><strong>From:</strong> ${senderName} (${senderRole})</p>
                  <p><strong>Recipient Group:</strong> ${recipients || 'Direct Message'}</p>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                  <div style="color: #555; line-height: 1.6;">
                    ${message.replace(/\n/g, '<br>')}
                  </div>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                  <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from Schootype School Management System</p>
                </div>
              </div>
            `,
            text: message,
          });
          console.log(`Email sent to ${toEmail}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${toEmail}:`, emailError.message);
        }
      }
    } else if (!emailTransporter) {
      console.debug('Email transporter not configured. Skipping email delivery.');
    }

    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply to message
app.post('/api/messages/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const { data: message, error } = await supabase
      .from('messages')
      .update({ reply, replied_at: new Date() })
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [students, staff, nonStaff, messages, attendance] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('messages').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId).is('reply', null),
      supabase.from('attendance').select('user_type').eq('school_id', req.user.schoolId).eq('date', new Date().toISOString().split('T')[0]),
    ]);

    res.json({
      totalStudents: students.count || 0,
      totalStaff: staff.count || 0,
      totalNonStaff: nonStaff.count || 0,
      unreadMessages: messages.count || 0,
      todayAttendance: attendance.data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple DB connectivity check before starting the server
const PORT = process.env.PORT || 5000;

async function initializeDatabase() {
  try {
    // Perform a lightweight test query to verify Supabase connectivity.
    const { data, error } = await supabase.from('schools').select('id').limit(1);
    if (error) {
      console.error('Database setup failed:', error.message || error);
      return false;
    }
    console.log('Database setup complete');
    return true;
  } catch (err) {
    console.error('Database setup failed:', err.message || err);
    return false;
  }
}

initializeDatabase().then((ok) => {
  if (ok) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    console.error('Aborting: database initialization failed. Server not started.');
    process.exit(1);
  }
});