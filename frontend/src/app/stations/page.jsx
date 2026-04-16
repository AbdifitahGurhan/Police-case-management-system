// src/app/stations/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Button, Tag, Modal, Form, Input, message, Popconfirm, Row, Col } from 'antd';
import { EnvironmentOutlined, PlusOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Title, Text } = Typography;

export default function StationManagementPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [form] = Form.useForm();

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stations');
      setStations(res.data.data);
    } catch (err) {
      message.error("Failed to load stations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

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

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (c) => <Tag color="blue">{c}</Tag> },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    { title: 'District', dataIndex: 'district', key: 'district' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (p) => p && <><PhoneOutlined /> {p}</> },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (a) => a ? <Tag color="success">OPERATIONAL</Tag> : <Tag color="error">INACTIVE</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Police Station Registry</Title>
            <Typography.Text type="secondary">Manage the physical locations and logistical details of police stations.</Typography.Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Add Station</Button>
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
            <Form.Item name="name" label="Station Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Hodan Central Station" />
            </Form.Item>
            <Form.Item name="code" label="Station Code (Unique)" rules={[{ required: true }]}>
              <Input placeholder="e.g. HPS-01" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="region" label="Region">
                  <Input placeholder="e.g. Banadir" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="district" label="District">
                  <Input placeholder="e.g. Hodan" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="phone" label="Contact Number">
              <Input />
            </Form.Item>
            <Form.Item name="address" label="Street Address">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
