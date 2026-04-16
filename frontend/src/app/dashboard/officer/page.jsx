// src/app/dashboard/officer/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Space, Button, Empty } from 'antd';
import { 
  PlusOutlined, 
  FileTextOutlined, 
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function OfficerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/cases/stats');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to fetch officer stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const columns = [
    {
      title: 'OB Number',
      dataIndex: 'ob_number',
      key: 'ob_number',
      render: (text, record) => <Link href={`/cases/${record.id}`}><Typography.Text strong>{text}</Typography.Text></Link>,
    },
    {
      title: 'Case Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />
    },
    {
      title: 'Date Registered',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['officer', 'admin']}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Officer Dashboard</Title>
            <Typography.Text type="secondary">Manage reports, register new cases, and track station activities.</Typography.Text>
          </div>
          <Link href="/cases/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              Register New Case
            </Button>
          </Link>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Total Cases"
                value={data?.total || 0}
                prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Draft / Pending"
                value={(data?.draft || 0) + (data?.pending_review || 0)}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Active Cases"
                value={data?.active || 0}
                prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Closed Cases"
                value={data?.closed || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Recent Cases at Station" variant="none">
          <Table 
            columns={columns} 
            dataSource={data?.recentCases || []} 
            loading={loading} 
            rowKey="id"
            pagination={false}
          />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
