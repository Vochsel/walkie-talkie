'use client';

import { useEffect, useRef } from 'react';

const ACCENT = '#00d4aa';
const BG = '#0a0a0f';
const CARD_BG = '#12121a';
const CARD_BORDER = '#1e1e2e';
const TEXT = '#e0e0e0';
const TEXT_DIM = '#888';
const MAX_WIDTH = 1100;

function TerminalWindow({ children, title, glow }: { children: React.ReactNode; title?: string; glow?: boolean }) {
  return (
    <div
      style={{
        background: '#0d0d14',
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: glow
          ? `0 0 60px rgba(0, 212, 170, 0.15), 0 0 120px rgba(0, 212, 170, 0.05)`
          : '0 4px 24px rgba(0,0,0,0.4)',
        maxWidth: 680,
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: '#08080d',
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        {title && (
          <span style={{ marginLeft: 8, fontSize: 13, color: TEXT_DIM, fontFamily: 'monospace' }}>{title}</span>
        )}
      </div>
      <div
        style={{
          padding: '20px 24px',
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 14,
          lineHeight: 1.7,
          color: TEXT,
          overflowX: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: '28px 24px',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.boxShadow = `0 0 30px rgba(0, 212, 170, 0.08)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = CARD_BORDER;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 600, color: '#fff' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: TEXT_DIM }}>{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div
        style={{
          minWidth: 44,
          height: 44,
          borderRadius: '50%',
          background: `${ACCENT}15`,
          border: `1px solid ${ACCENT}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: ACCENT,
        }}
      >
        {number}
      </div>
      <div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 600, color: '#fff' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 15, color: TEXT_DIM, lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

function CodeLine({ prompt, children }: { prompt?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ whiteSpace: 'pre' }}>
      {prompt && <span style={{ color: ACCENT }}>$ </span>}
      {children}
    </div>
  );
}

export default function Page() {
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
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
    fontSize: 36,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
    letterSpacing: '-0.02em',
  };

  const sectionSub: React.CSSProperties = {
    fontSize: 17,
    color: TEXT_DIM,
    marginBottom: 56,
    lineHeight: 1.6,
    maxWidth: 600,
  };

  return (
    <div
      ref={mainRef}
      style={{
        background: BG,
        color: TEXT,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        minHeight: '100vh',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: `${BG}ee`,
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <div
          style={{
            ...container,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 60,
          }}
        >
          <a
            href="/"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}
          >
            walkie-talkie
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {['Features', 'Setup', 'Docs', 'Showcase'].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                style={{
                  fontSize: 14,
                  color: TEXT_DIM,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
              >
                {link}
              </a>
            ))}
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#fff',
                textDecoration: 'none',
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                padding: '6px 16px',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = ACCENT)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = CARD_BORDER)}
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...sectionStyle, paddingTop: 100, paddingBottom: 80 }}>
        <div style={{ ...container, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 20px 0',
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
            }}
          >
            Your terminal, anywhere.
          </h1>
          <p
            style={{
              fontSize: 20,
              color: TEXT_DIM,
              maxWidth: 560,
              lineHeight: 1.6,
              margin: '0 0 40px 0',
            }}
          >
            One command to start. QR code to connect. Access your terminal from any browser on any device.
          </p>
          <div style={{ display: 'flex', gap: 16, marginBottom: 56 }}>
            <a
              href="#setup"
              style={{
                background: ACCENT,
                color: '#0a0a0f',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Get Started
            </a>
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                color: '#fff',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${CARD_BORDER}`,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = ACCENT)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = CARD_BORDER)}
            >
              View on GitHub
            </a>
          </div>
          <TerminalWindow title="walkie-talkie" glow>
            <CodeLine prompt>npx walkie-talkie</CodeLine>
            <div style={{ height: 12 }} />
            <CodeLine>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{'  walkie-talkie'}</span>
              <span style={{ color: TEXT_DIM }}> v1.0.0</span>
            </CodeLine>
            <CodeLine>
              <span style={{ color: TEXT_DIM }}>{'  Remote terminal access from your browser'}</span>
            </CodeLine>
            <div style={{ height: 12 }} />
            <CodeLine>
              <span style={{ color: '#28c840' }}>{'  Server running'}</span>
            </CodeLine>
            <CodeLine>
              <span style={{ color: TEXT_DIM }}>{'  Local: '}</span>
              <span style={{ color: '#fff' }}>http://localhost:3456</span>
            </CodeLine>
            <CodeLine>
              <span style={{ color: TEXT_DIM }}>{'  Token: '}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>a7f3-b2c1-d9e0-f456</span>
            </CodeLine>
            <div style={{ height: 12 }} />
            <CodeLine>
              <span style={{ color: TEXT_DIM }}>{'  Open in browser:'}</span>
            </CodeLine>
            <CodeLine>
              <span style={{ color: ACCENT, textDecoration: 'underline' }}>{'  https://demo.walkie-talkie.dev?server=...&token=a7f3-b2c1-d9e0-f456'}</span>
            </CodeLine>
          </TerminalWindow>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Why walkie-talkie?</h2>
          <p style={sectionSub}>
            Everything you need for remote terminal access, nothing you don&apos;t.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            <FeatureCard
              title="One command"
              description="npx walkie-talkie and you're running. No install, no config."
            />
            <FeatureCard
              title="Secure by default"
              description="Magic tokens, single-use, 5-minute expiry. QR codes for easy pairing."
            />
            <FeatureCard
              title="Cross-platform"
              description="Mac, Windows, Linux. Works everywhere Node.js runs."
            />
            <FeatureCard
              title="Multiple terminals"
              description="Open as many terminals as you need. Tabs, splits, whatever your client wants."
            />
            <FeatureCard
              title="Any browser"
              description="Connect from your phone, tablet, laptop. xterm.js rendering."
            />
            <FeatureCard
              title="Tunnel ready"
              description="ngrok integration for cross-network access with automatic HTTPS."
            />
          </div>
        </div>
      </section>

      {/* Setup */}
      <section id="setup" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Get started in 30 seconds</h2>
          <p style={sectionSub}>Three steps. That&apos;s it.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginBottom: 72 }}>
            <StepCard
              number={1}
              title="Start the server"
              description="npx walkie-talkie"
            />
            <StepCard
              number={2}
              title="Open your browser"
              description="http://localhost:3456"
            />
            <StepCard
              number={3}
              title="Connect with the token from your terminal"
              description="Enter the token displayed in your terminal, or scan the QR code."
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              Or build your own client
            </h3>
            <p style={{ fontSize: 15, color: TEXT_DIM, marginBottom: 28, lineHeight: 1.6 }}>
              The WebSocket protocol is simple and documented. Connect from any language.
            </p>
            <TerminalWindow title="client.ts">
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#c678dd' }}>const</span>
                <span style={{ color: TEXT }}> ws </span>
                <span style={{ color: '#c678dd' }}>=</span>
                <span style={{ color: TEXT }}> </span>
                <span style={{ color: '#c678dd' }}>new</span>
                <span style={{ color: '#61afef' }}> WebSocket</span>
                <span style={{ color: TEXT }}>(</span>
                <span style={{ color: '#98c379' }}>&apos;ws://localhost:3456/ws&apos;</span>
                <span style={{ color: TEXT }}>);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>ws.</span>
                <span style={{ color: '#61afef' }}>send</span>
                <span style={{ color: TEXT }}>(JSON.</span>
                <span style={{ color: '#61afef' }}>stringify</span>
                <span style={{ color: TEXT }}>(</span>
                <span style={{ color: TEXT }}>{'{ '}</span>
                <span style={{ color: '#e06c75' }}>type</span>
                <span style={{ color: TEXT }}>: </span>
                <span style={{ color: '#98c379' }}>&apos;auth&apos;</span>
                <span style={{ color: TEXT }}>, </span>
                <span style={{ color: '#e06c75' }}>token</span>
                <span style={{ color: TEXT }}>: </span>
                <span style={{ color: '#98c379' }}>&apos;your-token&apos;</span>
                <span style={{ color: TEXT }}>{' }'}</span>
                <span style={{ color: TEXT }}>));</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>ws.</span>
                <span style={{ color: '#61afef' }}>send</span>
                <span style={{ color: TEXT }}>(JSON.</span>
                <span style={{ color: '#61afef' }}>stringify</span>
                <span style={{ color: TEXT }}>(</span>
                <span style={{ color: TEXT }}>{'{ '}</span>
                <span style={{ color: '#e06c75' }}>type</span>
                <span style={{ color: TEXT }}>: </span>
                <span style={{ color: '#98c379' }}>&apos;terminal:create&apos;</span>
                <span style={{ color: TEXT }}>, </span>
                <span style={{ color: '#e06c75' }}>cols</span>
                <span style={{ color: TEXT }}>: </span>
                <span style={{ color: '#d19a66' }}>80</span>
                <span style={{ color: TEXT }}>, </span>
                <span style={{ color: '#e06c75' }}>rows</span>
                <span style={{ color: TEXT }}>: </span>
                <span style={{ color: '#d19a66' }}>24</span>
                <span style={{ color: TEXT }}>{' }'}</span>
                <span style={{ color: TEXT }}>));</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>ws.</span>
                <span style={{ color: '#e06c75' }}>onmessage</span>
                <span style={{ color: TEXT }}> = </span>
                <span style={{ color: TEXT }}>(</span>
                <span style={{ color: '#e5c07b' }}>e</span>
                <span style={{ color: TEXT }}>) </span>
                <span style={{ color: '#c678dd' }}>=&gt;</span>
                <span style={{ color: TEXT }}> {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>{'  '}</span>
                <span style={{ color: '#c678dd' }}>const</span>
                <span style={{ color: TEXT }}> msg = JSON.</span>
                <span style={{ color: '#61afef' }}>parse</span>
                <span style={{ color: TEXT }}>(e.data);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>{'  '}</span>
                <span style={{ color: '#c678dd' }}>if</span>
                <span style={{ color: TEXT }}> (msg.type === </span>
                <span style={{ color: '#98c379' }}>&apos;terminal:output&apos;</span>
                <span style={{ color: TEXT }}>) {'{'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>{'    '}terminal.</span>
                <span style={{ color: '#61afef' }}>write</span>
                <span style={{ color: TEXT }}>(msg.data);</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>{'  }'}</span>
              </div>
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: TEXT }}>{'};'}</span>
              </div>
            </TerminalWindow>
          </div>
        </div>
      </section>

      {/* Protocol Docs */}
      <section id="docs" style={sectionStyle}>
        <div style={container}>
          <h2 style={sectionHeading}>Simple WebSocket Protocol</h2>
          <p style={sectionSub}>
            A clean message-based protocol. JSON in, JSON out.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 32,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: ACCENT, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Client Messages
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['auth', 'terminal:create', 'terminal:input', 'terminal:resize', 'terminal:kill', 'terminal:list'].map(
                  (msg) => (
                    <div
                      key={msg}
                      style={{
                        background: CARD_BG,
                        border: `1px solid ${CARD_BORDER}`,
                        borderRadius: 8,
                        padding: '10px 16px',
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 14,
                        color: '#fff',
                      }}
                    >
                      {msg}
                    </div>
                  )
                )}
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: ACCENT, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Server Messages
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['auth:ok', 'auth:fail', 'terminal:created', 'terminal:output', 'terminal:exited', 'terminal:list', 'error'].map(
                  (msg) => (
                    <div
                      key={msg}
                      style={{
                        background: CARD_BG,
                        border: `1px solid ${CARD_BORDER}`,
                        borderRadius: 8,
                        padding: '10px 16px',
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 14,
                        color: '#fff',
                      }}
                    >
                      {msg}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" style={sectionStyle}>
        <div style={{ ...container, textAlign: 'center' }}>
          <h2 style={{ ...sectionHeading, marginBottom: 16 }}>AI Showcase</h2>
          <p
            style={{
              fontSize: 17,
              color: TEXT_DIM,
              maxWidth: 560,
              margin: '0 auto 40px',
              lineHeight: 1.6,
            }}
          >
            See GPT 5.1 mini generate a terminal UI in real-time that connects to your local walkie-talkie server.
          </p>
          <a
            href="/showcase"
            style={{
              display: 'inline-block',
              background: ACCENT,
              color: '#0a0a0f',
              padding: '14px 32px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Try the AI Showcase &rarr;
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${CARD_BORDER}`,
          marginTop: 80,
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
          <p style={{ margin: 0, fontSize: 14, color: TEXT_DIM }}>
            Built with{' '}
            <span style={{ color: TEXT }}>node-pty</span>,{' '}
            <span style={{ color: TEXT }}>xterm.js</span>, and{' '}
            <span style={{ color: TEXT }}>WebSockets</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a
              href="https://github.com/vochsel/walkie-talkie"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 14, color: TEXT_DIM, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
            >
              GitHub
            </a>
            <span style={{ fontSize: 14, color: TEXT_DIM }}>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
