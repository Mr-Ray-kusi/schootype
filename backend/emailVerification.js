import crypto from 'crypto';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createEmailVerificationToken() {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashEmailVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  return { rawToken, tokenHash, expiresAt };
}

export function hashEmailVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

export function getFrontendBaseUrl() {
  return String(process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function buildVerifyEmailUrl(rawToken) {
  return `${getFrontendBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export function isSchoolEmailVerified(school) {
  if (!school) return false;
  if (school.role === 'super_admin') return true;
  // Legacy / missing column: treat as verified so existing schools keep working
  if (school.email_verified === undefined || school.email_verified === null) return true;
  return school.email_verified === true;
}

/** Email-first signup pending password choice after magic link. */
export const PASSWORD_SETUP_MARKER = '__EMAIL_SETUP__';

export function needsPasswordSetup(school) {
  return Boolean(school) && school.initial_password === PASSWORD_SETUP_MARKER;
}

export function buildVerificationEmail({ schoolName, email, verifyUrl }) {
  const name = schoolName || 'your school';
  const subject = 'Create your Schooltype account';
  const text = [
    `Hi,`,
    ``,
    `Thanks for starting registration for ${name} on Schooltype.`,
    `Confirm this email address, then choose a password to finish creating your account:`,
    ``,
    verifyUrl,
    ``,
    `If you did not request this, you can ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Create your account</h2>
      <p>Thanks for starting registration for <strong>${escapeHtml(name)}</strong> on Schooltype.</p>
      <p>Confirm <strong>${escapeHtml(email)}</strong>, then choose a password to finish setup:</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">
          Continue with email
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Or copy this link:<br>${escapeHtml(verifyUrl)}</p>
      <p style="font-size: 13px; color: #64748b;">This link expires in 24 hours.</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
