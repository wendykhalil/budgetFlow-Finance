import { useEffect, useRef, useState } from "react"

import { Link, useNavigate, useParams } from "react-router-dom"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import Input from "@/components/ui/Input"

import Select from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"

import { apiRequest } from "@/lib/api"

import { useAuth } from "@/contexts/AuthContext"

import { useCategories } from "@/contexts/CategoryContext"

import { useTransactions } from "@/contexts/TransactionContext"

import {
  clearTransactionDraft,
  readTransactionDraft,
  saveTransactionDraft,
} from "@/utils/transactionDrafts"
import {
  getCurrencyFractionDigits,
  getCurrencySymbol,
} from "@/utils/currencies"
import { getLocalDateString, isValidCalendarDate } from "@/utils/calendarDates"

export function TransactionNew() {
  const { user, loading: authLoading } = useAuth()
  const { id } = useParams()

  if (authLoading) {
    return (
      <p role="status" className="py-8 text-center text-sm text-slate-500">
        Restoring your session...
      </p>
    )
  }

  if (!user?.id) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-rose-600">
        Your session is unavailable. Sign in again to manage transactions.
      </p>
    )
  }

  return (
    <TransactionNewForm
      key={`${user.id}:${id || "create"}`}
      userId={user.id}
      currency={user.currency || "EUR"}
    />
  )
}

