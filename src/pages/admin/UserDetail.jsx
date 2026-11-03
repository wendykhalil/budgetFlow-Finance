import { useEffect, useRef, useState } from "react"

import { useNavigate, useParams } from "react-router-dom"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Card from "@/components/ui/Card"

import Avatar from "@/components/ui/Avatar"

import Icon from "@/components/ui/Icon"

import Alert from "@/components/ui/Alert"

import { useAuth } from "@/contexts/AuthContext"

import { apiRequest } from "@/lib/api"

function validateUserResponse(response, expectedId) {
  const user = response?.user

  if (
    !user ||
    user.id !== expectedId ||
    typeof user.firstName !== "string" ||
    typeof user.lastName !== "string" ||
    typeof user.email !== "string" ||
    !["active", "pending", "suspended"].includes(user.status) ||
    !["admin", "client"].includes(user.role)
  ) {
    throw new Error("The user detail API returned an unexpected response.")
  }

  return user
}

function initialsForUser(user) {
  return `${user.firstName[0] || ""}${user.lastName[0] || ""}`.toUpperCase()
}

function displayDate(value) {
  if (!value) return "Not available"

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-GB")
}

export function AdminUserDetail() {
  const navigate = useNavigate()

  const { id } = useParams()

  const { user: adminUser, token } = useAuth()

  const sessionKey =
    id && adminUser?.id && token ? `${id}:${adminUser.id}:${token}` : ""

  const [detail, setDetail] = useState(null)

  const [statusError, setStatusError] = useState("")

  const [updatingStatus, setUpdatingStatus] = useState(false)

  const currentKeyRef = useRef(sessionKey)

  const statusControllerRef = useRef(null)

  currentKeyRef.current = sessionKey

  useEffect(() => {
    const controller = new AbortController()

    let active = true

    setDetail({
      requestKey: sessionKey,

      status: "loading",

      user: null,

      error: "",
    })

    setStatusError("")

    setUpdatingStatus(false)

    statusControllerRef.current?.abort()

    if (!sessionKey) {
      setDetail({
        requestKey: sessionKey,

        status: "error",

        user: null,

        error: "An administrator session is required to view user details.",
      })

      return () => {
        active = false
      }
    }

    apiRequest(`admin/users/${encodeURIComponent(id)}`, {
      token,

      signal: controller.signal,
    })

      .then((response) => validateUserResponse(response, id))

      .then((loadedUser) => {
        if (!active) return

        setDetail({
          requestKey: sessionKey,

          status: "success",

          user: loadedUser,

          error: "",
        })
      })

      .catch((error) => {
        if (!active || controller.signal.aborted) return

        setDetail({
          requestKey: sessionKey,

          status: "error",

          user: null,

          error: error.message || "Could not load this user.",
        })
      })

    return () => {
      active = false

      controller.abort()

      statusControllerRef.current?.abort()
    }
  }, [id, sessionKey, token])

  const currentDetail =
    detail?.requestKey === sessionKey
      ? detail
      : { status: "loading", user: null, error: "" }

  const selectedUser = currentDetail.user

  const handleStatusChange = async () => {
    if (!selectedUser || updatingStatus || !token) return

    const nextStatus =
      selectedUser.status === "suspended" ? "active" : "suspended"

    const requestKey = sessionKey

    const controller = new AbortController()

    statusControllerRef.current = controller

    setUpdatingStatus(true)

    setStatusError("")

    try {
      const response = await apiRequest(
        `admin/users/${encodeURIComponent(id)}/status`,

        {
          token,

          method: "PATCH",

          body: { status: nextStatus },

          signal: controller.signal,
        },
      )

      const updatedUser = validateUserResponse(response, id)

      if (currentKeyRef.current !== requestKey || controller.signal.aborted) {
        return
      }

      setDetail({
        requestKey,

        status: "success",

        user: updatedUser,

        error: "",
      })
    } catch (error) {
      if (controller.signal.aborted || currentKeyRef.current !== requestKey) {
        return
      }

      setStatusError(error.message || "Could not update this user's status.")
    } finally {
      if (currentKeyRef.current === requestKey) setUpdatingStatus(false)

      if (statusControllerRef.current === controller) {
        statusControllerRef.current = null
      }
    }
  }

  if (currentDetail.status === "loading") {
    return (
      <p role="status" className="py-12 text-center text-sm text-slate-500">
        Loading user details…
      </p>
    )
  }

  if (currentDetail.status === "error") {
    return (
      <>
        <PageTitle
          title="User details"
          action={
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/users")}
            >
              <Icon name="arrow-left" className="size-4" /> Back
            </Button>
          }
        />
        <Alert
          type="error"
          title="User details unavailable"
          message={currentDetail.error}
        />
      </>
    )
  }

  return (
    <>
      <PageTitle
        title="User details"
        sub="Account information is loaded from the admin user detail API."
        action={
          <Button variant="secondary" onClick={() => navigate("/admin/users")}>
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      {statusError && (
        <Alert className="mb-5" type="error" message={statusError} />
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="text-center">
          <Avatar initials={initialsForUser(selectedUser)} size="xl" />
          <div className="mt-4 text-xl font-bold">
            {selectedUser.firstName} {selectedUser.lastName}
          </div>
          <div className="text-sm text-slate-500">{selectedUser.email}</div>
          <div className="mt-3">
            <Badge
              tone={
                selectedUser.status === "active"
                  ? "green"
                  : selectedUser.status === "pending"
                    ? "amber"
                    : "red"
              }
            >
              {selectedUser.status}
            </Badge>
          </div>
          <Badge
            tone={selectedUser.role === "admin" ? "blue" : "neutral"}
            className="mt-2"
          >
            {selectedUser.role}
          </Badge>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="mb-4 font-bold">Account information</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-xs text-slate-400">First name</span>
                <div className="mt-1 font-semibold">
                  {selectedUser.firstName}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Last name</span>
                <div className="mt-1 font-semibold">
                  {selectedUser.lastName}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Email</span>
                <div className="mt-1 font-semibold">{selectedUser.email}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Phone</span>
                <div className="mt-1 font-semibold">
                  {selectedUser.phone || "Not set"}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Country</span>
                <div className="mt-1 font-semibold">
                  {selectedUser.country || "Not available"}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Currency</span>
                <div className="mt-1 font-semibold">
                  {selectedUser.currency || "Not available"}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Joined</span>
                <div className="mt-1 font-semibold">
                  {displayDate(selectedUser.createdAt)}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Status</span>
                <div className="mt-1 font-semibold">{selectedUser.status}</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="font-bold">Activity summary unavailable</div>
            <p className="mt-2 text-sm text-slate-500">
              The existing user detail API does not include per-user transaction
              or budget summaries.
            </p>
          </Card>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={handleStatusChange}
              disabled={updatingStatus}
            >
              {updatingStatus
                ? "Updating…"
                : selectedUser.status === "suspended"
                  ? "Reactivate"
                  : "Suspend"}
            </Button>
            <Button
              variant="secondary"
              disabled
              title="Password resets require a backend endpoint"
            >
              Password reset unavailable
            </Button>
            <Button
              variant="secondary"
              disabled
              title="User deletion is not supported by the existing admin API"
            >
              Delete unavailable
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminUserDetail
