// src/app/dashboard/ward_commander/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Space, Typography, Tag, App } from 'antd';
import { 
  FileSearchOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import Link from 'next/link';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function WardCommanderDashboard() {
  const [stats, setStats] = useState({ total_ward_cases: 0, pending_reviews: 0, confirmed_today: 0, active_investigations: 0 });
  const [pendingCases, setPendingCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await api.get('/cases/stats');
        setStats(statsRes.data.data);
        
        const casesRes = await api.get('/cases?status=pending_commander_review');
        setPendingCases(casesRes.data.data);
      } catch (err) {
        console.error("Dashboard data load failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const columns = [
    { title: 'OB Number', dataIndex: 'ob_number', key: 'ob_number', render: (text, record) => <Link href={`/cases/${record.id}`}>{text}</Link> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Date Created', dataIndex: 'created_at', render: d => dayjs(d).format('DD MMM YYYY') },
    { title: 'Officer', dataIndex: 'officer_name' },
    { title: 'Status', dataIndex: 'status', render: s => <CaseStatusTag status={s} /> },
    { 
      title: 'Action', 
      key: 'action', 
      render: (_, record) => (
        <Link href={`/cases/${record.id}`}>
          <Button type="primary" size="small">Review Case</Button>
        </Link>
      )
    }
  ];

  const { Title, Text } = Typography;

  return (
    <ProtectedRoute allowedRoles={['ward_commander', 'admin']}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Ward Commander Control Panel</Title>
        <Text type="secondary">Review and confirm case integrity for your assigned Ward.</Text>

        <Row gutter={16}>
          <Col span={6}>
            <Card variant="none" className="shadow-sm">
              <Statistic title="Total Ward Cases" value={stats.total_cases} prefix={<FileSearchOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="none" className="shadow-sm">
              <Statistic title="Pending Review" value={pendingCases.length} styles={{ content: { color: '#faad14' } }} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="none" className="shadow-sm">
              <Statistic title="Confirmed (All Time)" value={stats.confirmed_cases || 0} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="none" className="shadow-sm">
              <Statistic title="Active Investigations" value={stats.under_investigation_cases || 0} prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card title="Active Case Queue: Pending Confirmation">
          <Table 
            dataSource={pendingCases} 
            columns={columns} 
            loading={loading} 
            rowKey="id"
          />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
