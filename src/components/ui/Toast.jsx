import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './Icon.jsx'

export function Toast({ message, type = 'success', duration = 2500, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible) return null

  const typeConfig = {
    success: { bg: 'bg-slate-900', icon: 'check', iconBg: 'bg-emerald-500' },
    error: { bg: 'bg-rose-900', icon: 'x-circle', iconBg: 'bg-rose-500' },
    info: { bg: 'bg-slate-900', icon: 'alert-triangle', iconBg: 'bg-blue-500' },
    warning: { bg: 'bg-amber-900', icon: 'alert-triangle', iconBg: 'bg-amber-500' },
  }

  const config = typeConfig[type] || typeConfig.success

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl ${config.bg} px-4 py-3 text-sm font-semibold text-white shadow-xl`}
    >
      <span className="grid size-6 place-items-center rounded-full bg-white/10">
        <Icon name={config.icon} className="size-4 text-white" />
      </span>
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false })
  const toastIdRef = useRef(0)

  const showToast = useCallback((message, type = 'success', duration = 2500) => {
    setToast({ id: ++toastIdRef.current, message, type, visible: true, duration })
  }, [])

  const hideToast = useCallback(() => {
    setToast((current) => current.visible
      ? { ...current, message: '', visible: false, duration: 0 }
      : current,
    )
  }, [])

  const ToastComponent = toast.visible ? (
    <Toast
      key={toast.id}
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      onClose={hideToast}
    />
  ) : null

  return { showToast, hideToast, ToastComponent }
}

export default Toast
