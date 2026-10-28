import Icon from '../ui/Icon.jsx'
import Avatar from '../ui/Avatar.jsx'
import { useAuth } from '@/contexts/AuthContext'
import {
  getUserDisplayName,
  getUserInitials,
  getUserRoleLabel,
} from '@/utils/userIdentity'

export function Header({ role, mobileMenuOpen = false, onToggleMobileMenu, menuButtonRef }) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center gap-4 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur md:px-7">
      {onToggleMobileMenu && (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onToggleMobileMenu}
          aria-label={`${mobileMenuOpen ? 'Close' : 'Open'} ${role} navigation`}
          aria-expanded={mobileMenuOpen}
          aria-controls={`${role}-navigation-drawer`}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 lg:hidden"
        >
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} className="size-5" />
        </button>
      )}
      <div className="relative hidden max-w-md flex-1 md:block">
        <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none"
          placeholder="Search anything..."
          aria-label="Search anything"
        />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"
        >
          <Icon name="bell" className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="hidden items-center gap-3 sm:flex">
          <Avatar
            initials={getUserInitials(user)}
            color={user?.avatarColor || 'emerald'}
            size="sm"
          />
          <div>
            <div className="text-sm font-bold text-slate-900">{getUserDisplayName(user)}</div>
            <div className="text-xs text-slate-400">{getUserRoleLabel(user)}</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
