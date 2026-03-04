const TOKEN_KEY = "clockedInToken";

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(extraHeaders = {}) {
  const token = getToken();
  if (!token) return extraHeaders;

  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`
  };
}
