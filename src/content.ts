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
  kicker: string
  // Provisional dates render with a "To be confirmed" tag. Flip to true once announced.
  confirmed: boolean
  startsAt: string
  durationHours: number
  venue: string
  address: string
  mapsUrl: string
  transport?: string
  blurb: string
}

export const finestWorship: Programme = {
  title: 'Finest Worship',
  kicker: 'Special programme',
  confirmed: true,
  startsAt: '2026-11-20T22:00:00+01:00',
  durationHours: 7,
  venue: 'GLT Campground',
  address: 'Ijebu-Ode Road, off Lagos-Ibadan Expressway, Ibadan, Oyo State',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=GLT+Campground+Ijebu-Ode+Road+Lagos-Ibadan+Expressway+Ibadan',
  transport: 'Transportation will be provided from Ile-Ife, so you don’t need to sort out your own way to Ibadan.',
  blurb:
    'A whole night of worship at the GLT Campground in Ibadan, from 10pm till 5am. No rush, no programme to get through: just songs, Scripture and a crowd of people who came to meet with God.',
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

// Placeholders from Unsplash (free licence). Swap for real GLT Ife photography.
export const images = {
  hero: { src: unsplash('1637615739656-ca10c4285c88'), alt: 'A congregation with hands raised in worship' },
  students: { src: unsplash('1655720348590-c739c860beed'), alt: 'Students with laptops sitting together on campus steps' },
  worship: { src: unsplash('1570786032462-2efc3ca8fccd'), alt: 'Hands raised under warm stage lights' },
  welcome: { src: unsplash('1604072424771-7300bc5de457'), alt: 'A family seated together in church pews' },
  visit: { src: unsplash('1648301033733-44554c74ec50'), alt: 'Friends talking together outside a building' },
}
