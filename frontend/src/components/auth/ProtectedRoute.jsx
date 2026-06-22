// src/components/auth/ProtectedRoute.jsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Result, Spin } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Show access denied screen instead of hard redirect
        setIsDenied(true);
      } else {
        setIsDenied(false);
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

  if (!user) return null;

  if (isDenied) {
    const roleRedirects = {
      admin: '/dashboard/admin',
      officer: '/dashboard/officer',
      cid: '/dashboard/cid',
      cid_director: '/dashboard/cid',
      cid_supervisor: '/dashboard/cid',
      cid_officer: '/dashboard/cid',
      court: '/dashboard/court',
      court_admin: '/dashboard/court',
      judge: '/dashboard/court',
      prosecutor: '/dashboard/court',
      prosecutor_liaison: '/dashboard/cid',
      court_clerk: '/dashboard/court',
      jail: '/dashboard/jail',
      state_commander: '/dashboard/unit',
      region_commander: '/dashboard/unit',
      district_commander: '/dashboard/unit',
      police_station_commander: '/dashboard/unit',
      ob_staff: '/ob-register',
      staff: '/cases',
      state_admin: '/dashboard/unit',
      region_admin: '/dashboard/unit',
      city_admin: '/dashboard/unit',
      district_admin: '/dashboard/unit',
    };

    const homeRoute = roleRedirects[user.role] || '/cases';

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Result
          icon={<LockOutlined style={{ color: '#2563eb' }} />}
          status="403"
          title="Access Restricted"
          subTitle={
            <>
              Your account role (<strong>{user.role?.replace(/_/g, ' ').toUpperCase()}</strong>) does not have
              permission to view this page.
            </>
          }
          extra={[
            <Button
              key="back"
              type="primary"
              onClick={() => router.back()}
            >
              Go Back
            </Button>,
            <Button
              key="home"
              onClick={() => router.push(homeRoute)}
            >
              My Dashboard
            </Button>,
          ]}
        />
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
