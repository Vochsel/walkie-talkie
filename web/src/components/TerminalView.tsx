'use client';

import '@xterm/xterm/css/xterm.css';
import { TerminalView as BaseTerminalView, defaultTheme, lightTheme } from '@walkie-talkie/react';
import type { TerminalViewProps } from '@walkie-talkie/react';
import { useTheme } from '@/hooks/useTheme';

export type { TerminalViewProps } from '@walkie-talkie/react';

export default function TerminalView(props: TerminalViewProps) {
  const { theme } = useTheme();
  const termTheme = props.theme ?? (theme === 'light' ? lightTheme : defaultTheme);
  return <BaseTerminalView {...props} theme={termTheme} />;
}
