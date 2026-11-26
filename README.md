# GLT Ile-Ife: Welcome

The landing page that welcomes freshers to God's Love Tabernacle, Ile-Ife. Built with TanStack Start.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build
```

## Editing content

Service times, programmes, contacts and photos all live in `src/content.ts`.

- **Featured programme:** `featured` drives section 04 (currently the MOSHIA carol). Once it has passed, replace it with the next one; `transport`, `entry`, `ticket` and `doorsAt` are optional. Set `confirmed: false` to show a "To be confirmed" tag.
- **Logo:** the source is `brand/glt-ile-ife-logo.svg`. `pnpm social` swaps its bottom line for "ILE-IFE EXTENSION" (`scripts/logo.mjs`, which reuses the logo's own letters and draws the missing -, X and T), then writes the lockup to `public/brand/`, the favicons and the share images. The headers paint `public/brand/glt-ile-ife-extension.svg` in the text colour.
- **Photos:** paths starting with `/` are real GLT Ife photos, made by `pnpm gallery <folder>` from the `features` list in `scripts/gallery-picks.json` into `public/photos/<name>-<width>.webp`. The rest are still Unsplash placeholders.

The "next gathering" countdown and "Add to calendar" files are worked out from `gatherings` in WAT. On the last Sunday of a month, SMS replaces both regular services.

## Deploying

Import the repo on Vercel. `vercel.json` already sets the TanStack Start framework preset, so you don't need any other configuration.

## Study space (`/study`)

A study app for students, ported from Focus Garden with the owner's permission: study timetable, CGPA calculator (OAU 5-point scale), focus timer, Study Buddy and Progress. The homepage has a teaser section (`StudyTeaser`) that links into it.

- Logic lives in `src/study/*.ts` (timer, plan, cgpa, streak, buddy, files, sound); the interface is in `src/study/ui/`, styled by `study.css`, which only loads on `/study`.
- Everything is saved in the browser's localStorage on the student's device. There is no server or account.
- Study Buddy reads files on the device. pdf.js and mammoth are bundled but only load when a PDF or .docx is opened. The photo reader (Tesseract) fetches its engine and English language data from the jsDelivr CDN the first time a photo is read; the photo itself never leaves the device.

## Sharing and icons

- Share cards live in `public/og/` (`home.jpg`, `study.png`, 1200×630) and the favicons, app icons and `site.webmanifest` in `public/`. They're generated from `scripts/generate-social.mjs`; edit that and run `pnpm social` to change them.
- Share previews need absolute URLs. On Vercel the production domain is used automatically. If you add a custom domain, set `SITE_URL` (for example `https://gltife.org`) in the Vercel project's environment variables so previews and canonical links use it.