function TransactionNewForm({ userId, currency }) {
  const navigate = useNavigate()

  const { id } = useParams()

  const { upsertTransaction } = useTransactions()

  const {
    categories,

    loading: loadingCategories,

    error: categoriesError,

    refreshCategories,

    createCategory,
  } = useCategories()

  const { showToast, ToastComponent } = useToast()

  const isEditing = Boolean(id)

  const [description, setDescription] = useState("")

  const [amount, setAmount] = useState("")

  const [type, setType] = useState("expense")

  const [categoryId, setCategoryId] = useState("")

  const [legacyCategory, setLegacyCategory] = useState("")

  const [originalCategory, setOriginalCategory] = useState(null)

  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState(null)

  const [date, setDate] = useState(() => getLocalDateString())

  const [paymentMethod, setPaymentMethod] = useState("Credit card")

  const [status, setStatus] = useState("completed")

  const [note, setNote] = useState("")

  const [loadingTransaction, setLoadingTransaction] = useState(isEditing)

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState("")

  const [draftReady, setDraftReady] = useState(false)

  const [draftStorageError, setDraftStorageError] = useState("")

  const [inlineCategoryOpen, setInlineCategoryOpen] = useState(false)

  const [inlineCategoryName, setInlineCategoryName] = useState("")

  const [inlineCategoryColorEnabled, setInlineCategoryColorEnabled] =
    useState(false)

  const [inlineCategoryColor, setInlineCategoryColor] = useState("#155C4F")

  const [inlineCategoryError, setInlineCategoryError] = useState("")

  const [creatingCategory, setCreatingCategory] = useState(false)

  const submitLockRef = useRef(false)

  const restoredDraftKeyRef = useRef("")

  const createCategoryLockRef = useRef(false)

  const activeCategories = categories.filter((item) => item.isArchived !== true)

  const typeCategories = activeCategories.filter((item) => item.type === type)

  const categoryOptions = [
    { value: "", label: "Select category" },

    ...typeCategories.map((item) => ({ value: item.id, label: item.name })),

    { value: "__create_category__", label: "+ Create new category" },
  ]

  if (legacyCategory && !categoryId) {
    categoryOptions.push({
      value: "__legacy_category__",

      label: `${legacyCategory} (legacy, unlinked)`,
    })
  }

  const originalCategoryIsActive = originalCategory?.id
    ? activeCategories.some((item) => item.id === originalCategory.id)
    : false
  const hasUnlistedOriginalCategory =
    isEditing &&
    originalCategory &&
    originalCategory.type === type &&
    originalCategory.id &&
    !originalCategoryIsActive

  if (hasUnlistedOriginalCategory) {
    categoryOptions.push({
      value: originalCategory.id,
      label: `${originalCategory.name} (${
        loadingCategories || categoriesError
          ? "existing linked category"
          : "archived historical category"
      })`,
    })
  }

  useEffect(() => {
    if (!isEditing) return

    let isMounted = true

    async function loadTransaction() {
      setLoadingTransaction(true)

      setDraftReady(false)

      setError("")

      try {
        const response = await apiRequest(`transactions/${id}`, {
          token: localStorage.getItem("budgetflow_token"),
        })

        if (!response?.transaction) {
          throw new Error(
            "The transactions service returned an invalid response.",
          )
        }

        if (!isMounted) return

        const transaction = response.transaction

        setBaselineUpdatedAt(transaction.updatedAt || null)

        setDescription(transaction.description || "")

        setAmount(String(transaction.amount ?? ""))

        const linkedCategoryId =
          typeof transaction.categoryId === "object"
            ? transaction.categoryId?.id || transaction.categoryId?._id
            : transaction.categoryId

        const normalizedCategoryId = linkedCategoryId
          ? String(linkedCategoryId)
          : ""
        const transactionType = transaction.type || "expense"

        setType(transactionType)

        setCategoryId(normalizedCategoryId)

        setLegacyCategory(
          normalizedCategoryId ? "" : transaction.category || "",
        )

        setOriginalCategory({
          id: normalizedCategoryId,
          name: transaction.category || "",
          type: transactionType,
        })

        setDate(transaction.date || "")

        setPaymentMethod(transaction.paymentMethod || "")

        setStatus(transaction.status || "completed")

        setNote(transaction.note || "")
      } catch (requestError) {
        if (isMounted)
          setError(requestError.message || "Could not load this transaction.")
      } finally {
        if (isMounted) setLoadingTransaction(false)
      }
    }

    loadTransaction()

    return () => {
      isMounted = false
    }
  }, [id, isEditing])

  useEffect(() => {
    if (
      !userId ||
      (isEditing && (loadingTransaction || (error && !originalCategory)))
    ) {
      return
    }

    const draftKey = `${userId}:${id || "create"}`
    if (restoredDraftKeyRef.current === draftKey) return
    restoredDraftKeyRef.current = draftKey

    const result = readTransactionDraft(userId, id)
    if (result.error) {
      setDraftStorageError(
        "Local drafts are unavailable in this browser. Your changes will not survive a refresh.",
      )
    } else if (result.outdated) {
      setDraftStorageError(
        "An invalid or outdated saved draft was discarded. The current form is ready to use.",
      )
    }

    const draft = result.draft
    if (draft) {
      const baselineMatches =
        !isEditing || draft.baselineUpdatedAt === baselineUpdatedAt

      if (!baselineMatches) {
        clearTransactionDraft(userId, id)
        setDraftStorageError(
          "A saved edit draft was discarded because this transaction changed on the server.",
        )
      } else {
        const fields = draft.fields
        const legacySelectionIsValid =
          !fields.legacyCategory ||
          (!originalCategory?.id &&
            fields.legacyCategory === originalCategory?.name &&
            fields.type === originalCategory?.type)
        const archivedSelectionIsValid =
          !originalCategory?.id ||
          fields.categoryId !== originalCategory.id ||
          fields.type === originalCategory.type

        setDescription(fields.description)
        setAmount(fields.amount)
        setType(fields.type)
        setDate(fields.date)
        setPaymentMethod(fields.paymentMethod)
        setStatus(fields.status || "completed")
        setNote(fields.note)

        if (legacySelectionIsValid && archivedSelectionIsValid) {
          setCategoryId(fields.categoryId)
          setLegacyCategory(fields.legacyCategory)
        } else {
          setDraftStorageError(
            "The saved category selection is no longer compatible. Choose a category before saving.",
          )
        }
      }
    }

    setDraftReady(true)
  }, [
    baselineUpdatedAt,
    error,
    id,
    isEditing,
    loadingTransaction,
    originalCategory,
    userId,
  ])

  useEffect(() => {
    if (!userId || !draftReady || (isEditing && loadingTransaction)) return

    const saved = saveTransactionDraft(
      userId,
      id,
      {
        description,
        amount,
        type,
        categoryId,
        legacyCategory,
        date,
        paymentMethod,
        status,
        note,
      },
      baselineUpdatedAt,
    )

    if (!saved) {
      setDraftStorageError(
        "Local drafts could not be saved in this browser. Your changes may be lost after a refresh.",
      )
    }
  }, [
    amount,
    baselineUpdatedAt,
    categoryId,
    date,
    description,
    draftReady,
    id,
    isEditing,
    legacyCategory,
    loadingTransaction,
    note,
    paymentMethod,
    status,
    type,
    userId,
  ])

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitLockRef.current) return

    const parsedAmount = Number(amount)

    const selectedCategory = typeCategories.find(
      (item) => item.id === categoryId,
    )

    const canKeepLegacyCategory =
      isEditing &&
      !categoryId &&
      Boolean(legacyCategory) &&
      legacyCategory === originalCategory?.name &&
      type === originalCategory?.type
    const canKeepArchivedCategory =
      isEditing &&
      Boolean(originalCategory?.id) &&
      categoryId === originalCategory.id &&
      type === originalCategory.type &&
      !selectedCategory

    const validDate = isValidCalendarDate(date)

    if (
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      (!selectedCategory &&
        !canKeepLegacyCategory &&
        !canKeepArchivedCategory) ||
      !["income", "expense"].includes(type) ||
      !["completed", "pending"].includes(status) ||
      !validDate
    ) {
      setError(
        originalCategory && type !== originalCategory.type
          ? `Choose an active ${type} category after changing the transaction type.`
          : typeCategories.length === 0 &&
              !canKeepLegacyCategory &&
              !canKeepArchivedCategory
            ? `No active ${type} categories are available. Add a category before saving.`
            : "Enter a description, positive amount, compatible category, valid date, and transaction type.",
      )

      return
    }

    const submittedDraftFields = {
      description,
      amount,
      type,
      categoryId,
      legacyCategory,
      date,
      paymentMethod,
      status,
      note,
    }

    setError("")

    submitLockRef.current = true

    setSubmitting(true)

    try {
      const body = {
        date,

        description: description.trim(),

        category:
          selectedCategory?.name ||
          legacyCategory.trim() ||
          (canKeepArchivedCategory ? originalCategory.name : ""),

        type,

        amount: parsedAmount,

        paymentMethod,

        status,

        note,
      }

      if (selectedCategory) body.categoryId = selectedCategory.id

      const response = await apiRequest(
        isEditing ? `transactions/${id}` : "transactions",

        {
          method: isEditing ? "PATCH" : "POST",

          token: localStorage.getItem("budgetflow_token"),

          body,
        },
      )

      if (!response?.transaction?.id) {
        throw new Error(
          "The transactions service returned an invalid response.",
        )
      }

      upsertTransaction(response.transaction)

      clearTransactionDraft(userId, id, submittedDraftFields, baselineUpdatedAt)

      navigate("/client/transactions", {
        state: {
          successMessage: isEditing
            ? "Transaction updated."
            : "Transaction created.",
        },
      })
    } catch (requestError) {
      setError(
        requestError.message ||
          `Could not ${isEditing ? "update" : "create"} the transaction.`,
      )
    } finally {
      submitLockRef.current = false

      setSubmitting(false)
    }
  }

  function closeInlineCategoryModal() {
    if (createCategoryLockRef.current) return
    setInlineCategoryOpen(false)
    setInlineCategoryName("")
    setInlineCategoryColorEnabled(false)
    setInlineCategoryColor("#155C4F")
    setInlineCategoryError("")
  }

  async function handleCreateInlineCategory(event) {
    event.preventDefault()
    if (createCategoryLockRef.current) return

    const name = inlineCategoryName.trim()
    if (!name) {
      setInlineCategoryError("Enter a category name.")
      return
    }

    createCategoryLockRef.current = true
    setCreatingCategory(true)
    setInlineCategoryError("")
    try {
      const data = { name, type }
      if (inlineCategoryColorEnabled) data.color = inlineCategoryColor

      const createdCategory = await createCategory(data)
      if (
        !createdCategory?.id ||
        createdCategory.type !== type ||
        createdCategory.isArchived === true
      ) {
        throw new Error(
          "The categories service returned a category that cannot be assigned to this transaction.",
        )
      }

      setCategoryId(createdCategory.id)
      setLegacyCategory("")
      createCategoryLockRef.current = false
      closeInlineCategoryModal()
      showToast("Category created and selected.")
    } catch (requestError) {
      const message =
        requestError.status === 409
          ? requestError.message ||
            "A category with this name and transaction type already exists."
          : requestError.message || "Could not create the category."
      setInlineCategoryError(message)
      showToast(message, "error")
    } finally {
      createCategoryLockRef.current = false
      setCreatingCategory(false)
    }
  }

  return (
    <>
      <PageTitle
        title={isEditing ? "Edit transaction" : "Add transaction"}
        sub={
          isEditing
            ? "Update this transaction record."
            : "Create a new transaction record."
        }
        action={
          <Button
            variant="secondary"
            onClick={() => navigate("/client/transactions")}
          >
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      <Card>
        {loadingTransaction ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">
            Loading transaction...
          </p>
        ) : error && isEditing && !description ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/client/transactions")}
            >
              Back to transactions
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2 flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (type !== "income") {
                      setType("income")

                      setCategoryId("")

                      setLegacyCategory("")
                    }
                  }}
                  aria-pressed={type === "income"}
                  className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                    type === "income"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (type !== "expense") {
                      setType("expense")

                      setCategoryId("")

                      setLegacyCategory("")
                    }
                  }}
                  aria-pressed={type === "expense"}
                  className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                    type === "expense"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Expense
                </button>
              </div>

              <Input
                label="Description"
                placeholder="Grocery store"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <Input
                label="Amount"
                type="number"
                placeholder={`0.${"0".repeat(getCurrencyFractionDigits(currency))}`}
                min={String(1 / 10 ** getCurrencyFractionDigits(currency))}
                step={String(1 / 10 ** getCurrencyFractionDigits(currency))}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                prefix={getCurrencySymbol(currency)}
              />
              <div className="space-y-2">
                <Select
                  label="Category"
                  options={categoryOptions}
                  value={
                    categoryId || (legacyCategory ? "__legacy_category__" : "")
                  }
                  onChange={(event) => {
                    if (event.target.value === "__create_category__") {
                      setInlineCategoryName("")
                      setInlineCategoryColorEnabled(false)
                      setInlineCategoryColor("#155C4F")
                      setInlineCategoryError("")
                      setInlineCategoryOpen(true)
                    } else if (event.target.value === "__legacy_category__") {
                      setCategoryId("")
                    } else if (event.target.value === originalCategory?.id) {
                      setCategoryId(event.target.value)
                      setLegacyCategory("")
                    } else {
                      setCategoryId(event.target.value)
                      setLegacyCategory("")
                    }
                  }}
                  disabled={loadingCategories || creatingCategory}
                />
                {loadingCategories && (
                  <p role="status" className="text-sm text-slate-500">
                    Loading categories...
                  </p>
                )}
                {categoriesError && (
                  <div className="text-sm text-rose-600" role="alert">
                    <p>{categoriesError}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={refreshCategories}
                      disabled={loadingCategories}
                    >
                      {loadingCategories ? "Retrying..." : "Retry categories"}
                    </Button>
                  </div>
                )}
                {hasUnlistedOriginalCategory &&
                  categoryId === originalCategory.id && (
                    <p role="status" className="text-sm text-amber-700">
                      {loadingCategories || categoriesError
                        ? "This existing linked category is not in the active category list. Leave it selected to keep it unchanged."
                        : "This is an archived historical category. Leave it selected to keep it unchanged, or choose an active category to replace it."}
                    </p>
                  )}
                {!loadingCategories &&
                  !categoriesError &&
                  typeCategories.length === 0 && (
                    <div className="text-sm text-amber-700" role="status">
                      <p>No active {type} categories are available.</p>
                      <Link
                        to="/client/categories"
                        className="mt-1 inline-block font-semibold text-[#155C4F] underline"
                      >
                        Manage categories
                      </Link>
                    </div>
                  )}
              </div>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Select
                label="Payment method"
                options={[
                  { value: "", label: "Select payment method" },

                  { value: "Credit card", label: "Credit card" },

                  { value: "Debit card", label: "Debit card" },

                  { value: "Bank transfer", label: "Bank transfer" },

                  { value: "Cash", label: "Cash" },
                ]}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              />
              <Select
                label="Status"
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                ]}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              />
              <Input
                label="Note"
                placeholder="Optional note..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {draftStorageError && (
              <p role="status" className="text-sm text-amber-700">
                {draftStorageError}
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-6">
              <Button
                variant="secondary"
                type="button"
                onClick={() => navigate("/client/transactions")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : isEditing
                    ? "Save changes"
                    : "Save transaction"}
              </Button>
            </div>
          </form>
        )}
      </Card>
      <Modal
        isOpen={inlineCategoryOpen}
        onClose={closeInlineCategoryModal}
        title={`Create ${type} category`}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={closeInlineCategoryModal}
              disabled={creatingCategory}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateInlineCategory}
              disabled={creatingCategory}
            >
              {creatingCategory ? "Creating..." : "Create category"}
            </Button>
          </div>
        }
      >
        <form
          id="inline-category-form"
          onSubmit={handleCreateInlineCategory}
          className="space-y-5"
        >
          <p className="text-sm text-slate-500">
            This category will be added as an {type} category.
          </p>
          <Input
            label="Category name"
            value={inlineCategoryName}
            onChange={(event) => setInlineCategoryName(event.target.value)}
            placeholder="e.g. Groceries"
            maxLength={80}
            aria-required="true"
            disabled={creatingCategory}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={inlineCategoryColorEnabled}
              onChange={(event) =>
                setInlineCategoryColorEnabled(event.target.checked)
              }
              disabled={creatingCategory}
            />
            Choose a category color (optional)
          </label>
          {inlineCategoryColorEnabled && (
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Choose category color"
                value={inlineCategoryColor}
                onChange={(event) => setInlineCategoryColor(event.target.value)}
                disabled={creatingCategory}
                className="size-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span
                role="img"
                aria-label="Selected color preview"
                className="size-9 rounded-lg border border-slate-200"
                style={{ backgroundColor: inlineCategoryColor }}
              />
            </div>
          )}
          {inlineCategoryError && (
            <p role="alert" className="text-sm text-rose-600">
              {inlineCategoryError}
            </p>
          )}
        </form>
      </Modal>
      {ToastComponent}
    </>
  )
}

export default TransactionNew
