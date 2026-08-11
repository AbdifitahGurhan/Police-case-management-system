'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import api from '@/services/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

function StationJailAdmissionsContent() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [admissions, setAdmissions] = useState([]);
  const [custodyHistory, setCustodyHistory] = useState(null);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferForm] = Form.useForm();
  const hasPermission = key => user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes(key);
  const canTransfer = hasPermission('station_jail.intake');

  const loadAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/custody/admissions');
      setAdmissions(response.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Maxaabiista lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadAdmissions();
  }, [loadAdmissions]);

  const openHistory = async (admission) => {
    try {
      const response = await api.get(`/custody/criminals/${admission.suspect_id}`);
      setSelectedAdmission(admission);
      setCustodyHistory(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Taariikhda maxbuuska lama soo qaadi karin.');
    }
  };

  const openTransfer = (admission) => {
    setTransferTarget(admission);
    transferForm.setFieldsValue({
      from_facility: admission.facility,
      to_facility: 'Mogadishu Central Jail',
      transfer_reason: 'Court sentence transfer to central jail',
      transfer_date: dayjs(),
    });
  };

  const submitTransfer = async (values) => {
    if (!transferTarget) return;
    setSavingTransfer(true);
    try {
      await api.post(`/custody/criminals/${transferTarget.suspect_id}/transfers`, {
        ...values,
        arrest_id: transferTarget.arrest_id,
        status: 'pending',
        transfer_date: values.transfer_date?.format('YYYY-MM-DD HH:mm:ss'),
      });
      message.success('Transfer document waa la sameeyay.');
      setTransferTarget(null);
      transferForm.resetFields();
      await loadAdmissions();
    } catch (error) {
      message.error(error.response?.data?.message || 'Transfer lama sameyn karin.');
    } finally {
      setSavingTransfer(false);
    }
  };

  const printTransferDocument = async (transferId) => {
    try {
      const response = await api.get(`/custody/transfers/${transferId}/document`);
      const doc = response.data.data;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Transfer Document ${doc.id}</title>
            <style>
              body{font-family:Arial,sans-serif;color:#111;padding:28px;line-height:1.55}
              h1{text-align:center;font-size:22px;margin-bottom:4px}
              h2{text-align:center;font-size:15px;font-weight:400;margin-top:0}
              table{width:100%;border-collapse:collapse;margin-top:18px}
              th,td{border:1px solid #999;padding:8px;text-align:left}
              th{width:32%;background:#f2f5f8}
              .sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:54px}
              .line{border-top:1px solid #111;padding-top:8px}
            </style>
          </head>
          <body>
            <h1>Somali Police Force</h1>
            <h2>Station Jail Transfer Document</h2>
            <table>
              <tr><th>Transfer No.</th><td>TR-${String(doc.id).padStart(6, '0')}</td></tr>
              <tr><th>Offender</th><td>${doc.full_name || ''}</td></tr>
              <tr><th>Case / OB</th><td>${doc.case_number || ''} / ${doc.ob_number || ''}</td></tr>
              <tr><th>From</th><td>${doc.from_facility || doc.district_name || ''}</td></tr>
              <tr><th>To</th><td>${doc.to_facility || ''}</td></tr>
              <tr><th>Reason</th><td>${doc.transfer_reason || ''}</td></tr>
              <tr><th>Status</th><td>${doc.status || ''}</td></tr>
              <tr><th>Prepared By</th><td>${doc.authorized_by || ''}</td></tr>
              <tr><th>Date</th><td>${doc.transfer_date ? dayjs(doc.transfer_date).format('YYYY-MM-DD HH:mm') : ''}</td></tr>
            </table>
            <div class="sig">
              <div class="line">Station Jail Officer</div>
              <div class="line">Central Jail Receiving Officer</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      message.error(error.response?.data?.message || 'Transfer document lama daabici karin.');
    }
  };

  const columns = [
    { title: 'Lambarka Xabsiga', dataIndex: 'prison_number' },
    { title: 'Maxbuuska', dataIndex: 'full_name' },
    { title: 'Kiiska', dataIndex: 'case_number' },
    { title: 'Xabsiga', dataIndex: 'facility' },
    { title: 'Xaaladda', dataIndex: 'status', render: value => <Tag color={value === 'admitted' ? 'green' : 'default'}>{value === 'admitted' ? 'Ku jira' : 'Laga saaray'}</Tag> },
    { title: 'Qolka', render: (_, row) => row.cell_number ? `${row.block_name} / ${row.cell_number} (${row.cell_occupancy || 0}/${row.cell_capacity || '?'})` : 'Looma qoondeyn' },
    { title: 'Sentence', dataIndex: 'sentence_status', render: (value) => <Tag>{value}</Tag> },
    { title: 'Transfer', render: (_, row) => row.latest_transfer_status === 'completed' ? <Tag color="green">{`Ku jira Central Jail${row.latest_transfer_to_facility ? ` - ${row.latest_transfer_to_facility}` : ''}`}</Tag> : row.latest_transfer_status ? <Tag color="gold">{`${row.latest_transfer_status} ${row.latest_transfer_to_facility ? `-> ${row.latest_transfer_to_facility}` : ''}`}</Tag> : (row.sentence_status === 'serving' ? <Tag color="orange">Sugaya transfer</Tag> : <Tag>Ma jiro</Tag>) },
    { title: 'Release', render: (_, row) => row.expected_release_date ? dayjs(row.expected_release_date).format('DD MMM YYYY') : 'N/A' },
    { title: 'Release workflow', render: (_, row) => row.release_approval_status ? <Tag color="gold">{row.release_approval_status.replaceAll('_', ' ')}</Tag> : 'Not requested' },
    { title: 'Last roll call', render: (_, row) => row.last_roll_status ? <Tag color={row.last_roll_status === 'present' ? 'green' : 'orange'}>{row.last_roll_status}</Tag> : 'Not recorded' },
    {
      title: 'Ficillada',
      render: (_, row) => <Space>
        {canTransfer && row.sentence_status === 'serving' && !row.latest_transfer_status && <Button size="small" type="primary" onClick={() => openTransfer(row)}>Samee Transfer Document</Button>}
        {row.latest_transfer_id && <Button size="small" onClick={() => printTransferDocument(row.latest_transfer_id)}>Daabac Transfer</Button>}
        <Button size="small" onClick={() => openHistory(row)}>Taariikhda</Button>
      </Space>,
    },
  ];

  return (
    <ProtectedRoute
      allowedRoles={['station_jail', 'admin', 'sub_admin', 'district_admin', 'district_commander', 'police_station_commander']}
      requiredPermissions={['station_jail.view']}
    >
      <div className="standard-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <div className="dashboard-eyebrow">Xabsiga Saldhigga</div>
            <h2 style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>Maxaabiista Hadda Ku Jira</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Qaabilaadda, qolalka, muddada iyo tiro-koobka maalinlaha ah.</p>
          </div>
        </div>

        <Card variant="none" className="standard-panel" extra={<Tag>{admissions.length} records</Tag>}>
          <Table columns={columns} dataSource={admissions} loading={loading} rowKey="id" pagination={false} size="middle" scroll={{ x: 'max-content' }} />
        </Card>

        <Modal title={`Taariikhda Xabsiga - ${selectedAdmission?.full_name || ''}`} open={Boolean(custodyHistory)} onCancel={() => setCustodyHistory(null)} footer={null} width={780}>
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div><strong>Qaabilaadaha Xabsiga</strong>{custodyHistory?.admissions?.length ? custodyHistory.admissions.map(item => <div key={item.id}>{dayjs(item.admission_date).format('YYYY-MM-DD HH:mm')} - {item.prison_number} - {item.facility} - <Tag>{item.status}</Tag> - Kiis {item.case_number}</div>) : <div>Qaabilaad hore ma jiro.</div>}</div>
            <div><strong>Qolalka Loo Qoondeeyey</strong>{custodyHistory?.cellAssignments?.length ? custodyHistory.cellAssignments.map(item => <div key={item.id}>{dayjs(item.assigned_at).format('YYYY-MM-DD HH:mm')} - {item.facility} / {item.block_name} / {item.cell_number}{item.released_at ? ` - Laga saaray ${dayjs(item.released_at).format('YYYY-MM-DD HH:mm')}` : ' - Hadda ku jira'}</div>) : <div>Qol hore looma qoondeyn.</div>}</div>
            <div><strong>Wareejinnada</strong>{custodyHistory?.transfers?.length ? custodyHistory.transfers.map(item => <div key={item.id}>{dayjs(item.transfer_date).format('YYYY-MM-DD HH:mm')} - {item.from_facility || 'Bilow'} {'->'} {item.to_facility} - {item.transfer_reason}</div>) : <div>Wax wareejin ah ma jiro.</div>}</div>
          </Space>
        </Modal>

        <Modal
          title={`Samee Transfer Document - ${transferTarget?.full_name || ''}`}
          open={Boolean(transferTarget)}
          onCancel={() => setTransferTarget(null)}
          onOk={() => transferForm.submit()}
          confirmLoading={savingTransfer}
          destroyOnHidden
          forceRender
        >
          <Form form={transferForm} layout="vertical" onFinish={submitTransfer}>
            <Form.Item name="from_facility" label="Xabsiga Laga Wareejinayo">
              <Input disabled />
            </Form.Item>
            <Form.Item name="to_facility" label="Xabsiga Loo Wareejinayo" rules={[{ required: true, message: 'Geli xabsiga loo wareejinayo.' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="transfer_reason" label="Sababta Wareejinta" rules={[{ required: true, message: 'Geli sababta wareejinta.' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="transfer_date" label="Taariikhda Wareejinta" rules={[{ required: true, message: 'Dooro taariikhda wareejinta.' }]}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}

export default function StationJailAdmissionsPage() {
  return (
    <Suspense fallback={null}>
      <StationJailAdmissionsContent />
    </Suspense>
  );
}
