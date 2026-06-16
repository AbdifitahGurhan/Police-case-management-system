// src/app/stations/page.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { App, Table, Card, Typography, Space, Button, Tag, Modal, Form, Input, Row, Col, Select, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { codeRules, passwordRules, requiredRule, textLengthRule, usernameRules } from '@/utils/validation';

const { Title, Text } = Typography;

export default function StationManagementPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canEditStations = user?.role === 'admin';
  const [stations, setStations] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [form] = Form.useForm();

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stations');
      setStations(res.data.data);
    } catch (err) {
      message.error("Failed to load stations.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchGeography = useCallback(async () => {
    try {
      const res = await api.get('/stations/geography');
      setCities(res.data.data.cities || []);
    } catch (err) {
      if (canEditStations) {
        message.error("Failed to load cities.");
      }
    }
  }, [canEditStations, message]);

  useEffect(() => {
    fetchStations();
    if (canEditStations) {
      fetchGeography();
    }
  }, [canEditStations, fetchGeography, fetchStations]);

  const handleOpenModal = (station = null) => {
    setEditingStation(station);
    if (station) {
      form.setFieldsValue(station);
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, values);
        message.success("Station updated.");
      } else {
        await api.post('/stations', values);
        message.success("Station created.");
      }
      setIsModalOpen(false);
      fetchStations();
    } catch (err) {
      message.error("Save failed.");
    }
  };

  const handleDelete = async (station) => {
    try {
      await api.delete(`/stations/${station.id}`);
      message.success('Station deleted.');
      fetchStations();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (c) => <Tag color="blue">{c}</Tag> },
    { title: 'Region', dataIndex: 'region_name', key: 'region_name' },
    { title: 'City', dataIndex: 'city_name', key: 'city_name' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Commander', dataIndex: 'commander_name', key: 'commander_name', render: (v) => v || 'N/A' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (a) => a ? <Tag color="success">OPERATIONAL</Tag> : <Tag color="error">INACTIVE</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} disabled={!canEditStations} />
          <Popconfirm
            title="Delete station?"
            description="Only stations without cases, Waax stations, or assigned officers can be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
            disabled={!canEditStations}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!canEditStations} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>District Police Station Registry</Title>
            <Typography.Text type="secondary">Manage district stations, their login accounts, and their assigned command area.</Typography.Text>
          </div>
          {canEditStations && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Add Station</Button>}
        </div>

        <Card variant="none">
          <Table columns={columns} dataSource={stations} rowKey="id" loading={loading} />
        </Card>

        <Modal 
          title={editingStation ? "Edit Station Details" : "Register New Station"} 
          open={isModalOpen} 
          onCancel={() => setIsModalOpen(false)} 
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Station Name" rules={[requiredRule('Station name'), textLengthRule('Station name', 3, 150)]}>
              <Input placeholder="e.g. Hodan Central Station" />
            </Form.Item>
            <Form.Item name="code" label="Station Code (Unique)" rules={codeRules('Station code')}>
              <Input placeholder="e.g. HPS-01" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="city_id" label="City" rules={[requiredRule('City')]}>
                  <Select placeholder="Select city">
                    {cities.map((city) => <Select.Option key={city.id} value={city.id}>{city.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="username" label="Login Username" rules={usernameRules}>
                  <Input placeholder="e.g. hodan_station" />
                </Form.Item>
              </Col>
            </Row>
            {!editingStation && (
              <Form.Item name="password" label="Login Password" rules={passwordRules}>
                <Input.Password />
              </Form.Item>
            )}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
