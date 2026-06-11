import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import QuickAccessGrid from '../QuickAccessGrid'

describe('QuickAccessGrid', () => {
  it('routes 통독표 to the schedule table without showing 플랜 관리 inside that card', () => {
    render(<QuickAccessGrid userId="user-1" />)

    const planCard = screen.getByTestId('card-plan')

    expect(planCard).toHaveAttribute('href', '/plan')
    expect(within(planCard).getByText('통독표')).toBeVisible()
    expect(within(planCard).queryByText('플랜 관리')).toBeNull()
  })

  it('routes 플랜 관리 to plan subscription management as a separate card', () => {
    render(<QuickAccessGrid userId="user-1" />)

    const plansCard = screen.getByTestId('card-plans')

    expect(plansCard).toHaveAttribute('href', '/plans')
    expect(within(plansCard).getByText('플랜 관리')).toBeVisible()
  })
})
