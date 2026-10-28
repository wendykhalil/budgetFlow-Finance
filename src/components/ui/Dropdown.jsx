import { useState, useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

export function Dropdown({ trigger, items, placement = 'bottom-right', label = 'More options' }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (open && !e.target?.closest('[data-dropdown]')) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const placements = {
    'top-right': 'bottom-full right-0 mb-2',
    'top-left': 'bottom-full left-0 mb-2',
    'bottom-right': 'top-full right-0 mt-2',
    'bottom-left': 'top-full left-0 mt-2',
  }

  return (
    <div className="relative inline-block" data-dropdown>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
      >
        {trigger}
      </button>
      <div
        id={menuId}
        hidden={!open}
        className={`absolute z-20 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ${placements[placement]}`}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick?.()
              setOpen(false)
            }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 ${item.danger ? 'text-rose-600 hover:bg-rose-50' : ''}`}
          >
            {item.icon && <Icon name={item.icon} className="size-4" />}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Dropdown
