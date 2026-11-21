import { Link, NavLink, Outlet } from 'react-router';
import type { Role } from '../api/auth';
import { useSession } from '../hooks/useSession';

// Páginas de cada papel. O início do prestador é a agenda do dia.
const LINKS: Record<Role, { to: string; label: string }[]> = {
  CLIENT: [{ to: '/reservas', label: 'Minhas reservas' }],
  PROVIDER: [
    { to: '/', label: 'Agenda' },
    { to: '/servicos', label: 'Serviços' },
    { to: '/horarios', label: 'Horários' },
  ],
};

export function Layout() {
  const { user, signOut } = useSession();

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="rounded text-lg font-bold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            agendei
          </Link>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <nav aria-label="Principal">
                <ul className="flex items-center gap-3">
                  {LINKS[user.role].map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end
                        className="rounded font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-[current=page]:underline"
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <span className="hidden text-slate-600 sm:inline">
                {user.name}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
