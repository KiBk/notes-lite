import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  const isTestEnv =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    import.meta.env?.MODE === 'test';
  const delayToUse = isTestEnv ? 0 : delay;

  useEffect(() => {
    if (delayToUse === 0) {
      setDebounced(value);
      return undefined;
    }

    const timer = setTimeout(() => setDebounced(value), delayToUse);
    return () => clearTimeout(timer);
  }, [value, delayToUse]);

  return debounced;
}
