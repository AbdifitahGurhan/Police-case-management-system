'use client';

import React, { useEffect, useState } from 'react';
import { Avatar, Card, Col, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import {
  AlertOutlined,
  ApartmentOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

const { Text, Title } = Typography;

const value = (input) => Number(input || 0);

const SimpleRows = ({ items = [], render }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {items.length ? items.map((item, index) => (
      <div
        key={item.id || item.month || item.category || item.status_group || index}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        {render(item)}
      </div>
    )) : <Text type="secondary">No records found</Text>}
  </div>
);

function RegionDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/reports/region-dashboard');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to load region dashboard data.', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  const summary = data?.summary || {};
  const totalCases = value(summary.total_cases);
  const openCases = value(summary.open_cases);
  const closedCases = value(summary.closed_cases);
  const pendingCases = value(summary.pending_cases);

  // Reordered and trimmed metrics to match requested Regional Dashboard items
  const metrics = [
    { title: 'Total Registered Cases', value: totalCases, icon: <FolderOpenOutlined />, tone: 'blue' },
    { title: 'Total Open Cases', value: openCases, icon: <FileSearchOutlined />, tone: 'amber' },
    { title: 'Total Closed Cases', value: closedCases, icon: <CheckCircleOutlined />, tone: 'green' },
    { title: 'District Police Stations', value: value(summary.district_police_stations), icon: <BankOutlined />, tone: 'purple' },
    { title: 'Waax Police Stations', value: value(summary.waax_police_stations), icon: <HomeOutlined />, tone: 'blue' },
    { title: 'Arrested Cases', value: value(summary.arrest_records) || value(data?.arrestReleaseStats?.arrests), icon: <SafetyCertificateOutlined />, tone: 'purple' },
    { title: 'Released Cases', value: value(summary.released_cases) || value(data?.arrestReleaseStats?.releases), icon: <CheckCircleOutlined />, tone: 'green' },
  ];

  const stationColumns = [
    { title: 'Police Station', dataIndex: 'station_name', key: 'station_name', render: (text, row) => <Text strong>{text} <Tag>{row.station_code}</Tag></Text> },
    { title: 'Cases', dataIndex: 'cases_count', key: 'cases_count' },
    { title: 'Officers', dataIndex: 'officers_count', key: 'officers_count' },
    { title: 'Closed', dataIndex: 'closed_cases', key: 'closed_cases' },
    { title: 'Status', key: 'status', render: () => <Tag color="success">ACTIVE</Tag> },
  ];

  const waaxColumns = [
    { title: 'Waax Station', dataIndex: 'waax_name', key: 'waax_name', render: (text, row) => <Text strong>{text} <Tag>{row.waax_code}</Tag></Text> },
    { title: 'District', dataIndex: 'district_name', key: 'district_name' },
    { title: 'Cases', dataIndex: 'cases_count', key: 'cases_count' },
    { title: 'Officers', dataIndex: 'officers_count', key: 'officers_count' },
    { title: 'Performance', key: 'performance', render: (_, row) => <Progress percent={Math.min(100, value(row.cases_count) * 10)} size="small" /> },
  ];

  const recentCaseColumns = [
    { title: 'Case', dataIndex: 'case_number', key: 'case_number', render: (text, row) => <Text strong>{text || row.ob_number}</Text> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Station', dataIndex: 'district_name', key: 'district_name' },
    { title: 'Waax', dataIndex: 'waax_name', key: 'waax_name' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === 'closed' ? 'green' : 'blue'}>{status}</Tag> },
  ];

  return (
    <ProtectedRoute allowedRoles={['region_admin']}>
      <div className="standard-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Regional Command Dashboard</Text>
            <Title level={2}>{data?.region?.region_name || user?.fullName || 'Region'} Overview</Title>
            <Text type="secondary">Regional cases, stations, Waax units, users, arrests, and activity reports.</Text>
          </div>
          <Space wrap>
            <Tag color="blue">{data?.region?.state_name}</Tag>
            <Tag color="cyan">{data?.region?.region_code}</Tag>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} xl={6} key={metric.title}>
              <Card variant="none" className="standard-metric-card">
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value} loading={loading} />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Overall Regional Overview">
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div><Text type="secondary">Commander</Text><br /><Text strong>{data?.region?.commander_name || 'Unassigned'}</Text></div>
                <div><Text type="secondary">Open vs Total Cases</Text><Progress percent={totalCases ? Math.round((openCases / totalCases) * 100) : 0} /></div>
                <div><Text type="secondary">Closed Case Rate</Text><Progress percent={totalCases ? Math.round((closedCases / totalCases) * 100) : 0} status="success" /></div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Case Status Comparison">
              <SimpleRows
                items={data?.caseStatus || []}
                render={(item) => (
                  <>
                    <Text>{item.status_group}</Text>
                    <Tag color={item.status_group === 'Closed' ? 'green' : item.status_group === 'Pending' ? 'gold' : 'blue'}>{item.total}</Tag>
                  </>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Arrest and Release Statistics">
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Statistic title="Arrests" value={value(data?.arrestReleaseStats?.arrests)} prefix={<SafetyCertificateOutlined />} />
                <Statistic title="Releases" value={value(data?.arrestReleaseStats?.releases)} prefix={<CheckCircleOutlined />} />
                <Statistic title="Wanted" value={value(data?.arrestReleaseStats?.wanted)} prefix={<AlertOutlined />} />
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card variant="none" className="standard-panel" title="Police Station Performance Comparison">
              <Table columns={stationColumns} dataSource={data?.stationPerformance || []} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card variant="none" className="standard-panel" title="Waax Police Station Performance">
              <Table columns={waaxColumns} dataSource={data?.waaxPerformance || []} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Monthly Case Registration Trends">
              <SimpleRows
                items={data?.monthlyTrends || []}
                render={(item) => (
                  <>
                    <Text>{item.month}</Text>
                    <Tag color="blue">{item.total_cases}</Tag>
                  </>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Crime Category Distribution">
              <SimpleRows
                items={data?.crimeCategories || []}
                render={(item) => (
                  <>
                    <Text>{item.category}</Text>
                    <Tag>{item.total}</Tag>
                  </>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="User Activity Reports">
              <SimpleRows
                items={data?.userActivity || []}
                render={(item) => (
                  <>
                    <Space>
                      <Avatar icon={<UserOutlined />} />
                      <div>
                        <Text strong style={{ display: 'block' }}>{item.full_name || item.username}</Text>
                        <Text type="secondary">{item.role || item.user_type || 'User'} - {item.last_login ? `Last login ${item.last_login}` : 'No login yet'}</Text>
                      </div>
                    </Space>
                    <Tag color={item.status === 'ACTIVE' ? 'green' : 'default'}>{item.status}</Tag>
                  </>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card variant="none" className="standard-panel" title="Recent Cases">
              <Table columns={recentCaseColumns} dataSource={data?.recentCases || []} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card variant="none" className="standard-panel" title="Recent Activities">
              <SimpleRows
                items={data?.recentActivities || []}
                render={(item) => (
                  <Space>
                    <Avatar icon={<ClockCircleOutlined />} />
                    <div>
                      <Text strong style={{ display: 'block' }}>{item.action_type}</Text>
                      <Text type="secondary">{item.ob_number || ''} {item.description || ''}</Text>
                    </div>
                  </Space>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </ProtectedRoute>
  );
}

function GenericUnitDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/reports/unit-dashboard');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to load unit dashboard data.', err);
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

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  const { stats, commander } = data || {};

  const formatUnitType = (role) => {
    switch (role) {
      case 'state_admin': return 'State Administration';
      case 'city_admin': return 'City Command';
      case 'district_admin': return 'District Command';
      case 'neighborhood_admin': return 'Neighborhood Sub-Station';
      default: return 'Administrative Unit';
    }
  };

  const hasChildren = user?.role !== 'neighborhood_admin';

  return (
    <StandardDashboard
      allowedRoles={['state_admin', 'city_admin', 'district_admin', 'neighborhood_admin']}
      eyebrow={formatUnitType(user?.role)}
      title={`${user?.fullName || 'Unit'} Dashboard`}
      subtitle="Scope management, supervision, and operational visibility for your jurisdiction."
      loading={loading}
      metrics={[
        ...(hasChildren ? [{ title: 'Subordinate Units', value: stats?.subordinate_units || 0, icon: <BankOutlined />, tone: 'blue', note: 'Units below this scope' }] : []),
        { title: 'Officers Deployed', value: stats?.officers_deployed || 0, icon: <TeamOutlined />, tone: 'green', note: 'Assigned personnel' },
        { title: 'Cases Managed', value: stats?.cases_count || 0, icon: <FolderOpenOutlined />, tone: 'amber', note: 'Within jurisdiction' },
        { title: 'Commander Status', value: commander ? 1 : 0, icon: <UserOutlined />, tone: commander ? 'purple' : 'red', note: commander ? 'Assigned' : 'Unassigned' },
      ]}
      sidePanel={{
        title: 'Commander Profile',
        content: (
          <Space size={14}>
            <Avatar
              size={64}
              src={commander?.profile_image ? `http://localhost:5001${commander.profile_image}` : null}
              icon={!commander?.profile_image && <UserOutlined />}
            />
            <div>
              <Text strong style={{ display: 'block' }}>{commander?.full_name || 'No Commander Assigned'}</Text>
              <Text type="secondary">{commander?.rank_name || 'N/A'}</Text>
            </div>
          </Space>
        ),
      }}
      tableTitle="Recent Activity"
      tableSubtitle="Detailed activity for this jurisdiction will appear here"
      tableColumns={[
        { title: 'Activity', dataIndex: 'activity', key: 'activity' },
        { title: 'Status', dataIndex: 'status', key: 'status' },
      ]}
      tableData={[]}
    />
  );
}

export default function UnitDashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'region_admin') {
    return <RegionDashboard user={user} />;
  }

  return (
    <ProtectedRoute allowedRoles={['state_admin', 'city_admin', 'district_admin', 'neighborhood_admin', 'region_admin']}>
      <GenericUnitDashboard user={user} />
    </ProtectedRoute>
  );
}
