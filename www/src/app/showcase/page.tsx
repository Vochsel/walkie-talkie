'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';

function highlightCode(code: string): string {
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Keywords
  highlighted = highlighted.replace(
    /\b(import|export|default|function|const|let|var|return|if|else|from|new|true|false|null|undefined|typeof|class|extends|async|await|try|catch|switch|case|break|this)\b/g,
    '<span style="color:#ff7b72">$1</span>'
  );
  // Strings
  highlighted = highlighted.replace(
    /(&#39;[^&#]*?&#39;|&quot;[^&]*?&quot;|`[^`]*?`)/g,
    '<span style="color:#a5d6ff">$1</span>'
  );
  // Brackets and parens
  highlighted = highlighted.replace(
    /([{}()[\]])/g,
    '<span style="color:#ffa657">$1</span>'
  );
  // Comments
  highlighted = highlighted.replace(
    /(\/\/.*)/g,
    '<span style="color:#8b949e">$1</span>'
  );
  // JSX tags
  highlighted = highlighted.replace(
    /(&lt;\/?[a-zA-Z][a-zA-Z0-9.]*)/g,
    '<span style="color:#7ee787">$1</span>'
  );

  return highlighted;
}

export default function ShowcasePage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/showcase',
  });

  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const latestCode =
    selectedMessageIndex !== null
      ? assistantMessages[selectedMessageIndex]?.content ?? ''
      : assistantMessages.length > 0
        ? assistantMessages[assistantMessages.length - 1]?.content ?? ''
        : '';

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0f',
        color: '#e6edf3',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(0, 212, 170, 0.15)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <a
          href="/"
          style={{
            color: '#00d4aa',
            textDecoration: 'none',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          &larr; Back
        </a>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            margin: 0,
            background: 'linear-gradient(135deg, #00d4aa, #00a884)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI Terminal UI Generator
        </h1>
      </header>

      {/* Main split layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          height: 'calc(100vh - 65px)',
        }}
      >
        {/* Left panel: Chat / Prompt area */}
        <div
          style={{
            borderRight: '1px solid rgba(0, 212, 170, 0.15)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Chat messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '80px',
                  color: '#8b949e',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>
                  &gt;_
                </div>
                <p style={{ fontSize: '18px', marginBottom: '8px', color: '#e6edf3' }}>
                  Describe the terminal UI you want
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  Try something like: &quot;Create a dark terminal dashboard with 3 terminal panes
                  arranged in a grid&quot;
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={message.id}
                style={{
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: message.role === 'user' ? '#00d4aa' : '#ffa657',
                    marginBottom: '8px',
                  }}
                >
                  {message.role === 'user' ? 'You' : 'AI'}
                </div>

                {message.role === 'user' ? (
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.6,
                      color: '#e6edf3',
                    }}
                  >
                    {message.content}
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#8b949e' }}>
                        Generated Component
                      </span>
                      <button
                        onClick={() => {
                          const aiIndex = assistantMessages.findIndex(
                            (m) => m.id === message.id
                          );
                          setSelectedMessageIndex(aiIndex);
                        }}
                        style={{
                          background:
                            latestCode === message.content
                              ? 'rgba(0, 212, 170, 0.2)'
                              : 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(0, 212, 170, 0.3)',
                          color: '#00d4aa',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Preview
                      </button>
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#161b22',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '16px',
                        overflowX: 'auto',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        margin: 0,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(message.content),
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d4aa',
                  fontSize: '14px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#00d4aa',
                    animation: 'pulse 1s ease-in-out infinite',
                  }}
                />
                Generating...
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
              </div>
            )}
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(0, 212, 170, 0.15)',
              display: 'flex',
              gap: '12px',
            }}
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Describe the terminal UI you want..."
              disabled={isLoading}
              style={{
                flex: 1,
                backgroundColor: '#161b22',
                border: '1px solid rgba(0, 212, 170, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#e6edf3',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                backgroundColor: '#00d4aa',
                color: '#0a0a0f',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              Generate
            </button>
          </form>
        </div>

        {/* Right panel: Live preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <div
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid rgba(0, 212, 170, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#e6edf3',
              }}
            >
              Preview
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#8b949e',
              }}
            >
              Live Preview
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
            }}
          >
            {latestCode ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div
                  style={{
                    backgroundColor: '#0d1117',
                    border: '1px solid rgba(0, 212, 170, 0.2)',
                    borderRadius: '12px',
                    padding: '24px',
                    height: '100%',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '2px solid #00d4aa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    &gt;_
                  </div>
                  <p
                    style={{
                      color: '#e6edf3',
                      fontSize: '16px',
                      fontWeight: 500,
                      margin: 0,
                      textAlign: 'center',
                    }}
                  >
                    Connect to your local walkie-talkie server to see the live preview.
                  </p>
                  <p
                    style={{
                      color: '#8b949e',
                      fontSize: '14px',
                      margin: 0,
                      textAlign: 'center',
                    }}
                  >
                    Run{' '}
                    <code
                      style={{
                        backgroundColor: 'rgba(0, 212, 170, 0.1)',
                        border: '1px solid rgba(0, 212, 170, 0.2)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: '#00d4aa',
                        fontFamily:
                          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                      }}
                    >
                      npx walkie-talkie
                    </code>{' '}
                    first.
                  </p>

                  <div
                    style={{
                      marginTop: '16px',
                      width: '100%',
                      maxWidth: '500px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#8b949e',
                        marginBottom: '8px',
                      }}
                    >
                      Generated Code
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#161b22',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '16px',
                        overflowX: 'auto',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        fontFamily:
                          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        margin: 0,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(latestCode),
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: '#8b949e',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(0, 212, 170, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '24px',
                    opacity: 0.5,
                  }}
                >
                  &gt;_
                </div>
                <p style={{ fontSize: '16px', margin: '0 0 8px' }}>
                  No preview yet
                </p>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  Generate a terminal UI to see it here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
