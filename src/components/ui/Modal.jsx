import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  const dialogId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement
    dialogRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusableElements?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault()
        lastElement.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${dialogId}-title` : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`relative m-4 w-full ${sizes[size]} max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        {title && (
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 id={`${dialogId}-title`} className="text-xl font-bold text-slate-900">{title}</h2>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {children}
        </div>
        {footer && <div className="border-t border-slate-100 px-6 py-4">{footer}</div>}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>
    </div>,
    document.body
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, confirmDisabled = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {cancelText}
        </button>
        <button
          disabled={confirmDisabled}
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#155C4F] hover:bg-[#104B41]'}`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

export default Modal
