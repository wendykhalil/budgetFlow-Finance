const notifications = [
  {
    id: 'not_001',
    title: 'Your Food budget is at 84%.',
    message: 'You have spent €420 of your €500 Food budget.',
    type: 'warning',
    status: 'unread',
    date: '2026-10-24T10:00:00Z',
    userId: 'usr_001',
    icon: 'amber',
  },
  {
    id: 'not_002',
    title: 'Salary received: €3,200.',
    message: 'Your monthly salary has been deposited.',
    type: 'success',
    status: 'unread',
    date: '2026-10-23T09:00:00Z',
    userId: 'usr_001',
    icon: 'green',
  },
  {
    id: 'not_003',
    title: 'Your monthly expenses decreased by 8%.',
    message: 'Great job! You spent 8% less than last month.',
    type: 'info',
    status: 'read',
    date: '2026-10-22T14:30:00Z',
    userId: 'usr_001',
    icon: 'blue',
  },
  {
    id: 'not_004',
    title: 'Your Shopping budget is almost exceeded.',
    message: 'You have spent €286 of your €300 Shopping budget.',
    type: 'error',
    status: 'read',
    date: '2026-10-20T16:45:00Z',
    userId: 'usr_001',
    icon: 'red',
  },
  {
    id: 'not_005',
    title: 'Your Entertainment budget is at 76%.',
    message: 'You have spent €190 of your €250 Entertainment budget.',
    type: 'info',
    status: 'read',
    date: '2026-10-18T11:20:00Z',
    userId: 'usr_001',
    icon: 'blue',
  },
  {
    id: 'not_006',
    title: 'New security feature enabled.',
    message: 'Two-factor authentication has been enabled for your account.',
    type: 'success',
    status: 'read',
    date: '2026-10-15T08:00:00Z',
    userId: 'usr_001',
    icon: 'green',
  },
]

const getNotificationsByUser = (userId) =>
  notifications.filter((n) => n.userId === userId).sort((a, b) => new Date(b.date) - new Date(a.date))

const getUnreadCount = (userId) => getNotificationsByUser(userId).filter((n) => n.status === 'unread').length

const mockNotifications = {
  notifications,
  getNotificationsByUser,
  getUnreadCount,
}

export default mockNotifications
export { notifications, getNotificationsByUser, getUnreadCount }
