// src/app/cases/page.jsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Breadcrumb,
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { Title, Text } = Typography;

const CASE_READ_ROLES = [
  'admin', 'staff', 'officer', 'investigator', 'station_jail', 'region_admin', 'district_admin',
  'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
  'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
  'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
];

const CASE_WRITE_ROLES = [
  'admin', 'officer', 'investigator', 'district_admin',
  'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
  'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'registered', label: 'OB created' },
  { value: 'CASE_REGISTERED', label: 'Case opened' },
  { value: 'under_investigation', label: 'Baaritaan' },
  { value: 'referred_to_court', label: 'Maxkamad loo gudbiyey' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const priorityTone = {
  critical: 'critical',
  high: 'warning',
  medium: 'pending',
  low: 'neutral',
};

export default function CaseListPage() {
  const { user, loading: authLoading } = useAuth();
  const [cases, setCases] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    priority: undefined,
    district_id: undefined,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    pages: 0,
  });

  const normalizedRole = String(user?.role || '').trim().toLowerCase();
  const userPermissions = user?.permissions || [];
  const hasPermission = key => normalizedRole === 'admin' || userPermissions.includes('*') || userPermissions.includes(key);
  const canRead = Boolean(user && (CASE_READ_ROLES.includes(normalizedRole) || hasPermission('cases.view') || hasPermission('cases.investigate')));
  const canCreate = Boolean(user && (CASE_WRITE_ROLES.includes(normalizedRole) || hasPermission('cases.investigate')));

  const fetchCases = useCallback(async (page = 1, pageSize = 20, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (activeFilters.search) params.search = activeFilters.search;
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.priority) params.priority = activeFilters.priority;
      if (activeFilters.district_id) params.district_id = activeFilters.district_id;

      const res = await api.get('/cases', { params });
      const meta = res.data.pagination || {};
      setCases(res.data.data || []);
      setLoadError('');
      setPagination({
        current: meta.page || page,
        pageSize: meta.limit || pageSize,
        total: meta.total || 0,
        pages: meta.pages || 0,
      });
    } catch (err) {
      console.error(err);
      setCases([]);
      setLoadError(err.response?.data?.message || 'Cases-ka lama soo akhrin karin. Fadlan dib u cusboonaysii bogga.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!authLoading && canRead) {
      fetchCases(1, pagination.pageSize, filters);
    } else if (!authLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, filters, canRead]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const res = await api.get('/stations');
        setStations(res.data.data || []);
      } catch {
        setStations([]);
      }
    };
    if (user) loadStations();
  }, [user]);

  const handleTableChange = (pager) => {
    fetchCases(pager.current, pager.pageSize, filters);
  };

  const applySearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
  };

  const columns = [
    {
      title: 'Nambarka Kiiska',
      dataIndex: 'case_number',
      key: 'case_number',
      render: (text, record) => (
        <Typography.Text strong>{text || record.ob_number || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Nambarka OB-da',
      dataIndex: 'ob_number',
      key: 'ob_number',
    },
    {
      title: 'Cinwaanka Dacwadda',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Nooca Dambiga',
      dataIndex: 'incident_type',
      key: 'incident_type',
      render: (text, record) => text || record.case_type || '—',
    },
    {
      title: 'Saldhigga',
      dataIndex: 'station_name',
      key: 'station_name',
      render: (text) => text || '—',
    },
    {
      title: 'Xaaladda',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Heerka Ahmiyadda',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Tag className={`status-tag status-tag--${priorityTone[p] || 'neutral'}`}>
          {p || '—'}
        </Tag>
      ),
    },
    {
      title: 'Taariikhda',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, record) => (
        <Link href={`/cases/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>
            Eeg Faahfaahinta
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={CASE_READ_ROLES} requiredPermissions={['cases.view', 'cases.investigate']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Bogga Hore' }, { title: 'Galal-kiiseedka (Cases)' }]} />

        <div className="standard-dashboard-hero" style={{ marginBottom: 0 }}>
          <div>
            <Text className="dashboard-eyebrow">Maamulka Kiisaska Booliska</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Galal-kiiseedka (Cases)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Duhay, kala-sifeey, oo fur dhammaan galal-kiiseedka dambiyada ee deegaankaaga.
            </Text>
          </div>
          {canCreate && (
            <Link href="/cases/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Dhal Kiis Cusub
              </Button>
            </Link>
          )}
        </div>

        <Card variant="none" className="standard-panel">
          {loadError && (
            <Alert
              type="error"
              showIcon
              title={loadError}
              style={{ marginBottom: 16 }}
            />
          )}
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="Search case, OB, or location..."
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={applySearch}
              allowClear
              onClear={() => {
                setSearchInput('');
                setFilters((prev) => ({ ...prev, search: '' }));
              }}
            />
            <Button onClick={applySearch}>Search</Button>
            <Select
              placeholder="Status"
              style={{ width: 180 }}
              allowClear
              options={STATUS_OPTIONS}
              value={filters.status}
              onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
            />
            <Select
              placeholder="Priority"
              style={{ width: 140 }}
              allowClear
              options={PRIORITY_OPTIONS}
              value={filters.priority}
              onChange={(v) => setFilters((prev) => ({ ...prev, priority: v }))}
            />
            <Select
              placeholder="Station"
              style={{ width: 200 }}
              allowClear
              showSearch
              optionFilterProp="label"
              value={filters.district_id}
              onChange={(v) => setFilters((prev) => ({ ...prev, district_id: v }))}
              options={stations.map((s) => ({
                value: s.id,
                label: s.name || s.district_name || s.station_name,
              }))}
            />
          </Space>

          <Table
            columns={columns}
            dataSource={cases}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} (page ${pagination.current}/${pagination.pages || 1})`,
            }}
            onChange={handleTableChange}
          />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
