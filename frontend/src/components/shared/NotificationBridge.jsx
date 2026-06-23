'use client';

import { useEffect } from 'react';
import { App } from 'antd';

export default function NotificationBridge() {
  const { notification } = App.useApp();

  useEffect(() => {
    const handleNotify = (event) => {
      const { type = 'info', message, description } = event.detail || {};
      const title = message || (type === 'success' ? 'Success' : 'Error');
      notification[type]({
        key: `${type}:${title}:${description || ''}`,
        title,
        description,
        placement: 'topRight',
      });
    };

    window.addEventListener('police-cms-notify', handleNotify);
    return () => window.removeEventListener('police-cms-notify', handleNotify);
  }, [notification]);

  return null;
}
