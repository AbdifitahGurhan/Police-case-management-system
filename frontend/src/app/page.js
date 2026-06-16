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
          cid_director: '/dashboard/cid',
          cid_supervisor: '/dashboard/cid',
          cid_officer: '/dashboard/cid',
          court: '/dashboard/court',
          prosecutor: '/dashboard/court',
          prosecutor_liaison: '/dashboard/cid',
          jail: '/dashboard/jail'
        };
        router.push(roleRedirects[user.role] || '/cases');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}
