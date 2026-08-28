const getGoogleClientId = () =>
  String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export function getGoogleAuthConfig() {
  const clientId = getGoogleClientId();
  return {
    configured: Boolean(clientId),
    clientId: clientId || null,
  };
}

function googleError(message, status = 401, code = 'GOOGLE_AUTH_FAILED') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export async function verifyGoogleIdentity({ idToken, accessToken }) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw googleError('Google sign-in is not configured on the server.', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  if (idToken) {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken))}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error || data.error_description) {
      throw googleError(data.error_description || 'Google sign-in could not be verified.');
    }
    if (String(data.aud || '') !== clientId) {
      throw googleError('Google sign-in was issued for a different app.');
    }
    const verified = data.email_verified === true || data.email_verified === 'true';
    if (!verified || !data.email) {
      throw googleError('Your Google email is not verified.');
    }
    return {
      email: String(data.email).trim().toLowerCase(),
      name: String(data.name || '').trim() || null,
      picture: data.picture || null,
      sub: data.sub || null,
    };
  }

  if (accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${String(accessToken)}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw googleError(data.error_description || 'Google sign-in could not be verified.');
    }
    const verified = data.email_verified === true || data.email_verified === 'true';
    if (!verified || !data.email) {
      throw googleError('Your Google email is not verified.');
    }
    return {
      email: String(data.email).trim().toLowerCase(),
      name: String(data.name || '').trim() || null,
      picture: data.picture || null,
      sub: data.sub || null,
    };
  }

  throw googleError('Google sign-in token is missing.');
}
