// src/app/reports/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Space, Table, Tag, DatePicker, Button, Statistic, Select, App } from 'antd';
import { 
  BarChartOutlined, 
  AuditOutlined, 
  DownloadOutlined, 
  SecurityScanOutlined,
  ThunderboltOutlined 
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default function ReportsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dateRange, setDateRange] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange[0]) {
        params.from_date = dateRange[0].format('YYYY-MM-DD');
        params.to_date = dateRange[1].format('YYYY-MM-DD');
      }

      const [sRes, aRes] = await Promise.all([
        api.get('/reports/summary', { params }),
        api.get('/reports/audit-logs', { params: { limit: 10 } })
      ]);
      
      setStats(sRes.data.data);
      setAuditLogs(aRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const auditColumns = [
    { title: 'Timestamp', dataIndex: 'created_at', render: d => dayjs(d).format('DD/MM HH:mm') },
    { title: 'User', dataIndex: 'user_email' },
    { title: 'Action', dataIndex: 'action', render: (a) => <Tag color="blue">{a}</Tag> },
    { title: 'Entity', dataIndex: 'entity_type' },
    { title: 'Entity ID', dataIndex: 'entity_id' },
  ];

  return (
    <ProtectedRoute>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Operational Reports & Audit</Title>
            <Typography.Text type="secondary">Real-time statistics and activity logs monitoring across stations.</Typography.Text>
          </div>
          <Space>
            <RangePicker onChange={(v) => setDateRange(v)} />
            <Button type="primary" icon={<DownloadOutlined />}>Export Report</Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card variant="none">
              <Statistic
                title="Crime Frequency Distribution"
                value={stats?.caseStats?.total_cases || 0}
                prefix={<BarChartOutlined />}
              />
              <div style={{ marginTop: 16 }}>
                {stats?.byType?.slice(0, 5).map(t => (
                  <div key={t.case_type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Typography.Text size="small">{t.case_type}</Typography.Text>
                    <Typography.Text strong>{t.count}</Typography.Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={16}>
             <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card variant="none">
                    <Statistic title="Critical Cases" value={stats?.caseStats?.critical_priority || 0} styles={{ content: { color: '#cf1322' } }} prefix={<ThunderboltOutlined />} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card variant="none">
                    <Statistic title="Blockchain Proofs" value={stats?.evidenceStats?.total_evidence || 0} prefix={<SecurityScanOutlined style={{ color: '#1677ff' }} />} />
                  </Card>
                </Col>
                <Col span={24}>
                   <Card title="System Audit Logs (Live Stream)" size="small" extra={<AuditOutlined />}>
                      <Table 
                        columns={auditColumns} 
                        dataSource={auditLogs} 
                        pagination={false} 
                        size="small" 
                        rowKey="id"
                        loading={loading}
                      />
                   </Card>
                </Col>
             </Row>
          </Col>
        </Row>
      </Space>
    </ProtectedRoute>
  );
}
