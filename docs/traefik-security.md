# Traefik security

The Compose backend now has `traefik.enable=false`. The homelab Anubis router
for `flags.betz.coffee` is the sole public route, targeting `flag-quiz:3000`.
Deploy the homelab security changes first, then recreate the quiz container to
remove its old router. When Anubis is unavailable the app must remain inaccessible,
never fall back to the backend. If changing `FLAG_DOMAIN`, update the central
Anubis hostname too. Existing local development access is unchanged.

Cloudflare must preserve `CF-Connecting-IP`; do not enable the Remove visitor IP
headers transform. For IPv6 visitor identities use Pseudo IPv4 Off or Add Header,
not Overwrite Headers. Peer allowlists must match https://www.cloudflare.com/ips/.
Direct origin/LAN requests to these public routers are rejected, even with forged
Cloudflare headers. Use the Cloudflare public hostname or a separate internal
route. Missing visitor headers share an empty-header rate bucket rather than
being assigned to a Cloudflare edge bucket.

This policy does not enable Authenticated Origin Pulls/mTLS; server certificates
and Cloudflare peer allowlists are distinct controls. Application authorization
remains necessary. Clients sharing a public IP also share a proxy rate budget.

Changes are prepared on a security branch to avoid automatically deploying to
production. Merge/deploy only after the shared homelab middlewares are available
(where used), then recreate the affected containers. Check normal browser/app
access, existing authentication and unexpected 403/429 responses. These are
request limits, not bandwidth or volumetric DDoS protection.
