import { NavLink } from 'react-router-dom'
import { Home, Search, Library, User } from 'lucide-react'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Search },
  { to: '/collection', label: 'Library', icon: Library },
  { to: '/account', label: 'Account', icon: User },
]

export default function NavShell({ children }) {
  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-ink/10 px-6 py-8 flex-shrink-0">
        <div className="flex items-center gap-2 mb-10">
          <span className="font-display text-2xl text-teal-600">Folio</span>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-100 text-teal-600'
                    : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-center py-4 border-b border-ink/10">
          <span className="font-display text-xl text-teal-600">Folio</span>
        </header>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-parchment border-t border-ink/10 flex items-center justify-around py-2 px-2">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive ? 'text-teal-600' : 'text-ink-muted'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
