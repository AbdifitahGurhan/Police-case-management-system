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
      admin: '/dashboard/admin',
      officer: '/dashboard/officer',
      ward_commander: '/dashboard/ward_commander',
      state_admin: '/dashboard/unit',
      region_admin: '/dashboard/unit',
      city_admin: '/dashboard/unit',
      district_admin: '/dashboard/unit',
      neighborhood_admin: '/dashboard/unit',
      cid: '/dashboard/cid',
      cid_director: '/dashboard/cid',
      cid_supervisor: '/dashboard/cid',
      cid_officer: '/dashboard/cid',
      court: '/dashboard/court',
      prosecutor: '/dashboard/court',
      prosecutor_liaison: '/dashboard/cid',
      jail: '/dashboard/jail',
    };

    router.replace(roleRedirects[user.role] || '/cases');
  }, [loading, router, user]);

  return (
    <div style={{ display: 'grid', minHeight: '60vh', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  );
}
