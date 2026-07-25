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
  'admin', 'staff', 'officer', 'district_admin',
  'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
  'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
  'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
];

const CASE_WRITE_ROLES = [
  'admin', 'officer', 'district_admin',
  'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
  'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'registered', label: 'Registered' },
  { value: 'CASE_REGISTERED', label: 'Case registered' },
  { value: 'under_investigation', label: 'Under investigation' },
  { value: 'referred_to_cid', label: 'Referred to CID' },
  { value: 'ready_for_court', label: 'Ready for court' },
  { value: 'forwarded_to_court', label: 'Forwarded to court' },
  { value: 'court_decided', label: 'Court decided' },
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
  const canCreate = user && CASE_WRITE_ROLES.includes(normalizedRole);

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
    if (!authLoading && user && CASE_READ_ROLES.includes(normalizedRole)) {
      fetchCases(1, pagination.pageSize, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, filters]);

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
      title: 'Case number',
      dataIndex: 'case_number',
      key: 'case_number',
      render: (text, record) => (
        <Typography.Text strong>{text || record.ob_number || '—'}</Typography.Text>
      ),
    },
    {
      title: 'OB number',
      dataIndex: 'ob_number',
      key: 'ob_number',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'incident_type',
      key: 'incident_type',
      render: (text, record) => text || record.case_type || '—',
    },
    {
      title: 'Station',
      dataIndex: 'station_name',
      key: 'station_name',
      render: (text) => text || '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <CaseStatusTag status={status} />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Tag className={`status-tag status-tag--${priorityTone[p] || 'neutral'}`}>
          {p || '—'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Link href={`/cases/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={CASE_READ_ROLES}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Cases' }]} />

        <div className="standard-dashboard-hero" style={{ marginBottom: 0 }}>
          <div>
            <Text className="dashboard-eyebrow">Case management</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Cases
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Search, filter, and open investigation records in your jurisdiction.
            </Text>
          </div>
          {canCreate && (
            <Link href="/cases/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New case
              </Button>
            </Link>
          )}
        </div>

        <Card variant="none" className="standard-panel">
          {loadError && (
            <Alert
              type="error"
              showIcon
              message={loadError}
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
