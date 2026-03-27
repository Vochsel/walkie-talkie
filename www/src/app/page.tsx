'use client';

import { useEffect, useState, useCallback } from 'react';

const TEXT = '#26251e';
const TEXT_SEC = 'rgba(38, 37, 30, 0.55)';
const TEXT_MUTED = 'rgba(38, 37, 30, 0.35)';
const BG = '#f7f7f4';
const BG_CODE = '#1a1814';
const BORDER = 'rgba(38, 37, 30, 0.08)';
const BORDER_HOVER = 'rgba(38, 37, 30, 0.16)';
const SURFACE = 'rgba(38, 37, 30, 0.03)';
const MAX_WIDTH = 1060;
const MONO = "'Berkeley Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace";

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <button
      onClick={copy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        background: BG_CODE,
        borderRadius: 12,
        padding: '16px 20px 16px 24px',
        fontFamily: MONO,
        fontSize: 15,
        color: '#edecec',
        border: `1px solid ${hovered ? 'rgba(237, 236, 236, 0.15)' : 'rgba(237, 236, 236, 0.08)'}`,
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
        letterSpacing: '-0.01em',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, whiteSpace: 'nowrap' }}>
        <span style={{ color: 'rgba(237, 236, 236, 0.3)' }}>$ </span>
        {command}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: copied ? 'rgba(74, 222, 128, 0.12)' : hovered ? 'rgba(237, 236, 236, 0.08)' : 'rgba(237, 236, 236, 0.04)',
          transition: 'background 0.15s ease',
          flexShrink: 0,
        }}
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="rgba(237, 236, 236, 0.45)" strokeWidth="1.2" />
            <path d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5" stroke="rgba(237, 236, 236, 0.45)" strokeWidth="1.2" />
          </svg>
        )}
      </span>
    </button>
  );
}

