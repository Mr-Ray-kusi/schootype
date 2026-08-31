export const ATTENDANCE_TIMEZONE = 'Africa/Accra';

export function schoolLocalDate(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: ATTENDANCE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // fall back to UTC
  }
  return date.toISOString().split('T')[0];
}

export function schoolLocalDateLabel(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: ATTENDANCE_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return schoolLocalDate(date);
  }
}
