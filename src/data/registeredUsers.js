const USERS_KEY = 'budgetflow_users'

export const getRegisteredUsers = () => {
  const stored = localStorage.getItem(USERS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

export const saveRegisteredUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export const updateRegisteredUser = (id, updates) => {
  const users = getRegisteredUsers()
  const index = users.findIndex((user) => user.id === id)
  if (index === -1) return null
  users[index] = { ...users[index], ...updates }
  saveRegisteredUsers(users)
  return users[index]
}

export const deleteRegisteredUser = (id) => {
  const users = getRegisteredUsers()
  const nextUsers = users.filter((user) => user.id !== id)
  if (nextUsers.length === users.length) return false
  saveRegisteredUsers(nextUsers)
  return true
}
