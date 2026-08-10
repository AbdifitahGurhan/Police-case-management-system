'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';
import { BankOutlined, IdcardOutlined, SafetyCertificateOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

function CentralJailDashboardContent() {
  const { message } = App.useApp();
  const [transfers, setTransfers] = useState([]);
  const [centralAdmissions, setCentralAdmissions] = useState([]);
  const [cells, setCells] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const selectedFacility = Form.useWatch('facility', form);
  const selectedBlock = Form.useWatch('block_name', form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [transferRes, admissionRes, cellRes] = await Promise.all([
        api.get('/custody/central/transfers'),
        api.get('/custody/central/admissions'),
        api.get('/custody/cells', { params: { scope: 'central' } }),
      ]);
      setTransfers(transferRes.data.data || []);
      setCentralAdmissions(admissionRes.data.data || []);
      setCells(cellRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Central jail data lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const facilityOptions = useMemo(
    () => [...new Set(cells.map((cell) => cell.facility))].map((value) => ({ value, label: value })),
    [cells]
  );
  const blockOptions = useMemo(
    () => [...new Set(cells.filter((cell) => cell.facility === selectedFacility).map((cell) => cell.block_name))].map((value) => ({ value, label: value })),
    [cells, selectedFacility]
  );
  const cellOptions = useMemo(
    () => cells
      .filter((cell) => cell.facility === selectedFacility && cell.block_name === selectedBlock)
      .map((cell) => ({
        value: cell.cell_number,
        label: `Cell ${cell.cell_number} (${cell.occupancy}/${cell.capacity})`,
        disabled: Number(cell.occupancy) >= Number(cell.capacity),
      })),
    [cells, selectedFacility, selectedBlock]
  );

  const openReceive = (transfer) => {
    setSelectedTransfer(transfer);
    form.resetFields();
    form.setFieldsValue({ facility: transfer.to_facility || 'Mogadishu Central Jail' });
  };

  const receiveTransfer = async (values) => {
    if (!selectedTransfer) return;
    setSaving(true);
    try {
      await api.patch(`/custody/central/transfers/${selectedTransfer.id}/receive`, values);
      message.success('Transfer received by central jail.');
      setSelectedTransfer(null);
      await loadData();
    } catch (error) {
      message.error(error.response?.data?.message || 'Transfer receive failed.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Transfer No.', render: (_, row) => `TR-${String(row.id).padStart(6, '0')}` },
    { title: 'Offender', dataIndex: 'full_name' },
    { title: 'Case / OB', render: (_, row) => `${row.case_number || '-'} / ${row.ob_number || '-'}` },
    { title: 'From', render: (_, row) => row.from_facility || row.district_name || '-' },
    { title: 'To', dataIndex: 'to_facility' },
    { title: 'Sentence', render: (_, row) => row.sentence_period_value ? `${row.sentence_period_value} ${row.sentence_period_unit || ''}` : row.sentence_status || '-' },
    { title: 'Transfer Date', dataIndex: 'transfer_date', render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
    { title: 'Status', dataIndex: 'status', render: (value) => <Tag color="gold">{value}</Tag> },
    {
      title: 'Ficilka',
      render: (_, row) => (
        <Button size="small" type="primary" icon={<SwapOutlined />} onClick={() => openReceive(row)}>
          Receive + Assign Cell
        </Button>
      ),
    },
  ];

  const centralColumns = [
    { title: 'Prison No.', dataIndex: 'prison_number' },
    { title: 'Offender', dataIndex: 'full_name' },
    { title: 'Case / OB', render: (_, row) => `${row.case_number || '-'} / ${row.ob_number || '-'}` },
    { title: 'Facility', render: (_, row) => row.facility || row.to_facility || '-' },
    { title: 'Cell', render: (_, row) => row.cell_number ? `${row.block_name} / ${row.cell_number} (${row.cell_occupancy || 0}/${row.cell_capacity || '?'})` : 'Looma qoondeyn' },
    { title: 'Transfer Date', dataIndex: 'transfer_date', render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
    { title: 'Status', render: () => <Tag color="green">Ku jira Central Jail</Tag> },
  ];

  return (
    <>
      <StandardDashboard
        allowedRoles={['jail', 'admin']}
        eyebrow="Hawlaha Xabsiga Dhexe"
        title="Central Jail / Prison"
        subtitle="Receive sentenced offender transfers, assign cells, and continue custody records."
        loading={loading}
        metrics={[
          { title: 'Incoming Transfers', value: transfers.length, icon: <SwapOutlined />, tone: 'amber', note: 'Pending station jail handover' },
          { title: 'Cells', value: cells.length, icon: <BankOutlined />, tone: 'blue', note: 'Registered central jail cells' },
          { title: 'Awaiting Receive', value: transfers.filter((row) => row.status === 'pending').length, icon: <SafetyCertificateOutlined />, tone: 'red', note: 'Need central jail action' },
          { title: 'Current Offenders', value: centralAdmissions.length, icon: <IdcardOutlined />, tone: 'green', note: 'Received into central jail' },
        ]}
        tableTitle="Incoming Transfers"
        tableSubtitle="Sentenced offenders transferred from station jail to central jail/prison"
        tableColumns={columns}
        tableData={transfers}
      />

      <Card
        variant="none"
        className="standard-panel"
        title="Current Central Jail Offenders"
        extra={<Tag color="green">{centralAdmissions.length} records</Tag>}
        style={{ marginTop: 16 }}
      >
        <Table
          columns={centralColumns}
          dataSource={centralAdmissions}
          loading={loading}
          rowKey="id"
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={`Receive Transfer - ${selectedTransfer?.full_name || ''}`}
        open={Boolean(selectedTransfer)}
        onCancel={() => setSelectedTransfer(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={receiveTransfer}>
          <Form.Item name="facility" label="Central Jail / Prison" rules={[{ required: true, message: 'Dooro xabsiga dhexe.' }]}>
            <Select options={facilityOptions} onChange={() => form.setFieldsValue({ block_name: undefined, cell_number: undefined })} />
          </Form.Item>
          <Form.Item name="block_name" label="Block" rules={[{ required: true, message: 'Dooro block.' }]}>
            <Select options={blockOptions} onChange={() => form.setFieldValue('cell_number', undefined)} />
          </Form.Item>
          <Form.Item name="cell_number" label="Cell" rules={[{ required: true, message: 'Dooro cell.' }]}>
            <Select disabled={!selectedBlock} options={cellOptions} />
          </Form.Item>
          <Form.Item name="notes" label="Receiving Notes">
            <Input.TextArea rows={3} placeholder="Received with transfer document and assigned to central jail cell." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function CentralJailDashboard() {
  return (
    <Suspense fallback={null}>
      <CentralJailDashboardContent />
    </Suspense>
  );
}
