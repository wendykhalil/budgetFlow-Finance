import { createPortal } from 'react'
import Icon from './Icon.jsx'

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
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
      />
      <div
        className={`relative m-4 w-full ${sizes[size]} max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        {title && (
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {children}
        </div>
        {footer && <div className="border-t border-slate-100 px-6 py-4">{footer}</div>}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>
    </div>,
    document.body
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
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
