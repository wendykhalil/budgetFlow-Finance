import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7F6] p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-500">The page you requested does not exist.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-8 rounded-xl bg-[#155C4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#104B41]"
        >
          Return to BudgetFlow
        </button>
      </div>
    </main>
  )
}

export default NotFound
