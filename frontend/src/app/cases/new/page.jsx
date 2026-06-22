'use client';

import React from 'react';
import { AuditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card, Space, Tag, Typography } from 'antd';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

const { Text, Title } = Typography;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];

export default function NewCasePage() {
  const { user } = useAuth();
  const caseReadRoles = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'state_commander', 'region_commander', 'district_commander', 'ward_commander', 'police_station_commander', 'waax_commander'];
  const canReadCases = user && caseReadRoles.includes(user.role);
  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'neighborhood_admin', ...commanderRoles]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Cases', href: '/cases' }, { title: 'Open Case' }]} />

        <Card variant="none" className="case-register-hero">
          <div>
            <Text className="dashboard-eyebrow">OB REGISTRATION REQUIRED</Text>
            <Title level={2}>Case cannot be opened directly</Title>
            <Typography.Text type="secondary">
              Marka hore dacwadda ku diiwaangeli OB Register. Haddii loo baahdo case formal ah,
              fur OB detail-ka kadib riix Convert to Case.
            </Typography.Text>
          </div>
          <Tag color="geekblue">OB first</Tag>
        </Card>

        <Card variant="none" className="case-register-card">
          <Space orientation="vertical" size="middle">
            <Title level={4} style={{ margin: 0 }}>Use OB Register</Title>
            <Text type="secondary">
              OB-ga ayaa noqda record-ka rasmiga ah ee bilowga ah. Case waxaa laga abuuraa OB-ga kaliya marka baaritaan ama talaabo sharci ah loo baahdo.
            </Text>
            <Space wrap>
              <Link href="/ob-register">
                <Button type="primary" icon={<AuditOutlined />}>Go to OB Registration</Button>
              </Link>
              {canReadCases && (
                <Link href="/cases">
                  <Button icon={<ArrowLeftOutlined />}>Back to Cases</Button>
                </Link>
              )}
            </Space>
          </Space>
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
