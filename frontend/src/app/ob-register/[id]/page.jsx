'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, FileAddOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Title, Text, Paragraph } = Typography;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];

export default function ObDetailPage() {
  const { id } = useParams();
  const { message } = App.useApp();
  const [ob, setOb] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOb = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/ob-entries/${id}`);
      setOb(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load OB entry.');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    if (id) loadOb();
  }, [id, loadOb]);

  const converted = ob?.linked_case_id || ['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob?.status);

  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'neighborhood_admin', ...commanderRoles]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Space orientation="vertical">
            <Link href="/ob-register">
              <Button type="text" icon={<ArrowLeftOutlined />}>Back to OB Register</Button>
            </Link>
            <Title level={2} style={{ margin: 0 }}>OB Detail: {ob?.ob_number || id}</Title>
            <Text type="secondary">Review the original occurrence book record before creating a formal case.</Text>
          </Space>
          <Space wrap>
            {ob?.status && <Tag color={converted ? 'green' : 'blue'}>{ob.status}</Tag>}
            {converted ? (
              ob?.linked_case_id ? (
                <Link href={`/cases/${ob.linked_case_id}`}>
                  <Button type="primary">Open Linked Case</Button>
                </Link>
              ) : (
                <Button disabled>This OB has already been converted to a case.</Button>
              )
            ) : (
              <Link href={`/cases/new?ob_entry_id=${id}`}>
                <Button type="primary" icon={<FileAddOutlined />}>Convert to Case</Button>
              </Link>
            )}
          </Space>
        </div>

        <Card variant="none" loading={loading}>
          {ob && (
            <Descriptions bordered column={2}>
              <Descriptions.Item label="OB Number">{ob.ob_number}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={converted ? 'green' : 'blue'}>{ob.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Incident Type">{ob.incident_type}</Descriptions.Item>
              <Descriptions.Item label="Incident Location">{ob.incident_location}</Descriptions.Item>
              <Descriptions.Item label="Reported By">{ob.reported_by}</Descriptions.Item>
              <Descriptions.Item label="Reporter Phone">{ob.reporter_phone}</Descriptions.Item>
              <Descriptions.Item label="Registered By OB Staff">{ob.registered_by_name}</Descriptions.Item>
              <Descriptions.Item label="Registered Role">{ob.registered_by_role}</Descriptions.Item>
              <Descriptions.Item label="Registration Date">{ob.registration_date}</Descriptions.Item>
              <Descriptions.Item label="Registration Time">{ob.registration_time}</Descriptions.Item>
              <Descriptions.Item label="State">{ob.state_name}</Descriptions.Item>
              <Descriptions.Item label="Region">{ob.region_name}</Descriptions.Item>
              <Descriptions.Item label="District / Police Station">{ob.district_police_station_name}</Descriptions.Item>
              <Descriptions.Item label="Waax">{ob.waax_name}</Descriptions.Item>
              <Descriptions.Item label="Short Description" span={2}>
                <Paragraph style={{ marginBottom: 0 }}>{ob.description || 'No description recorded.'}</Paragraph>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
