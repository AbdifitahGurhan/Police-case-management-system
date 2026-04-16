// src/app/evidence/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Input, Tag, Button, Breadcrumb, Tooltip, App } from 'antd';
import { SearchOutlined, DatabaseOutlined, EyeOutlined, FileSearchOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function EvidenceBrowserPage() {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await api.get('/evidence');
      setData(res.data.data);
    } catch (err) {
      message.error("Failed to load evidence repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const filteredData = data.filter(item => 
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.evidence_number?.toLowerCase().includes(search.toLowerCase()) ||
    item.case_id?.toString().includes(search)
  );

  const columns = [
    { title: 'Evidence #', dataIndex: 'evidence_number', key: 'evidence_number', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t.toUpperCase()}</Tag> },
    { title: 'Collector', dataIndex: 'collected_by_name', key: 'collected_by_name' },
    { title: 'Date Collected', dataIndex: 'collection_date', key: 'collection_date', render: d => dayjs(d).format('DD/MM/YYYY') },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
           <Link href={`/cases/${record.case_id}`}>
            <Button size="small" icon={<FileSearchOutlined />}>Case File</Button>
           </Link>
           {record.file_url && (
              <Button size="small" type="link" href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${record.file_url}`} target="_blank">
                View File
              </Button>
           )}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Evidence Repository' }]} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Central Evidence Repository</Title>
            <Typography.Text type="secondary">Digital catalog of all physical and digital exhibits across Somalia police stations.</Typography.Text>
          </div>
          <DatabaseOutlined style={{ fontSize: '32px', color: '#1677ff' }} />
        </div>

        <Card variant="none">
          <Input 
            placeholder="Search by Evidence Number, Title or Case ID..." 
            prefix={<SearchOutlined />} 
            style={{ width: 400, marginBottom: 20 }}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Table columns={columns} dataSource={filteredData} rowKey="id" loading={loading} />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
