'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',           label: 'Agente',    icon: '⚡' },
  { href: '/dashboard',  label: 'Dashboard', icon: '📊' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-1.5 py-1.5">
      {links.map(link => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
