// Public URLs are embedded at build time; set these before building a hosted UI.
const preview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === 'true';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || (preview ? '' : 'http://127.0.0.1:4000');
export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || (preview ? '' : 'http://127.0.0.1:4001');
export const MONITOR_URL = process.env.NEXT_PUBLIC_MONITOR_URL || (preview ? '' : 'http://127.0.0.1:4003');
export const TEST_SERVICE_URL = process.env.NEXT_PUBLIC_TEST_SERVICE_URL || (preview ? '' : 'http://127.0.0.1:4002');

export async function apiRequest(path: string, options: RequestInit = {}, token = '') {
  if (!API_URL) throw new Error('This preview has no backend configured. Run the local stack or rebuild with NEXT_PUBLIC_API_URL.');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
