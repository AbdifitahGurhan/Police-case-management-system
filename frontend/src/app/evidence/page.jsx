// src/app/evidence/page.jsx
'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Input, Tag, Button, Breadcrumb, Tooltip, App } from 'antd';
import { SearchOutlined, DatabaseOutlined, EyeOutlined, FileSearchOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title, Text } = Typography;
const UPLOAD_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

export default function EvidenceBrowserPage() {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evidence');
      setData(res.data.data);
    } catch (err) {
      message.error("Diiwaanka caddeymaha lama soo gelin.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const filteredData = data.filter(item => 
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.evidence_number?.toLowerCase().includes(search.toLowerCase()) ||
    item.case_id?.toString().includes(search)
  );

  const columns = [
    { title: 'Caddeyn #', dataIndex: 'evidence_number', key: 'evidence_number', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Cinwaan', dataIndex: 'title', key: 'title' },
    { title: 'Nooca', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t.toUpperCase()}</Tag> },
    { title: 'Ururiyey', dataIndex: 'collected_by_name', key: 'collected_by_name' },
    { title: 'Taariikhda', dataIndex: 'collection_date', key: 'collection_date', render: d => dayjs(d).format('DD/MM/YYYY') },
    {
      title: 'Ficil',
      key: 'action',
      render: (_, record) => (
        <Space>
           <Link href={`/cases/${record.case_id}`}>
            <Button size="small" icon={<FileSearchOutlined />}>Faylka Kiiska</Button>
           </Link>
           {record.file_url && (
              <Button size="small" type="link" href={`${UPLOAD_BASE_URL}${record.file_url}`} target="_blank">
                Fur Faylka
              </Button>
           )}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'officer', 'cid', 'court', 'jail', 'district_admin', 'neighborhood_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Bogga Hore' }, { title: 'Diiwaanka Caddeymaha' }]} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Diiwaanka Caddeymaha</Title>
            <Typography.Text type="secondary">Kaydka caddeymaha muuqaalka, dukumentiyada, iyo walxaha la xiriira kiisaska.</Typography.Text>
          </div>
          <DatabaseOutlined style={{ fontSize: '32px', color: '#1677ff' }} />
        </div>

        <Card variant="none">
          <Input 
            placeholder="Raadi lambarka caddeynta, cinwaan, ama case ID..." 
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
