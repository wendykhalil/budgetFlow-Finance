import { isValidCalendarDate } from "@/utils/calendarDates"

const DRAFT_VERSION = 1

const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const paymentMethods = new Set([
  "",

  "Credit card",

  "Debit card",

  "Bank transfer",

  "Cash",
])

function isValidDate(value) {
  return value === "" || isValidCalendarDate(value)
}

function isValidDraft(draft, expected) {
  if (
    !draft ||
    typeof draft !== "object" ||
    draft.version !== DRAFT_VERSION ||
    draft.userId !== expected.userId ||
    draft.mode !== (expected.transactionId ? "edit" : "create") ||
    (draft.transactionId || null) !== (expected.transactionId || null) ||
    !Number.isFinite(draft.savedAt) ||
    draft.savedAt > Date.now() ||
    Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS
  ) {
    return false
  }

  const fields = draft.fields

  return Boolean(
    fields &&
      typeof fields === "object" &&
      typeof fields.description === "string" &&
      typeof fields.amount === "string" &&
      (fields.amount === "" ||
        (/^\d*\.?\d*$/.test(fields.amount) &&
          Number.isFinite(Number(fields.amount)))) &&
      ["income", "expense"].includes(fields.type) &&
      typeof fields.categoryId === "string" &&
      (fields.categoryId === "" || /^[a-f\d]{24}$/i.test(fields.categoryId)) &&
      typeof fields.legacyCategory === "string" &&
      isValidDate(fields.date) &&
      paymentMethods.has(fields.paymentMethod) &&
      typeof fields.note === "string" &&
      (fields.status === undefined ||
        ["completed", "pending"].includes(fields.status)) &&
      (draft.baselineUpdatedAt === null ||
        typeof draft.baselineUpdatedAt === "string"),
  )
}

export function getTransactionDraftKey(userId, transactionId) {
  const mode = transactionId
    ? `edit:${encodeURIComponent(transactionId)}`
    : "create"

  return `budgetflow_transaction_draft:v1:${encodeURIComponent(userId)}:${mode}`
}

export function readTransactionDraft(userId, transactionId) {
  const expected = { userId, transactionId: transactionId || null }

  const key = getTransactionDraftKey(userId, transactionId)

  let stored

  try {
    stored = window.localStorage.getItem(key)
  } catch {
    return { draft: null, error: true, outdated: false }
  }

  if (!stored) return { draft: null, error: false, outdated: false }

  let draft

  try {
    draft = JSON.parse(stored)
  } catch {
    try {
      window.localStorage.removeItem(key)

      return { draft: null, error: false, outdated: true }
    } catch {
      return { draft: null, error: true, outdated: false }
    }
  }

  if (!isValidDraft(draft, expected)) {
    try {
      window.localStorage.removeItem(key)

      return { draft: null, error: false, outdated: true }
    } catch {
      return { draft: null, error: true, outdated: false }
    }
  }

  return { draft, error: false, outdated: false }
}

export function saveTransactionDraft(
  userId,
  transactionId,
  fields,
  baselineUpdatedAt,
) {
  const key = getTransactionDraftKey(userId, transactionId)

  const draft = {
    version: DRAFT_VERSION,

    userId,

    mode: transactionId ? "edit" : "create",

    transactionId: transactionId || null,

    savedAt: Date.now(),

    baselineUpdatedAt: baselineUpdatedAt || null,

    fields,
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(draft))

    return true
  } catch {
    return false
  }
}

export function clearTransactionDraft(
  userId,
  transactionId,
  expectedFields,
  baselineUpdatedAt,
) {
  if (expectedFields) {
    const result = readTransactionDraft(userId, transactionId)
    if (result.error) return false

    const isSubmittedDraft =
      result.draft &&
      result.draft.baselineUpdatedAt === (baselineUpdatedAt || null) &&
      Object.keys(expectedFields).every(
        (field) => result.draft.fields[field] === expectedFields[field],
      )

    if (!isSubmittedDraft) return true
  }

  try {
    window.localStorage.removeItem(
      getTransactionDraftKey(userId, transactionId),
    )

    return true
  } catch {
    return false
  }
}
