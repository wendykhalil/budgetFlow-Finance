export function getUserDisplayName(user) {
  const name = [user?.firstName, user?.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(' ')

  return name || 'User'
}

export function getUserInitials(user) {
  if (typeof user?.avatar === 'string' && user.avatar.trim()) {
    return user.avatar.trim()
  }

  const initials = [user?.firstName, user?.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim()[0])
    .join('')
    .toUpperCase()

  return initials || '?'
}

export function getUserRoleLabel(user) {
  if (user?.role === 'admin') return 'Admin'
  if (user?.role === 'client') return 'Client'
  return 'User'
}
