'use client';

import { usePathname } from 'next/navigation';
import './docs.css';

const GITHUB = 'https://github.com/vochsel/walkie-talkie';

const NAV = [
  { label: 'Getting Started' },
  { href: '/docs', title: 'Overview' },
  { href: '/docs/cli', title: 'CLI Reference' },
  { label: 'Packages' },
  { href: '/docs/server', title: 'Server' },
  { href: '/docs/client', title: 'Client' },
  { href: '/docs/react', title: 'React' },
  { label: 'Reference' },
  { href: '/docs/protocol', title: 'Protocol' },
  { href: '/docs/architecture', title: 'Architecture' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="docs-layout">
      <nav className="docs-sidebar">
        <a href="/" className="docs-sidebar-logo">
          walkie-talkie
        </a>
        {NAV.map((item, i) =>
          'label' in item && !('href' in item) ? (
            <div key={i} className="docs-sidebar-label">
              {item.label}
            </div>
          ) : (
            <a
              key={i}
              href={(item as any).href}
              className="docs-sidebar-link"
              data-active={pathname === (item as any).href}
            >
              {(item as any).title}
            </a>
          )
        )}
        <div style={{ flex: 1 }} />
        <a
          href={GITHUB}
          target="_blank"
          rel="noopener noreferrer"
          className="docs-sidebar-link"
          style={{ marginTop: 16, fontSize: 12.5, opacity: 0.6 }}
        >
          GitHub
        </a>
      </nav>
      <main className="docs-main">{children}</main>
    </div>
  );
}
