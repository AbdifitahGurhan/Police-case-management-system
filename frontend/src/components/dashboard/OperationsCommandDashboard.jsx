'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import {
  AlertOutlined,
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DistrictOperationsDashboard from '@/components/dashboard/DistrictOperationsDashboard';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const number = (value) => Number(value || 0);
const allowedRoles = [
  'admin',
  'state_admin',
  'state_commander',
  'region_admin',
  'region_commander',
  'district_admin',
  'district_commander',
  'police_station_commander',
];

const statusColor = (status) => ({
  Xiran: 'green',
  Furan: 'blue',
  Baaris: 'gold',
  Sugaya: 'orange',
}[status] || 'default');

const priorityColor = (priority) => ({
  critical: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'default',
}[String(priority || '').toLowerCase()] || 'default');

const scopeTitle = (scope) => ({
  admin: 'Dashboard-ka Hawlgallada Qaranka',
  state: 'Dashboard-ka Hawlgallada State-ka',
  region: 'Dashboard-ka Hawlgallada Gobolka',
  district: 'Dashboard-ka Maamulka Degmada',
}[scope?.type] || 'Dashboard-ka Hawlgallada');

const metricDefs = [
  ['total_ob', 'OB-yada', <FileDoneOutlined key="ob" />, 'blue'],
  ['total_cases', 'Kiisaska', <FolderOpenOutlined key="cases" />, 'blue'],
  ['open_cases', 'Kiisaska Furan', <ClockCircleOutlined key="open" />, 'amber'],
  ['closed_cases', 'Kiisaska Xiran', <CheckCircleOutlined key="closed" />, 'green'],
  ['total_officers', 'Askarta', <TeamOutlined key="officers" />, 'purple'],
  ['arrests', 'Qabashooyinka', <SafetyCertificateOutlined key="arrests" />, 'red'],
  ['prisoners', 'Maxaabiista', <BankOutlined key="prisoners" />, 'red'],
  ['investigator_tasks', 'Hawlaha Baarayaasha', <UserSwitchOutlined key="tasks" />, 'purple'],
  ['evidence', 'Caddeymaha', <FileProtectOutlined key="evidence" />, 'green'],
  ['warrants', 'Warrants', <AuditOutlined key="warrants" />, 'amber'],
  ['court_cases', 'Kiisaska Maxkamadda', <BankOutlined key="court" />, 'blue'],
  ['complaints', 'Cabashooyinka', <AlertOutlined key="complaints" />, 'red'],
];

const toneClass = {
  blue: 'standard-metric-blue',
  amber: 'standard-metric-amber',
  green: 'standard-metric-green',
  red: 'standard-metric-red',
  purple: 'standard-metric-purple',
};

const withKeys = (rows = [], prefix = 'row') => rows.map((row) => ({
  ...row,
  key: `${prefix}-${row.id}`,
  children: row.children?.length ? withKeys(row.children, `${prefix}-${row.id}`) : undefined,
}));

