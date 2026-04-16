// src/app/dashboard/cid/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Space, Button } from 'antd';
import { 
  FileSearchOutlined, 
  SearchOutlined,
  SolutionOutlined,
  HourglassOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function CIDDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/cases/stats');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to fetch CID stats', err);
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
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const colors = { low: 'blue', medium: 'cyan', high: 'orange', critical: 'red' };
        return <Tag color={colors[priority]}>{priority.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Current Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color="purple">{status.replace('_', ' ').toUpperCase()}</Tag>
    },
    {
      title: 'Assigned Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['cid', 'admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>CID Investigator Dashboard</Title>
          <Typography.Text type="secondary">Manage criminal investigations, analyze evidence, and provide findings.</Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Assigned to Me"
                value={data?.total || 0}
                prefix={<SolutionOutlined style={{ color: '#722ed1' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Active Investigations"
                value={data?.under_investigation || 0}
                prefix={<SearchOutlined style={{ color: '#1677ff' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Pending Referral"
                value={data?.referred_cid || 0}
                prefix={<HourglassOutlined style={{ color: '#faad14' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Cases Solved"
                value={data?.closed_cases || 0}
                prefix={<FileSearchOutlined style={{ color: '#52c41a' }} />}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Cases Requiring Investigation" variant="none">
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
