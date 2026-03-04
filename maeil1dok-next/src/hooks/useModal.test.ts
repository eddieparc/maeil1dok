import React, { useState } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ModalHost } from '../components/ui/modal/ModalHost'
import { useModal } from './useModal'

function TestHarness() {
  const modal = useModal()
  const [confirmResult, setConfirmResult] = useState('pending')
  const [alertResult, setAlertResult] = useState('pending')
  const [stackResult, setStackResult] = useState('pending')

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ModalHost),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: async () => {
          const result = await modal.confirm({
            title: '삭제할까요?',
            description: '이 작업은 되돌릴 수 없습니다.',
            icon: 'warning',
          })
          setConfirmResult(result ? 'true' : 'false')
        },
      },
      'open-confirm',
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: async () => {
          await modal.alert({
            title: '알림',
            description: '저장되었습니다.',
            icon: 'success',
          })
          setAlertResult('done')
        },
      },
      'open-alert',
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: async () => {
          const confirmPromise = modal.confirm({
            title: '첫 번째 모달',
            description: '아래에 남아있어야 합니다.',
          })

          const alertPromise = modal.alert({
            title: '두 번째 모달',
            description: '스택 최상단 모달입니다.',
          })

          await alertPromise
          const confirmValue = await confirmPromise
          setStackResult(confirmValue ? 'true' : 'false')
        },
      },
      'open-stack',
    ),
    React.createElement('output', { 'data-testid': 'confirm-result' }, confirmResult),
    React.createElement('output', { 'data-testid': 'alert-result' }, alertResult),
    React.createElement('output', { 'data-testid': 'stack-result' }, stackResult),
  )
}

function cleanupStack() {
  const { result, unmount } = renderHook(() => useModal())

  act(() => {
    while (result.current.stack.length > 0) {
      result.current.close(result.current.stack[result.current.stack.length - 1].id)
    }
  })

  unmount()
}

afterEach(() => {
  cleanupStack()
})

describe('useModal', () => {
  it('confirm resolves true when confirmed', async () => {
    render(React.createElement(TestHarness))

    fireEvent.click(screen.getByText('open-confirm'))
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result').textContent).toBe('true')
    })
  })

  it('confirm resolves false when cancelled', async () => {
    render(React.createElement(TestHarness))

    fireEvent.click(screen.getByText('open-confirm'))
    fireEvent.click(await screen.findByTestId('confirm-modal-cancel'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result').textContent).toBe('false')
    })
  })

  it('alert resolves void after confirm', async () => {
    render(React.createElement(TestHarness))

    fireEvent.click(screen.getByText('open-alert'))
    fireEvent.click(await screen.findByTestId('alert-modal-confirm'))

    await waitFor(() => {
      expect(screen.getByTestId('alert-result').textContent).toBe('done')
    })
  })

  it('supports stacking and closes top modal first', async () => {
    render(React.createElement(TestHarness))

    fireEvent.click(screen.getByText('open-stack'))

    await waitFor(() => {
      expect(screen.getAllByTestId('modal-content').length).toBe(2)
    })

    fireEvent.click(screen.getByTestId('alert-modal-confirm'))

    await waitFor(() => {
      expect(Boolean(screen.queryByText('첫 번째 모달'))).toBe(true)
    })

    fireEvent.click(screen.getByTestId('confirm-modal-cancel'))

    await waitFor(() => {
      expect(screen.getByTestId('stack-result').textContent).toBe('false')
    })
  })
})
