import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import FloatingNav from '../FloatingNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/plan',
}))

describe('FloatingNav', () => {
  it('exposes common reading surfaces from the app chrome', () => {
    render(<FloatingNav userId="user-1" />)

    expect(screen.getByTestId('nav-calendar')).toHaveAttribute('href', '/calendar')
    expect(screen.getByTestId('nav-schedule')).toHaveAttribute('href', '/plan')
    expect(screen.getByTestId('nav-plans')).toHaveAttribute('href', '/plans')
    expect(screen.getByTestId('nav-bible')).toHaveAttribute('href', '/bible')
  })

  it('marks 통독표 active on the schedule table route', () => {
    render(<FloatingNav userId="user-1" />)

    const scheduleLink = screen.getByTestId('nav-schedule')

    expect(scheduleLink).toHaveAttribute('aria-current', 'page')
  })
})
