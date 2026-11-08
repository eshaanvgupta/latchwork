import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent } from 'undici';

export function isPublicAddress(input: string): boolean {
  const host = input.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (isIP(host) === 6) return /^[23][0-9a-f]{3}:/.test(host) && !host.startsWith('2001:db8:');
  return false;
}

export function isSafeUpstreamUrl(urlStr: string, allowLocalhost: boolean = false): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);

    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      return { safe: false, reason: 'Invalid protocol: only http and https are allowed' };
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Check Cloud metadata services
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
      return { safe: false, reason: 'Access to cloud metadata service is prohibited' };
    }

    if (!allowLocalhost) {
      if (isIP(host) && !isPublicAddress(host)) return { safe: false, reason: 'Private or reserved address prohibited' };
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
        return { safe: false, reason: 'Loopback address access is prohibited in production' };
      }

      // Check private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
      const ipParts = host.split('.').map(Number);
      if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p))) {
        if (ipParts[0] === 10) return { safe: false, reason: 'Private IP 10.0.0.0/8 prohibited' };
        if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31)
          return { safe: false, reason: 'Private IP 172.16.0.0/12 prohibited' };
        if (ipParts[0] === 192 && ipParts[1] === 168)
          return { safe: false, reason: 'Private IP 192.168.0.0/16 prohibited' };
      }
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: `Malformed URL: ${err.message}` };
  }
}

/** Validate all DNS answers, then pin the selected answer for this request. */
export async function upstreamDispatcher(url: URL, allowLocalhost = false) {
  const check = isSafeUpstreamUrl(url.toString(), allowLocalhost);
  if (!check.safe) throw new Error(check.reason);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const answers = await lookup(host, { all: true });
  if (!answers.length || (!allowLocalhost && answers.some(answer => !isPublicAddress(answer.address)))) {
    throw new Error('Upstream DNS resolves to a private or reserved address');
  }
  const answer = answers[0];
  return new Agent({ connect: { lookup: (_hostname, options: any, callback: any) => {
    if (options?.all) callback(null, [answer]);
    else callback(null, answer.address, answer.family);
  } } });
}

