import { useCallback, useEffect, useState } from 'react';

export const MESSAGE_DURATION = 3000;

// Each occurrence gets its own lifetime, even when the text is identical.
export function useTimedMessage(initialMessage = '') {
  const [notification, setNotification] = useState({ message: initialMessage });
  const setMessage = useCallback((message: string) => setNotification({ message }), []);

  useEffect(() => {
    if (!notification.message) return;
    const timer = setTimeout(() => setNotification({ message: '' }), MESSAGE_DURATION);
    return () => clearTimeout(timer);
  }, [notification]);

  return [notification.message, setMessage] as const;
}
