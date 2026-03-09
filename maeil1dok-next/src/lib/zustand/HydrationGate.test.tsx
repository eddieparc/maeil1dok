import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HydrationGate } from './HydrationGate'

describe('HydrationGate', () => {
  it('renders fallback first, then children after hydration effect', async () => {
    render(
      <HydrationGate fallback={<div>loading</div>}>
        <div>ready</div>
      </HydrationGate>
    )

    expect(screen.getByText('loading')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy()
    })
  })
})
