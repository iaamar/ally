'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const SIDEBAR_STORAGE_KEY = 'ally.sidebar.collapsed';

const NAVIGATION = [
  {
    href: '/',
    label: 'Projects',
    tone: 'blue',
    icon: <path d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h2.4c.4 0 .78.16 1.06.44l.9.9h5.14c.83 0 1.5.67 1.5 1.5v6.16c0 .83-.67 1.5-1.5 1.5H3.25c-.83 0-1.5-.67-1.5-1.5z" />,
  },
  {
    href: '/connect',
    label: 'Ally MCP',
    tone: 'violet',
    icon: <><path d="M6.2 5.25l-1-1a2.3 2.3 0 0 0-3.25 3.25l1.55 1.55a2.3 2.3 0 0 0 3.25 0l1-1" /><path d="M9.8 10.75l1 1a2.3 2.3 0 0 0 3.25-3.25L12.5 6.95a2.3 2.3 0 0 0-3.25 0l-1 1" /><path d="M5.75 10.25l4.5-4.5" /></>,
  },
  {
    href: '/activity',
    label: 'Traces',
    tone: 'green',
    icon: <><path d="M2 11.5h2.2l1.5-4 2.2 6 1.7-8 1.4 4h3" /><path d="M2 2.75h12v10.5H2z" /></>,
  },
  {
    href: '/keys',
    label: 'API Keys',
    tone: 'amber',
    icon: <><circle cx="5.4" cy="5.4" r="2.9" /><path d="M7.6 7.6l5.1 5.1M10.6 10.6l1.3-1.3M12.7 12.7l1.3-1.3" /></>,
  },
  {
    href: '/settings',
    label: 'Settings',
    tone: 'slate',
    icon: <><circle cx="8" cy="8" r="2.15" /><path d="M8 1.75l1.15 1.4 1.77-.5.5 1.77 1.4 1.15-1.4 1.15.5 1.77-1.77.5L8 14.25l-1.15-1.4-1.77.5-.5-1.77-1.4-1.15 1.4-1.15-.5-1.77 1.77-.5z" /></>,
  },
] as const;

function activePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    setCollapsed(stored);
    document.documentElement.classList.toggle('sidebar-collapsed', stored);
    return () => document.documentElement.classList.remove('sidebar-collapsed');
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.classList.toggle('sidebar-collapsed', next);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  }

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar__toggle"
        onClick={toggleSidebar}
        aria-label={collapsed ? 'Expand workspace navigation' : 'Collapse workspace navigation'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand workspace' : 'Collapse workspace'}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d={collapsed ? 'M6 3.5L10.5 8 6 12.5' : 'M10 3.5L5.5 8l4.5 4.5'} />
        </svg>
      </button>
      <p className="sidebar__eyebrow">Workspace</p>
      <nav aria-label="Primary" className="sidebar__nav">
        {NAVIGATION.map((item) => {
          const active = activePath(pathname, item.href);
          return (
            <a
              key={item.href}
              className={`nav-link nav-link--${item.tone}${active ? ' nav-link--active' : ''}`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-link__icon" aria-hidden="true">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
              </span>
              <span className="nav-link__label">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
