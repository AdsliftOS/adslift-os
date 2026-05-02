// Shared helpers for Revolut Business API auth (Deno / Edge Runtime).

const REVOLUT_TOKEN_URL = "https://b2b.revolut.com/api/1.0/auth/token";
const REVOLUT_API_BASE = "https://b2b.revolut.com/api/1.0";
const JWT_AUDIENCE = "https://revolut.com";
// must match the CN in the certificate uploaded to Revolut
const JWT_ISSUER = "adslift.app";

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(stripped);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function buildClientAssertionJwt(
  clientId: string,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: JWT_ISSUER,
    sub: clientId,
    aud: JWT_AUDIENCE,
    exp: now + 60 * 30, // 30 minutes
    iat: now,
  };
  const encoder = new TextEncoder();
  const headerB64 = b64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(signature)}`;
}

export type RevolutTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
};

export async function exchangeAuthCode(params: {
  clientId: string;
  privateKeyPem: string;
  code: string;
}): Promise<RevolutTokenResponse> {
  const assertion = await buildClientAssertionJwt(params.clientId, params.privateKeyPem);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    client_id: params.clientId,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const res = await fetch(REVOLUT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Revolut token exchange failed (${res.status}): ${t}`);
  }
  return await res.json();
}

export async function refreshAccessToken(params: {
  clientId: string;
  privateKeyPem: string;
  refreshToken: string;
}): Promise<RevolutTokenResponse> {
  const assertion = await buildClientAssertionJwt(params.clientId, params.privateKeyPem);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const res = await fetch(REVOLUT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Revolut token refresh failed (${res.status}): ${t}`);
  }
  return await res.json();
}

export async function fetchTransactions(params: {
  accessToken: string;
  fromIso?: string;
  toIso?: string;
  count?: number;
}): Promise<any[]> {
  const url = new URL(`${REVOLUT_API_BASE}/transactions`);
  if (params.fromIso) url.searchParams.set("from", params.fromIso);
  if (params.toIso) url.searchParams.set("to", params.toIso);
  url.searchParams.set("count", String(params.count ?? 1000));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Revolut transactions fetch failed (${res.status}): ${t}`);
  }
  return await res.json();
}

export const REVOLUT = {
  TOKEN_URL: REVOLUT_TOKEN_URL,
  API_BASE: REVOLUT_API_BASE,
  AUTH_URL: "https://business.revolut.com/app-confirm",
};
