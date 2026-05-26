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
  low: 'Hoose',
  medium: 'Dhexdhexaad',
  high: 'Sare',
  critical: 'Halis',
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
      title: 'Cinwaanka Kiiska',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Mudnaanta',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const colors = { low: 'blue', medium: 'cyan', high: 'orange', critical: 'red' };
        return <Tag color={colors[priority] || 'default'}>{priorityLabels[priority] || priority}</Tag>;
      },
    },
    {
      title: 'Xaaladda Maxkamadda',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'La Diiwaan Geliyey',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
  ];

  return (
    <StandardDashboard
      allowedRoles={['court', 'admin']}
      eyebrow="Court Referral"
      title="Kiisaska Maxkamad Loo Gudbiyay"
      subtitle="Qaybtani waxay muujisaa kaliya kiisaska boolisku baaray kadibna maxkamad loogu gudbiyay tallaabo sharci ah."
      loading={loading}
      metrics={[
        { title: 'Court Referrals', value: data?.referred_to_court || courtQueue.length, icon: <BankOutlined />, tone: 'blue', note: 'Kiisas loo gudbiyay' },
        { title: 'Workflow Dhammaaday', value: data?.referred_to_court || courtQueue.length, icon: <FileDoneOutlined />, tone: 'green', note: 'Shaqada saldhigga way xirmatay' },
        { title: 'Kiisas Xiran', value: data?.closed || 0, icon: <CheckCircleOutlined />, tone: 'purple', note: 'Diiwaanno dhammaaday' },
      ]}
      actions={[
        { label: 'Warbixinno', href: '/reports', icon: <FileDoneOutlined /> },
        { label: 'Caddeymo', href: '/evidence', icon: <AuditOutlined /> },
      ]}
      tableTitle="Kiisaska Maxkamadda"
      tableSubtitle="Kiisas loo gudbiyay maxkamad kadib baaritaanka booliska. Xukun iyo sentence laguma diiwaan geliyo halkan."
      tableColumns={columns}
      tableData={courtQueue}
    />
  );
}
