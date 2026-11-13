import { createFileRoute } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { Header } from '#/components/Header'
import { Hero } from '#/components/Hero'
import { Closing, FirstSunday, Intro, Programmes, Visit, Week } from '#/components/Sections'
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
        <Week />
        <Programmes />
        <FirstSunday />
        <Visit />
      </main>
      <Closing />
    </MotionConfig>
  )
}
