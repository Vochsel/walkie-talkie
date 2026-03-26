import { useState, useCallback, useRef, useEffect } from 'react';
import { loadState, saveState } from '@walkie-talkie/client';

/**
 * Like useState but persisted to localStorage.
 * Reads initial value from storage on mount, writes on every change.
 */
export function usePersistedState<T>(key: string, fallback: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => loadState(key, fallback));
  const keyRef = useRef(key);
  keyRef.current = key;

  const setState = useCallback((val: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;
      saveState(keyRef.current, next);
      return next;
    });
  }, []);

  return [state, setState];
}

/**
 * Like useRef but persisted to localStorage.
 * Reads initial value from storage. Call save() to flush current value.
 * Auto-saves on unmount and periodically.
 */
export function usePersistedRef<T>(key: string, fallback: T, autoSaveMs = 2000): {
  ref: React.MutableRefObject<T>;
  save: () => void;
} {
  const ref = useRef<T>(loadState(key, fallback));
  const keyRef = useRef(key);
  keyRef.current = key;

  const save = useCallback(() => {
    saveState(keyRef.current, ref.current);
  }, []);

  useEffect(() => {
    const interval = setInterval(save, autoSaveMs);
    return () => {
      clearInterval(interval);
      save();
    };
  }, [save, autoSaveMs]);

  return { ref, save };
}
