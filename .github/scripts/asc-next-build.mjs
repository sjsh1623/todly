// Prints the next iOS build number (highest existing TestFlight/App Store build
// number for the app + 1) so each CI upload is a unique, increasing version.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (PEM contents), ASC_APP_ID.
// Output: a single integer on stdout. Falls back to 1 when the app has no builds.
import crypto from 'node:crypto'

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, ASC_APP_ID } = process.env
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_P8 || !ASC_APP_ID) {
  console.error('missing ASC_* env')
  process.exit(1)
}

const b64u = (b) =>
  Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }
  const input = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(payload))
  const sig = crypto.sign('sha256', Buffer.from(input), { key: ASC_KEY_P8, dsaEncoding: 'ieee-p1363' })
  return input + '.' + b64u(sig)
}

const res = await fetch(
  `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${ASC_APP_ID}&limit=200&fields[builds]=version`,
  { headers: { Authorization: 'Bearer ' + jwt() } },
)
if (!res.ok) {
  console.error('ASC builds query failed', res.status, await res.text())
  process.exit(1)
}
const json = await res.json()
let max = 0
for (const b of json.data || []) {
  const n = parseInt(b.attributes?.version ?? '0', 10)
  if (Number.isFinite(n) && n > max) max = n
}
process.stdout.write(String(max + 1))
