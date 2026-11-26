// Everything a church admin is likely to change lives in this file.
// Service details come from glt.church/extensions (Ile-Ife entry), Nov 2026.

export const church = {
  name: "God's Love Tabernacle",
  branch: 'Ile-Ife',
  address: 'Ibadan Road, Ile-Ife, Osun State',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=God%27s+Love+Tabernacle+Ibadan+Road+Ile-Ife',
  phone: '+234 906 280 7060',
  email: 'gltife2021@gmail.com',
  pastors: 'Pastor Tayo & Pastor Olamide Akanbi',
  hq: 'https://www.glt.church',
  sister: {
    name: 'GLT Phase 2, OAUTHC',
    address: 'Famous Hall, Famous Shopping Complex, opposite OAUTHC Phase 2 gate',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Famous+Shopping+Complex+OAUTHC+Phase+2+Ile-Ife',
  },
}

export type Gathering = {
  id: string
  day: string
  name: string
  start: string
  end: string
  note: string
  recurrence: 'weekly-sun' | 'weekly-wed' | 'last-sun'
}

export const gatherings: Gathering[] = [
  {
    id: 'first-service',
    day: 'Sunday',
    name: 'First Service',
    start: '08:00',
    end: '09:50',
    note: 'Worship and the Word, early. A good one if you have a long Sunday ahead.',
    recurrence: 'weekly-sun',
  },
  {
    id: 'second-service',
    day: 'Sunday',
    name: 'Second Service',
    start: '10:00',
    end: '12:00',
    note: 'Same Word, a later start, for when the first one comes too early.',
    recurrence: 'weekly-sun',
  },
  {
    id: 'bible-study',
    day: 'Wednesday',
    name: 'Bible Study',
    start: '17:30',
    end: '19:30',
    note: 'Midweek, after lectures. The Word taught with simplicity and clarity. Bring your Bible and your questions.',
    recurrence: 'weekly-wed',
  },
  {
    id: 'sms',
    day: 'Last Sunday',
    name: 'Special Miracle Service',
    start: '08:00',
    end: '11:00',
    note: 'One combined service of worship, the Word and the working of miracles. Come expectant, and bring someone who needs a touch from God.',
    recurrence: 'last-sun',
  },
]

export type Programme = {
  title: string
  subtitle?: string
  kicker: string
  // Provisional dates render with a "To be confirmed" tag. Flip to true once announced.
  confirmed: boolean
  startsAt: string
  doorsAt?: string
  durationHours: number
  venue: string
  address: string
  mapsUrl: string
  transport?: string
  entry?: string
  ticket?: { label: string; href: string }
  website?: string
  blurb: string
  image: { src: string; alt: string }
}

// The programme featured on the homepage. Swap it out once it has passed.
export const featured: Programme = {
  title: 'Moshia',
  subtitle: 'The Saviour Is Born',
  kicker: 'Christmas carol · A theatre experience',
  confirmed: true,
  startsAt: '2026-12-18T16:00:00+01:00',
  doorsAt: '2026-12-18T15:15:00+01:00',
  durationHours: 4,
  venue: 'The Amphitheatre, OAU',
  address: 'Obafemi Awolowo University campus, Ile-Ife',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Amphitheatre+Obafemi+Awolowo+University+Ile-Ife',
  entry: 'Entry is free, but seats are limited. Register and your ticket lands in your email straight away. When seats run out, registrations go to a waitlist.',
  ticket: { label: 'Get your free ticket', href: 'https://moshia.gltifeevents.com/register' },
  website: 'https://moshia.gltifeevents.com',
  blurb:
    'Our Christmas carol, staged like a film and sung like a carol service. MOSHIA, Hebrew for “Saviour”, tells the story of the promised King, with choirs, candles and the carols everyone knows by heart.',
  image: {
    src: 'https://images.unsplash.com/photo-1765194493210-e2fb1c61a941',
    alt: 'A nativity scene of Mary, the wise men and the manger beside a Christmas tree in lights',
  },
}

export const firstSunday = [
  {
    title: 'Find your way',
    body: 'On Sunday mornings, a bus picks up from the AngloMoz car park on campus between 8 and 9am. Making your own way? We’re on Ibadan Road, Ile-Ife; tap “Get directions” below.',
  },
  {
    title: 'Come a little early',
    body: 'Aim for ten minutes before eight or ten. An usher will meet you at the door and find you a seat.',
  },
  {
    title: 'Come as you are',
    body: 'No dress code and no pressure to know the songs. Bring a Bible if you have one; someone will share if you don’t.',
  },
  {
    title: 'Stay and say hello',
    body: 'After service, find a pastor or usher. We’d love to know your name, your department and your hall.',
  },
]

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`

// Paths starting with / are real GLT Ife photos from public/photos; the rest are Unsplash placeholders.
export const images = {
  hero: { src: unsplash('1637615739656-ca10c4285c88'), alt: 'A congregation with hands raised in worship' },
  students: { src: unsplash('1655720348590-c739c860beed'), alt: 'Students with laptops sitting together on campus steps' },
  welcome: { src: '/photos/pastor', alt: 'A GLT Ile-Ife pastor smiling as he preaches, microphone in hand' },
  visit: { src: unsplash('1648301033733-44554c74ec50'), alt: 'Friends talking together outside a building' },
}
