'use client';

import React, { useEffect, useState } from 'react';
import { Button, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

export default function InvestigatorDashboard() {
  const [stats, setStats] = useState(null);
  const [assignedCases, setAssignedCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [statsResponse, assignedResponse] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/cases/my-assigned'),
        ]);
        setStats(statsResponse.data.data);
        setAssignedCases(assignedResponse.data.data || []);
      } catch (error) {
        console.error('Failed to load investigator dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const columns = [
    {
      title: 'Lambarka Kiiska',
      dataIndex: 'case_number',
      key: 'case_number',
      render: (value, record) => <Typography.Text strong>{value || record.ob_number || 'N/A'}</Typography.Text>,
    },
    {
      title: 'Cinwaanka',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (value) => value || 'Kiis baaritaan',
    },
    {
      title: 'Mudnaanta',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => <Tag color={priority === 'critical' || priority === 'high' ? 'red' : 'blue'}>{priority || 'normal'}</Tag>,
    },
    {
      title: 'Xaaladda',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Taariikhda',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? dayjs(date).format('DD MMM YYYY') : 'N/A'),
    },
    {
      title: 'Ficil',
      key: 'action',
      render: (_, record) => (
        <Button type="link" href={`/cases/${record.id}`}>
          Faahfaahin
        </Button>
      ),
    },
  ];

  return (
    <StandardDashboard
      allowedRoles={['investigator', 'admin']}
      eyebrow="Baaraha"
      title="Baaraha Dashboard"
      subtitle="Kiisaska baaritaanka ee laguu xilsaaray iyo xaaladdooda shaqo."
      loading={loading}
      metrics={[
        { title: 'Dhamaan Cases', value: stats?.total || 0, icon: <FileTextOutlined />, tone: 'blue', note: 'Cases-ka aad arki karto' },
        { title: 'Socda', value: stats?.active || 0, icon: <SafetyCertificateOutlined />, tone: 'purple', note: 'Baaritaan socda' },
        { title: 'Sugaya', value: (stats?.draft || 0) + (stats?.pending_review || 0), icon: <ClockCircleOutlined />, tone: 'amber', note: 'U baahan dabagal' },
        { title: 'Xirmay', value: stats?.closed || 0, icon: <CheckCircleOutlined />, tone: 'green', note: 'La dhameeyay' },
      ]}
      actions={[
        { label: 'Raadi Kiis', type: 'primary', icon: <FileSearchOutlined />, href: '/cases' },
      ]}
      tableTitle="Kiisaska Baaraha"
      tableSubtitle="Cases-ka si toos ah ugu xiran account-kan Baaraha"
      tableColumns={columns}
      tableData={assignedCases}
      viewAllHref="/cases"
      viewAllLabel="Eeg cases-ka oo dhan"
    />
  );
}