function MiniTrend({ rows = [] }) {
  const max = Math.max(...rows.map((row) => number(row.total)), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(24px, 1fr))`, gap: 8, alignItems: 'end', minHeight: 190 }}>
      {rows.length ? rows.map((row) => {
        const height = Math.max((number(row.total) / max) * 150, 8);
        return (
          <div key={row.period} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
            <Text strong>{row.total}</Text>
            <div style={{ width: '100%', height, borderRadius: 6, background: 'linear-gradient(180deg, var(--ui-primary), var(--ui-primary-2))' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(row.period).format('DD MMM')}</Text>
          </div>
        );
      }) : <Text type="secondary">Xog trend ah lama helin.</Text>}
    </div>
  );
}

function StatusDistribution({ rows = [] }) {
  const total = rows.reduce((sum, row) => sum + number(row.total), 0);
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {rows.length ? rows.map((row) => {
        const percent = total ? Math.round((number(row.total) / total) * 100) : 0;
        return (
          <div key={row.status}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Tag color={statusColor(row.status)}>{row.status}</Tag>
              <Text strong>{row.total} ({percent}%)</Text>
            </Space>
            <div style={{ height: 8, borderRadius: 999, background: '#eef2f7', overflow: 'hidden', marginTop: 6 }}>
              <div style={{ height: '100%', width: `${percent}%`, background: '#1677ff' }} />
            </div>
          </div>
        );
      }) : <Text type="secondary">Xaalado kiis lama helin.</Text>}
    </Space>
  );
}

export default function OperationsCommandDashboard({ user }) {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()]);

  const load = useCallback(async (nextRange = range) => {
    setLoading(true);
    try {
      const response = await api.get('/operations-dashboard', {
        params: {
          from: nextRange?.[0]?.format('YYYY-MM-DD'),
          to: nextRange?.[1]?.format('YYYY-MM-DD'),
        },
      });
      setData(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Dashboard-ka hawlgallada lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message, range]);

  useEffect(() => { load(); }, [load]);

  const hierarchy = useMemo(() => withKeys(data?.hierarchy || [], 'scope'), [data?.hierarchy]);
  const hierarchyColumns = [
    { title: 'Scope', dataIndex: 'name', render: (value, row) => <Text strong>{value} {row.code ? <Tag>{row.code}</Tag> : null}</Text> },
    { title: 'OB', dataIndex: 'total_ob', render: number },
    { title: 'Cases', dataIndex: 'total_cases', render: number },
    { title: 'Open', dataIndex: 'open_cases', render: (value) => <Tag color="blue">{number(value)}</Tag> },
    { title: 'Closed', dataIndex: 'closed_cases', render: (value) => <Tag color="green">{number(value)}</Tag> },
    { title: 'Arrests', dataIndex: 'arrests', render: number },
    { title: 'Complaints', dataIndex: 'complaints', render: number },
  ];

  const recentColumns = [
    { title: 'Operation', render: (_, row) => <><Text strong>{row.case_number || row.ob_number || row.action_type}</Text><br /><Text type="secondary">{row.title || row.description}</Text></> },
    { title: 'Location', render: (_, row) => row.district_name || row.region_name || row.state_name || 'System' },
    { title: 'Action', dataIndex: 'action_type', render: (value) => <Tag>{value || 'Activity'}</Tag> },
    { title: 'Date', dataIndex: 'created_at', render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
  ];

  if (loading && !data) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="standard-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">{data?.scope?.label || user?.fullName || 'Operations'}</Text>
            <Title level={2}>{scopeTitle(data?.scope)}</Title>
            <Text type="secondary">Hal dashboard oo mideynaya OB, kiisaska, askarta, xabsiga, warrants, maxkamadda iyo hawlaha degmooyinka.</Text>
          </div>
          <Space wrap>
            <RangePicker value={range} onChange={(value) => { setRange(value); if (value) load(value); }} />
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>Cusboonaysii</Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {metricDefs.map(([key, title, icon, tone]) => (
            <Col xs={24} sm={12} md={8} xl={4} key={key}>
              <Card variant="none" className={`standard-metric-card ${toneClass[tone] || ''}`}>
                <div className="standard-metric-icon">{icon}</div>
                <Text type="secondary">{title}</Text>
                <Title level={3} style={{ margin: '6px 0 0' }}>{number(data?.metrics?.[key])}</Title>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card variant="none" className="standard-panel" title="Dhaqdhaqaaqa Kiisaska">
              <MiniTrend rows={data?.trend || []} />
            </Card>
          </Col>
          <Col xs={24} xl={6}>
            <Card variant="none" className="standard-panel" title="Xaaladaha Kiisaska">
              <StatusDistribution rows={data?.caseStatus || []} />
            </Card>
          </Col>
          <Col xs={24} xl={6}>
            <Card variant="none" className="standard-panel" title="Hawlaha Degdegga ah">
              <Space orientation="vertical" style={{ width: '100%' }}>
                {(data?.urgentOperations || []).length ? data.urgentOperations.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <Text strong>{item.case_number || item.ob_number}</Text><br />
                      <Text type="secondary">{item.district_name || item.region_name || item.state_name}</Text>
                    </div>
                    <Tag color={priorityColor(item.priority)}>{item.priority || item.status}</Tag>
                  </div>
                )) : <Text type="secondary">Hawl degdeg ah lama helin.</Text>}
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={data?.permissions?.canDrillDown ? 12 : 24}>
            <Card variant="none" className="standard-panel" title="Dhaqdhaqaaqii Ugu Dambeeyay">
              <Table rowKey="id" columns={recentColumns} dataSource={data?.recentOperations || []} pagination={false} scroll={{ x: 'max-content' }} />
            </Card>
          </Col>
          {data?.permissions?.canDrillDown && (
            <Col xs={24} xl={12}>
              <Card variant="none" className="standard-panel" title="Kala-jabinta Heerarka">
                <Table rowKey="key" columns={hierarchyColumns} dataSource={hierarchy} pagination={false} scroll={{ x: 'max-content' }} />
              </Card>
            </Col>
          )}
        </Row>

        {data?.permissions?.canAct && (
          <Card variant="none" className="standard-panel" title="Hawlaha Degmada">
            <DistrictOperationsDashboard user={user} mode="operations" embedded />
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
