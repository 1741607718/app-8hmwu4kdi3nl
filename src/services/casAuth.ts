const CAS_SERVER_URL = import.meta.env.VITE_CAS_SERVER_URL;
const CAS_CALLBACK_URL = import.meta.env.VITE_CAS_CALLBACK_URL;
const CAS_CLIENT_ID = import.meta.env.VITE_CAS_CLIENT_ID;

const isDingTalk = /DingTalk|aliapp|ARM64/i.test(navigator.userAgent);

function setCookie(name: string, value: string, days = 7): void {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

export function redirectToCASLogin() {
  const state = generateRandomState();

  localStorage.setItem('cas_state', state);
  sessionStorage.setItem('cas_state', state);
  setCookie('cas_state', state, 1);

  const redirectUri = CAS_CALLBACK_URL || `${window.location.origin}/auth/callback`;
  const serverUrl = CAS_SERVER_URL || 'https://cas.wzbc.edu.cn';
  const clientId = CAS_CLIENT_ID;

  if (!clientId) {
    alert('系统未正确配置CAS登录参数，请联系管理员');
    return;
  }

  let baseUrl = serverUrl;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  if (!baseUrl.endsWith('/cas') && !baseUrl.includes('/cas/')) {
    baseUrl = `${baseUrl}/cas`;
  }

  const authUrl = new URL(`${baseUrl}/oauth2.0/authorize`);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('state', state);

  window.location.href = authUrl.toString();
}

export function casLogout() {
  const serverUrl = CAS_SERVER_URL || 'https://cas.wzbc.edu.cn';

  let baseUrl = serverUrl;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  if (!baseUrl.endsWith('/cas') && !baseUrl.includes('/cas/')) {
    baseUrl = `${baseUrl}/cas`;
  }

  const logoutUrl = new URL(`${baseUrl}/logout`);
  logoutUrl.searchParams.set('service', window.location.origin);

  if (isDingTalk) {
    setTimeout(() => {
      window.location.href = logoutUrl.toString();
    }, 100);
  } else {
    window.location.href = logoutUrl.toString();
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
