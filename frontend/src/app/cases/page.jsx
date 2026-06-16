// src/app/cases/page.jsx
'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Input, Select, Tag, Button, Breadcrumb } from 'antd';
import { SearchOutlined, EyeOutlined, AuditOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title } = Typography;
const { Option } = Select;

export default function CaseListPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });

  const fetchCases = useCallback(async (page = 1, size = 15) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: size,
        search: filters.search,
        status: filters.status,
        priority: filters.priority
      };
      const res = await api.get('/cases', { params });
      setCases(res.data.data);
      setPagination((current) => ({
        ...current,
        current: page,
        total: res.data.pagination.total
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleTableChange = (pagination) => {
    fetchCases(pagination.current, pagination.pageSize);
  };

  const columns = [
    {
      title: 'OB Number',
      dataIndex: 'ob_number',
      key: 'ob_number',
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'case_type',
      key: 'case_type',
    },
    {
      title: 'Station',
      dataIndex: 'station_name',
      key: 'station_name',
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
      render: (p) => {
        const colors = { critical: 'red', high: 'volcano', medium: 'gold', low: 'blue' };
        return <Tag color={colors[p]}>{p.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Link href={`/cases/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>View</Button>
        </Link>
      ),
    },
  ];
  return (
    <ProtectedRoute>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Cases' }]} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>Case Register</Title>
          <Link href="/ob-register">
            <Button type="primary" icon={<AuditOutlined />}>Go to OB Registration</Button>
          </Link>
        </div>

        <Card variant="none">
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="Search OB, address, or location..."
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              onPressEnter={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <Select
              placeholder="Status"
              style={{ width: 150 }}
              allowClear
              onChange={(v) => setFilters({ ...filters, status: v })}
            >
              <Option value="open">Open</Option>
              <Option value="under_investigation">Under Investigation</Option>
              <Option value="referred_cid">Referred to CID</Option>
              <Option value="closed">Closed</Option>
            </Select>
            <Select
              placeholder="Priority"
              style={{ width: 150 }}
              allowClear
              onChange={(v) => setFilters({ ...filters, priority: v })}
            >
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Space>

          <Table
            columns={columns}
            dataSource={cases}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
          />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
