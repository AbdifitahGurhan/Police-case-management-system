// src/app/dashboard/jail/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Tag, Typography } from 'antd';
import {
  DatabaseOutlined,
  IdcardOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
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

export default function JailDashboard() {
  const [caseData, setCaseData] = useState(null);
  const [offenders, setOffenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [caseRes, offenderRes] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/suspects', { params: { arrested: '1' } }),
        ]);
        setCaseData(caseRes.data.data);
        setOffenders(offenderRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch jail stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const custodyCases = useMemo(() => {
    const cases = caseData?.recentCases || [];
    return cases.filter((item) => ['closed', 'approved_for_court', 'under_investigation'].includes(item.status));
  }, [caseData]);

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
      title: 'Status',
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
      allowedRoles={['jail', 'admin']}
      eyebrow="Jail Operations"
      title="Jail Dashboard"
      subtitle="View incarcerated person records, related cases, evidence, and jail reports."
      loading={loading}
      metrics={[
        { title: 'Incarcerated Offenders', value: offenders.length, icon: <LockOutlined />, tone: 'red', note: 'Marked for detention' },
        { title: 'Custody Cases', value: custodyCases.length, icon: <SafetyCertificateOutlined />, tone: 'blue', note: 'Related cases' },
        { title: 'Total Cases', value: caseData?.total || 0, icon: <DatabaseOutlined />, tone: 'purple', note: 'Cases available for review' },
        { title: 'Offender Records', value: offenders.length, icon: <IdcardOutlined />, tone: 'green', note: 'Custody data' },
      ]}
      actions={[
        { label: 'Offenders', href: '/offenders', icon: <IdcardOutlined /> },
        { label: 'Reports', href: '/reports', icon: <DatabaseOutlined /> },
      ]}
      tableTitle="Custody Cases"
      tableSubtitle="Records related to custody and offender verification"
      tableColumns={columns}
      tableData={custodyCases.length ? custodyCases : caseData?.recentCases || []}
    />
  );
}
