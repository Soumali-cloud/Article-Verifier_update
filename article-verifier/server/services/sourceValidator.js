const trackingParameters = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_'])
const blockedHostnames = new Set(['localhost', 'localhost.localdomain'])

const isPrivateIpv4 = (hostname) => {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}

const isBlockedHostname = (hostname) => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return blockedHostnames.has(normalized) || normalized === '0.0.0.0' || normalized === '::1' || isPrivateIpv4(normalized) ||
    normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

export const normalizeSourceUrl = (value) => {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || isBlockedHostname(url.hostname)) return null
    for (const parameter of [...url.searchParams.keys()]) {
      if (parameter.toLowerCase().startsWith('utm_') || trackingParameters.has(parameter.toLowerCase())) url.searchParams.delete(parameter)
    }
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export const getDomain = (value) => {
  const normalized = normalizeSourceUrl(value)
  return normalized ? new URL(normalized).hostname.replace(/^www\./, '') : null
}
