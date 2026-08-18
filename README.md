# MAM Dev Tools

A fast, privacy-focused client-side developer utility for encoding, decoding, hashing, QR codes and file conversion — all running in the browser. No uploads: everything is processed locally.

Live demo: https://mam-dev-tools.github.io  
Preview: https://mam-dev-tools.github.io/preview.png

## Features

- Text encoding / decoding
  - Base64 (encode / decode)
  - Hex (encode / decode)
  - Binary (encode / decode)
- File ↔ Base64
  - Encode files to raw Base64 or Data URL
  - Decode Base64 / Data URL back to downloadable files with MIME detection
- Hash generator
  - SHA-256, SHA-384, SHA-512 for text or files
  - Verify expected hash
- QR code utilities (scan / generate)
- Dark / light theme toggle
- Client-side only — files and data are processed locally and are not uploaded

## Quick screenshot

![Preview](https://github.com/mam-dev-tools/mam-dev-tools.github.io/blob/main/preview.png)

## Built with

- Vue 3
- Vite
- Tailwind CSS
- html5-qrcode, jsqr, qr-code-styling (QR tooling)

See `package.json` for dependencies and scripts.

## Repository structure (important files)

- `index.html` — app entry
- `src/` — application source
  - `src/main.js` — app bootstrap
  - `src/App.vue` — main UI and tab navigation
  - `src/components/` — UI components
    - `FileEncoder.vue`, `Base64ToFile.vue`, `HashGenerator.vue`, `QRCodeTool.vue`, ...
  - `src/utils/` — utilities
    - `encoding.js` — Base64 / Hex / Binary text helpers
    - `fileEncoding.js` — file → base64 and base64 → file helpers (includes MIME detection and file-size limits)
- `preview.png` — repository preview image
- `package.json` — scripts and dependencies
- `postcss.config.js`, `tailwind.config.js`, `vite.config.js`

## File size limits

- File encoding: maximum supported size is 50 MB (see `src/utils/fileEncoding.js`).
- Hash generator has a configured maximum check (example: 100 MB in `HashGenerator.vue`), but browser memory and constraints may vary.

## Development

Requirements:
- Node.js (16+ recommended)
- npm or yarn

Install and run locally:

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev scripts come from `package.json`:
- `dev`: start Vite dev server
- `build`: build production assets
- `preview`: preview production build locally

## Deployment

This project can be deployed to GitHub Pages. Common approaches:
- Build (`npm run build`) and publish the `dist/` output using a `gh-pages` branch or a GitHub Action that deploys `dist/` to GitHub Pages.
- Alternatively configure Pages to serve from the `gh-pages` branch or `docs/` folder if you adapt the build output location.

Because the app is client-side, serving the static build (`index.html` + assets) is sufficient.

## Privacy & Security

- All processing (encoding, decoding, hashing, file handling) happens locally in the user's browser — files are not uploaded.
- Hashing is performed via the browser's SubtleCrypto API. Note: hashing is not encryption. Do not use these simple hashes for password storage — use a proper password hashing algorithm (Argon2, bcrypt, scrypt) for that purpose.

## Usage notes / Troubleshooting

- For large files, browser memory limits may cause failures; respect the maximum sizes and watch for out-of-memory issues.
- The code uses `btoa` / `atob` and ArrayBuffer conversions internally for binary-safe base64 handling.
- If you see invalid input errors when decoding, ensure the provided string contains only valid Base64 / Hex / Binary characters and appropriate padding.

## Contributing

- Bug reports, feature requests and PRs are welcome.
- Suggested workflow:
  1. Fork the repository
  2. Create a feature branch
  3. Open a pull request describing changes

Please include tests or manual steps to verify UI behavior where applicable.

## Tests

No automated tests are included in the repository at the moment.

## License

No LICENSE file was found in this repository. If you want others to reuse or contribute under a specific license, please add a `LICENSE` file (e.g., MIT, Apache-2.0).

## Acknowledgements

This project leverages open web APIs and libraries for QR and binary handling. See `package.json` for a list of dependencies (html5-qrcode, jsqr, qr-code-styling, Vue, Vite, Tailwind).

---

If you'd like, I can:
- Add this README file to the repository,
- Add a CONTRIBUTING.md or LICENSE file,
- Or produce a short GitHub Pages deployment workflow (GitHub Actions) to automatically publish the built `dist/`.