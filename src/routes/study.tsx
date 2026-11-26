import { createFileRoute } from '@tanstack/react-router'
import { StudyApp } from '#/study/ui/StudyApp'
import { TABS } from '#/study/ui/context'
import type { Tab } from '#/study/ui/context'
import studyCss from '#/study/ui/study.css?url'
import { pageHead } from '#/site'

export const Route = createFileRoute('/study')({
  // Optional so /study itself loads without a redirect; it opens on the timetable.
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    (TABS as readonly string[]).includes(search.tab as string) ? { tab: search.tab as Tab } : {},
  head: () => {
    const head = pageHead({
      title: 'Study space · GLT Ile-Ife',
      description: 'A free study space for OAU students: plan a month of study, calculate your CGPA, focus with a timer and turn your notes into revision packs.',
      path: '/study',
      image: { path: '/og/study.png', type: 'image/png' },
      imageAlt: 'Your semester, organised. Timetable, CGPA, focus timer, Study Buddy and progress.',
    })
    return { ...head, links: [...head.links, { rel: 'stylesheet', href: studyCss }] }
  },
  component: StudyPage,
})

function StudyPage() {
  const { tab = 'timetable' } = Route.useSearch()
  return <StudyApp tab={tab} />
}
