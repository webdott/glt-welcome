import { createFileRoute } from '@tanstack/react-router'
import { StudyApp } from '#/study/ui/StudyApp'
import { TABS } from '#/study/ui/context'
import type { Tab } from '#/study/ui/context'
import studyCss from '#/study/ui/study.css?url'

export const Route = createFileRoute('/study')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: (TABS as readonly string[]).includes(search.tab as string) ? (search.tab as Tab) : 'timetable',
  }),
  head: () => ({
    meta: [
      { title: 'Study space · GLT Ile-Ife' },
      {
        name: 'description',
        content: 'A free study space for OAU students: plan a month of study, calculate your CGPA, focus with a timer and turn your notes into revision packs.',
      },
    ],
    links: [{ rel: 'stylesheet', href: studyCss }],
  }),
  component: StudyPage,
})

function StudyPage() {
  const { tab } = Route.useSearch()
  return <StudyApp tab={tab} />
}
