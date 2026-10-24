const mockUsers = [
  {
    id: 'usr_001',
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'alex.martin@example.com',
    phone: '+33 6 12 34 56 78',
    password: 'password',
    role: 'client',
    status: 'active',
    currency: 'EUR',
    country: 'France',
    avatar: 'AM',
    avatarColor: 'amber',
    joinedAt: '2024-01-15T00:00:00Z',
    transactionsCount: 128,
  },
  {
    id: 'usr_002',
    firstName: 'Sarah',
    lastName: 'Wilson',
    email: 'sarah.w@example.com',
    phone: '+33 6 23 45 67 89',
    password: 'password',
    role: 'client',
    status: 'active',
    currency: 'EUR',
    country: 'France',
    avatar: 'SW',
    avatarColor: 'blue',
    joinedAt: '2024-03-18T00:00:00Z',
    transactionsCount: 94,
  },
  {
    id: 'usr_003',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.s@example.com',
    phone: '+33 6 34 56 78 90',
    password: 'password',
    role: 'admin',
    status: 'active',
    currency: 'EUR',
    country: 'France',
    avatar: 'JS',
    avatarColor: 'indigo',
    joinedAt: '2023-10-12T00:00:00Z',
    transactionsCount: 12,
  },
  {
    id: 'usr_004',
    firstName: 'Emma',
    lastName: 'Johnson',
    email: 'emma.j@example.com',
    phone: '+33 6 45 67 89 01',
    password: 'password',
    role: 'client',
    status: 'pending',
    currency: 'EUR',
    country: 'France',
    avatar: 'EJ',
    avatarColor: 'rose',
    joinedAt: '2026-10-22T00:00:00Z',
    transactionsCount: 0,
  },
  {
    id: 'usr_005',
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.b@example.com',
    phone: '+33 6 56 78 90 12',
    password: 'password',
    role: 'client',
    status: 'suspended',
    currency: 'EUR',
    country: 'France',
    avatar: 'MB',
    avatarColor: 'purple',
    joinedAt: '2025-06-04T00:00:00Z',
    transactionsCount: 203,
  },
]

const demoAccounts = {
  client: {
    email: 'client@budgetflow.test',
    password: 'Client123!',
    role: 'client',
  },
  admin: {
    email: 'admin@budgetflow.test',
    password: 'Admin123!',
    role: 'admin',
  },
}

const findUserByEmail = (email) => mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())

const getUserById = (id) => mockUsers.find((u) => u.id === id)

const getInitials = (user) => {
  if (!user) return ''
  return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
}

export { mockUsers, demoAccounts, findUserByEmail, getUserById, getInitials }
