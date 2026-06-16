'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { FileAddOutlined, LoginOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import Link from 'next/link';
import { nameRules, phoneRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { TextArea } = Input;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];

export default function ObRegisterPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/ob-entries');
      setEntries(response.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load OB entries.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const createEntry = async (values) => {
    setSaving(true);
    try {
      const response = await api.post('/ob-entries', values);
      message.success(`OB registered: ${response.data.obNumber}`);
      form.resetFields();
      setOpen(false);
      loadEntries();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to register OB entry.');
    } finally {
      setSaving(false);
    }
  };

  const canCreate = ['admin', 'ob_staff', 'officer', 'district_admin', 'neighborhood_admin'].includes(user?.role);
  const location = user?.location || {};

  const columns = [
    { title: 'OB Number', dataIndex: 'ob_number', key: 'ob_number', render: (value) => <Text strong>{value}</Text> },
    { title: 'Incident Type', dataIndex: 'incident_type', key: 'incident_type' },
    { title: 'Reported By', dataIndex: 'reported_by', key: 'reported_by' },
    { title: 'Registered By', dataIndex: 'registered_by_name', key: 'registered_by_name' },
    { title: 'District / Police Station', dataIndex: 'district_police_station_name', key: 'district_police_station_name' },
    { title: 'Waax', dataIndex: 'waax_name', key: 'waax_name' },
    { title: 'Date', dataIndex: 'registration_date', key: 'registration_date' },
    { title: 'Time', dataIndex: 'registration_time', key: 'registration_time' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'CASE_OPENED' ? 'green' : 'blue'}>{value}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Link href={`/ob-register/${record.id}`}>
          <Button>View Details</Button>
        </Link>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'neighborhood_admin', ...commanderRoles]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <Title level={2}>OB Register</Title>
            <Text type="secondary">Every OB entry records who registered it, when it was registered, and where it was registered.</Text>
          </div>
          {canCreate && (
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => setOpen(true)}>
              Register OB Entry
            </Button>
          )}
        </div>

        <Card variant="none">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><Text type="secondary">Logged in as</Text><br /><Text strong>{user?.fullName || user?.username}</Text></Col>
            <Col xs={24} md={6}><Text type="secondary">Role</Text><br /><Tag color="blue">{user?.roleCode || user?.role}</Tag></Col>
            <Col xs={24} md={6}><Text type="secondary">District / Police Station</Text><br /><Text strong>{location.districtName || 'System level'}</Text></Col>
            <Col xs={24} md={6}><Text type="secondary">Waax</Text><br /><Text strong>{location.waaxName || 'Not assigned'}</Text></Col>
          </Row>
        </Card>

        <Card variant="none">
          <Table columns={columns} dataSource={entries} rowKey="id" loading={loading} scroll={{ x: 1100 }} />
        </Card>

        <Modal
          title="Register OB Entry"
          open={open}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
          confirmLoading={saving}
          width={720}
        >
          <Card size="small" variant="none" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size={2}>
              <Text><LoginOutlined /> Location is captured automatically from your user profile.</Text>
              <Text type="secondary">{location.stateName || 'Administration'} → {location.regionName || 'Region'} → {location.districtName || 'District / Police Station'} → {location.waaxName || 'Waax'}</Text>
            </Space>
          </Card>
          <Form form={form} layout="vertical" onFinish={createEntry}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="incident_type" label="Incident Type" rules={[requiredRule('Incident type')]}>
                  <Select placeholder="Select incident type">
                    <Select.Option value="Theft">Theft</Select.Option>
                    <Select.Option value="Robbery">Robbery</Select.Option>
                    <Select.Option value="Assault">Assault</Select.Option>
                    <Select.Option value="Fraud">Fraud</Select.Option>
                    <Select.Option value="Traffic">Traffic</Select.Option>
                    <Select.Option value="General">General</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="incident_location" label="Incident Location" rules={[requiredRule('Incident location'), textLengthRule('Incident location', 3, 255)]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="reported_by" label="Reported By" rules={nameRules('Reporter name')}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="reporter_phone" label="Reporter Phone" rules={phoneRules}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="description" label="Initial Incident Description" rules={[textLengthRule('Incident description', 10, 5000)]}>
                  <TextArea rows={4} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
