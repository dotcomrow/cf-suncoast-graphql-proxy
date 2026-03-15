function normalizeIpToken(value) {
  if (!value) {
    return undefined;
  }

  let token = String(value).trim();
  if (!token) {
    return undefined;
  }

  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1).trim();
  }

  if (token.startsWith("[") && token.includes("]")) {
    token = token.slice(1, token.indexOf("]"));
  }

  if (!token || token === "-" || token.toLowerCase() === "unknown") {
    return undefined;
  }

  const ipv4WithPort = token.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    token = ipv4WithPort[1];
  }

  const zoneIndex = token.indexOf("%");
  if (zoneIndex > 0) {
    token = token.slice(0, zoneIndex);
  }

  return token || undefined;
}

function formatForwardedFor(clientIp) {
  if (clientIp.includes(":")) {
    return `"[${
      clientIp.replace(/["\\]/g, "")
    }]"`;
  }

  return clientIp;
}

function resolveTrustedClientIp(request) {
  return normalizeIpToken(request.headers.get("CF-Connecting-IP"));
}

export function applyClientIpHeaders(request, headers) {
  const clientIp = resolveTrustedClientIp(request);
  if (!clientIp) {
    return;
  }

  headers.set("X-Client-IP", clientIp);
  headers.set("X-Real-IP", clientIp);
  headers.set("CF-Connecting-IP", clientIp);
  headers.set("True-Client-IP", clientIp);
  headers.set("X-Forwarded-For", clientIp);
  headers.set("Forwarded", `for=${formatForwardedFor(clientIp)}`);
}
