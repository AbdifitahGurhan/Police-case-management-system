'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Table, Card, Typography, Space, Button, Modal, Form, Select, Input, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;

const SOMALI_RANKS_CATALOG = [
  // --- Commissioned Ranks (Xiddigle iyo wuxi ka weyn -> Admin) ---
  {
    name: 'Sareeye Guud',
    code: 'SG',
    level: 'commissioned',
    description: 'Sarkaalka ugu sareeya ee Hogaanka Ciidanka Booliska Soomaaliyeed.',
  },
  {
    name: 'Sareeye Gaas',
    code: 'SGS',
    level: 'commissioned',
    description: 'Sarkaal sare oo maamula Hogaannada Waaweyn ee Ciidanka Booliska.',
  },
  {
    name: 'Sareeye Guuto',
    code: 'SGT',
    level: 'commissioned',
    description: 'Sarkaal sare oo hogaamiya ciidamada heer qaran ama maamul goboleed.',
  },
  {
    name: 'Gaashaanle Sare',
    code: 'GSH-S',
    level: 'commissioned',
    description: 'Taliyaha Hogaanka ama Qeybta Booliska ee Gobolka.',
  },
  {
    name: 'Gaashaanle Dhexe',
    code: 'GSH-DH',
    level: 'commissioned',
    description: 'Taliye ku-xigeen ama Taliyaha Qeybta Booliska ee Degmada/Gobolka.',
  },
  {
    name: 'Gaashaanle',
    code: 'GSH',
    level: 'commissioned',
    description: 'Sarkaal maamula unugyada gaarka ah iyo baarista dambiyada.',
  },
  {
    name: 'Dhamme',
    code: 'DHM',
    level: 'commissioned',
    description: 'Taliyaha Saldhigga Booliska ama Maamulaha Qeybta Baarista.',
  },
  {
    name: 'Laba Xiddigle',
    code: 'LXDG',
    level: 'commissioned',
    description: 'Sarkaal sare oo gacan ka geysta hogaaminta saldhigga iyo baarista.',
  },
  {
    name: 'Xiddigle',
    code: 'XDG',
    level: 'commissioned',
    description: 'Sarkaalka koowaad ee heer xiddigle (Commissioned Officer).',
  },

  // --- Below Commissioned Ranks (State Admin: AL, SA, XDH, LXDH, LA, SXD) ---
  {
    name: 'Laba Xadhigle',
    code: 'LXDH',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh labo xadhig.',
  },
  {
    name: 'Xadhigle',
    code: 'XDH',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh hal xadhig.',
  },
  {
    name: 'Sadax Alifle',
    code: 'SA',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh saddex alif.',
  },
  {
    name: 'Labo Alifle',
    code: 'LA',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh labo alif.',
  },
  {
    name: 'Alifle',
    code: 'AL',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh hal alif.',
  },
  {
    name: 'Sadax Xadhigle',
    code: 'SXD',
    level: 'below_commissioned',
    description: 'Sarkaal hoose oo leh saddex xadhig.',
  },
];

