// src/app/dashboard/admin/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Tag, Typography } from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [stationStats, setStationStats] = useState([]);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [summaryRes, stationRes, chartRes] = await Promise.all([
          api.get('/reports/summary'),
          api.get('/reports/by-station'),
          api.get('/reports/dashboard-charts'),
        ]);
        setStats(summaryRes.data.data);
        setStationStats(stationRes.data.data);
        setCharts(chartRes.data.data);
      } catch (err) {
        console.error('Failed to fetch admin stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const caseStats = stats?.caseStats || {};
  const totalCases = Number(caseStats.total_cases || 0);
  const openCases = Number(caseStats.confirmed_active || 0) + Number(caseStats.pending_review || 0) + Number(caseStats.draft || 0);
  const closedCases = Number(caseStats.closed || 0);
  const criticalCases = Number(caseStats.critical_priority || 0);
  const activeUsers = Number(stats?.userStats?.total_users || 0);
  const stationsCount = Number(stats?.stationsStats?.total_stations || 0);
  const evidenceCount = Number(stats?.evidenceStats?.total_evidence || 0);

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
      title: 'Pending',
      dataIndex: 'pending_cases',
      key: 'pending_cases',
      render: (val) => <Typography.Text type={val > 0 ? 'warning' : 'secondary'}>{val || 0}</Typography.Text>
    },
    {
      title: 'Confirmed',
      dataIndex: 'confirmed_cases',
      key: 'confirmed_cases',
      render: (val) => <Typography.Text style={{ color: '#1967d2' }}>{val || 0}</Typography.Text>
    },
    {
      title: 'Closed Cases',
      dataIndex: 'closed_cases',
      key: 'closed_cases',
      render: (val) => <Typography.Text type="success">{val || 0}</Typography.Text>
    }
  ];

  const renderMiniChart = (title, rows = []) => {
    const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
    return (
      <Card variant="none" className="standard-panel dashboard-chart-card" title={title}>
        <div className="dashboard-chart-list">
          {rows.length === 0 ? (
            <Typography.Text type="secondary">No data available</Typography.Text>
          ) : rows.map((row) => (
            <div className="dashboard-chart-row" key={`${title}-${row.label}`}>
              <div className="dashboard-chart-label">
                <span>{row.label || 'Unknown'}</span>
                <strong>{row.value || 0}</strong>
              </div>
              <div className="dashboard-chart-track">
                <div style={{ width: `${Math.max((Number(row.value || 0) / max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <>
    <StandardDashboard
      allowedRoles={['admin']}
      eyebrow="Command Center"
      title="Admin Dashboard"
      subtitle="System-wide monitoring for cases, units, users, and evidence."
      loading={loading}
      metrics={[
        { title: 'Total Cases', value: totalCases, icon: <FileSearchOutlined />, tone: 'blue', note: 'Registered records' },
        { title: 'Critical Cases', value: criticalCases, icon: <AlertOutlined />, tone: 'red', note: 'Requires attention' },
        { title: 'Open Cases', value: openCases, icon: <ClockCircleOutlined />, tone: 'amber', note: 'Active workflows' },
        { title: 'Closed Cases', value: closedCases, icon: <CheckCircleOutlined />, tone: 'green', note: 'Completed workflow' },
      ]}
      sidePanel={{
        title: 'System Snapshot',
        content: ( 
          <div className="standard-side-list">
            <div><UserOutlined /><span>Active Users</span><strong>{activeUsers}</strong></div>
            <div><EnvironmentOutlined /><span>Stations</span><strong>{stationsCount}</strong></div>
            <div><DatabaseOutlined /><span>Evidence</span><strong>{evidenceCount}</strong></div>
          </div>
        ),
      }}
      tableTitle="Case Distribution by Station"
      tableSubtitle="Operational performance across stations and units"
      tableColumns={columns}
      tableData={stationStats}
      rowKey="station_name"
      viewAllHref="/stations"
    />
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>{renderMiniChart('Cases by Station', charts?.byStation)}</Col>
      <Col xs={24} lg={12}>{renderMiniChart('Cases by Crime Type', charts?.byCrimeType)}</Col>
      <Col xs={24} lg={12}>{renderMiniChart('Cases by Month', charts?.byMonth)}</Col>
      <Col xs={24} lg={12}>{renderMiniChart('Open vs Closed', charts?.openClosed)}</Col>
      <Col xs={24} lg={12}>{renderMiniChart('Critical Cases', charts?.criticalCases)}</Col>
      <Col xs={24} lg={12}>{renderMiniChart('Court Outcomes', charts?.courtOutcomes)}</Col>
    </Row>
    </>
  );
}
