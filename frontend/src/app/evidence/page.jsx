// src/app/evidence/page.jsx
'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Input, Tag, Button, Breadcrumb, Tooltip, App, Modal } from 'antd';
import { SearchOutlined, DatabaseOutlined, EyeOutlined, FileSearchOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const UPLOAD_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

export default function EvidenceBrowserPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewRecord, setPreviewRecord] = useState(null);

  const caseReadRoles = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'state_commander', 'region_commander', 'district_commander', 'ward_commander', 'police_station_commander', 'waax_commander'];
  const canReadCases = user && caseReadRoles.includes(user.role);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evidence');
      setData(res.data.data);
    } catch (err) {
      message.error('Failed to load evidence records.');
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
    { title: 'Evidence #', dataIndex: 'evidence_number', key: 'evidence_number', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t.toUpperCase()}</Tag> },
    { title: 'Collected By', dataIndex: 'collected_by_name', key: 'collected_by_name' },
    { title: 'Collection Date', dataIndex: 'collection_date', key: 'collection_date', render: d => dayjs(d).format('DD/MM/YYYY') },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
           {canReadCases && (
             <Link href={`/cases/${record.case_id}`}>
              <Button size="small" icon={<FileSearchOutlined />}>Case File</Button>
             </Link>
           )}
           {record.file_url && (
              <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => setPreviewRecord(record)}>
                Preview
              </Button>
           )}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'officer', 'cid', 'court', 'jail', 'district_admin', 'neighborhood_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Evidence Records' }]} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Evidence Records</Title>
            <Typography.Text type="secondary">Repository for case media, documents, and evidence items.</Typography.Text>
          </div>
          <DatabaseOutlined style={{ fontSize: '32px', color: '#1677ff' }} />
        </div>

        <Card variant="none">
          <Input 
            placeholder="Search evidence number, title, or case ID..." 
            prefix={<SearchOutlined />} 
            style={{ width: 400, marginBottom: 20 }}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Table columns={columns} dataSource={filteredData} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />
        </Card>

        <Modal
          title={previewRecord?.title || 'Evidence Preview'}
          open={!!previewRecord}
          onCancel={() => setPreviewRecord(null)}
          footer={previewRecord?.file_url ? (
            <Button href={`${UPLOAD_BASE_URL}${previewRecord.file_url}`} target="_blank">Open in New Tab</Button>
          ) : null}
          width={900}
        >
          {previewRecord?.file_url && (
            <div className="evidence-preview-frame">
              {previewRecord.mime_type?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${UPLOAD_BASE_URL}${previewRecord.file_url}`} alt={previewRecord.title} />
              ) : previewRecord.mime_type === 'application/pdf' || previewRecord.file_url?.toLowerCase().endsWith('.pdf') ? (
                <iframe title={previewRecord.title} src={`${UPLOAD_BASE_URL}${previewRecord.file_url}`} />
              ) : previewRecord.mime_type?.startsWith('text/') || previewRecord.file_url?.toLowerCase().endsWith('.txt') ? (
                <iframe title={previewRecord.title} src={`${UPLOAD_BASE_URL}${previewRecord.file_url}`} />
              ) : (
                <div className="evidence-preview-empty">
                  <Text type="secondary">Preview is not available for this file type. Open it in a new tab to inspect it.</Text>
                </div>
              )}
            </div>
          )}
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
