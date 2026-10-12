# Contributing

Thanks for wanting to help. Dammer is deliberately small, so the bar for adding things is high and the bar for fixing things is low.

## Ground rules

Changes will not be accepted if they:

- add network requests, analytics, remote configuration or remote code;
- add content scripts or host permissions, or otherwise let the extension read page content;
- simulate a person (mouse movement, scrolling, typing, solving challenges);
- add a runtime dependency or a build step.

A new permission needs a strong reason and an update to [PRIVACY.md](PRIVACY.md) and [docs/guide/PERMISSIONS.md](docs/guide/PERMISSIONS.md).

## Getting set up

1. Clone the repository.
2. Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose the `extension/` folder.
3. After changing the popup, close and reopen it. After changing `src/`, click the reload arrow on the extension's card.

## Before opening a pull request

```bash
npm run check
```

```bash
npm test
```

`npm test` needs Node 22 or newer, Google Chrome and `openssl`. It opens Chrome with a temporary profile, so it does not touch your own. Set `CHROME=/path/to/chrome` if Chrome is installed somewhere unusual. See [docs/guide/TESTING.md](docs/guide/TESTING.md).

If you change how something looks, the test run retakes the screenshots in `docs/screenshots/`; commit them with your change.

## Style

- Match the surrounding code: plain modern JavaScript, two-space indentation, single quotes, no frameworks.
- Comments explain why, not what.
- User-facing text is short. Labels, not sentences.
- Add a line to [CHANGELOG.md](CHANGELOG.md).

## Reporting bugs and ideas

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead.

By contributing you agree that your work is released under the [MIT License](LICENSE), and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
