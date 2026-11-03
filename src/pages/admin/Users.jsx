import { useState, useMemo, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Avatar from "@/components/ui/Avatar"
import Icon from "@/components/ui/Icon"
import SearchInput from "@/components/ui/SearchInput"
import { apiRequest } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"

export function AdminUsers() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    limit: 20,
  })
  const [suspendingId, setSuspendingId] = useState(null)
  const [suspendError, setSuspendError] = useState(null)

  const abortControllerRef = useRef(null)

  // Fetch users from API
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const fetchUsers = async () => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set("page", currentPage.toString())

        if (search) {
          params.set("search", search)
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }
        if (roleFilter !== "all") {
          params.set("role", roleFilter)
        }

        const response = await apiRequest(
          `/api/admin/users?${params.toString()}`,
          {
            token,
            signal: controller.signal,
          },
        )

        if (response?.data) {
          setUsers(response.data)
          setPagination(response.pagination)
        }
      } catch (err) {
        // Ignore abort errors (user navigated away or newer request started)
        if (err.name === "AbortError") {
          return
        }
        setError(err.message || "Failed to load users")
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [token, currentPage, search, statusFilter, roleFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, roleFilter])

  const handleSuspend = async (id, currentStatus) => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended"

    setSuspendingId(id)
    setSuspendError(null)

    try {
      const response = await apiRequest(`/api/admin/users/${id}/status`, {
        token,
        method: "PATCH",
        body: { status: newStatus },
      })

      if (response?.user) {
        // Update the user in the local list
        setUsers((prevUsers) =>
          prevUsers.map((u) => (u.id === id ? { ...u, status: newStatus } : u)),
        )
      }
    } catch (err) {
      setSuspendError(err.message || "Failed to update user status")
    } finally {
      setSuspendingId(null)
    }
  }

  return (
    <>
      <PageTitle
        title="Users management"
        sub={`Manage ${pagination.total} client and administrator accounts.`}
        action={
          <Button
            disabled
            title="Admin user creation is unavailable in this demo"
          >
            <Icon name="plus" className="size-4" /> Add user unavailable
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
          <div className="font-semibold">Error loading users</div>
          <div>{error}</div>
        </div>
      )}

      {suspendError && (
        <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
          <div className="font-semibold">Error updating user</div>
          <div>{suspendError}</div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput
            placeholder="Search users..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter by user status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          <select
            aria-label="Filter by user role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All roles</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {["User", "Role", "Status", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="flex items-center gap-3 px-5 py-4">
                    <Avatar
                      initials={u.avatar}
                      color={u.avatarColor}
                      size="sm"
                    />
                    <div>
                      <b>{`${u.firstName} ${u.lastName}`}</b>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={u.role === "admin" ? "blue" : "neutral"}
                      size="sm"
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      tone={
                        u.status === "active"
                          ? "green"
                          : u.status === "pending"
                            ? "amber"
                            : "red"
                      }
                      size="sm"
                    >
                      {u.status}
                    </Badge>
                  </td>
                  <td className="text-slate-500">
                    {new Date(u.joinedAt).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`View ${u.firstName} ${u.lastName}`}
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    >
                      <Icon name="eye" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${
                        u.status === "suspended" ? "Reactivate" : "Suspend"
                      } ${u.firstName} ${u.lastName}`}
                      onClick={() => handleSuspend(u.id, u.status)}
                      disabled={suspendingId === u.id}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon
                        name={u.status === "suspended" ? "check" : "close"}
                        className="size-4"
                      />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <span>
          Showing{" "}
          {users.length > 0 ? (currentPage - 1) * pagination.limit + 1 : 0}–
          {Math.min(currentPage * pagination.limit, pagination.total)} of{" "}
          {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
            (page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-xl text-sm font-semibold ${
                  page === currentPage
                    ? "bg-[#155C4F] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  )
}

export default AdminUsers
