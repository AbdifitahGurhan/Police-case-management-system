'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { App, Table, Card, Typography, Space, Button, Modal, Form, Input, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { codeRules, passwordRules, requiredRule, textLengthRule, usernameRules } from '@/utils/validation';

const { Title } = Typography;

export default function TierManager({
  entityName, // e.g. "Region"
  apiEndpoint, // e.g. "/regions"
  columns,
  formItems,
  parentKey, // e.g. "state_administration_id"
  parentEndpoint, // e.g. "/state-administrations" (optional, for dropdowns)
  parentLabel, // e.g. "State Administration"
  parentNameKey, // e.g. "state_name"
  entityKey, // Optional: manual override for field prefix e.g. "state"
  autoParentRoles = [],
  nameOptions = null,
  nameOptionsByParent = null,
  nameOptionsParentKey = null,
  generatedCode = false,
}) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const selectedParentId = Form.useWatch(parentKey || '__unused_parent__', form);
  
  const safeEntityKey = entityKey || entityName.toLowerCase();
  const autoParent = Boolean(parentKey && autoParentRoles.includes(user?.role));
  const selectedParent = parents.find(parent => Number(parent.id) === Number(selectedParentId));
  const entityNameOptions = nameOptions || (nameOptionsByParent
    ? (nameOptionsByParent[selectedParent?.[nameOptionsParentKey]] || nameOptionsByParent[selectedParent?.state_code] || nameOptionsByParent[selectedParent?.[parentNameKey]] || [])
    : []);
  const normalizedNameOptions = entityNameOptions.map(option => typeof option === 'string' ? { name: option } : option);
  const hasGeneratedOptions = normalizedNameOptions.length > 0;
  const requiresParentForOptions = Boolean(nameOptionsByParent);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, resOfficers] = await Promise.all([
        api.get(apiEndpoint),
        api.get('/police-officers')
      ]);
      setData(resData.data.data);
      setOfficers(resOfficers.data.data);

      if (parentEndpoint) {
        const resParents = await api.get(parentEndpoint);
        setParents(resParents.data.data);
      }
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error(`Failed to load ${entityName}s.`);
      }
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, entityName, message, parentEndpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      if (autoParent && user?.scopeId) form.setFieldValue(parentKey, Number(user.scopeId));
    }
    setIsModalOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingRecord) {
        await api.put(`${apiEndpoint}/${editingRecord.id}`, values);
        message.success(`${entityName} updated.`);
      } else {
        await api.post(apiEndpoint, values);
        message.success(`${entityName} created.`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Save failed.");
    }
  };

  const combinedColumns = [
    ...columns,
    { title: 'Code', dataIndex: `${entityName.toLowerCase()}_code`, key: 'code', render: c => <Tag color="blue">{c}</Tag> },
    { title: 'Account Username', dataIndex: 'username', key: 'username' },
    { title: 'Commander', dataIndex: 'commander_name', key: 'commander_name', render: (t) => t ? <><UserOutlined/> {t}</> : <Tag>Unassigned</Tag> },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, record) => <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />,
    },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>{entityName} Administration</Title>
          <Typography.Text type="secondary">Manage the underlying {entityName.toLowerCase()}s and credentials.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Add {entityName}</Button>
      </div>

      <Card variant="none">
        <Table columns={combinedColumns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />
      </Card>

      <Modal 
        title={editingRecord ? `Edit ${entityName}` : `Create New ${entityName}`} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          
          {parentEndpoint && autoParent && (
            <>
              <Form.Item name={parentKey} hidden rules={[requiredRule(parentLabel || 'Parent level')]}><Input /></Form.Item>
              <Form.Item label={parentLabel || 'Parent Level'}>
                <Input value={selectedParent?.[parentNameKey] || 'Si otomaatig ah ayaa loo qaatay'} readOnly />
              </Form.Item>
            </>
          )}

          {parentEndpoint && !autoParent && (
            <Form.Item name={parentKey} label={parentLabel || `Parent Level`} rules={[requiredRule(parentLabel || 'Parent level')]}>
              <Select placeholder={`Select ${parentLabel || 'Parent Entity'}`} onChange={() => {
                if (nameOptionsByParent) form.setFieldsValue({ [`${safeEntityKey}_name`]: undefined, [`${safeEntityKey}_code`]: undefined });
              }}>
                {parents.map(p => (
                  <Select.Option key={p.id} value={p.id}>{parentNameKey ? p[parentNameKey] : (p[`${parentEndpoint.replace('/', '').replace('-administrations', '_name').replace(/s$/, '')}_name`] || p.name || `ID: ${p.id}`)}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {formItems}

          <Form.Item name={`${safeEntityKey}_name`} label={`${entityName} Name`} rules={[requiredRule(`${entityName} name`), textLengthRule(`${entityName} name`, 2, 150)]}>
            {hasGeneratedOptions ? (
              <Select
                placeholder={requiresParentForOptions && !selectedParentId ? `Select ${parentLabel} first` : `Select ${entityName}`}
                disabled={requiresParentForOptions && !selectedParentId}
                options={normalizedNameOptions.map(option => ({ value: option.name, label: option.name }))}
                onChange={(name) => {
                  const option = normalizedNameOptions.find(item => item.name === name);
                  if (generatedCode) form.setFieldValue(`${safeEntityKey}_code`, option?.code);
                }}
              />
            ) : (
              <Input placeholder={`e.g. Central ${entityName}`} />
            )}
          </Form.Item>
          
          <Form.Item name={`${safeEntityKey}_code`} label={`${entityName} Code`} rules={codeRules(`${entityName} code`)}>
            <Input placeholder={generatedCode && hasGeneratedOptions ? 'Si otomaatig ah ayaa loo dhalinayaa' : 'e.g. REG-01'} disabled={(generatedCode && hasGeneratedOptions) || !!editingRecord} />
          </Form.Item>
          
          <Form.Item name="username" label="Username-ka Login-ka" rules={usernameRules}>
            <Input placeholder={`e.g. ${entityName.toLowerCase()}_user`} />
          </Form.Item>

          {!editingRecord && (
            <Form.Item name="password" label="Login Password" rules={passwordRules}>
              <Input.Password placeholder="Secure password for this unit" />
            </Form.Item>
          )}

          <Form.Item name="commander_officer_id" label="Commander Officer">
            <Select placeholder="Select Commander (Optional)" allowClear>
              {officers.map(o => (
                <Select.Option key={o.id} value={o.id}>{o.full_name} ({o.force_number})</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
