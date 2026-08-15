'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const roleRedirects = {
      admin: '/dashboard/operations',
      sub_admin: '/police-officers',
      ob_staff: '/ob-register',
      officer: '/dashboard/officer',
      state_admin: '/dashboard/operations',
      region_admin: '/dashboard/operations',
      district_admin: '/dashboard/operations',
      personnel_registry: '/police-officers',
      investigator: '/dashboard/investigator',
      station_jail: '/dashboard/jail',
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
      police_station_commander: '/dashboard/operations',
    };

    router.replace(roleRedirects[user.role] || '/police-officers');
  }, [loading, router, user]);

  return (
    <div style={{ display: 'grid', minHeight: '60vh', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  );
}