function CodeBlock({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: BG_CODE,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid rgba(237, 236, 236, 0.08)`,
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: `1px solid rgba(237, 236, 236, 0.06)`,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.1)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.1)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.1)' }} />
          <span
            style={{
              marginLeft: 8,
              fontSize: 12,
              color: 'rgba(237, 236, 236, 0.35)',
              fontFamily: MONO,
            }}
          >
            {title}
          </span>
        </div>
      )}
      <div
        style={{
          padding: '20px 24px',
          fontFamily: MONO,
          fontSize: 14,
          lineHeight: 1.8,
          color: '#edecec',
          overflowX: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      style={{
        fontSize: 14,
        color: hovered ? TEXT : TEXT_SEC,
        textDecoration: 'none',
        transition: 'color 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </a>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        padding: '28px 24px',
        borderRadius: 12,
        border: `1px solid ${hovered ? BORDER_HOVER : BORDER}`,
        background: hovered ? 'rgba(38, 37, 30, 0.02)' : 'transparent',
        transition: 'all 0.2s ease',
        height: '100%',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: 16,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: TEXT_SEC }}>
        {description}
      </p>
    </div>
  );
}

function ProtocolBadge({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: hovered ? 'rgba(38, 37, 30, 0.05)' : SURFACE,
        border: `1px solid ${hovered ? BORDER_HOVER : BORDER}`,
        borderRadius: 8,
        padding: '10px 16px',
        fontFamily: MONO,
        fontSize: 13,
        color: TEXT,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

export default function Page() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const container: React.CSSProperties = {
    maxWidth: MAX_WIDTH,
    margin: '0 auto',
    padding: '0 24px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const sectionStyle: React.CSSProperties = {
    paddingTop: 120,
    paddingBottom: 40,
  };

  const sectionHeading: React.CSSProperties = {
    fontSize: 32,
    fontWeight: 600,
    color: TEXT,
    marginBottom: 12,
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
  };

  const sectionSub: React.CSSProperties = {
    fontSize: 16,
    color: TEXT_SEC,
    marginBottom: 48,
    lineHeight: 1.6,
    maxWidth: 480,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 20,
  };

  return (
    <div
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        minHeight: '100vh',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: scrolled ? `${BG}ee` : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? `1px solid ${BORDER}` : '1px solid transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            ...container,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <a
            href="/"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            walkie-talkie
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#build">Build</NavLink>
            <NavLink href="#protocol">Protocol</NavLink>
            <NavLink href="/docs">Docs</NavLink>
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: TEXT,
                textDecoration: 'none',
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '6px 14px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(38, 37, 30, 0.06)';
                e.currentTarget.style.borderColor = BORDER_HOVER;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = SURFACE;
                e.currentTarget.style.borderColor = BORDER;
              }}
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 100, paddingBottom: 100 }}>
        <div
          style={{
            ...container,
            animation: 'fadeSlideUp 0.6s ease-out',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, color: TEXT_MUTED, marginBottom: 20, letterSpacing: '0.02em' }}>
            Open source terminal sharing
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-gelasio), Georgia, serif',
              fontSize: 64,
              fontWeight: 700,
              color: TEXT,
              margin: '0 0 24px 0',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: 680,
              fontStyle: 'normal',
            }}
          >
            Your terminal,{' '}
            <span style={{ fontStyle: 'italic', color: TEXT_SEC }}>anywhere</span>.
          </h1>
          <p
            style={{
              fontSize: 18,
              color: TEXT_SEC,
              maxWidth: 440,
              lineHeight: 1.6,
              margin: '0 0 40px 0',
              fontWeight: 400,
            }}
          >
            Access your terminal from any browser.
            One command to start. Scan a QR code to connect.
          </p>

          <CopyCommand command="npx @walkie-talkie/cli@latest --open" />

          <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 16 }}>
            No install. No config. No signup.
          </p>

          <div style={{ marginTop: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
            <video
              autoPlay
              muted
              loop
              playsInline
              style={{ display: 'block', width: '100%', height: 'auto' }}
            >
              <source src="/walkie-talkie-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>How it works</h2>
          <p style={sectionSub}>
            A WebSocket server bridges your terminal to the browser. Secure tokens, real-time I/O.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
            }}
          >
            {[
              { step: '01', label: 'Run the command', detail: 'Starts a local server with a unique token' },
              { step: '02', label: 'Open the link', detail: 'Or scan the QR code from your phone' },
              { step: '03', label: 'You\'re connected', detail: 'Full terminal access in your browser' },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  padding: '28px 24px',
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: TEXT_MUTED,
                    fontWeight: 500,
                  }}
                >
                  {s.step}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginTop: 12, marginBottom: 6 }}>
                  {s.label}
                </h3>
                <p style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.5, margin: 0 }}>{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="build" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Packages</h2>
          <p style={sectionSub}>
            Modular packages you can use together or independently. Install what you need.
          </p>

          {/* Package cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              marginBottom: 80,
            }}
          >
            {[
              {
                name: '@walkie-talkie/react',
                install: 'npm i @walkie-talkie/react',
                description: 'React hooks and a drop-in terminal component. useWalkieTalkie() for connection state, TerminalView for rendering.',
                tags: ['useWalkieTalkie', 'TerminalView', 'defaultTheme'],
              },
              {
                name: '@walkie-talkie/client',
                install: 'npm i @walkie-talkie/client',
                description: 'Framework-agnostic WebSocket client. Auto-reconnect with exponential backoff, session resumption, and typed messages.',
                tags: ['WalkieTalkieClient', 'ConnectionState', 'saveConnection'],
              },
              {
                name: '@walkie-talkie/shared',
                install: 'npm i @walkie-talkie/shared',
                description: 'Protocol types and constants. Use this to build your own client in any language or runtime.',
                tags: ['ServerMessage', 'ClientMessage', 'TerminalInfo'],
              },
            ].map((pkg) => (
              <div
                key={pkg.name}
                style={{
                  padding: '28px 24px',
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <code
                  style={{
                    fontFamily: MONO,
                    fontSize: 14,
                    fontWeight: 600,
                    color: TEXT,
                  }}
                >
                  {pkg.name}
                </code>
                <p style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.6, margin: 0, flex: 1 }}>
                  {pkg.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pkg.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        color: TEXT_MUTED,
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: TEXT_MUTED,
                    background: SURFACE,
                    borderRadius: 6,
                    padding: '8px 12px',
                    marginTop: 4,
                  }}
                >
                  <span style={{ color: TEXT_MUTED, opacity: 0.6 }}>$ </span>
                  {pkg.install}
                </div>
              </div>
            ))}
          </div>

          {/* React example */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              alignItems: 'start',
              marginBottom: 80,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: TEXT,
                  marginBottom: 10,
                  letterSpacing: '-0.02em',
                }}
              >
                Custom terminal UI in minutes
              </h3>
              <p style={{ fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, marginBottom: 28 }}>
                The React package gives you everything you need to build custom terminal experiences. Full xterm.js rendering with auto-resize, theming, and connection management out of the box.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { msg: 'useWalkieTalkie()', desc: 'Connection state, terminal list, I/O' },
                  { msg: 'TerminalView', desc: 'Drop-in xterm.js component' },
                  { msg: 'defaultTheme', desc: 'Pre-built terminal color scheme' },
                  { msg: 'usePersistedState', desc: 'localStorage-backed React state' },
                ].map((item) => (
                  <div key={item.msg} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <code
                      style={{
                        fontFamily: MONO,
                        fontSize: 13,
                        color: TEXT,
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: '4px 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.msg}
                    </code>
                    <span style={{ fontSize: 14, color: TEXT_SEC }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <CodeBlock title="MyTerminal.tsx">
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#c586c0' }}>import</span>
                <span style={{ color: '#edecec' }}> {'{ '}</span>
                <span style={{ color: '#9cdcfe' }}>useWalkieTalkie</span>
                <span style={{ color: '#edecec' }}>{', '}</span>
                <span style={{ color: '#9cdcfe' }}>TerminalView</span>
                <span style={{ color: '#edecec' }}>{' }'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>from</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#ce9178' }}>&apos;@walkie-talkie/react&apos;</span>
                <span style={{ color: '#edecec' }}>;</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#c586c0' }}>function</span>
                <span style={{ color: '#dcdcaa' }}> App</span>
                <span style={{ color: '#edecec' }}>() {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>const</span>
                <span style={{ color: '#edecec' }}> {'{ '}</span>
                <span style={{ color: '#9cdcfe' }}>connect</span>
                <span style={{ color: '#edecec' }}>{', '}</span>
                <span style={{ color: '#9cdcfe' }}>terminals</span>
                <span style={{ color: '#edecec' }}>{', '}</span>
                <span style={{ color: '#9cdcfe' }}>sendInput</span>
                <span style={{ color: '#edecec' }}>,</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}</span>
                <span style={{ color: '#9cdcfe' }}>resizeTerminal</span>
                <span style={{ color: '#edecec' }}>{', '}</span>
                <span style={{ color: '#9cdcfe' }}>registerOutputHandler</span>
                <span style={{ color: '#edecec' }}>{', '}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}</span>
                <span style={{ color: '#9cdcfe' }}>createTerminal</span>
                <span style={{ color: '#edecec' }}>{' } = '}</span>
                <span style={{ color: '#dcdcaa' }}>useWalkieTalkie</span>
                <span style={{ color: '#edecec' }}>();</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>return</span>
                <span style={{ color: '#edecec' }}> (</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}</span>
                <span style={{ color: '#808080' }}>{'<'}</span>
                <span style={{ color: '#4ec9b0' }}>TerminalView</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'      '}</span>
                <span style={{ color: '#9cdcfe' }}>terminalId</span>
                <span style={{ color: '#edecec' }}>=</span>
                <span style={{ color: '#edecec' }}>{'{'}</span>
                <span style={{ color: '#9cdcfe' }}>terminals</span>
                <span style={{ color: '#edecec' }}>[</span>
                <span style={{ color: '#b5cea8' }}>0</span>
                <span style={{ color: '#edecec' }}>].</span>
                <span style={{ color: '#9cdcfe' }}>id</span>
                <span style={{ color: '#edecec' }}>{'}'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'      '}</span>
                <span style={{ color: '#9cdcfe' }}>isActive</span>
                <span style={{ color: '#edecec' }}>=</span>
                <span style={{ color: '#edecec' }}>{'{'}</span>
                <span style={{ color: '#569cd6' }}>true</span>
                <span style={{ color: '#edecec' }}>{'}'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'      '}</span>
                <span style={{ color: '#9cdcfe' }}>onInput</span>
                <span style={{ color: '#edecec' }}>=</span>
                <span style={{ color: '#edecec' }}>{'{'}</span>
                <span style={{ color: '#9cdcfe' }}>d</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#c586c0' }}>=&gt;</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#dcdcaa' }}>sendInput</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#9cdcfe' }}>id</span>
                <span style={{ color: '#edecec' }}>, </span>
                <span style={{ color: '#9cdcfe' }}>d</span>
                <span style={{ color: '#edecec' }}>){'}'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'      '}</span>
                <span style={{ color: '#9cdcfe' }}>onResize</span>
                <span style={{ color: '#edecec' }}>=</span>
                <span style={{ color: '#edecec' }}>{'{'}</span>
                <span style={{ color: '#9cdcfe' }}>resizeTerminal</span>
                <span style={{ color: '#edecec' }}>{'}'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'      '}</span>
                <span style={{ color: '#9cdcfe' }}>registerOutput</span>
                <span style={{ color: '#edecec' }}>=</span>
                <span style={{ color: '#edecec' }}>{'{'}</span>
                <span style={{ color: '#9cdcfe' }}>registerOutputHandler</span>
                <span style={{ color: '#edecec' }}>{'}'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}</span>
                <span style={{ color: '#808080' }}>/&gt;</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  )'}</span>
                <span style={{ color: '#edecec' }}>;</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'}'}</span>
              </div>
            </CodeBlock>
          </div>

          {/* Client example */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              alignItems: 'start',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: TEXT,
                  marginBottom: 10,
                  letterSpacing: '-0.02em',
                }}
              >
                Or go framework-agnostic
              </h3>
              <p style={{ fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, marginBottom: 28 }}>
                The client package handles WebSocket connections, auth, and reconnection. No React required — use it with any framework or vanilla JS.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { msg: 'connect()', desc: 'Authenticate and open a session' },
                  { msg: 'onStateChange()', desc: 'Subscribe to connection state' },
                  { msg: 'onMessage()', desc: 'Handle all server messages' },
                  { msg: 'resumeSession()', desc: 'Reconnect to an existing session' },
                ].map((item) => (
                  <div key={item.msg} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <code
                      style={{
                        fontFamily: MONO,
                        fontSize: 13,
                        color: TEXT,
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: '4px 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.msg}
                    </code>
                    <span style={{ fontSize: 14, color: TEXT_SEC }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <CodeBlock title="client.ts">
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#c586c0' }}>import</span>
                <span style={{ color: '#edecec' }}> {'{ '}</span>
                <span style={{ color: '#9cdcfe' }}>WalkieTalkieClient</span>
                <span style={{ color: '#edecec' }}>{' }'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>from</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#ce9178' }}>&apos;@walkie-talkie/client&apos;</span>
                <span style={{ color: '#edecec' }}>;</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#c586c0' }}>const</span>
                <span style={{ color: '#edecec' }}> client </span>
                <span style={{ color: '#c586c0' }}>=</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#c586c0' }}>new</span>
                <span style={{ color: '#dcdcaa' }}> WalkieTalkieClient</span>
                <span style={{ color: '#edecec' }}>();</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>client.</span>
                <span style={{ color: '#dcdcaa' }}>onStateChange</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#9cdcfe' }}>state</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#c586c0' }}>=&gt;</span>
                <span style={{ color: '#edecec' }}> {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}console.</span>
                <span style={{ color: '#dcdcaa' }}>log</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#ce9178' }}>&apos;State:&apos;</span>
                <span style={{ color: '#edecec' }}>, state);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'}'});</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>client.</span>
                <span style={{ color: '#dcdcaa' }}>onMessage</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#9cdcfe' }}>msg</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#c586c0' }}>=&gt;</span>
                <span style={{ color: '#edecec' }}> {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>if</span>
                <span style={{ color: '#edecec' }}> (msg.type === </span>
                <span style={{ color: '#ce9178' }}>&apos;terminal:output&apos;</span>
                <span style={{ color: '#edecec' }}>)</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}terminal.</span>
                <span style={{ color: '#dcdcaa' }}>write</span>
                <span style={{ color: '#edecec' }}>(msg.data);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'}'});</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#6a9955' }}>{'// Connect with server URL + token'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>client.</span>
                <span style={{ color: '#dcdcaa' }}>connect</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#ce9178' }}>&apos;ws://localhost:3456&apos;</span>
                <span style={{ color: '#edecec' }}>, token);</span>
              </div>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Protocol reference */}
      <section id="protocol" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Protocol reference</h2>
          <p style={sectionSub}>Every message type, at a glance.</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
            }}
          >
            <div>
              <h3 style={labelStyle}>Client &rarr; Server</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'auth',
                  'terminal:create',
                  'terminal:input',
                  'terminal:resize',
                  'terminal:kill',
                  'terminal:list',
                ].map((msg) => (
                  <ProtocolBadge key={msg}>{msg}</ProtocolBadge>
                ))}
              </div>
            </div>
            <div>
              <h3 style={labelStyle}>Server &rarr; Client</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'auth:ok',
                  'auth:fail',
                  'terminal:created',
                  'terminal:output',
                  'terminal:exited',
                  'terminal:list',
                  'error',
                ].map((msg) => (
                  <ProtocolBadge key={msg}>{msg}</ProtocolBadge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingTop: 100, paddingBottom: 120 }}>
        <div style={container}>
          <div
            style={{
              background: BG_CODE,
              borderRadius: 16,
              padding: '64px 56px',
              border: `1px solid rgba(237, 236, 236, 0.06)`,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-gelasio), Georgia, serif',
                fontSize: 40,
                fontWeight: 700,
                color: '#edecec',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                marginBottom: 16,
                maxWidth: 500,
                fontStyle: 'normal',
              }}
            >
              One command. Real terminal. Any device.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(237, 236, 236, 0.5)', marginBottom: 36, maxWidth: 380, lineHeight: 1.6 }}>
              Open source, MIT licensed. Start building in seconds.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <CopyCommand command="npx @walkie-talkie/cli@latest --open" />
              <a
                href="https://github.com/vochsel/walkie-talkie"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(237, 236, 236, 0.55)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#edecec')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(237, 236, 236, 0.55)')}
              >
                View on GitHub &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '32px 0',
        }}
      >
        <div
          style={{
            ...container,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, letterSpacing: '-0.01em' }}>walkie-talkie</span>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>Remote terminal access</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: TEXT_SEC, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SEC)}
            >
              GitHub
            </a>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
