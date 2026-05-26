// src/app/dashboard/prosecutor/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Space } from 'antd';
import {
  AuditOutlined,
  BookOutlined,
  CheckSquareOutlined,
  ContainerOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title } = Typography;

export default function ProsecutorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/cases/stats');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to fetch Prosecutor stats', err);
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
        return <Tag color={colors[priority]}>{priority?.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Action Needed',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="gold">LEGAL REVIEW</Tag>
    },
    {
      title: 'Referred Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['prosecutor', 'admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Public Prosecutor Dashboard</Title>
          <Typography.Text type="secondary">Review case files, evidence, and decide on legal proceedings.</Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Pending Review"
                value={data?.referred_prosecutor || 0}
                prefix={<AuditOutlined style={{ color: '#faad14' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Total Referred"
                value={data?.total || 0}
                prefix={<BookOutlined style={{ color: '#1677ff' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Processed Cases"
                value={data?.closed_cases || 0}
                prefix={<CheckSquareOutlined style={{ color: '#52c41a' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none">
              <Statistic
                title="Report Files"
                value={(data?.total || 0) + (data?.closed_cases || 0)}
                prefix={<ContainerOutlined style={{ color: '#d48d08' }} />}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Prosecution Queue - Case Files for Review" variant="none">
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
