import { useMemo, useState } from "react"

import PageTitle from "@/components/layout/PageTitle"

import Badge from "@/components/ui/Badge"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import EmptyState from "@/components/ui/EmptyState"

import Icon from "@/components/ui/Icon"

import Input from "@/components/ui/Input"

import { Modal, ConfirmModal } from "@/components/ui/Modal"

import Select from "@/components/ui/Select"

import { useToast } from "@/components/ui/Toast"

import { useAuth } from "@/contexts/AuthContext"

import { useCategories } from "@/contexts/CategoryContext"

import { useTransactions } from "@/contexts/TransactionContext"

import { formatUserCurrency } from "@/utils/formatters"

const DEFAULT_CATEGORY_COLOR = "#155C4F"

const emptyForm = () => ({
  name: "",
  type: "expense",
  color: DEFAULT_CATEGORY_COLOR,
  icon: "",
})

function transactionUsesCategory(transaction, category) {
  if (transaction.categoryId) {
    const categoryId =
      typeof transaction.categoryId === "object"
        ? transaction.categoryId.id || transaction.categoryId._id
        : transaction.categoryId

    return String(categoryId) === String(category.id)
  }

  return transaction.category === category.name
}

export function ClientCategories() {
  const { user } = useAuth()

  const currency = user?.currency || "EUR"

  const {
    categories,

    loading,

    error,

    refreshCategories,

    createCategory,

    updateCategory,

    deleteCategory,
  } = useCategories()

  const {
    transactions,

    loading: transactionsLoading,

    error: transactionsError,
  } = useTransactions()

  const { showToast, ToastComponent } = useToast()

  const [formOpen, setFormOpen] = useState(false)

  const [categoryToEdit, setCategoryToEdit] = useState(null)

  const [categoryToDelete, setCategoryToDelete] = useState(null)

  const [form, setForm] = useState(emptyForm)

  const [formErrors, setFormErrors] = useState({})

  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] = useState("")

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isArchived !== true),

    [categories],
  )

  const incomeCategories = activeCategories.filter(
    (category) => category.type === "income",
  )

  const expenseCategories = activeCategories.filter(
    (category) => category.type === "expense",
  )

  const usageUnavailable = transactionsLoading || Boolean(transactionsError)

  function openCreateForm() {
    setCategoryToEdit(null)

    setForm(emptyForm())

    setFormErrors({})

    setFormOpen(true)
  }

  function openEditForm(category) {
    setCategoryToEdit(category)

    setForm({
      name: category.name || "",

      type: category.type || "expense",

      color: category.color || DEFAULT_CATEGORY_COLOR,

      icon: category.icon || "",
    })

    setFormErrors({})

    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return

    setFormOpen(false)

    setCategoryToEdit(null)

    setForm(emptyForm())

    setFormErrors({})
  }

  function validateForm() {
    const nextErrors = {}

    const name = form.name.trim()

    const icon = form.icon.trim()

    if (!name) nextErrors.name = "Name is required."
    else if (name.length > 80)
      nextErrors.name = "Name must be 80 characters or fewer."

    if (!["income", "expense"].includes(form.type)) {
      nextErrors.type = "Choose income or expense."
    }

    if (icon && (icon.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(icon))) {
      nextErrors.icon =
        "Use up to 64 letters, numbers, underscores, or hyphens."
    }

    setFormErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (saving || deletingId || !validateForm()) return

    const data = {
      name: form.name.trim(),

      type: form.type,
    }

    data.color = form.color

    if (form.icon.trim()) data.icon = form.icon.trim()

    setSaving(true)

    try {
      if (categoryToEdit) {
        await updateCategory(categoryToEdit.id, data)

        showToast("Category updated.")
      } else {
        await createCategory(data)

        showToast("Category created.")
      }

      setFormOpen(false)

      setCategoryToEdit(null)

      setForm(emptyForm())

      setFormErrors({})
    } catch (requestError) {
      showToast(
        requestError.message ||
          `Could not ${categoryToEdit ? "update" : "create"} the category.`,

        "error",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!categoryToDelete || deletingId || saving) return

    const category = categoryToDelete

    setDeletingId(category.id)

    try {
      const response = await deleteCategory(category.id)

      showToast(
        response.action === "deleted"
          ? "Category permanently deleted."
          : "Category archived. Transaction history was preserved.",
      )

      setCategoryToDelete(null)
    } catch (requestError) {
      showToast(
        requestError.message || "Could not delete the category.",
        "error",
      )
    } finally {
      setDeletingId("")
    }
  }

  const formIsDisabled = saving || Boolean(deletingId)

  const formFooter = (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={closeForm} disabled={formIsDisabled}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={formIsDisabled}>
        {saving
          ? "Saving..."
          : categoryToEdit
            ? "Save changes"
            : "Create category"}
      </Button>
    </div>
  )

  return (
    <>
      {ToastComponent}
      <PageTitle
        title="Categories"
        sub="Organize transactions into meaningful groups."
        action={
          <Button onClick={openCreateForm} disabled={Boolean(deletingId)}>
            <Icon name="plus" className="size-4" /> Add category
          </Button>
        }
      />

      {loading && activeCategories.length === 0 ? (
        <Card>
          <p role="status" className="py-8 text-center text-sm text-slate-500">
            Loading categories...
          </p>
        </Card>
      ) : error ? (
        <Card>
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
            <Button
              className="mt-4"
              onClick={refreshCategories}
              disabled={loading}
            >
              {loading ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </Card>
      ) : activeCategories.length === 0 ? (
        <Card>
          <EmptyState
            title="No categories yet"
            message="Create a category to start organizing your transactions."
            icon={<Icon name="tag" className="size-10" />}
            action={
              <Button onClick={openCreateForm} disabled={Boolean(deletingId)}>
                <Icon name="plus" className="size-4" /> Add your first category
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <Badge tone="neutral">
              All categories ({activeCategories.length})
            </Badge>
            <Badge tone="green">Income ({incomeCategories.length})</Badge>
            <Badge tone="red">Expense ({expenseCategories.length})</Badge>
          </div>

          {transactionsError && (
            <p role="status" className="mb-3 text-sm text-amber-700">
              Transaction usage is unavailable until transactions load
              successfully.
            </p>
          )}

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-400">
                  <tr>
                    {[
                      "Category",
                      "Type",
                      "Transactions",
                      "Total amount",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="px-5 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeCategories.map((category) => {
                    const categoryTransactions = transactions.filter(
                      (transaction) =>
                        transactionUsesCategory(transaction, category),
                    )

                    const total = categoryTransactions.reduce(
                      (sum, transaction) =>
                        transaction.status == null ||
                        transaction.status === "completed"
                          ? sum +
                            (transaction.type === "income"
                              ? transaction.amount
                              : -transaction.amount)
                          : sum,

                      0,
                    )

                    const color = category.color || "#155C4F"

                    const rowDisabled =
                      formIsDisabled || deletingId === category.id

                    return (
                      <tr key={category.id}>
                        <td className="flex items-center gap-3 px-5 py-4 font-bold">
                          <span
                            className="grid size-9 place-items-center rounded-lg"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <Icon
                              name={category.icon || "tag"}
                              className="size-4"
                            />
                          </span>
                          {category.name}
                        </td>
                        <td>
                          <Badge
                            tone={
                              category.type === "income" ? "green" : "neutral"
                            }
                            size="sm"
                          >
                            {category.type}
                          </Badge>
                        </td>
                        <td className="text-slate-500">
                          {usageUnavailable ? "—" : categoryTransactions.length}
                        </td>
                        <td className="font-semibold">
                          {usageUnavailable
                            ? "—"
                            : formatUserCurrency(total, currency)}
                        </td>
                        <td className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(category)}
                            disabled={rowDisabled}
                            aria-label={`Edit ${category.name}`}
                          >
                            <Icon name="edit" className="size-4" /> Edit
                            <span className="sr-only"> {category.name}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCategoryToDelete(category)}
                            disabled={rowDisabled}
                            aria-label={`Delete ${category.name}`}
                            className="text-rose-600"
                          >
                            <Icon name="trash" className="size-4" /> Delete
                            <span className="sr-only"> {category.name}</span>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={categoryToEdit ? "Edit category" : "Add category"}
        footer={formFooter}
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }))

              setFormErrors((current) => ({ ...current, name: "" }))
            }}
            error={formErrors.name}
            placeholder="e.g. Groceries"
            maxLength={80}
            disabled={formIsDisabled}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({ ...current, type: event.target.value }))
            }
            options={[
              { value: "expense", label: "Expense" },

              { value: "income", label: "Income" },
            ]}
            disabled={formIsDisabled}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="category-color"
              className="text-sm font-semibold text-slate-700"
            >
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="category-color"
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
                disabled={formIsDisabled}
                className="size-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Choose category color"
              />
              <span
                className="size-9 rounded-lg border border-slate-200"
                style={{
                  backgroundColor: form.color || DEFAULT_CATEGORY_COLOR,
                }}
                aria-label="Selected color preview"
                role="img"
              />
              <span className="text-sm text-slate-500">
                Choose a color for this category
              </span>
            </div>
          </div>
          <Input
            label="Icon (optional)"
            value={form.icon}
            onChange={(event) => {
              setForm((current) => ({ ...current, icon: event.target.value }))

              setFormErrors((current) => ({ ...current, icon: "" }))
            }}
            error={formErrors.icon}
            placeholder="tag"
            maxLength={64}
            disabled={formIsDisabled}
          />
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        onClose={() => {
          if (!deletingId) setCategoryToDelete(null)
        }}
        onConfirm={handleDelete}
        title="Remove category?"
        message="Confirm to remove this category from your active list. Depending on whether it is linked to transactions, the service may permanently delete it or archive it. Transaction history will be preserved."
        confirmText={deletingId ? "Removing..." : "Remove category"}
        confirmDisabled={Boolean(deletingId) || saving}
        danger
      />
    </>
  )
}

export default ClientCategories
