# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a problem

Please report security problems privately, not in a public issue:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** and describe what you found and how to reproduce it.

You can expect an acknowledgement within a week. If the report is confirmed, a fix will be released and you will be credited in the changelog unless you prefer otherwise.

## What Dammer is designed to prevent

Dammer was written because auto-refresh extensions have repeatedly been used to deliver ad injection and tracking. Its design limits what it could do even if it had a bug:

- **No network access.** The content security policy sets `connect-src 'none'`. `npm run check` fails if `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` or `new Function` appear in the extension.
- **No remote code.** Every script ships in the package. There is no update channel other than installing a new release.
- **No access to page content.** There are no content scripts, no host permissions and no `scripting` permission.
- **No messages from outside.** The extension does not accept messages from web pages or other extensions, and the service worker rejects any message that does not come from its own popup.
- **Page data is treated as text.** Tab titles and addresses come from web pages and are only ever inserted with `textContent`.
- **Stored addresses are trimmed.** Query strings and fragments are removed before an address is saved.
- **No dependencies.** There is no `node_modules` and no build step that could be tampered with.

The permissions and the reason for each are listed in [docs/guide/PERMISSIONS.md](docs/guide/PERMISSIONS.md).

## Verifying a release

The release zip is built by a GitHub Actions workflow from the tagged commit ([release.yml](.github/workflows/release.yml)). You can rebuild it yourself with `npm run build` and compare the contents with `unzip -l`.
