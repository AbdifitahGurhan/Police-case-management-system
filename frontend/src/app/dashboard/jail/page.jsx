// src/app/dashboard/jail/page.jsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Tag, Upload } from 'antd';
import {
  DatabaseOutlined,
  IdcardOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/services/api';
import StandardDashboard from '@/components/dashboard/StandardDashboard';

const BLOCK_OPTIONS = ['Block A', 'Block B', 'Block C', 'Block D'].map((value) => ({ value, label: value }));
const CELL_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const value = String(index + 1).padStart(2, '0');
  return { value, label: `Cell ${value}` };
});

function JailDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [caseData, setCaseData] = useState(null);
  const [offenders, setOffenders] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [cells, setCells] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [warrantFiles, setWarrantFiles] = useState([]);
  const [bulkStatuses, setBulkStatuses] = useState({});
  const [modalType, setModalType] = useState(null);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [form] = Form.useForm();
  const selectedBlock = Form.useWatch('block_name', form);
  const selectedFacility = Form.useWatch('facility', form);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [caseRes, offenderRes, admissionRes, cellRes] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/criminals', { params: { arrested: '1' } }),
          api.get('/custody/admissions'),
          api.get('/custody/cells'),
        ]);
        setCaseData(caseRes.data.data);
        setOffenders(offenderRes.data.data || []);
        setAdmissions(admissionRes.data.data || []);
        setEligible(admissionRes.data.eligible || []);
        setCells(cellRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch jail stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const refreshAdmissions = async () => {
    const [response, cellResponse] = await Promise.all([api.get('/custody/admissions'), api.get('/custody/cells')]);
    setAdmissions(response.data.data || []);
    setEligible(response.data.eligible || []);
    setCells(cellResponse.data.data || []);
  };

  const openAction = (type, admission = null) => {
    setModalType(type);
    setSelectedAdmission(admission);
    form.resetFields();
    setPhotoFiles([]);
    setWarrantFiles([]);
    if (type === 'cell' && admission) form.setFieldsValue({ facility: admission.facility });
    if (type === 'roll') form.setFieldsValue({ roll_date: dayjs(), shift: 'morning', status: 'present' });
    if (type === 'bulk_roll') form.setFieldsValue({ roll_date: dayjs(), shift: 'morning' });
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (!['admit', 'capacity', 'bulk_roll'].includes(action)) return;
    setModalType(action);
    setSelectedAdmission(null);
    form.resetFields();
    if (action === 'bulk_roll') {
      setBulkStatuses({});
      form.setFieldsValue({ roll_date: dayjs(), shift: 'morning' });
    }
    router.replace('/dashboard/jail');
  }, [form, router, searchParams]);

  const submitAction = async (values) => {
    try {
      if (modalType === 'admit') {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'admission_date') data.append(key, value);
        });
        if (values.admission_date) data.append('admission_date', values.admission_date.format('YYYY-MM-DD HH:mm:ss'));
        if (photoFiles[0]) data.append('photo', photoFiles[0]);
        if (warrantFiles[0]) data.append('commitment_warrant', warrantFiles[0]);
        await api.post('/custody/admissions', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      if (modalType === 'cell') await api.post(`/custody/admissions/${selectedAdmission.id}/cell-assignments`, values);
      if (modalType === 'roll') {
        await api.post(`/custody/admissions/${selectedAdmission.id}/roll-calls`, {
          ...values,
          roll_date: values.roll_date.format('YYYY-MM-DD'),
        });
      }
      if (modalType === 'capacity') await api.post('/custody/cells', values);
      if (modalType === 'bulk_roll') {
        const latest = await api.get('/custody/admissions');
        const activeAdmissions = latest.data.data || [];
        if (!activeAdmissions.length) throw new Error('No active prison admissions are available for roll call.');
        const entries = activeAdmissions.map((row) => ({ admission_id: row.id, status: bulkStatuses[row.id] || 'present' }));
        const result = await api.post('/custody/roll-calls/bulk', {
          roll_date: values.roll_date.format('YYYY-MM-DD'), shift: values.shift, entries,
        });
        if (result.data.absent > 0) message.warning(`${result.data.absent} prisoner(s) marked absent.`);
      }
      if (modalType === 'release') {
        await api.post(`/custody/criminals/${selectedAdmission.suspect_id}/release-approvals`, {
          arrest_id: selectedAdmission.arrest_id,
          request_reason: values.request_reason,
        });
      }
      message.success('Jail record saved successfully.');
      setModalType(null);
      await refreshAdmissions();
    } catch (error) {
      message.error(error.response?.data?.message || error.message || 'Jail action failed.');
    }
  };

  const custodyCases = useMemo(() => {
    const cases = caseData?.recentCases || [];
    return cases.filter((item) => [
      'closed',
      'approved_for_court',
      'under_investigation',
      'court_decided',
      'sentenced',
    ].includes(item.status));
  }, [caseData]);

  const facilityOptions = useMemo(() => [...new Set(cells.map((cell) => cell.facility))].map((value) => ({ value, label: value })), [cells]);
  const blockOptions = useMemo(() => [...new Set(cells.filter((cell) => cell.facility === selectedFacility).map((cell) => cell.block_name))].map((value) => ({ value, label: value })), [cells, selectedFacility]);
  const cellOptions = useMemo(() => cells
    .filter((cell) => cell.facility === selectedFacility && cell.block_name === selectedBlock)
    .map((cell) => ({
      value: cell.cell_number,
      label: `Cell ${cell.cell_number} (${cell.occupancy}/${cell.capacity})`,
      disabled: Number(cell.occupancy) >= Number(cell.capacity),
    })), [cells, selectedFacility, selectedBlock]);

  const admissionColumns = [
    { title: 'Prison #', dataIndex: 'prison_number' },
    { title: 'Maxbuuska', dataIndex: 'full_name' },
    { title: 'Case', dataIndex: 'case_number' },
    { title: 'Facility', dataIndex: 'facility' },
    { title: 'Cell', render: (_, row) => row.cell_number ? `${row.block_name} / ${row.cell_number} (${row.cell_occupancy || 0}/${row.cell_capacity || '?'})` : 'Unassigned' },
    { title: 'Sentence', dataIndex: 'sentence_status', render: (value) => <Tag>{value}</Tag> },
    { title: 'Release', render: (_, row) => row.expected_release_date ? <Space orientation="vertical" size={0}><span>{dayjs(row.expected_release_date).format('DD MMM YYYY')}</span><Tag color={Number(row.days_remaining) <= 7 ? 'red' : Number(row.days_remaining) <= 30 ? 'orange' : 'blue'}>{row.days_remaining} days left</Tag></Space> : 'N/A' },
    { title: 'Release workflow', render: (_, row) => row.release_approval_status ? <Tag color={row.release_approval_status === 'rejected' ? 'red' : row.release_approval_status === 'released' ? 'green' : 'gold'}>{row.release_approval_status.replaceAll('_', ' ')}</Tag> : 'Not requested' },
    { title: 'Last roll call', render: (_, row) => row.last_roll_status ? <Tag color={row.last_roll_status === 'present' ? 'green' : 'orange'}>{row.last_roll_status}</Tag> : 'Not recorded' },
    {
      title: 'Actions',
      render: (_, row) => <Space>
        <Button size="small" onClick={() => openAction('cell', row)}>Assign cell</Button>
        <Button size="small" type="primary" onClick={() => openAction('roll', row)}>Roll call</Button>
        {row.expected_release_date && Number(row.days_remaining) <= 30 && (!row.release_approval_status || ['rejected', 'released'].includes(row.release_approval_status))
          && <Button size="small" danger onClick={() => openAction('release', row)}>Release review</Button>}
      </Space>,
    },
  ];

  return (
    <>
    <StandardDashboard
      allowedRoles={['jail', 'admin']}
      eyebrow="Jail Operations"
      title="Jail Dashboard"
      subtitle="View incarcerated person records, related cases, evidence, and jail reports."
      loading={loading}
      metrics={[
        { title: 'Incarcerated Offenders', value: offenders.length, icon: <LockOutlined />, tone: 'red', note: 'Marked for detention' },
        { title: 'Custody Cases', value: custodyCases.length, icon: <SafetyCertificateOutlined />, tone: 'blue', note: 'Related cases' },
        { title: 'Total Cases', value: caseData?.total || 0, icon: <DatabaseOutlined />, tone: 'purple', note: 'Cases available for review' },
        { title: 'Offender Records', value: offenders.length, icon: <IdcardOutlined />, tone: 'green', note: 'Custody data' },
      ]}
      tableTitle="Active Prison Admissions"
      tableSubtitle="Admissions, cell assignments, sentence dates, and daily roll calls"
      tableColumns={admissionColumns}
      tableData={admissions}
      sidePanel={{
        title: 'Jail Alerts',
        content: <Space orientation="vertical" style={{ width: '100%' }}>
          {admissions.filter((row) => row.expected_release_date && Number(row.days_remaining) <= 30).map((row) => <Alert key={`release-${row.id}`} type={Number(row.days_remaining) <= 7 ? 'error' : 'warning'} showIcon title={`${row.full_name}: ${row.days_remaining} days to release`} />)}
          {admissions.filter((row) => row.last_roll_status === 'absent').map((row) => <Alert key={`absent-${row.id}`} type="error" showIcon title={`${row.full_name} marked absent`} />)}
          {!admissions.some((row) => (row.expected_release_date && Number(row.days_remaining) <= 30) || row.last_roll_status === 'absent') && <Alert type="success" showIcon title="No urgent jail alerts" />}
        </Space>,
      }}
    />
    <Modal
      title={modalType === 'admit' ? 'Prison Admission' : modalType === 'cell' ? 'Cell Assignment' : modalType === 'capacity' ? 'Cell Capacity' : modalType === 'bulk_roll' ? 'Bulk Daily Roll Call' : modalType === 'release' ? 'Release Approval Request' : 'Daily Roll Call'}
      open={Boolean(modalType)}
      onCancel={() => setModalType(null)}
      onOk={() => form.submit()}
      destroyOnHidden
      centered
    >
      <Form form={form} layout="vertical" onFinish={submitAction}>
        {modalType === 'admit' && <>
          <Form.Item name="arrest_id" label="Prisoner / Case" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={eligible.map((row) => ({ value: row.arrest_id, label: `${row.full_name} — ${row.case_number}` }))} />
          </Form.Item>
          <Form.Item name="facility" label="Prison facility" rules={[{ required: true }]}><Select options={facilityOptions} onChange={() => form.setFieldsValue({ block_name: undefined, cell_number: undefined })} /></Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="block_name" label="Block">
              <Select style={{ width: 180 }} placeholder="Select block" options={blockOptions} onChange={() => form.setFieldValue('cell_number', undefined)} />
            </Form.Item>
            <Form.Item name="cell_number" label="Cell number">
              <Select style={{ width: 180 }} placeholder="Select cell" disabled={!selectedBlock} options={cellOptions} />
            </Form.Item>
          </Space>
          <Form.Item name="admission_date" label="Admission date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Prisoner photo"><Upload beforeUpload={(file) => { setPhotoFiles([file]); return false; }} fileList={photoFiles} maxCount={1}><Button>Select photo</Button></Upload></Form.Item>
          <Form.Item label="Commitment warrant"><Upload beforeUpload={(file) => { setWarrantFiles([file]); return false; }} fileList={warrantFiles} maxCount={1}><Button>Select warrant</Button></Upload></Form.Item>
          <Form.Item name="property_inventory" label="Property inventory"><Input.TextArea rows={3} placeholder="Phone, cash, documents, clothing..." /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </>}
        {modalType === 'cell' && <>
          <Form.Item name="facility" label="Prison facility" rules={[{ required: true }]}><Select options={facilityOptions} onChange={() => form.setFieldsValue({ block_name: undefined, cell_number: undefined })} /></Form.Item>
          <Form.Item name="block_name" label="Block" rules={[{ required: true }]}>
            <Select placeholder="Select block" options={blockOptions} onChange={() => form.setFieldValue('cell_number', undefined)} />
          </Form.Item>
          <Form.Item name="cell_number" label="Cell number" rules={[{ required: true }]}>
            <Select placeholder="Select cell" disabled={!selectedBlock} options={cellOptions} />
          </Form.Item>
          <Form.Item name="notes" label="Reason / notes"><Input.TextArea rows={3} /></Form.Item>
        </>}
        {modalType === 'roll' && <>
          <Form.Item name="roll_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="shift" label="Shift" rules={[{ required: true }]}><Select options={[
            { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'night', label: 'Night' },
          ]} /></Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}><Select options={[
            { value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'hospital', label: 'Hospital' }, { value: 'court', label: 'At court' }, { value: 'transfer', label: 'Transfer' },
          ]} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </>}
        {modalType === 'capacity' && <>
          <Form.Item name="facility" label="Prison facility" rules={[{ required: true }]}><Select options={facilityOptions} /></Form.Item>
          <Form.Item name="block_name" label="Block" rules={[{ required: true }]}><Select options={BLOCK_OPTIONS} /></Form.Item>
          <Form.Item name="cell_number" label="Cell" rules={[{ required: true }]}><Select options={CELL_OPTIONS} /></Form.Item>
          <Form.Item name="capacity" label="Maximum capacity" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
        </>}
        {modalType === 'bulk_roll' && <>
          <Form.Item name="roll_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="shift" label="Shift" rules={[{ required: true }]}><Select options={[
            { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'night', label: 'Night' },
          ]} /></Form.Item>
          <Space orientation="vertical" style={{ width: '100%', maxHeight: 360, overflowY: 'auto' }}>
            {admissions.map((row) => <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>{row.prison_number} — {row.full_name}</span>
              <Select value={bulkStatuses[row.id] || 'present'} style={{ width: 140 }} onChange={(status) => setBulkStatuses((current) => ({ ...current, [row.id]: status }))} options={[
                { value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'hospital', label: 'Hospital' }, { value: 'court', label: 'At court' }, { value: 'transfer', label: 'Transfer' },
              ]} />
            </div>)}
          </Space>
        </>}
        {modalType === 'release' && <>
          <Alert type="warning" showIcon title={`${selectedAdmission?.full_name || 'Prisoner'} has ${selectedAdmission?.days_remaining ?? '?'} days remaining.`} style={{ marginBottom: 16 }} />
          <Form.Item name="request_reason" label="Release review reason" rules={[{ required: true }]}><Input.TextArea rows={4} placeholder="Sentence completion review and supporting details" /></Form.Item>
        </>}
      </Form>
    </Modal>
    </>
  );
}

export default function JailDashboard() {
  return (
    <Suspense fallback={null}>
      <JailDashboardContent />
    </Suspense>
  );
}
