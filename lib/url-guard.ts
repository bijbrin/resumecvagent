import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Blocks SSRF: rejects non-http(s) URLs, private/loopback/link-local IPs, and
 * hostnames that resolve to them. Used before any user-supplied URL is handed
 * to Firecrawl or fetched directly (job-scraper extract/detail routes).
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 0) return true; // "this network"
  if (a === 100 && b >= 64 && b <= 127) return true; // shared address space (CGNAT)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower === "::") return true; // unspecified
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 address — check the embedded IPv4.
    const v4 = lower.slice("::ffff:".length);
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return false;
}

export interface UrlGuardResult {
  ok: boolean;
  error?: string;
}

/**
 * Validates that `rawUrl` is safe to fetch server-side: http(s) only, and
 * neither the literal host nor its resolved IPs land in a private/loopback/
 * link-local range. Does not restrict to a domain allowlist — any public
 * hostname is allowed.
 */
export async function assertSafeUrl(rawUrl: string): Promise<UrlGuardResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http/https URLs are allowed." };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, error: "That URL is not allowed." };
  }

  // If the hostname is itself a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { ok: false, error: "That URL is not allowed." };
    }
    return { ok: true };
  }

  // Resolve the hostname and reject if any address is private — blocks DNS
  // rebinding to internal/cloud-metadata addresses.
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      return { ok: false, error: "Could not resolve that hostname." };
    }
    if (records.some((r) => isPrivateIp(r.address))) {
      return { ok: false, error: "That URL is not allowed." };
    }
  } catch {
    return { ok: false, error: "Could not resolve that hostname." };
  }

  return { ok: true };
}
