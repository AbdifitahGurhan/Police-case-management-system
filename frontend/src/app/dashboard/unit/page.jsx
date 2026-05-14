'use client';
import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Row, Col, Statistic, Avatar, Tag, message, Spin } from 'antd';
import { UserOutlined, TeamOutlined, FolderOpenOutlined, BankOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { Title, Text } = Typography;

export default function UnitDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/reports/unit-dashboard');
        setData(response.data.data);
      } catch (err) {
        message.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.role?.includes('admin')) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  if (!user) return null;

  const { stats, commander } = data || {};

  const formatUnitType = (role) => {
    switch (role) {
      case 'state_admin': return 'State Administration';
      case 'region_admin': return 'Region Command';
      case 'city_admin': return 'City Command';
      case 'district_admin': return 'District Command';
      case 'neighborhood_admin': return 'Neighborhood Sub-Station';
      default: return 'Administrative Unit';
    }
  };

  const hasChildren = user.role !== 'neighborhood_admin';

  return (
    <ProtectedRoute allowedRoles={['state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        
        <Row gutter={24} align="middle">
          <Col span={16}>
            <Title level={2}>{user.fullName || 'Unit'} Dashboard</Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              <Tag color="cyan">{formatUnitType(user.role)}</Tag> Scope Management & Supervision
            </Text>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Card variant="none" style={{ background: 'linear-gradient(135deg, #f0f2f5 0%, #ffffff 100%)', border: '1px solid #d9d9d9' }}>
              <Space>
                <Avatar 
                  size={64} 
                  src={commander?.profile_image ? `http://localhost:5001${commander.profile_image}` : null} 
                  icon={!commander?.profile_image && <UserOutlined />} 
                />
                <div style={{ textAlign: 'left' }}>
                  <Text strong style={{ display: 'block' }}>
                    {commander?.full_name || 'No Commander Assigned'}
                  </Text>
                  <Text type="secondary">{commander?.rank_name || 'N/A'}</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          {hasChildren && (
            <Col span={8}>
              <Card>
                <Statistic
                  title="Subordinate Units"
                  value={stats?.subordinate_units || 0}
                  prefix={<BankOutlined />}
                  styles={{ content: { color: '#1890ff' } }}
                />
              </Card>
            </Col>
          )}
          <Col span={hasChildren ? 8 : 12}>
            <Card>
              <Statistic
                title="Officers Deployed"
                value={stats?.officers_deployed || 0}
                prefix={<TeamOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col span={hasChildren ? 8 : 12}>
            <Card>
              <Statistic
                title="Total Cases Managed"
                value={stats?.cases_count || 0}
                prefix={<FolderOpenOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Card>
          </Col>
        </Row>
        
        <Title level={4} style={{ marginTop: '20px' }}>Recent Activity</Title>
        <Card variant="none">
          <Text type="secondary">Detailed case activity within this jurisdiction will be listed here.</Text>
        </Card>

      </Space>
    </ProtectedRoute>
  );
}
