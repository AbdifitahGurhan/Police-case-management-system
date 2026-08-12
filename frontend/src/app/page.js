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
          admin: '/dashboard/operations',
          sub_admin: '/police-officers',
          ob_staff: '/ob-register',
          state_admin: '/dashboard/operations',
          region_admin: '/dashboard/operations',
          city_admin: '/districts',
          district_admin: '/dashboard/operations',
          personnel_registry: '/police-officers',
          station_jail: '/dashboard/jail',
          officer: '/dashboard/officer',
          cid: '/dashboard/cid',
          cid_director: '/dashboard/cid',
          cid_supervisor: '/dashboard/cid',
          cid_officer: '/dashboard/cid',
          court: '/dashboard/court',
          prosecutor: '/dashboard/court',
          prosecutor_liaison: '/dashboard/cid',
          jail: '/dashboard/central-jail',
          state_commander: '/dashboard/operations',
          region_commander: '/dashboard/operations',
          district_commander: '/dashboard/operations',
          police_station_commander: '/dashboard/operations'
        };
        router.push(roleRedirects[user.role] || '/police-officers');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}
