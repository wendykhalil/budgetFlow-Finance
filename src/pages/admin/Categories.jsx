import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { categories } from '@/data/mockCategories'

export function AdminCategories() {
  const [catList, setCatList] = useState(categories)
  const [showDeleteModal, setShowDeleteModal] = useState(null)

  const handleDelete = (id) => {
    const idx = catList.findIndex((c) => c.id === id)
    if (idx !== -1) {
      catList.splice(idx, 1)
      setCatList([...catList])
    }
    setShowDeleteModal(null)
  }

  return (
    <>
      <PageTitle
        title="Categories"
        sub="Manage platform-wide transaction categories."
        action={<Button>Add category</Button>}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-150 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['Category', 'Type', 'Color', 'Transactions', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {catList.map((c) => (
              <tr key={c.id}>
                <td className="flex items-center gap-3 px-5 py-4 font-bold">
                  <span
                    className="grid size-9 place-items-center rounded-lg"
                    style={{ backgroundColor: `${c.color}20`, color: c.color }}
                  >
                    <Icon name={c.icon} className="size-4" />
                  </span>
                  {c.name}
                </td>
                <td>
                  <Badge tone={c.type === 'income' ? 'green' : 'neutral'} size="sm">
                    {c.type}
                  </Badge>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.color}
                  </div>
                </td>
                <td className="text-slate-500">{c.transactionCount || 0}</td>
                <td className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm">Edit</Button>
                  <button
                    onClick={() => setShowDeleteModal(c.id)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <Icon name="trash" className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold">Delete category?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This action cannot be undone. All transactions in this category will be affected.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(showDeleteModal)}
              >
                Delete category
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AdminCategories
