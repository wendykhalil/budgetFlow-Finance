import React from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useToast } from '@/components/ui/Toast'

describe('useToast', () => {
  it('keeps notification callbacks stable between renders', () => {
    const { result, rerender } = renderHook(() => useToast())
    const showToast = result.current.showToast
    const hideToast = result.current.hideToast

    rerender()

    expect(result.current.showToast).toBe(showToast)
    expect(result.current.hideToast).toBe(hideToast)
  })

  it('does not restart a toast timer when its parent rerenders', () => {
    vi.useFakeTimers()
    const hooks = {}

    function ToastHarness() {
      const { showToast, ToastComponent } = useToast()
      const [count, setCount] = React.useState(0)
      hooks.showToast = showToast
      return (
        <div>
          <button onClick={() => setCount((current) => current + 1)}>Rerender {count}</button>
          {ToastComponent}
        </div>
      )
    }

    const view = render(<ToastHarness />)
    act(() => hooks.showToast('Saved'))
    expect(screen.getByText('Saved')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1500))
    fireEvent.click(screen.getByText('Rerender 0'))
    act(() => vi.advanceTimersByTime(1000))

    expect(screen.queryByText('Saved')).toBeNull()
    view.unmount()
    vi.useRealTimers()
  })
})
