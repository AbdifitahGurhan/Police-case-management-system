// src/app/cases/page.jsx
'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
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
import { useSearchParams } from 'next/navigation';
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
  { value: 'draft', label: 'Qabyo' },
  { value: 'registered', label: 'Diiwaangashan' },
  { value: 'CASE_REGISTERED', label: 'Kiis Furay' },
  { value: 'under_investigation', label: 'Baaris ku Socota' },
  { value: 'referred_to_court', label: 'Maxkamadda loo Gudbiyey' },
  { value: 'court_decided', label: 'Maxkamaddu Go\'aamisay' },
  { value: 'closed', label: 'La Soo Gabagabeeyay' },
  { value: 'archived', label: 'La Kaydiyey (Archived)' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Aad u Degdeg Badan' },
  { value: 'high', label: 'Sare / Degdeg' },
  { value: 'medium', label: 'Dhexdhexaad' },
  { value: 'low', label: 'Hoose' },
];

const priorityLabels = {
  critical: 'Aad u Degdeg Badan',
  high: 'Sare / Degdeg',
  medium: 'Dhexdhexaad',
  low: 'Hoose',
};

const priorityTone = {
  critical: 'critical',
  high: 'warning',
  medium: 'pending',
  low: 'neutral',
};

function CaseListContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialDistrictId = searchParams.get('district_id') ? Number(searchParams.get('district_id')) : undefined;
  const initialScope = searchParams.get('scope') || undefined;
  const [cases, setCases] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    priority: undefined,
    district_id: initialDistrictId,
    scope: initialScope,
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
      if (activeFilters.scope) params.scope = activeFilters.scope;

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
      setLoadError(err.response?.data?.message || 'Kiisaska lama soo sharixi karo.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (user && canRead) {
      fetchCases(1, pagination.pageSize, filters);
    }
  }, [fetchCases, user, canRead]);

  useEffect(() => {
    api
      .get('/stations')
      .then((res) => {
        const payload = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setStations(payload);
      })
      .catch(() => setStations([]));
  }, []);

  const handleTableChange = (pag) => {
    fetchCases(pag.current, pag.pageSize, filters);
  };

  const applySearch = () => {
    const nextFilters = { ...filters, search: searchInput.trim() };
    setFilters(nextFilters);
    fetchCases(1, pagination.pageSize, nextFilters);
  };

  const columns = [
    {
      title: 'Lambarka Kiiska',
      dataIndex: 'case_number',
      key: 'case_number',
      render: (text, record) => (
        <Link href={`/cases/${record.id}`}>
          <Text strong style={{ color: '#0284c7' }}>
            {text}
          </Text>
        </Link>
      ),
    },
    {
      title: 'Cinwaanka Dacwadda',
      dataIndex: 'title',
      key: 'title',
      render: (t, r) => (
        <div>
          <div>{t || r.case_title || '—'}</div>
          {r.ob_number && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              OB: {r.ob_number}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Goobta / Saldhigga',
      dataIndex: 'station_name',
      key: 'station_name',
      render: (s, r) => s || r.district_name || r.incident_location || '—',
    },
    {
      title: 'Xaaladda',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Mudnaanta',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Tag className={`status-tag status-tag--${priorityTone[p] || 'neutral'}`}>
          {priorityLabels[p] || p || '—'}
        </Tag>
      ),
    },
    {
      title: 'Taariikhda Diiwaangelinta',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Hawlaha',
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
        <Breadcrumb items={[{ title: 'Bogga Hore' }, { title: 'Kiisaska Dacwadaha' }]} />

        <div className="standard-dashboard-hero" style={{ marginBottom: 0 }}>
          <div>
            <Text className="dashboard-eyebrow">Maamulka Kiisaska Booliska</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 600, margin: '4px 0' }}>
              Kiisaska Dacwadaha (Cases)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Duhay, shaandhee, oo maamul dhammaan galalka kiisaska dambiyada ee deegaankaaga.
            </Text>
          </div>
          {canCreate && (
            <Link href="/cases/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Diiwaangeli Kiis Cusub
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
              placeholder="Raadi kiis, lambarka OB, goobta..."
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={applySearch}
              allowClear
              onClear={() => {
                setSearchInput('');
                setFilters((prev) => ({ ...prev, search: '' }));
              }}
            />
            <Button onClick={applySearch} type="primary">Raadi</Button>
            <Select
              placeholder="Xaaladda Kiiska"
              style={{ width: 200 }}
              allowClear
              options={STATUS_OPTIONS}
              value={filters.status}
              onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
            />
            <Select
              placeholder="Heerka Mudnaanta"
              style={{ width: 180 }}
              allowClear
              options={PRIORITY_OPTIONS}
              value={filters.priority}
              onChange={(v) => setFilters((prev) => ({ ...prev, priority: v }))}
            />
            <Select
              placeholder="Saldhigga Booliska"
              style={{ width: 220 }}
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
                `${range[0]}–${range[1]} ee ${total} kiis (Bogga ${pagination.current}/${pagination.pages || 1})`,
            }}
            onChange={handleTableChange}
          />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}

export default function CaseListPage() {
  return (
    <Suspense fallback={null}>
      <CaseListContent />
    </Suspense>
  );
}
