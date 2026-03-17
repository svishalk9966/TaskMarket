import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/owner-dashboard', label: 'Overview' },
  { to: '/owner/users', label: 'Users' },
  { to: '/owner/tasks', label: 'Tasks' },
  { to: '/owner/payments', label: 'Payments' },
  { to: '/owner/disputes', label: 'Disputes' },
  { to: '/owner/refunds', label: 'Refunds' },
  { to: '/owner/expired-tasks', label: 'Expired Tasks' },
  { to: '/owner/delivery-cleanup', label: 'Delivery Cleanup' },
];

const OwnerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="rounded-[1.6rem] border border-base-300 bg-base-200/45 px-4 py-4 shadow-sm">
        <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-primary/80">Owner Panel</p>
        <h2 className="text-xl font-bold sm:text-2xl">TaskMarket Admin</h2>
        <p className="mt-2 break-all text-sm text-base-content/60" title={user?.email || ''}>{user?.email}</p>
      </div>

      <nav className="mt-5 flex-1 space-y-2.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/owner-dashboard'}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-2xl border px-4 py-3.5 text-sm font-medium transition ${isActive
                ? 'border-primary/20 bg-primary text-primary-content shadow-[0_12px_30px_rgba(99,102,241,0.22)]'
                : 'border-transparent bg-base-100/60 hover:border-base-300 hover:bg-base-200/70'}`
            }
          >
            <span className="min-w-0 break-words">{item.label}</span>
            <span className="text-base">→</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="rounded-[1.6rem] border border-base-300 bg-base-100/70 p-3 shadow-sm">
        <div className="space-y-2">
          <Link to="/dashboard" className="btn btn-ghost w-full justify-start rounded-2xl" onClick={() => setMenuOpen(false)}>User Dashboard</Link>
          <button onClick={logout} className="btn btn-outline btn-error w-full justify-start rounded-2xl">Logout</button>
        </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative mx-auto max-w-7xl animate-slide-in px-4 pb-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.06),transparent_28%)]"></div>

      <div className="mb-4 lg:hidden">
        <button className="btn btn-outline w-full justify-between rounded-2xl" onClick={() => setMenuOpen(true)}>
          <span>Owner Panel Menu</span>
          <span>☰</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.18fr)] xl:items-stretch">
        <aside className="hidden xl:block xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)]">
          <div className="rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)] xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
            <div className="border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-semibold">Admin navigation</h3>
                <p className="mt-1 text-sm text-base-content/60">Manage platform activity with the same stable workspace pattern used across TaskMarket.</p>
              </div>
            </div>
            <div className="task-scroll-shell rounded-b-[2rem] bg-base-100/55 p-1 pt-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
              <div className="task-list-scroll rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:h-full xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:bg-base-100/60">
                {sidebar}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)]">
          <div className="rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)] xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
            <div className="border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Owner workspace</h3>
                  <p className="mt-1 text-sm text-base-content/60">Improved alignment, spacing, and scroll containment without changing admin functionality.</p>
                </div>
                <div className="rounded-full bg-base-200/70 px-3 py-1.5 text-xs font-semibold text-base-content/60">Admin tools</div>
              </div>
            </div>
            <div className="task-scroll-shell rounded-b-[2rem] bg-base-100/55 p-1 pt-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
              <div className="task-list-scroll rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:h-full xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:bg-base-100/60">
                <Outlet />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className={`fixed inset-0 z-[80] lg:hidden ${menuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMenuOpen(false)}></div>
        <aside className={`absolute left-0 top-0 h-full w-[min(22rem,88vw)] border-r border-base-200 bg-base-100 p-5 shadow-2xl transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-semibold">Owner Menu</span>
            <button className="btn btn-ghost btn-circle" onClick={() => setMenuOpen(false)} aria-label="Close owner menu">✕</button>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-y-auto pr-1">{sidebar}</div>
        </aside>
      </div>
    </div>
  );
};

export default OwnerLayout;
