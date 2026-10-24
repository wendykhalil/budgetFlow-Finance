import { useNavigate } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Icon from '@/components/ui/Icon'

export function Landing() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#FBFCFC] text-slate-900">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Logo />
        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
          <span>Features</span>
          <span>How it works</span>
          <span>Security</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Log in
          </Button>
          <Button onClick={() => navigate('/login')}>Get started</Button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:pt-24">
        <div>
          <Badge tone="green">A clearer way to manage money</Badge>
          <div className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
            Take control of your money.
          </div>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Track income, understand spending, and build budgets that fit your life—all
            in one beautifully simple workspace.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/login')} className="px-6 py-3.5">
              Start for free <Icon name="arrow" className="size-4" />
            </Button>
            <Button variant="secondary" onClick={() => navigate('/login')} className="px-6 py-3.5">
              View demo
            </Button>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
            <div className="flex -space-x-2">
              {['AM', 'SW', 'JS'].map((x, i) => (
                <span
                  key={x}
                  className={`grid size-8 place-items-center rounded-full border-2 border-white text-[10px] font-bold ${
                    ['bg-amber-100', 'bg-rose-100', 'bg-blue-100'][i]
                  }`}
                >
                  {x}
                </span>
              ))}
            </div>
            Trusted by 2,500+ mindful spenders
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-3 py-10 text-center">
          <div>
            <b className="text-2xl md:text-3xl">10,000+</b>
            <span className="block text-xs text-slate-500 md:text-sm">transactions tracked</span>
          </div>
          <div>
            <b className="text-2xl md:text-3xl">2,500+</b>
            <span className="block text-xs text-slate-500 md:text-sm">active users</span>
          </div>
          <div>
            <b className="text-2xl md:text-3xl">€1.2M</b>
            <span className="block text-xs text-slate-500 md:text-sm">expenses analyzed</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="max-w-xl text-4xl font-bold">
          Everything you need to feel financially confident.
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['card', 'Expense tracking', 'See exactly where your money goes, without the spreadsheets.'],
            ['wallet', 'Smart budgets', 'Set flexible limits and get a heads-up before you overspend.'],
            ['chart', 'Financial analytics', 'Turn everyday transactions into clear, useful insights.'],
            ['activity', 'Income management', 'Keep every income stream organized in one place.'],
            ['calendar', 'Transaction history', 'Search and review your complete financial timeline.'],
            ['tag', 'Categories', 'Organize spending with categories that fit your life.'],
          ].map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-[#155C4F]">
                <Icon name={i} />
              </div>
              <div className="mt-5 text-lg font-bold">{t}</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function DashboardPreview() {
  return (
    <div className="relative rounded-3xl bg-[#E9F1EF] p-4 md:p-7">
      <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-emerald-950/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total balance</div>
            <div className="text-2xl font-bold">€4,250.80</div>
          </div>
          <Badge tone="green">+8.4%</Badge>
        </div>
        <div className="mt-6 h-40">
          <svg viewBox="0 0 500 160" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2B8A78" stopOpacity=".25" />
                <stop offset="1" stopColor="#2B8A78" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 125 C60 100 80 118 130 80 S210 100 260 55 S350 70 400 32 S460 42 500 18 V160 H0Z"
              fill="url(#fill)"
            />
            <path
              d="M0 125 C60 100 80 118 130 80 S210 100 260 55 S350 70 400 32 S460 42 500 18"
              fill="none"
              stroke="#267968"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Income', '€3,850', 'text-emerald-600'],
            ['Expenses', '€2,140', 'text-rose-500'],
            ['Savings', '€1,709', 'text-blue-600'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] text-slate-400">{l}</div>
              <div className={`mt-1 text-sm font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Landing
