import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import Logo from './Logo.jsx'
import Avatar from '../ui/Avatar.jsx'
import Dropdown from '../ui/Dropdown.jsx'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDisplayName, getUserInitials } from '@/utils/userIdentity'

export function Sidebar({ navItems, role, mobileOpen = false, onClose }) {
  const { user, logout } = useAuth()
  const drawerRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!mobileOpen) return

    const desktopQuery = window.matchMedia('(min-width: 64rem)')
    if (desktopQuery.matches) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusableElements?.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    const handleBreakpointChange = (event) => {
      if (event.matches) {
        onClose?.(false)
        drawerRef.current?.querySelector('nav a')?.focus()
      }
    }

    closeButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    desktopQuery.addEventListener('change', handleBreakpointChange)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      desktopQuery.removeEventListener('change', handleBreakpointChange)
    }
  }, [mobileOpen, onClose])

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-default bg-slate-950/40 lg:hidden"
        />
      )}
      <aside
        id={`${role}-navigation-drawer`}
        ref={drawerRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? 'true' : undefined}
        aria-label={`${role === 'admin' ? 'Admin' : 'Client'} navigation`}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-[#123F39] p-5 transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'
        }`}
      >
        <div className="flex items-center gap-3">
          <Logo inverse />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-emerald-50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="mt-9 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/50">
          {role === 'admin' ? 'Administration' : 'Personal workspace'}
        </div>
        <nav className="mt-3 flex-1 space-y-1" aria-label="Main navigation">
          {navItems.map(({ name, icon, path }) => (
            <NavLink
              key={name}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-white text-[#123F39] shadow-sm'
                    : 'text-emerald-50/75 hover:bg-white/10 hover:text-white'
                } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`
              }
            >
              <Icon name={icon} className="size-4.5" />
              {name}
            </NavLink>
          ))}
        </nav>
        <div className="mt-5 rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <Avatar
              initials={getUserInitials(user)}
              color={user?.avatarColor || 'emerald'}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">
                {getUserDisplayName(user)}
              </div>
              <div className="text-xs text-emerald-100/60">
                {role === 'admin' ? 'Administrator' : 'Personal plan'}
              </div>
            </div>
            <Dropdown
              trigger={<Icon name="more" className="text-white/60 size-5" />}
              label="Account options"
              placement="bottom-right"
              items={[
                { label: 'Profile', icon: 'user', onClick: () => {} },
                { label: 'Settings', icon: 'settings', onClick: () => {} },
                { label: 'Logout', icon: 'close', onClick: logout, danger: true },
              ]}
            />
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
