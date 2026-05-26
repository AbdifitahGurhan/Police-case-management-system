// src/app/dashboard/ward_commander/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { Button, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

export default function WardCommanderDashboard() {
  const [stats, setStats] = useState({});
  const [pendingCases, setPendingCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, casesRes] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/cases?status=pending_commander_review'),
        ]);
        setStats(statsRes.data.data);
        setPendingCases(casesRes.data.data);
      } catch (err) {
        console.error('Dashboard data load failed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const columns = [
    {
      title: 'OB Number',
      dataIndex: 'ob_number',
      key: 'ob_number',
      render: (text, record) => <Link href={`/cases/${record.id}`}><Typography.Text strong>{text}</Typography.Text></Link>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Date Created', dataIndex: 'created_at', key: 'created_at', render: (date) => dayjs(date).format('DD MMM YYYY') },
    { title: 'Officer', dataIndex: 'officer_name', key: 'officer_name' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <CaseStatusTag status={status} /> },
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

  return (
    <StandardDashboard
      allowedRoles={['ward_commander', 'admin']}
      eyebrow="Commander Workspace"
      title="Ward Commander Dashboard"
      subtitle="Review and confirm case integrity for your assigned ward."
      loading={loading}
      metrics={[
        { title: 'Total Ward Cases', value: stats.total_cases || 0, icon: <FileSearchOutlined />, tone: 'blue', note: 'Within your scope' },
        { title: 'Pending Review', value: pendingCases.length, icon: <ClockCircleOutlined />, tone: 'amber', note: 'Needs confirmation' },
        { title: 'Confirmed Cases', value: stats.confirmed_cases || 0, icon: <CheckCircleOutlined />, tone: 'green', note: 'Approved records' },
        { title: 'Active Investigations', value: stats.under_investigation_cases || 0, icon: <ExclamationCircleOutlined />, tone: 'red', note: 'Ongoing work' },
      ]}
      tableTitle="Pending Commander Review"
      tableSubtitle="Cases waiting for commander confirmation"
      tableColumns={columns}
      tableData={pendingCases}
    />
  );
}
