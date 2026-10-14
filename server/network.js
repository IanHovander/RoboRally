import os from 'node:os';

/**
 * Find this computer's addresses on the local network, best guess first.
 * Phones on the same Wi-Fi use one of these to reach the server.
 */
export function lanAddresses() {
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue; // loopback / no DHCP
      found.push({ name, address: a.address, score: score(name, a.address) });
    }
  }
  return found.sort((a, b) => b.score - a.score);
}

/**
 * Did this connection come from this computer or the local network (rather than from the
 * internet through a tunnel)? Tunnels such as cloudflared connect from this computer itself,
 * but they add forwarding headers, so those count as the internet.
 */
export function isLocalNetwork(address, headers = {}) {
  if (headers['cf-connecting-ip'] || headers['x-forwarded-for'] || headers.forwarded) return false;
  const ip = String(address ?? '').replace(/^::ffff:/i, '');
  return (
    ip === '::1' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || // Tailscale and similar
    /^f[cd][0-9a-f]{2}:/i.test(ip) || // private IPv6
    /^fe80:/i.test(ip) // link-local IPv6
  );
}

function score(name, ip) {
  let s = 0;
  if (ip.startsWith('192.168.')) s += 3;
  else if (ip.startsWith('10.')) s += 2;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) s += 1;
  if (/wi-?fi|wlan|wireless|ethernet|^en\d|^eth\d/i.test(name)) s += 2;
  // Virtual adapters (VMs, WSL, Docker, VPNs) are almost never what phones can reach.
  if (/vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|tailscale|zerotier|hamachi|loopback|bluetooth/i.test(name)) s -= 10;
  return s;
}
