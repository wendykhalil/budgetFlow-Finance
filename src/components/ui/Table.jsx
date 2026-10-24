export function Table({ columns, data, rowKey, onRowClick, className = '' }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200/70 bg-white ${className}`}>
      <table className="w-full min-w-150 text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-5 py-3 font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr
              key={row[rowKey] || row.id}
              onClick={() => onRowClick?.(row)}
              className={`hover:bg-slate-50/60 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-5 py-4 ${col.className || ''}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Table
