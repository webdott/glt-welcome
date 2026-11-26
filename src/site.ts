// Set at build time in vite.config.ts. Share previews need absolute URLs.
declare const __SITE_URL__: string

export const SITE_URL = __SITE_URL__
export const SITE_NAME = 'GLT Ile-Ife'

/** Title, description, canonical URL and the Open Graph / Twitter card tags for one page. */
export function pageHead({
  title,
  description,
  path,
  image,
  imageAlt,
}: {
  title: string
  description: string
  path: string
  image: { path: string; type: string }
  imageAlt: string
}) {
  const url = `${SITE_URL}${path}`
  const imageUrl = `${SITE_URL}${image.path}`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:secure_url', content: imageUrl },
      { property: 'og:image:type', content: image.type },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: imageAlt },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
      { name: 'twitter:image:alt', content: imageAlt },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
