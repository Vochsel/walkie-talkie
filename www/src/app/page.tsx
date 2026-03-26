'use client';

import { useEffect, useState } from 'react';

const TEXT = '#26251e';
const TEXT_SEC = 'rgba(38, 37, 30, 0.55)';
const TEXT_MUTED = 'rgba(38, 37, 30, 0.35)';
const BG = '#f7f7f4';
const BG_CODE = '#14120b';
const BORDER = 'rgba(38, 37, 30, 0.08)';
const BORDER_HOVER = 'rgba(38, 37, 30, 0.16)';
const SURFACE = 'rgba(38, 37, 30, 0.03)';
const MAX_WIDTH = 1100;

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
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.12)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.12)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(237, 236, 236, 0.12)' }} />
          <span
            style={{
              marginLeft: 8,
              fontSize: 12,
              color: 'rgba(237, 236, 236, 0.4)',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}
          >
            {title}
          </span>
        </div>
      )}
      <div
        style={{
          padding: '20px 24px',
          fontFamily: "'Berkeley Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
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

function CodeLine({ prompt, children }: { prompt?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ whiteSpace: 'pre' }}>
      {prompt && <span style={{ color: 'rgba(237, 236, 236, 0.35)' }}>$ </span>}
      {children}
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

function Card({
  title,
  description,
  href,
  linkText,
}: {
  title: string;
  description: string;
  href?: string;
  linkText?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const inner = (
    <div
      style={{
        padding: '36px 32px',
        borderRadius: 12,
        border: `1px solid ${hovered ? BORDER_HOVER : BORDER}`,
        background: hovered ? 'rgba(38, 37, 30, 0.02)' : 'transparent',
        transition: 'all 0.2s ease',
        cursor: href ? 'pointer' : 'default',
        height: '100%',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          fontSize: 18,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: TEXT_SEC }}>
        {description}
      </p>
      {linkText && (
        <p
          style={{
            margin: '16px 0 0 0',
            fontSize: 14,
            fontWeight: 500,
            color: hovered ? TEXT : TEXT_SEC,
            transition: 'color 0.15s ease',
          }}
        >
          {linkText} &rarr;
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </a>
    );
  }
  return inner;
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
    paddingTop: 140,
    paddingBottom: 40,
  };

  const sectionHeading: React.CSSProperties = {
    fontSize: 38,
    fontWeight: 600,
    color: TEXT,
    marginBottom: 12,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
  };

  const sectionSub: React.CSSProperties = {
    fontSize: 17,
    color: TEXT_SEC,
    marginBottom: 60,
    lineHeight: 1.6,
    maxWidth: 520,
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
              fontSize: 17,
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
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: TEXT,
                textDecoration: 'none',
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '7px 16px',
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
      <section style={{ paddingTop: 120, paddingBottom: 100 }}>
        <div
          style={{
            ...container,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            animation: 'fadeSlideUp 0.6s ease-out',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-gelasio), Georgia, serif',
              fontSize: 72,
              fontWeight: 700,
              color: TEXT,
              margin: '0 0 24px 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              maxWidth: 800,
              fontStyle: 'normal',
            }}
          >
            Your terminal, anywhere.
          </h1>
          <p
            style={{
              fontSize: 20,
              color: TEXT_SEC,
              maxWidth: 480,
              lineHeight: 1.6,
              margin: '0 0 48px 0',
              fontWeight: 400,
            }}
          >
            Access your terminal from any browser. One command. That&apos;s it.
          </p>

          {/* The one command */}
          <div
            style={{
              background: BG_CODE,
              borderRadius: 12,
              padding: '18px 32px',
              fontFamily: "'Berkeley Mono', 'SF Mono', 'Fira Code', monospace",
              fontSize: 16,
              color: '#edecec',
              border: `1px solid rgba(237, 236, 236, 0.08)`,
              marginBottom: 24,
              userSelect: 'all',
              cursor: 'text',
              letterSpacing: '-0.01em',
            }}
          >
            <span style={{ color: 'rgba(237, 236, 236, 0.35)' }}>$ </span>
            npx @walkie-talkie/cli@latest --open
          </div>
          <p style={{ fontSize: 14, color: TEXT_MUTED }}>
            No install. No config. No signup.
          </p>
        </div>
      </section>

      {/* How it works — dead simple */}
      <section id="how-it-works" style={{ paddingTop: 100, paddingBottom: 40 }}>
        <div style={{ ...container, textAlign: 'center' }}>
          <h2 style={{ ...sectionHeading, marginBottom: 16 }}>How it works</h2>
          <p style={{ ...sectionSub, margin: '0 auto 64px', maxWidth: 440 }}>
            A WebSocket server that bridges your terminal to the browser. Secure tokens, real-time I/O.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 80,
              flexWrap: 'wrap',
            }}
          >
            {[
              { step: '1', label: 'Run the command', detail: 'Starts a local server with a unique token' },
              { step: '2', label: 'Open the link', detail: 'Or scan the QR code from your phone' },
              { step: '3', label: 'You\'re connected', detail: 'Full terminal access in your browser' },
            ].map((s) => (
              <div key={s.step} style={{ maxWidth: 200, textAlign: 'center' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: `1px solid ${BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 600,
                    color: TEXT_SEC,
                    margin: '0 auto 16px',
                  }}
                >
                  {s.step}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{s.label}</h3>
                <p style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Build your own */}
      <section id="build" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Build on top of it</h2>
          <p style={sectionSub}>
            walkie-talkie gives you remote terminal access as a primitive. What you build with it is up to you.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 80,
            }}
          >
            <Card
              title="Vibe code your own dev environment"
              description="Build custom agent UIs, terminal dashboards, or AI-powered dev tools. The WebSocket protocol is simple — connect and start building."
            />
            <Card
              title="Use the client libraries"
              description="Drop in the React hooks or connect directly via WebSocket from any language. TypeScript, Python, Go — whatever you're working in."
            />
            <Card
              title="Connect AI agents"
              description="Give your AI agents a real terminal. Code execution, system access, tool use — all through a clean, authenticated WebSocket connection."
            />
          </div>

          {/* Code example */}
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
                  fontSize: 24,
                  fontWeight: 600,
                  color: TEXT,
                  marginBottom: 12,
                  letterSpacing: '-0.02em',
                }}
              >
                Simple WebSocket API
              </h3>
              <p style={{ fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, marginBottom: 24 }}>
                Authenticate, create a terminal, send input, receive output. Four messages to get a working terminal
                client.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {[
                  { msg: 'auth', desc: 'Authenticate with your token' },
                  { msg: 'terminal:create', desc: 'Spawn a new terminal session' },
                  { msg: 'terminal:input', desc: 'Send keystrokes' },
                  { msg: 'terminal:output', desc: 'Receive terminal data' },
                ].map((item) => (
                  <div key={item.msg} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <code
                      style={{
                        fontFamily: "'Berkeley Mono', 'SF Mono', monospace",
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
                <span style={{ color: '#c586c0' }}>const</span>
                <span style={{ color: '#edecec' }}> ws </span>
                <span style={{ color: '#c586c0' }}>=</span>
                <span style={{ color: '#edecec' }}> </span>
                <span style={{ color: '#c586c0' }}>new</span>
                <span style={{ color: '#dcdcaa' }}> WebSocket</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#ce9178' }}>&apos;ws://localhost:3456/ws&apos;</span>
                <span style={{ color: '#edecec' }}>);</span>
              </div>
              <div style={{ height: 4 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#6a9955' }}>{'// Authenticate'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>ws.</span>
                <span style={{ color: '#dcdcaa' }}>send</span>
                <span style={{ color: '#edecec' }}>(JSON.</span>
                <span style={{ color: '#dcdcaa' }}>stringify</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#edecec' }}>{'{ '}</span>
                <span style={{ color: '#9cdcfe' }}>type</span>
                <span style={{ color: '#edecec' }}>: </span>
                <span style={{ color: '#ce9178' }}>&apos;auth&apos;</span>
                <span style={{ color: '#edecec' }}>, </span>
                <span style={{ color: '#9cdcfe' }}>token</span>
                <span style={{ color: '#edecec' }}>: </span>
                <span style={{ color: '#ce9178' }}>&apos;your-token&apos;</span>
                <span style={{ color: '#edecec' }}>{' }'}</span>
                <span style={{ color: '#edecec' }}>));</span>
              </div>
              <div style={{ height: 4 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#6a9955' }}>{'// Create a terminal'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>ws.</span>
                <span style={{ color: '#dcdcaa' }}>send</span>
                <span style={{ color: '#edecec' }}>(JSON.</span>
                <span style={{ color: '#dcdcaa' }}>stringify</span>
                <span style={{ color: '#edecec' }}>(</span>
                <span style={{ color: '#edecec' }}>{'{ '}</span>
                <span style={{ color: '#9cdcfe' }}>type</span>
                <span style={{ color: '#edecec' }}>: </span>
                <span style={{ color: '#ce9178' }}>&apos;terminal:create&apos;</span>
                <span style={{ color: '#edecec' }}>{' }'}</span>
                <span style={{ color: '#edecec' }}>));</span>
              </div>
              <div style={{ height: 4 }} />
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#6a9955' }}>{'// Handle output'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>ws.</span>
                <span style={{ color: '#9cdcfe' }}>onmessage</span>
                <span style={{ color: '#edecec' }}> = (</span>
                <span style={{ color: '#9cdcfe' }}>e</span>
                <span style={{ color: '#edecec' }}>) </span>
                <span style={{ color: '#c586c0' }}>=&gt;</span>
                <span style={{ color: '#edecec' }}> {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>const</span>
                <span style={{ color: '#edecec' }}> msg = JSON.</span>
                <span style={{ color: '#dcdcaa' }}>parse</span>
                <span style={{ color: '#edecec' }}>(e.data);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  '}</span>
                <span style={{ color: '#c586c0' }}>if</span>
                <span style={{ color: '#edecec' }}> (msg.type === </span>
                <span style={{ color: '#ce9178' }}>&apos;terminal:output&apos;</span>
                <span style={{ color: '#edecec' }}>) {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'    '}terminal.</span>
                <span style={{ color: '#dcdcaa' }}>write</span>
                <span style={{ color: '#edecec' }}>(msg.data);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'  }'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#edecec' }}>{'};'}</span>
              </div>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Protocol reference */}
      <section id="protocol" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Full protocol reference</h2>
          <p style={sectionSub}>Every message type, at a glance.</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_MUTED,
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Client &rarr; Server
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'auth',
                  'terminal:create',
                  'terminal:input',
                  'terminal:resize',
                  'terminal:kill',
                  'terminal:list',
                ].map((msg) => (
                  <div
                    key={msg}
                    style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontFamily: "'Berkeley Mono', 'SF Mono', 'Fira Code', monospace",
                      fontSize: 13,
                      color: TEXT,
                    }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_MUTED,
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Server &rarr; Client
              </h3>
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
                  <div
                    key={msg}
                    style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontFamily: "'Berkeley Mono', 'SF Mono', 'Fira Code', monospace",
                      fontSize: 13,
                      color: TEXT,
                    }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          paddingTop: 120,
          paddingBottom: 140,
        }}
      >
        <div
          style={{
            ...container,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-gelasio), Georgia, serif',
              fontSize: 52,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 20,
              maxWidth: 600,
              fontStyle: 'normal',
            }}
          >
            One command. Real terminal. Any device.
          </h2>
          <p style={{ fontSize: 17, color: TEXT_SEC, marginBottom: 40, maxWidth: 400, lineHeight: 1.6 }}>
            Open source, MIT licensed. Start building in seconds.
          </p>
          <div
            style={{
              background: BG_CODE,
              borderRadius: 12,
              padding: '18px 32px',
              fontFamily: "'Berkeley Mono', 'SF Mono', monospace",
              fontSize: 16,
              color: '#edecec',
              border: `1px solid rgba(237, 236, 236, 0.08)`,
              userSelect: 'all',
              cursor: 'text',
              marginBottom: 24,
            }}
          >
            <span style={{ color: 'rgba(237, 236, 236, 0.35)' }}>$ </span>
            npx @walkie-talkie/cli@latest --open
          </div>
          <a
            href="https://github.com/vochsel/walkie-talkie"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14,
              color: TEXT_SEC,
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SEC)}
          >
            View on GitHub &rarr;
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '40px 0',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, letterSpacing: '-0.01em' }}>walkie-talkie</span>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>Remote terminal access</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
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
