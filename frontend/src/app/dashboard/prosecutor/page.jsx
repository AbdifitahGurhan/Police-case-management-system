// src/app/dashboard/prosecutor/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Typography } from 'antd';
import {
  AuditOutlined,
  BookOutlined,
  CheckSquareOutlined,
  ContainerOutlined
} from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

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
    <StandardDashboard
      allowedRoles={['prosecutor', 'admin']}
      eyebrow="Public prosecution"
      title="Public Prosecutor Dashboard"
      subtitle="Review case files, evidence, and decide on legal proceedings."
      loading={loading}
      metrics={[
        { title: 'Pending Review', value: data?.referred_prosecutor || 0, icon: <AuditOutlined />, tone: 'amber' },
        { title: 'Total Referred', value: data?.total || 0, icon: <BookOutlined />, tone: 'blue' },
        { title: 'Processed Cases', value: data?.closed_cases || 0, icon: <CheckSquareOutlined />, tone: 'green' },
        { title: 'Report Files', value: (data?.total || 0) + (data?.closed_cases || 0), icon: <ContainerOutlined />, tone: 'purple' },
      ]}
      tableTitle="Prosecution Queue - Case Files for Review"
      tableColumns={columns}
      tableData={data?.recentCases || []}
      rowKey="id"
      pagination={false}
    />
  );
}
