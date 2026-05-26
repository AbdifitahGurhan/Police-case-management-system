'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Table, Card, Typography, Space, Button, Modal, Form, Input, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { codeRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;

export default function RanksPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const fetchRanks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ranks');
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load ranks.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanks();
  }, []);

  const handleOpenModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingRecord) {
        await api.put(`/ranks/${editingRecord.id}`, values);
        message.success("Rank updated successfully");
      } else {
        await api.post('/ranks', values);
        message.success("Rank created successfully");
      }
      setIsModalOpen(false);
      fetchRanks();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save rank.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ranks/${id}`);
      message.success("Rank deleted successfully");
      fetchRanks();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to delete rank. It might be assigned to active officers.");
    }
  };

  const columns = [
    { 
      title: 'Rank Name', 
      dataIndex: 'rank_name', 
      key: 'rank_name',
      render: (text) => <Text strong><StarOutlined style={{ marginRight: 8, color: '#faad14' }}/>{text}</Text>
    },
    { 
      title: 'Rank Code', 
      dataIndex: 'rank_code', 
      key: 'rank_code',
      render: (code) => <Tag color="blue">{code}</Tag>
    },
    { 
      title: 'Description', 
      dataIndex: 'description', 
      key: 'description' 
    },
    {
      title: 'Created By',
      dataIndex: 'created_by',
      key: 'created_by'
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => new Date(val).toLocaleDateString()
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this rank?"
            description="Are you sure? This cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Card variant="none">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>Registered Ranks</Title>
              <Text type="secondary">Manage the chain of command and rank identities assignable to police officers</Text>
            </div>
            
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} size="large">
              Add New Rank
            </Button>
          </div>

          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="id" 
            loading={loading} 
            pagination={{ pageSize: 10 }}
          />

        </div>
      </Card>

      <Modal 
        title={editingRecord ? "Edit Police Rank" : "Create New Rank"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()}
        okText={editingRecord ? "Update Rank" : "Save Rank"}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          
          <Form.Item 
            name="rank_name" 
            label="Rank Name" 
            rules={[requiredRule('Rank name'), textLengthRule('Rank name', 2, 100)]}
          >
            <Input placeholder="e.g. Inspector General" prefix={<StarOutlined style={{ color: 'rgba(0,0,0,.25)' }}/>} />
          </Form.Item>
          
          <Form.Item 
            name="rank_code" 
            label="Rank Code" 
            rules={codeRules('Rank code')}
          >
            <Input placeholder="e.g. IG" disabled={!!editingRecord} />
          </Form.Item>
          
          <Form.Item name="description" label="Rank Description (Optional)" rules={[textLengthRule('Rank description', 3, 500)]}>
            <Input.TextArea placeholder="Brief description of responsibilities and scope" rows={3}>
            </Input.TextArea>
          </Form.Item>

        </Form>
      </Modal>
    </ProtectedRoute>
  );
}
