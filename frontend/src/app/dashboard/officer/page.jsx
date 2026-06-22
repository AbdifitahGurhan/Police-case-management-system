// src/app/dashboard/officer/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { Button, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

export default function OfficerDashboard() {
  const [data, setData] = useState(null);
  const [assignedCases, setAssignedCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsResponse, assignedResponse] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/cases/my-assigned'),
        ]);
        setData(statsResponse.data.data);
        setAssignedCases(assignedResponse.data.data || []);
      } catch (err) {
        console.error('Failed to fetch officer stats', err);
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
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: 'Case Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => <Tag color={priority === 'critical' ? 'red' : 'blue'}>{priority?.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Date Registered',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <StandardDashboard
      allowedRoles={['officer', 'admin']}
      eyebrow="Officer Workspace"
      title="Officer Dashboard"
      subtitle="Register OB records, track pending reviews, and monitor active station work."
      loading={loading}
      metrics={[
        { title: 'Total Cases', value: data?.total || 0, icon: <FileTextOutlined />, tone: 'blue', note: 'Registered records' },
        { title: 'Draft / Pending', value: (data?.draft || 0) + (data?.pending_review || 0), icon: <ClockCircleOutlined />, tone: 'amber', note: 'Needs review' },
        { title: 'Active Cases', value: data?.active || 0, icon: <SafetyCertificateOutlined />, tone: 'purple', note: 'In progress' },
        { title: 'Closed Cases', value: data?.closed || 0, icon: <CheckCircleOutlined />, tone: 'green', note: 'Completed workflow' },
      ]}
      actions={[
        { label: 'Register OB', type: 'primary', icon: <AuditOutlined />, href: '/ob-register' },
      ]}
      tableTitle="My Assigned Cases"
      tableSubtitle="Cases directly assigned to this officer account"
      tableColumns={columns}
      tableData={assignedCases}
    />
  );
}