function RanksPageContent() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const isSystemAdmin = user?.role === 'admin' || (user?.permissions || []).includes('*');

  const COMMISSIONED_CODES = useMemo(() => new Set(['SG', 'SGS', 'SGT', 'GSH-S', 'GSH-DH', 'GSH', 'DHM', 'LXDG', 'XDG']), []);

  const filteredData = useMemo(() => {
    return (data || []).filter((item) => {
      const code = String(item.rank_code || '').trim().toUpperCase();
      const name = String(item.rank_name || '').toLowerCase();
      const isCommissioned = COMMISSIONED_CODES.has(code) || name.includes('sareeye') || name.includes('gaashaanle') || name.includes('dhamme') || name.includes('xiddigle');
      if (isSystemAdmin) {
        return isCommissioned;
      }
      return !isCommissioned;
    });
  }, [data, isSystemAdmin, COMMISSIONED_CODES]);

  const availableRanksOptions = useMemo(() => {
    return SOMALI_RANKS_CATALOG.filter((item) => {
      if (isSystemAdmin) {
        return item.level === 'commissioned'; // Admin: Xiddigle iyo wuxi ka weyn
      }
      return item.level === 'below_commissioned'; // State Admin: Wixi ka yar Xiddigle
    });
  }, [isSystemAdmin]);

  const fetchRanks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ranks');
      setData(res.data.data || []);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error('Lama soo rabi karo darajooyinka.');
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

  const handleRankNameChange = (selectedName) => {
    const selectedRank = SOMALI_RANKS_CATALOG.find((item) => item.name === selectedName);
    if (selectedRank) {
      form.setFieldsValue({
        rank_code: selectedRank.code,
        description: selectedRank.description,
      });
    }
  };

  const handleSave = async (values) => {
    try {
      if (editingRecord) {
        await api.put(`/ranks/${editingRecord.id}`, values);
        message.success('Darajada waa la cusboonaysiiyey.');
      } else {
        await api.post('/ranks', values);
        message.success('Darajada cusub waa la diiwaangeliyey.');
      }
      setIsModalOpen(false);
      fetchRanks();
    } catch (err) {
      message.error(err.response?.data?.message || 'Kaydinta darajada waa ay guuldarraysatay.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ranks/${id}`);
      message.success('Darajada waa la tirtiray.');
      fetchRanks();
    } catch (err) {
      message.error(err.response?.data?.message || 'Tirtirista darajada waa ay guuldarraysatay.');
    }
  };

  const columns = [
    {
      title: 'Magaca Darajada',
      dataIndex: 'rank_name',
      key: 'rank_name',
      render: (text) => (
        <Text strong>
          <StarOutlined style={{ marginRight: 8, color: '#faad14' }} />
          {text}
        </Text>
      ),
    },
    {
      title: 'Koodhka Darajada',
      dataIndex: 'rank_code',
      key: 'rank_code',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Faahfaahinta',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Diiwaangeliyaha',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: 'Taariikhda',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => (val ? new Date(val).toLocaleDateString() : '—'),
    },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>
            Wax ka beddel
          </Button>
          <Popconfirm
            title="Maw hubtaa inaad tirtirto darajadan?"
            description="Talaabadan dib looma soo celin karo."
            onConfirm={() => handleDelete(record.id)}
            okText="Haa"
            cancelText="Maya"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              Tirtir
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin']} requiredPermissions={['ranks.manage', 'ranks.assign']}>
      <Card variant="none">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>Darajooyinka Ciidanka Booliska</Title>
              <Text type="secondary">
                {isSystemAdmin
                  ? 'Maamulka darajooyinka ciidanka (Xiddigle iyo wuxi ka weyn - System Admin)'
                  : 'Maamulka darajooyinka ciidanka (Wuxi ka yar Xiddigle - State Admin)'}
              </Text>
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} size="large">
              Diiwaangeli Darajo Cusub
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </Card>

      <Modal
        title={editingRecord ? 'Wax ka beddel Darajada' : 'Diiwaangeli Darajo Cusub'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingRecord ? 'Cusboonaysii' : 'Kaydi Darajada'}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="rank_name"
            label="Magaca Darajada"
            rules={[requiredRule('Magaca darajada')]}
          >
            <Select
              placeholder="Dooro darajada Booliska"
              onChange={handleRankNameChange}
              options={availableRanksOptions.map((r) => ({
                value: r.name,
                label: `${r.name} (${r.code})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="rank_code"
            label="Koodhka Darajada (Generated)"
            rules={[requiredRule('Koodhka darajada')]}
          >
            <Input readOnly placeholder="Koodhka otomaatig ah ayaa loo dhalinayaa" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Faahfaahinta Darajada"
            rules={[textLengthRule('Faahfaahinta darajada', 3, 500)]}
          >
            <Input.TextArea placeholder="Faahfaahinta shaqada iyo mas'uuliyadda darajada" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </ProtectedRoute>
  );
}

export default function RanksPage() {
  return (
    <App>
      <RanksPageContent />
    </App>
  );
}
