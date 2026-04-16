// src/app/dashboard/admin/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Space, Button } from 'antd';
import { 
  UserOutlined, 
  FileSearchOutlined, 
  EnvironmentOutlined,
  RiseOutlined,
  AlertOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/reports/summary');
        setStats(response.data.data);
      } catch (err) {
        console.error('Failed to fetch admin stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const columns = [
    {
      title: 'Station Name',
      dataIndex: 'station_name',
      key: 'station_name',
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Total Cases',
      dataIndex: 'total_cases',
      key: 'total_cases',
    },
    {
      title: 'Open Cases',
      dataIndex: 'open_cases',
      key: 'open_cases',
      render: (val) => <Typography.Text type="danger">{val}</Typography.Text>
    },
    {
      title: 'Closed Cases',
      dataIndex: 'closed_cases',
      key: 'closed_cases',
      render: (val) => <Typography.Text type="success">{val}</Typography.Text>
    }
  ];

  const [stationStats, setStationStats] = useState([]);
  
  useEffect(() => {
    const fetchStationStats = async () => {
      try {
        const res = await api.get('/reports/by-station');
        setStationStats(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStationStats();
  }, []);

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Admin Overview</Title>
          <Typography.Text type="secondary">System-wide monitoring and statistics for all police stations in Somalia.</Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none" className="stat-card">
              <Statistic
                title="Total Registered Cases"
                value={stats?.caseStats?.total_cases || 0}
                prefix={<FileSearchOutlined style={{ color: '#1677ff' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none" className="stat-card">
              <Statistic
                title="Active Users"
                value={stats?.userStats?.total_users || 0}
                prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none" className="stat-card">
              <Statistic
                title="Police Stations"
                value={stats?.stationsStats?.total_stations || 0}
                prefix={<EnvironmentOutlined style={{ color: '#faad14' }} />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="none" className="stat-card">
              <Statistic
                title="Critical Priority"
                value={stats?.caseStats?.critical_priority || 0}
                prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
                styles={{ content: { color: '#ff4d4f' } }}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Case Distribution by Station" variant="none">
              <Table 
                columns={columns} 
                dataSource={stationStats} 
                loading={loading} 
                rowKey="station_name"
                pagination={false}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </ProtectedRoute>
  );
}
