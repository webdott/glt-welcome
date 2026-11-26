import { createFileRoute } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { Header } from '#/components/Header'
import { Gallery } from '#/components/Gallery'
import { Hero } from '#/components/Hero'
import { Closing, FirstSunday, Intro, Programmes, Visit, Week } from '#/components/Sections'
import { StudyTeaser } from '#/components/StudyTeaser'
import { SmoothScroll } from '#/components/SmoothScroll'
import { pageHead } from '#/site'

export const Route = createFileRoute('/')({
  head: () =>
    pageHead({
      title: 'GLT Ile-Ife · Welcome home, fresher',
      description:
        'God’s Love Tabernacle, Ile-Ife. A church family of OAU students on Ibadan Road. Sundays 8:00am & 10:00am, Bible Study Wednesdays 5:30pm.',
      path: '/',
      image: { path: '/og/home.jpg', type: 'image/jpeg' },
      imageAlt: 'Welcome home, fresher. A GLT Ile-Ife member holding a Home Found sign.',
    }),
  component: Home,
})

function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <Header />
      <main>
        <Hero />
        <Intro />
        <Gallery />
        <Week />
        <Programmes />
        <FirstSunday />
        <StudyTeaser />
        <Visit />
      </main>
      <Closing />
    </MotionConfig>
  )
}
