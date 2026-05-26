// src/components/auth/ProtectedRoute.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spin } from 'antd';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Redirect to their own dashboard if they try to access a page they aren't allowed to
        const roleRedirects = {
          admin: '/dashboard/admin',
          officer: '/dashboard/officer',
          ward_commander: '/dashboard/ward_commander',
          cid: '/dashboard/cid',
          court: '/dashboard/court',
          jail: '/dashboard/jail',
          state_commander: '/dashboard/unit',
          region_commander: '/dashboard/unit',
          district_commander: '/dashboard/unit',
          police_station_commander: '/dashboard/unit',
          waax_commander: '/dashboard/unit',
          ob_staff: '/ob-register',
          staff: '/cases',
          state_admin: '/dashboard/unit',
          region_admin: '/dashboard/unit',
          city_admin: '/dashboard/unit',
          district_admin: '/dashboard/unit',
          neighborhood_admin: '/dashboard/unit'
        };
        router.push(roleRedirects[user.role] || '/cases');
      }
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" description="Loading..." />
      </div>
    );
  }

  if (!user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return null;
  }

  return children;
};

export default ProtectedRoute;
