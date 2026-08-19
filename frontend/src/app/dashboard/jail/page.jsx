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
import { useAuth } from '@/contexts/AuthContext';

const BLOCK_OPTIONS = ['Block A', 'Block B', 'Block C', 'Block D'].map((value) => ({ value, label: value }));
const CELL_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const value = String(index + 1).padStart(2, '0');
  return { value, label: `Cell ${value}` };
});

function JailDashboardContent() {
  const { user } = useAuth();
  const hasPermission = key => user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes(key);
  const canIntake = hasPermission('station_jail.intake');
  const canAssignCell = hasPermission('station_jail.assign_cell');
  const canCreateCentralTransfer = (row) => ['sentenced', 'serving'].includes(row.sentence_status) && !row.latest_transfer_status;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [caseData, setCaseData] = useState(null);
  const [offenders, setOffenders] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [cells, setCells] = useState([]);
  const [warrantFiles, setWarrantFiles] = useState([]);
  const [bulkStatuses, setBulkStatuses] = useState({});
  const [modalType, setModalType] = useState(null);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [custodyHistory, setCustodyHistory] = useState(null);
  const [form] = Form.useForm();
  const selectedBlock = Form.useWatch('block_name', form);
  const selectedFacility = Form.useWatch('facility', form);
  const selectedArrestId = Form.useWatch('arrest_id', form);
  const [loading, setLoading] = useState(true);
  const selectedEligible = useMemo(() => eligible.find((row) => String(row.candidate_key || row.arrest_id) === String(selectedArrestId)), [eligible, selectedArrestId]);
  const userStationFacility = user?.location?.districtName ? `${user.location.districtName} Station Jail` : null;
  const firstStationFacility = cells.find((cell) => cell.facility)?.facility || null;
  const defaultStationFacility = userStationFacility || firstStationFacility;
  const stationFacilityFallback = selectedEligible?.district_name ? `${selectedEligible.district_name} Station Jail` : null;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [caseRes, offenderRes, admissionRes, cellRes] = await Promise.all([
          api.get('/cases/stats'),
          api.get('/criminals', { params: { arrested: '1' } }),
          api.get('/custody/admissions'),
          api.get('/custody/cells', { params: { scope: 'station' } }),
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
    const [response, cellResponse] = await Promise.all([api.get('/custody/admissions'), api.get('/custody/cells', { params: { scope: 'station' } })]);
    setAdmissions(response.data.data || []);
    setEligible(response.data.eligible || []);
    setCells(cellResponse.data.data || []);
  };

  const openAction = (type, admission = null) => {
    setModalType(type);
    setSelectedAdmission(admission);
    form.resetFields();
    setWarrantFiles([]);
    if (type === 'cell' && admission) form.setFieldsValue({ facility: admission.facility });
    if (type === 'transfer' && admission) form.setFieldsValue({ arrest_id: admission.arrest_id, from_facility: admission.facility, to_facility: 'Mogadishu Central Jail', transfer_date: dayjs(), status: 'pending' });
    if (type === 'roll') form.setFieldsValue({ roll_date: dayjs(), shift: 'morning', status: 'present' });
    if (type === 'bulk_roll') form.setFieldsValue({ roll_date: dayjs(), shift: 'morning' });
  };

  const openHistory = async (admission) => {
    try {
      const response = await api.get(`/custody/criminals/${admission.suspect_id}`);
      setSelectedAdmission(admission);
      setCustodyHistory(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Taariikhda maxbuuska lama soo qaadi karin.');
    }
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
    if (action === 'capacity' && defaultStationFacility) {
      form.setFieldValue('facility', defaultStationFacility);
    }
    router.replace('/dashboard/jail');
  }, [defaultStationFacility, form, router, searchParams]);

  useEffect(() => {
    if (modalType !== 'admit' || !stationFacilityFallback) return;
    form.setFieldValue('facility', stationFacilityFallback);
  }, [form, modalType, stationFacilityFallback]);

  const submitAction = async (values) => {
    try {
      if (modalType === 'admit') {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined && value !== null && !['admission_date','property_inventory'].includes(key)) data.append(key, value);
        });
        if (selectedEligible) {
          if (selectedEligible.suspect_id) data.append('suspect_id', selectedEligible.suspect_id);
          if (selectedEligible.case_id) data.append('case_id', selectedEligible.case_id);
          if (selectedEligible.arrest_id) data.append('arrest_id', selectedEligible.arrest_id);
          if (selectedEligible.candidate_key) data.append('candidate_key', selectedEligible.candidate_key);
        }
        const inventory = String(values.property_inventory || '').split(/[,\n]/).map(value => value.trim()).filter(Boolean);
        data.append('property_inventory', JSON.stringify(inventory));
        if (values.admission_date) data.append('admission_date', values.admission_date.format('YYYY-MM-DD HH:mm:ss'));
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
        const activeAdmissions = (latest.data.data || []).filter((row) => row.latest_transfer_status !== 'completed');
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
      if (modalType === 'transfer') {
        await api.post(`/custody/criminals/${selectedAdmission.suspect_id}/transfers`, {
          ...values,
          arrest_id: selectedAdmission.arrest_id,
          status: 'pending',
          transfer_date: values.transfer_date?.format('YYYY-MM-DD HH:mm:ss'),
        });
      }
      message.success('Jail record saved successfully.');
      setModalType(null);
      await refreshAdmissions();
    } catch (error) {
      message.error(error.response?.data?.message || error.message || 'Jail action failed.');
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
              <tr><th>Sentence</th><td>${doc.sentence_period_value || ''} ${doc.sentence_period_unit || ''}</td></tr>
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

  const facilityOptions = useMemo(() => [...new Set([...cells.map((cell) => cell.facility), stationFacilityFallback, defaultStationFacility].filter(Boolean))].map((value) => ({ value, label: value })), [cells, stationFacilityFallback, defaultStationFacility]);
  const stationRollAdmissions = useMemo(() => admissions.filter((row) => row.latest_transfer_status !== 'completed'), [admissions]);
  const blockOptions = useMemo(() => {
    const dbBlocks = cells.filter((cell) => cell.facility === selectedFacility).map((cell) => cell.block_name);
    const standardBlocks = ['Block A', 'Block B', 'Block C', 'Block D', 'Holding Cell'];
    const allBlocks = [...new Set([...dbBlocks, ...standardBlocks])].filter(Boolean);
    return allBlocks.map((value) => ({ value, label: value }));
  }, [cells, selectedFacility]);
  const cellOptions = useMemo(() => {
    const dbCells = cells.filter((cell) => cell.facility === selectedFacility && cell.block_name === selectedBlock);
    if (dbCells.length > 0) {
      return dbCells.map((cell) => ({
        value: cell.cell_number,
        label: `Cell ${cell.cell_number} (${cell.occupancy}/${cell.capacity})`,
        disabled: Number(cell.occupancy) >= Number(cell.capacity),
      }));
    }
    return Array.from({ length: 10 }, (_, index) => {
      const value = String(index + 1).padStart(2, '0');
      return { value, label: `Cell ${value} (5 boos)`, disabled: false };
    });
  }, [cells, selectedFacility, selectedBlock]);

  const admissionColumns = [
    { title: 'Lambarka Xabsiga', dataIndex: 'prison_number' },
    { title: 'Maxbuuska', dataIndex: 'full_name' },
    { title: 'Kiiska', dataIndex: 'case_number' },
    { title: 'Xabsiga', dataIndex: 'facility' },
    { title: 'Xaaladda', dataIndex: 'status', render: value => <Tag color={value === 'admitted' ? 'green' : 'default'}>{value === 'admitted' ? 'Ku jira' : 'Laga saaray'}</Tag> },
    { title: 'Qolka', render: (_, row) => row.cell_number ? `${row.block_name} / ${row.cell_number} (${row.cell_occupancy || 0}/${row.cell_capacity || '?'})` : 'Looma qoondeyn' },
    { title: 'Sentence', dataIndex: 'sentence_status', render: (value) => <Tag>{value}</Tag> },
    { title: 'Transfer', render: (_, row) => row.latest_transfer_status === 'completed' ? <Tag color="green">{`Ku jira Central Jail${row.latest_transfer_to_facility ? ` - ${row.latest_transfer_to_facility}` : ''}`}</Tag> : row.latest_transfer_status ? <Tag color="gold">{`${row.latest_transfer_status} ${row.latest_transfer_to_facility ? `-> ${row.latest_transfer_to_facility}` : ''}`}</Tag> : (['sentenced', 'serving'].includes(row.sentence_status) ? <Tag color="orange">Sugaya transfer</Tag> : <Tag>Ma jiro</Tag>) },
    { title: 'Last roll call', render: (_, row) => row.last_roll_status ? <Tag color={row.last_roll_status === 'present' ? 'green' : 'orange'}>{row.last_roll_status}</Tag> : 'Not recorded' },
    {
      title: 'Ficillada',
      render: (_, row) => {
        const isCentralJail = row.latest_transfer_status === 'completed';
        return <Space>
        {canAssignCell && !isCentralJail && <Button size="small" onClick={() => openAction('cell', row)}>Qol U Qoondee</Button>}
        {canIntake && canCreateCentralTransfer(row) && <Button size="small" onClick={() => openAction('transfer', row)}>Samee Transfer Document</Button>}
        {row.latest_transfer_id && <Button size="small" onClick={() => printTransferDocument(row.latest_transfer_id)}>Daabac Transfer</Button>}
        <Button size="small" onClick={() => openHistory(row)}>Taariikhda</Button>
        {canIntake && !isCentralJail && <Button size="small" type="primary" onClick={() => openAction('roll', row)}>Tiro-koob</Button>}
        {canIntake && !isCentralJail && (!row.release_approval_status || ['rejected', 'released'].includes(row.release_approval_status))
          && <Button size="small" danger onClick={() => openAction('release', row)}>Codso Sii-dayn</Button>}
      </Space>;
      },
    },
  ];

  return (
    <>
    <StandardDashboard
      allowedRoles={['station_jail', 'admin']}
      eyebrow="Hawlaha Xabsiga Saldhigga"
      title="Maamulka Station Jail"
      subtitle="Temporary custody, station holding, transfer documents, roll-call, and cell records."
      loading={loading}
      metrics={[
        { title: 'Incarcerated Offenders', value: offenders.length, icon: <LockOutlined />, tone: 'red', note: 'Marked for detention' },
        { title: 'Custody Cases', value: custodyCases.length, icon: <SafetyCertificateOutlined />, tone: 'blue', note: 'Related cases' },
        { title: 'Total Cases', value: caseData?.total || 0, icon: <DatabaseOutlined />, tone: 'purple', note: 'Cases available for review' },
        { title: 'Offender Records', value: offenders.length, icon: <IdcardOutlined />, tone: 'green', note: 'Custody data' },
      ]}
      tableTitle="Maxaabiista Hadda Ku Jira"
      tableSubtitle="Qaabilaadda, qolalka, muddada iyo tiro-koobka maalinlaha ah"
      tableColumns={admissionColumns}
      tableData={admissions}
      showTable={true}
    />
    <Modal
      title={modalType === 'admit' ? 'Qaabilaadda Maxbuuska' : modalType === 'cell' ? 'Qol U Qoondee' : modalType === 'capacity' ? 'Awoodda Qolka' : modalType === 'bulk_roll' ? 'Tiro-koobka Maalinlaha' : modalType === 'release' ? 'Codsiga Sii-daynta' : modalType === 'transfer' ? 'Samee Transfer Document' : 'Tiro-koobka Maalinlaha'}
      open={Boolean(modalType)}
      onCancel={() => setModalType(null)}
      onOk={() => form.submit()}
      destroyOnHidden
      centered
    >
      <Form form={form} layout="vertical" onFinish={submitAction}>
        {modalType === 'admit' && <>
          <Form.Item
            name="arrest_id"
            label="Prisoner / Case (Eedeysanaha / Dambiilaha Saldhigga)"
            rules={[{ required: true, message: 'Fadlan dooro eedeysanaha ama kiiska.' }]}
          >
            <Select
              showSearch
              placeholder="Dooro ama raadi eedeysane / dambiile (Magac, Tel, ID, Kiis)..."
              optionFilterProp="filterText"
              options={eligible.map((row) => {
                const key = String(row.candidate_key || row.arrest_id || `suspect-${row.suspect_id}-case-${row.case_id}`);
                const casePart = row.case_number ? `${row.case_number}${row.ob_number ? ` (${row.ob_number})` : ''}` : (row.ob_number || 'Kiis');
                const idPart = row.id_number ? ` | ID: ${row.id_number}` : (row.phone ? ` | Tel: ${row.phone}` : '');
                const isArrested = Number(row.is_arrested) === 1 || row.arrest_status === 'arrested';
                return {
                  value: key,
                  filterText: `${row.full_name} ${row.alias || ''} ${row.phone || ''} ${row.id_number || ''} ${row.case_number || ''} ${row.ob_number || ''} ${row.district_name || ''}`,
                  label: `${row.full_name}${row.alias ? ` (${row.alias})` : ''} — ${casePart}${idPart} — ${isArrested ? '🔒 Gacanta lagu hayaa' : '⚠️ Eedaysane Kiis'}`,
                };
              })}
            />
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
          <Form.Item label="Warqadda/Xaqiijinta Haynta"><Upload beforeUpload={(file) => { setWarrantFiles([file]); return false; }} fileList={warrantFiles} maxCount={1}><Button>Select document</Button></Upload></Form.Item>
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
          <Form.Item name="facility" label="Prison facility" rules={[{ required: true }]}><Input readOnly /></Form.Item>
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
            {stationRollAdmissions.map((row) => <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>{row.prison_number} - {row.full_name}</span>
              <Select value={bulkStatuses[row.id] || 'present'} style={{ width: 140 }} onChange={(status) => setBulkStatuses((current) => ({ ...current, [row.id]: status }))} options={[
                { value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'hospital', label: 'Hospital' }, { value: 'court', label: 'At court' }, { value: 'transfer', label: 'Transfer' },
              ]} />
            </div>)}
            {!stationRollAdmissions.length && <Alert type="info" showIcon title="Ma jiraan maxaabiis Station Jail ku jirta oo tiro-koob loo sameeyo." />}
          </Space>
        </>}
        {modalType === 'release' && <>
          <Alert type="warning" showIcon title={`${selectedAdmission?.full_name || 'Prisoner'} has ${selectedAdmission?.days_remaining ?? '?'} days remaining.`} style={{ marginBottom: 16 }} />
          <Form.Item name="request_reason" label="Release review reason" rules={[{ required: true }]}><Input.TextArea rows={4} placeholder="Sentence completion review and supporting details" /></Form.Item>
        </>}
        {modalType === 'transfer' && <>
          <Form.Item name="from_facility" label="Xabsiga Laga Wareejinayo"><Input disabled /></Form.Item>
          <Form.Item name="to_facility" label="Xabsiga Loo Wareejinayo" rules={[{ required: true, message: 'Geli xabsiga loo wareejinayo.' }]}><Input /></Form.Item>
          <Form.Item name="transfer_reason" label="Sababta Wareejinta" rules={[{ required: true, message: 'Geli sababta wareejinta.' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="transfer_date" label="Taariikhda Wareejinta" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Faahfaahin Dheeraad ah"><Input.TextArea rows={2} /></Form.Item>
        </>}
      </Form>
    </Modal>
    <Modal title={`Taariikhda Xabsiga · ${selectedAdmission?.full_name || ''}`} open={Boolean(custodyHistory)} onCancel={() => setCustodyHistory(null)} footer={null} width={780}>
      <Space orientation="vertical" style={{width:'100%'}} size="large">
        <div><strong>Qaabilaadaha Xabsiga</strong>{custodyHistory?.admissions?.length ? custodyHistory.admissions.map(item => <div key={item.id}>{dayjs(item.admission_date).format('YYYY-MM-DD HH:mm')} · {item.prison_number} · {item.facility} · <Tag>{item.status}</Tag> · Kiis {item.case_number}</div>) : <div>Qaabilaad hore ma jiro.</div>}</div>
        <div><strong>Qolalka Loo Qoondeeyey</strong>{custodyHistory?.cellAssignments?.length ? custodyHistory.cellAssignments.map(item => <div key={item.id}>{dayjs(item.assigned_at).format('YYYY-MM-DD HH:mm')} · {item.facility} / {item.block_name} / {item.cell_number}{item.released_at ? ` · Laga saaray ${dayjs(item.released_at).format('YYYY-MM-DD HH:mm')}` : ' · Hadda ku jira'}</div>) : <div>Qol hore looma qoondeyn.</div>}</div>
        <div><strong>Wareejinnada</strong>{custodyHistory?.transfers?.length ? custodyHistory.transfers.map(item => <div key={item.id}>{dayjs(item.transfer_date).format('YYYY-MM-DD HH:mm')} · {item.from_facility || 'Bilow'} → {item.to_facility} · {item.transfer_reason}</div>) : <div>Wax wareejin ah ma jiro.</div>}</div>
        <div><strong>Codsiyada Sii-daynta</strong>{custodyHistory?.releaseApprovals?.length ? custodyHistory.releaseApprovals.map(item => <div key={item.id}>{dayjs(item.requested_at).format('YYYY-MM-DD HH:mm')} · <Tag>{item.status}</Tag> · {item.request_reason}</div>) : <div>Codsi sii-dayn ah ma jiro.</div>}</div>
        <div><strong>Diiwaannada Caafimaadka</strong>{custodyHistory?.medical?.length ? custodyHistory.medical.map(item => <div key={item.id}>{dayjs(item.record_date).format('YYYY-MM-DD')} · {item.condition_summary}</div>) : <div>Diiwaan caafimaad ma jiro.</div>}</div>
      </Space>
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
