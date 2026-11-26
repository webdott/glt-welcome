import { createFileRoute } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { Header } from '#/components/Header'
import { Gallery } from '#/components/Gallery'
import { Hero } from '#/components/Hero'
import { Closing, FirstSunday, Intro, Programmes, Visit, Week } from '#/components/Sections'
import { StudyTeaser } from '#/components/StudyTeaser'
import { SmoothScroll } from '#/components/SmoothScroll'

export const Route = createFileRoute('/')({ component: Home })

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
