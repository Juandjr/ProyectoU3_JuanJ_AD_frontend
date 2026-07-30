export function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export function isJwtValid(token: string | null): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload !== 'object') return false;
  const exp = Number(payload.exp || 0);
  return exp > 0 && exp * 1000 > Date.now();
}

export function isJwtExpiringSoon(token: string | null, windowMs = 5 * 60 * 1000): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload !== 'object') return false;
  const exp = Number(payload.exp || 0);
  if (!exp) return false;
  return exp * 1000 <= Date.now() + windowMs;
}

export function clearJwt() {
  localStorage.removeItem('jwt');
}
