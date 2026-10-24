import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import Logo from './Logo.jsx'
import Avatar from '../ui/Avatar.jsx'
import Dropdown from '../ui/Dropdown.jsx'
import { useAuth } from '@/contexts/AuthContext'

export function Sidebar({ navItems, role }) {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-[#123F39] p-5">
      <div className="flex items-center justify-between">
        <Logo inverse />
      </div>
      <div className="mt-9 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/50">
        {role === 'admin' ? 'Administration' : 'Personal workspace'}
      </div>
      <nav className="mt-3 space-y-1">
        {navItems.map(({ name, icon, path }) => (
          <NavLink
            key={name}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-white text-[#123F39] shadow-sm'
                  : 'text-emerald-50/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon name={icon} className="size-4.5" />
            {name}
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-white/10 p-3">
        <div className="flex items-center gap-3">
          <Avatar initials={user?.avatar || 'AM'} color={user?.avatarColor || 'amber'} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'Alex Martin'}
            </div>
            <div className="text-xs text-emerald-100/60">
              {role === 'admin' ? 'Administrator' : 'Personal plan'}
            </div>
          </div>
          <Dropdown
            trigger={<Icon name="more" className="text-white/60 size-5" />}
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
  )
}

export default Sidebar
