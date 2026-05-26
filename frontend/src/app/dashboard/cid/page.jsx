// src/app/dashboard/cid/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  FileSearchOutlined,
  HourglassOutlined,
  SearchOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/services/api';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

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
      ellipsis: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const colors = { low: 'blue', medium: 'cyan', high: 'orange', critical: 'red' };
        return <Tag color={colors[priority] || 'default'}>{priority?.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Current Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color="purple">{status?.replace(/_/g, ' ').toUpperCase()}</Tag>
    },
    {
      title: 'Assigned Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <StandardDashboard
      allowedRoles={['cid', 'admin']}
      eyebrow="Investigation Workspace"
      title="CID Dashboard"
      subtitle="Manage investigations, analyze evidence, and report findings."
      loading={loading}
      metrics={[
        { title: 'Assigned to Me', value: data?.total || 0, icon: <SolutionOutlined />, tone: 'purple', note: 'Assigned case files' },
        { title: 'Active Investigations', value: data?.under_investigation || 0, icon: <SearchOutlined />, tone: 'blue', note: 'Currently active' },
        { title: 'Pending Referral', value: data?.referred_cid || 0, icon: <HourglassOutlined />, tone: 'amber', note: 'Awaiting action' },
        { title: 'Cases Solved', value: data?.closed_cases || 0, icon: <CheckCircleOutlined />, tone: 'green', note: 'Closed investigations' },
      ]}
      tableTitle="Cases Requiring Investigation"
      tableSubtitle="Queue of case files requiring CID attention"
      tableColumns={columns}
      tableData={data?.recentCases || []}
    />
  );
}
