// src/app/page.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spin } from 'antd';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        const roleRedirects = {
          admin: '/dashboard/admin',
          state_admin: '/dashboard/unit',
          region_admin: '/dashboard/unit',
          city_admin: '/dashboard/unit',
          district_admin: '/dashboard/unit',
          neighborhood_admin: '/dashboard/unit',
          officer: '/dashboard/officer',
          cid: '/dashboard/cid',
          prosecutor: '/dashboard/prosecutor'
        };
        router.push(roleRedirects[user.role] || '/dashboard/unit');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}
