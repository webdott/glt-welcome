# GLT Ile-Ife: Welcome

The landing page that welcomes freshers to God's Love Tabernacle, Ile-Ife. Built with TanStack Start.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build
```

## Editing content

Service times, programmes, contacts and photos all live in `src/content.ts`.

- **Finest Worship:** set `startsAt`, then set `confirmed: true` to remove the "To be confirmed" tag.
- **Photos:** the current images are free Unsplash placeholders. To use real GLT Ife photos, put them in `public/` and point `images` at them. Note that `ImageReveal` adds Unsplash resize parameters, so local files need that removed.

The "next gathering" countdown and "Add to calendar" files are worked out from `gatherings` in WAT. On the last Sunday of a month, SMS replaces both regular services.

## Deploying

Import the repo on Vercel. `vercel.json` already sets the TanStack Start framework preset, so you don't need any other configuration.
