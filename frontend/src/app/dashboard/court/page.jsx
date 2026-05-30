// src/app/dashboard/court/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Tag, Typography } from 'antd';
import {
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function CourtDashboard() {
  const [data, setData] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsResponse, referralsResponse] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/referrals?role=court'),
        ]);
        setData(statsResponse.data.data);
        setReferrals(referralsResponse.data.data || []);
      } catch (err) {
        console.error('Failed to fetch court stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const courtQueue = useMemo(() => {
    return referrals.map((referral) => ({
      ...referral,
      id: referral.case_id,
      title: referral.case_title,
      status: 'referred_to_court',
      created_at: referral.referred_at,
    }));
  }, [referrals]);

  const columns = [
    {
      title: 'Lambarka OB',
      dataIndex: 'ob_number',
      key: 'ob_number',
      render: (text, record) => <Link href={`/cases/${record.id}`}><Typography.Text strong>{text}</Typography.Text></Link>,
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
      render: (priority) => {
        const colors = { low: 'blue', medium: 'cyan', high: 'orange', critical: 'red' };
        return <Tag color={colors[priority] || 'default'}>{priorityLabels[priority] || priority}</Tag>;
      },
    },
    {
      title: 'Court Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Filed On',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <StandardDashboard
      allowedRoles={['court', 'admin']}
      eyebrow="Court Referral"
      title="Cases Referred to Court"
      subtitle="This section shows cases investigated by police and referred to court for legal action."
      loading={loading}
      metrics={[
        { title: 'Court Referrals', value: data?.referred_to_court || courtQueue.length, icon: <BankOutlined />, tone: 'blue', note: 'Cases forwarded' },
        { title: 'Completed Workflows', value: data?.referred_to_court || courtQueue.length, icon: <FileDoneOutlined />, tone: 'green', note: 'Station work completed' },
        { title: 'Closed Cases', value: data?.closed || 0, icon: <CheckCircleOutlined />, tone: 'purple', note: 'Completed records' },
      ]}
      actions={[
        { label: 'Reports', href: '/reports', icon: <FileDoneOutlined /> },
        { label: 'Evidence', href: '/evidence', icon: <AuditOutlined /> },
      ]}
      tableTitle="Court Cases"
      tableSubtitle="Cases referred to court after police investigation. Verdicts and sentencing are not recorded here."
      tableColumns={columns}
      tableData={courtQueue}
    />
  );
}
