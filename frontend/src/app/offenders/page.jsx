'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  FileImageOutlined,
  HistoryOutlined,
  IdcardOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const UPLOAD_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

export default function OffendersPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [releaseForm] = Form.useForm();
  const [sentenceForm] = Form.useForm();
  const [custodyForm] = Form.useForm();
  const [offenders, setOffenders] = useState([]);
  const [sentenceAlerts, setSentenceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedArrest, setSelectedArrest] = useState(null);
  const [custodyAction, setCustodyAction] = useState(null);
  const [filters, setFilters] = useState({ search: '', gender: undefined, arrested: undefined, repeat: undefined });
  const canManageOffenders = ['admin', 'officer', 'cid', 'district_admin', 'neighborhood_admin'].includes(user?.role);
  const canReleaseOffenders = ['admin', 'jail'].includes(user?.role);
  const canManageSentence = ['admin', 'court', 'jail'].includes(user?.role);
  const canManageCustody = ['admin', 'court', 'jail', 'cid', 'district_admin', 'neighborhood_admin'].includes(user?.role);

  const fetchOffenders = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
      const res = await api.get('/suspects', { params });
      setOffenders(res.data.data || []);
    } catch (err) {
      console.error(err);
      message.error('Failed to load offenders.');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  const fetchSentenceAlerts = useCallback(async () => {
    if (!['admin', 'jail'].includes(user?.role)) return;
    try {
      const res = await api.get('/suspects/sentence-alerts');
      setSentenceAlerts(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchOffenders();
    fetchSentenceAlerts();
  }, [fetchOffenders, fetchSentenceAlerts]);

  const stats = useMemo(() => {
    const total = offenders.length;
    const arrested = offenders.filter((item) => Number(item.is_arrested) === 1).length;
    const repeat = offenders.filter((item) => Number(item.case_count || 0) > 1).length;
    const withPhotos = offenders.filter((item) => item.photo_url).length;
    return { total, arrested, repeat, withPhotos };
  }, [offenders]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      is_arrested: Number(record.is_arrested) === 1,
    });
    setModalOpen(true);
  };

  const openRelease = (record) => {
    setReleasing(record);
    releaseForm.resetFields();
    setReleaseOpen(true);
  };

  const openHistory = async (record) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setSelectedProfile(null);
    try {
      const res = await api.get(`/suspects/${record.id}/history`);
      setSelectedProfile(res.data.data);
    } catch (err) {
      console.error(err);
      message.error('Failed to load offender history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openSentence = (arrest) => {
    setSelectedArrest(arrest);
    sentenceForm.setFieldsValue({
      court_decision: arrest.court_decision || 'pending',
      court_decision_notes: arrest.court_decision_notes,
      sentence_period_value: arrest.sentence_period_value,
      sentence_period_unit: arrest.sentence_period_unit,
      sentence_start_date: arrest.sentence_start_date ? dayjs(arrest.sentence_start_date) : null,
      expected_release_date: arrest.expected_release_date ? dayjs(arrest.expected_release_date) : null,
      sentence_status: arrest.sentence_status || 'awaiting_trial',
      final_status: arrest.final_status,
      notes: arrest.notes,
    });
    setSentenceOpen(true);
  };

  const refreshSelectedProfile = async () => {
    if (!selectedProfile?.profile?.id) return;
    const res = await api.get(`/suspects/${selectedProfile.profile.id}/history`);
    setSelectedProfile(res.data.data);
  };

  const openCustodyAction = (action) => {
    setCustodyAction(action);
    custodyForm.resetFields();
    setCustodyOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'photo') return;
        if (value !== undefined && value !== null) payload.append(key, value);
      });
      const file = values.photo?.[0]?.originFileObj;
      if (file) payload.append('photo', file);

      if (editing) {
        await api.put(`/suspects/${editing.id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success('Offender profile updated.');
      } else {
        await api.post('/suspects', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success('Offender profile registered.');
      }
      setModalOpen(false);
      fetchOffenders();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Validation failed. Please check the form.');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (values) => {
    if (!releasing) return;
    setSaving(true);
    try {
      await api.post(`/suspects/${releasing.id}/release`, values);
      message.success('The offender has been released.');
      setReleaseOpen(false);
      setReleasing(null);
      releaseForm.resetFields();
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Release failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitRelease = async () => {
    try {
      const values = await releaseForm.validateFields();
      await handleRelease(values);
    } catch {
      // Ant Design will display validation messages next to the fields.
    }
  };

  const handleSentenceUpdate = async (values) => {
    if (!selectedArrest) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        sentence_start_date: values.sentence_start_date ? values.sentence_start_date.format('YYYY-MM-DD') : null,
        expected_release_date: values.expected_release_date ? values.expected_release_date.format('YYYY-MM-DD') : null,
      };
      await api.put(`/arrests/${selectedArrest.id}/sentence`, payload);
      if (values.sentence_status && values.sentence_status !== selectedArrest.sentence_status) {
        await api.patch(`/arrests/${selectedArrest.id}/status`, {
          sentence_status: values.sentence_status,
          final_status: values.final_status,
          notes: values.notes,
        });
      }
      message.success('Sentence and prisoner status updated.');
      setSentenceOpen(false);
      if (selectedProfile?.profile?.id) {
        await refreshSelectedProfile();
      }
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to update sentence.');
    } finally {
      setSaving(false);
    }
  };

  const handleCustodySubmit = async (values) => {
    if (!selectedProfile?.profile?.id || !custodyAction) return;
    setSaving(true);
    try {
      const suspectId = selectedProfile.profile.id;
      const arrestId = values.arrest_id || selectedProfile.arrests?.[0]?.id || null;
      const datePayload = {
        ...values,
        arrest_id: arrestId,
        transfer_date: values.transfer_date ? values.transfer_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        record_date: values.record_date ? values.record_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        visit_date: values.visit_date ? values.visit_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
      };

      if (custodyAction === 'document') {
        const payload = new FormData();
        Object.entries(datePayload).forEach(([key, value]) => {
          if (key !== 'document' && value !== undefined && value !== null) payload.append(key, value);
        });
        const file = values.document?.[0]?.originFileObj;
        if (file) payload.append('document', file);
        await api.post(`/custody/suspects/${suspectId}/documents`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const endpointByAction = {
          biometric: 'biometrics',
          transfer: 'transfers',
          medical: 'medical-records',
          visitor: 'visitor-logs',
          release: 'release-approvals',
        };
        await api.post(`/custody/suspects/${suspectId}/${endpointByAction[custodyAction]}`, datePayload);
      }

      message.success('Custody record saved.');
      setCustodyOpen(false);
      await refreshSelectedProfile();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to save custody record.');
    } finally {
      setSaving(false);
    }
  };

  const releaseStatusColor = (status) => ({
    pending_admin_review: 'orange',
    admin_reviewed: 'blue',
    prison_confirmed: 'purple',
    court_approved: 'cyan',
    certificate_generated: 'geekblue',
    released: 'green',
    rejected: 'red',
  }[status] || 'default');

  const printReleaseCertificate = (certificate) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Release Certificate ${certificate.certificate_number}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:40px;color:#111827}
            .cert{border:4px solid #163b73;padding:32px;max-width:760px;margin:auto}
            h1{text-align:center;margin:0 0 8px;color:#163b73}
            h2{text-align:center;margin:0 0 28px;font-size:16px;color:#475467}
            .row{display:flex;justify-content:space-between;border-bottom:1px solid #d0d5dd;padding:12px 0}
            .label{font-weight:bold}
            .footer{margin-top:40px;display:flex;justify-content:space-between}
          </style>
        </head>
        <body>
          <div class="cert">
            <h1>Somali Police Force</h1>
            <h2>Release Certificate</h2>
            <div class="row"><span class="label">Certificate No.</span><span>${certificate.certificate_number}</span></div>
            <div class="row"><span class="label">Released Person</span><span>${certificate.suspect_name}</span></div>
            <div class="row"><span class="label">Case OB Number</span><span>${certificate.ob_number}</span></div>
            <div class="row"><span class="label">Case Title</span><span>${certificate.case_title}</span></div>
            <div class="row"><span class="label">Issued By</span><span>${certificate.issued_by}</span></div>
            <div class="row"><span class="label">Issued At</span><span>${dayjs(certificate.issued_at).format('YYYY-MM-DD HH:mm')}</span></div>
            <div class="row"><span class="label">Final Status</span><span>Released</span></div>
            <p>${certificate.notes || ''}</p>
            <div class="footer"><span>Prison Officer</span><span>Court/Authority</span><span>Admin</span></div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const reviewReleaseApproval = async (approval, action) => {
    setSaving(true);
    try {
      const endpointByAction = {
        admin_review: `/custody/release-approvals/${approval.id}/admin-review`,
        prison_confirm: `/custody/release-approvals/${approval.id}/prison-confirmation`,
        court_approve: `/custody/release-approvals/${approval.id}/court-approval`,
        reject: `/custody/release-approvals/${approval.id}`,
      };
      const payloadByAction = {
        admin_review: { decision: 'approved', notes: 'Admin reviewed sentence completion and approved release workflow.' },
        prison_confirm: { notes: 'Prison officer confirmed identity, custody file, and readiness for release.' },
        court_approve: { decision: 'approved', notes: 'Court/authority approved final release.' },
        reject: { status: 'rejected', review_notes: 'Release workflow rejected after review.' },
      };
      const res = await api.patch(endpointByAction[action], payloadByAction[action]);
      message.success(res.data.message || 'Release workflow updated.');
      await refreshSelectedProfile();
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to review release request.');
    } finally {
      setSaving(false);
    }
  };

  const generateReleaseCertificate = async (approval) => {
    setSaving(true);
    try {
      const res = await api.post(`/custody/release-approvals/${approval.id}/certificate`, {
        notes: 'Release certificate generated after full approval workflow.',
      });
      message.success(res.data.message || 'Release certificate generated.');
      if (res.data.certificate) printReleaseCertificate(res.data.certificate);
      await refreshSelectedProfile();
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to generate release certificate.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'Alias', 'Gender', 'Age', 'Nationality', 'Phone', 'Cases', 'Arrested'],
      ...offenders.map((item) => [
        item.full_name,
        item.alias || '',
        item.gender || '',
        item.age || '',
        item.nationality || '',
        item.phone || '',
        item.case_count || 0,
        Number(item.is_arrested) === 1 ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `offenders-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printList = () => {
    const htmlRows = offenders.map((item) => `
      <tr>
        <td>${item.full_name || ''}</td>
        <td>${item.alias || ''}</td>
        <td>${item.gender || ''}</td>
        <td>${item.nationality || ''}</td>
        <td>${item.case_count || 0}</td>
        <td>${Number(item.is_arrested) === 1 ? 'Arrested' : 'Open'}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Offender Register</title>
      <style>body{font-family:Arial;padding:28px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e2ef;padding:10px;text-align:left}th{background:#eef6ff}h1{margin-bottom:4px}</style>
      </head><body><h1>Somali Police Force</h1><h2>Offender Register</h2><p>Generated ${dayjs().format('YYYY-MM-DD HH:mm')}</p><table><thead><tr><th>Name</th><th>Alias</th><th>Gender</th><th>Nationality</th><th>Cases</th><th>Status</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>
    `);
    win.document.close();
    win.print();
  };

  const columns = [
    {
      title: 'Offender',
      dataIndex: 'full_name',
      render: (name, row) => (
        <Space>
          {row.photo_url ? (
            <Avatar src={<Image src={`${UPLOAD_BASE_URL}${row.photo_url}`} alt={name} preview={false} />} />
          ) : (
            <Avatar icon={<UserOutlined />} />
          )}
          <Space orientation="vertical" size={0}>
            <Text strong>{name}</Text>
            <Text type="secondary">{row.alias || 'No alias'}</Text>
          </Space>
        </Space>
      ),
    },
    { title: 'Gender', dataIndex: 'gender', render: (value) => <Tag>{value || 'N/A'}</Tag> },
    { title: 'Age', dataIndex: 'age', width: 80 },
    { title: 'Nationality', dataIndex: 'nationality' },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Cases', dataIndex: 'case_count', align: 'center', render: (value) => <Tag color={value > 1 ? 'red' : 'blue'}>{value || 0}</Tag> },
    { title: 'Status', dataIndex: 'is_arrested', render: (value) => Number(value) === 1 ? <Tag color="red">Arrested</Tag> : <Tag color="green">Not Arrested</Tag> },
    {
      title: 'Ficil',
      render: (_, row) => (
        <Space wrap>
          {canManageOffenders && <Button onClick={() => openEdit(row)}>Report</Button>}
          <Button icon={<HistoryOutlined />} onClick={() => openHistory(row)}>History</Button>
          {canReleaseOffenders && Number(row.is_arrested) === 1 && (
              <Button type="primary" icon={<UnlockOutlined />} onClick={() => openRelease(row)}>
                Release
              </Button>
          )}
          {!canManageOffenders && !(canReleaseOffenders && Number(row.is_arrested) === 1) && <Tag color="blue">View Only</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'officer', 'cid', 'court', 'jail', 'district_admin', 'neighborhood_admin']}>
      <div className="offenders-page">
        {sentenceAlerts.length > 0 && (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message={`${sentenceAlerts.length} prisoner(s) have completed the expected sentence period and need release review.`}
            description={sentenceAlerts.slice(0, 3).map((alert) => alert.message).join(' ')}
          />
        )}

        <div className="reports-hero">
          <div>
            <Text className="dashboard-eyebrow">Record Management</Text>
            <Title level={2}>Offender Registry</Title>
            <Text type="secondary">Manage identity, photos, biometrics, search, and repeat offender analysis.</Text>
          </div>
          <Space wrap>
            <Button icon={<PrinterOutlined />} onClick={printList}>Print</Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
            {canManageOffenders && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Register Offender</Button>}
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="report-kpi-card"><Statistic title="Total Offenders" value={stats.total} prefix={<TeamOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="report-kpi-card"><Statistic title="Repeat Offenders" value={stats.repeat} prefix={<IdcardOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="report-kpi-card"><Statistic title="Arrested" value={stats.arrested} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="report-kpi-card"><Statistic title="With Photos" value={stats.withPhotos} prefix={<FileImageOutlined />} /></Card></Col>
        </Row>

        <Card variant="none" className="report-panel" style={{ marginTop: 16 }}>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={10}>
              <Input prefix={<SearchOutlined />} placeholder="Search name, alias, ID, phone, or address" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} allowClear />
            </Col>
            <Col xs={12} lg={4}><Select placeholder="Gender" value={filters.gender} onChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))} allowClear style={{ width: '100%' }} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></Col>
            <Col xs={12} lg={4}><Select placeholder="Status" value={filters.arrested} onChange={(value) => setFilters((prev) => ({ ...prev, arrested: value }))} allowClear style={{ width: '100%' }} options={[{ value: '1', label: 'Arrested' }, { value: '0', label: 'Not Arrested' }]} /></Col>
            <Col xs={24} lg={4}><Select placeholder="Repeat" value={filters.repeat} onChange={(value) => setFilters((prev) => ({ ...prev, repeat: value }))} allowClear style={{ width: '100%' }} options={[{ value: '1', label: 'Repeat' }]} /></Col>
          </Row>
          <Table columns={columns} dataSource={offenders} rowKey="id" loading={loading} scroll={{ x: 960 }} />
        </Card>

        <Modal title={editing ? 'Edit Offender Profile' : 'Register Offender'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={820} destroyOnHidden forceRender>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: 'Full name is required.' }, { min: 3 }]}><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="alias" label="Alias"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="gender" label="Gender" initialValue="male" rules={[{ required: true }]}><Select options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="age" label="Age" rules={[{ type: 'number', min: 1, max: 120 }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="id_type" label="ID Type"><Input placeholder="National ID, passport..." /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="id_number" label="ID Number"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="phone" label="Phone" rules={[{ pattern: /^[+\d][\d\s-]{6,24}$/, message: 'Use a valid phone number.' }]}><Input /></Form.Item></Col>
              <Col xs={24}><Form.Item name="address" label="Address"><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="fingerprint_hash" label="Fingerprint / Biometric Reference"><Input placeholder="Fingerprint hash or biometric reference" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="is_arrested" label="Arrested" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24}><Form.Item name="biometric_notes" label="Biometric Notes"><TextArea rows={3} /></Form.Item></Col>
              <Col xs={24}><Form.Item name="description" label="Profile Notes"><TextArea rows={3} /></Form.Item></Col>
              <Col xs={24}><Form.Item name="photo" label="Offender Photo" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList || []}><Upload beforeUpload={() => false} maxCount={1} accept="image/png,image/jpeg,image/webp"><Button icon={<PlusOutlined />}>Select Photo</Button></Upload></Form.Item></Col>
            </Row>
          </Form>
        </Modal>

        <Modal
          title={selectedProfile ? `Complete History: ${selectedProfile.profile.full_name}` : 'Complete History'}
          open={historyOpen}
          onCancel={() => setHistoryOpen(false)}
          footer={[
            <Button key="close" onClick={() => setHistoryOpen(false)}>Close</Button>,
            <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>,
          ]}
          width={1100}
        >
          <Card loading={historyLoading} variant="none">
            {selectedProfile && (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {selectedProfile.release_alerts?.length > 0 && (
                  <Alert type="warning" showIcon message={selectedProfile.release_alerts[0].message} />
                )}
                {selectedProfile.repeat_offender && (
                  <Alert type="info" showIcon message="This person has previous arrest or case history connected to the same profile." />
                )}
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Full Name">{selectedProfile.profile.full_name}</Descriptions.Item>
                  <Descriptions.Item label="Alias">{selectedProfile.profile.alias || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="ID Number">{selectedProfile.profile.id_number || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{selectedProfile.profile.phone || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="First Arrest">{selectedProfile.first_arrest_date ? dayjs(selectedProfile.first_arrest_date).format('YYYY-MM-DD') : 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Arrests">{selectedProfile.arrests.length}</Descriptions.Item>
                </Descriptions>
                <Tabs
                  items={[
                    {
                      key: 'arrests',
                      label: 'Arrest & Sentence History',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.arrests}
                          pagination={false}
                          scroll={{ x: 1300 }}
                          columns={[
                            { title: 'OB Number', dataIndex: 'ob_number' },
                            { title: 'Station', dataIndex: 'police_station_name', render: (v) => v || 'N/A' },
                            { title: 'Arrest Date', dataIndex: 'arrest_date', render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : 'N/A' },
                            { title: 'Charges', dataIndex: 'charges', ellipsis: true },
                            { title: 'Court', dataIndex: 'court_decision', render: (v) => <Tag>{(v || 'pending').toUpperCase()}</Tag> },
                            { title: 'Sentence', render: (_, row) => row.sentence_period_value ? `${row.sentence_period_value} ${row.sentence_period_unit}` : 'N/A' },
                            { title: 'Release Date', dataIndex: 'expected_release_date', render: (v) => v || 'N/A' },
                            { title: 'Progress', render: (_, row) => <Progress percent={row.sentence_progress_percent || 0} size="small" /> },
                            { title: 'Remaining', render: (_, row) => row.remaining_days === null ? 'N/A' : `${row.remaining_days} day(s)` },
                            { title: 'Status', dataIndex: 'sentence_status', render: (v) => <Tag color={['escaped', 'wanted'].includes(v) ? 'red' : 'blue'}>{(v || 'awaiting_trial').toUpperCase()}</Tag> },
                            {
                              title: 'Action',
                              fixed: 'right',
                              render: (_, row) => canManageSentence && (
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSentence(row)}>Update</Button>
                              ),
                            },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'cases',
                      label: 'Case Records',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.cases}
                          pagination={false}
                          columns={[
                            { title: 'OB Number', dataIndex: 'ob_number' },
                            { title: 'Title', dataIndex: 'title' },
                            { title: 'Station', dataIndex: 'police_station_name' },
                            { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                            { title: 'Role', dataIndex: 'role_in_case' },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'actions',
                      label: 'Actions Taken',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.actions}
                          pagination={{ pageSize: 6 }}
                          columns={[
                            { title: 'Date', dataIndex: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                            { title: 'Action', dataIndex: 'action_type' },
                            { title: 'By', dataIndex: 'performed_by' },
                            { title: 'Description', dataIndex: 'description' },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'custody',
                      label: 'Custody Records',
                      children: (
                        <Space orientation="vertical" style={{ width: '100%' }} size="large">
                          {canManageCustody && (
                            <Space wrap>
                              <Button onClick={() => openCustodyAction('biometric')}>Add Biometric</Button>
                              <Button onClick={() => openCustodyAction('document')}>Add Document</Button>
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('transfer')}>Prison Transfer</Button>}
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('medical')}>Medical Record</Button>}
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('visitor')}>Visitor Log</Button>}
                              {['admin', 'jail'].includes(user?.role) && <Button type="primary" onClick={() => openCustodyAction('release')}>Request Release</Button>}
                            </Space>
                          )}
                          <Table
                            title={() => 'Biometric Identification'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.biometrics || []}
                            pagination={false}
                            columns={[
                              { title: 'Type', dataIndex: 'biometric_type', render: (v) => <Tag>{v}</Tag> },
                              { title: 'Hash', dataIndex: 'biometric_hash', ellipsis: true },
                              { title: 'Quality', dataIndex: 'quality_score' },
                              { title: 'Captured By', dataIndex: 'captured_by' },
                              { title: 'Captured At', dataIndex: 'captured_at', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : 'N/A' },
                            ]}
                          />
                          <Table
                            title={() => 'Documents'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.documents || []}
                            pagination={false}
                            columns={[
                              { title: 'Type', dataIndex: 'document_type' },
                              { title: 'Title', dataIndex: 'title' },
                              { title: 'Uploaded By', dataIndex: 'uploaded_by' },
                              { title: 'Date', dataIndex: 'uploaded_at', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                              { title: 'File', dataIndex: 'file_url', render: (v) => v ? <Button size="small" href={`${UPLOAD_BASE_URL}${v}`} target="_blank">Open</Button> : 'N/A' },
                            ]}
                          />
                          <Table
                            title={() => 'Prison Transfer History'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.prison_transfers || []}
                            pagination={false}
                            columns={[
                              { title: 'From', dataIndex: 'from_facility' },
                              { title: 'To', dataIndex: 'to_facility' },
                              { title: 'Reason', dataIndex: 'transfer_reason' },
                              { title: 'Date', dataIndex: 'transfer_date', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                              { title: 'Authorized By', dataIndex: 'authorized_by' },
                            ]}
                          />
                          <Table
                            title={() => 'Medical Records'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.medical_records || []}
                            pagination={false}
                            columns={[
                              { title: 'Date', dataIndex: 'record_date', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                              { title: 'Condition', dataIndex: 'condition_summary', ellipsis: true },
                              { title: 'Treatment', dataIndex: 'treatment_given', ellipsis: true },
                              { title: 'Doctor', dataIndex: 'doctor_name' },
                              { title: 'Fitness', dataIndex: 'fitness_status', render: (v) => <Tag>{v}</Tag> },
                            ]}
                          />
                          <Table
                            title={() => 'Visitor Logs'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.visitor_logs || []}
                            pagination={false}
                            columns={[
                              { title: 'Visitor', dataIndex: 'visitor_name' },
                              { title: 'ID Number', dataIndex: 'visitor_id_number' },
                              { title: 'Relationship', dataIndex: 'relationship' },
                              { title: 'Visit Date', dataIndex: 'visit_date', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                              { title: 'Approved By', dataIndex: 'approved_by' },
                            ]}
                          />
                          <Table
                            title={() => 'Release Approval Workflow'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.release_approvals || []}
                            pagination={false}
                            columns={[
                              { title: 'Requested By', dataIndex: 'requested_by' },
                              { title: 'Reason', dataIndex: 'request_reason' },
                              { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={releaseStatusColor(v)}>{String(v || '').replaceAll('_', ' ')}</Tag> },
                              { title: 'Admin', dataIndex: 'admin_reviewed_by', render: (v, row) => v || (row.status === 'pending_admin_review' ? 'Pending' : 'N/A') },
                              { title: 'Prison Officer', dataIndex: 'prison_confirmed_by', render: (v, row) => v || (row.status === 'admin_reviewed' ? 'Pending' : 'N/A') },
                              { title: 'Court/Authority', dataIndex: 'court_approved_by', render: (v, row) => v || (row.status === 'prison_confirmed' ? 'Pending' : 'N/A') },
                              { title: 'Certificate', dataIndex: 'certificate_number', render: (v) => v || 'N/A' },
                              {
                                title: 'Action',
                                render: (_, row) => (
                                  <Space>
                                    {user?.role === 'admin' && row.status === 'pending_admin_review' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'admin_review')}>Admin Review</Button>
                                    )}
                                    {user?.role === 'jail' && row.status === 'admin_reviewed' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'prison_confirm')}>Prison Confirm</Button>
                                    )}
                                    {['court', 'admin'].includes(user?.role) && row.status === 'prison_confirmed' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'court_approve')}>Court Approve</Button>
                                    )}
                                    {['admin', 'court', 'jail'].includes(user?.role) && row.status === 'court_approved' && (
                                      <Button size="small" type="primary" onClick={() => generateReleaseCertificate(row)}>Generate Certificate</Button>
                                    )}
                                    {user?.role === 'admin' && ['pending_admin_review', 'admin_reviewed', 'prison_confirmed'].includes(row.status) && (
                                      <Button size="small" danger onClick={() => reviewReleaseApproval(row, 'reject')}>Reject</Button>
                                    )}
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              </Space>
            )}
          </Card>
        </Modal>

        <Modal
          title="Update Sentence / Prisoner Status"
          open={sentenceOpen}
          onCancel={() => setSentenceOpen(false)}
          onOk={() => sentenceForm.submit()}
          confirmLoading={saving}
          width={760}
          destroyOnHidden
          forceRender
        >
          <Form form={sentenceForm} layout="vertical" onFinish={handleSentenceUpdate}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="court_decision" label="Court Decision" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'convicted', label: 'Convicted' },
                    { value: 'acquitted', label: 'Acquitted' },
                    { value: 'dismissed', label: 'Dismissed' },
                    { value: 'adjourned', label: 'Adjourned' },
                  ]} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="sentence_status" label="Prisoner Status" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'awaiting_trial', label: 'Awaiting Trial' },
                    { value: 'sentenced', label: 'Sentenced' },
                    { value: 'serving', label: 'Serving' },
                    { value: 'release_review', label: 'Release Review' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'released', label: 'Released' },
                    { value: 'wanted', label: 'Wanted' },
                    { value: 'escaped', label: 'Escaped' },
                    { value: 'acquitted', label: 'Acquitted' },
                    { value: 'dismissed', label: 'Dismissed' },
                  ]} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="sentence_period_value" label="Sentence Period"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="sentence_period_unit" label="Unit"><Select options={[{ value: 'days', label: 'Days' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="sentence_start_date" label="Start Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="expected_release_date" label="Expected Release Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="final_status" label="Final Outcome"><Input placeholder="Released, transferred, appeal pending..." /></Form.Item></Col>
              <Col xs={24}><Form.Item name="court_decision_notes" label="Court Judgment Notes"><TextArea rows={3} /></Form.Item></Col>
              <Col xs={24}><Form.Item name="notes" label="Officer/Admin Notes"><TextArea rows={3} /></Form.Item></Col>
            </Row>
          </Form>
          <Divider />
          <Text type="secondary">Set status to Wanted or Escaped when the prisoner leaves custody before completing the sentence.</Text>
        </Modal>

        <Modal
          title={{
            biometric: 'Add Biometric Identifier',
            document: 'Add Prisoner Document',
            transfer: 'Record Prison Transfer',
            medical: 'Add Medical Record',
            visitor: 'Add Visitor Log',
            release: 'Request Release Approval',
          }[custodyAction] || 'Custody Record'}
          open={custodyOpen}
          onCancel={() => setCustodyOpen(false)}
          onOk={() => custodyForm.submit()}
          confirmLoading={saving}
          width={760}
          destroyOnHidden
          forceRender
        >
          <Form form={custodyForm} layout="vertical" onFinish={handleCustodySubmit}>
            <Form.Item name="arrest_id" label="Related Arrest">
              <Select
                allowClear
                placeholder="Use latest arrest if left blank"
                options={(selectedProfile?.arrests || []).map((arrest) => ({
                  value: arrest.id,
                  label: `${arrest.ob_number || 'Arrest'} - ${arrest.police_station_name || 'Station N/A'}`,
                }))}
              />
            </Form.Item>

            {custodyAction === 'biometric' && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="biometric_type" label="Biometric Type" rules={[{ required: true }]}>
                    <Select options={[{ value: 'fingerprint', label: 'Fingerprint' }, { value: 'face', label: 'Face' }, { value: 'iris', label: 'Iris' }, { value: 'other', label: 'Other' }]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}><Form.Item name="quality_score" label="Quality Score"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="biometric_hash" label="Biometric Hash / Reference" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'document' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="document_type" label="Document Type" rules={[{ required: true }]}><Input placeholder="Court order, warrant, medical file..." /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="document" label="File" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList || []}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<PlusOutlined />}>Select Document</Button></Upload></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'transfer' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="from_facility" label="From Facility"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="to_facility" label="To Facility" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="transfer_date" label="Transfer Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="status" label="Status" initialValue="completed"><Select options={[{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="transfer_reason" label="Reason" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'medical' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="record_date" label="Record Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="fitness_status" label="Fitness Status" initialValue="fit"><Select options={[{ value: 'fit', label: 'Fit' }, { value: 'needs_treatment', label: 'Needs Treatment' }, { value: 'hospitalized', label: 'Hospitalized' }, { value: 'critical', label: 'Critical' }]} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="doctor_name" label="Doctor / Clinician"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="facility" label="Facility"><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="condition_summary" label="Condition Summary" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="treatment_given" label="Treatment Given"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'visitor' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="visitor_name" label="Visitor Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="visitor_id_number" label="Visitor ID Number"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="relationship" label="Relationship"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="visit_date" label="Visit Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="purpose" label="Purpose"><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'release' && (
              <Form.Item name="request_reason" label="Release Review Reason" rules={[{ required: true }]}>
                <TextArea rows={4} placeholder="Sentence completed, court order, appeal decision, medical release..." />
              </Form.Item>
            )}
          </Form>
        </Modal>

        <Modal
          title={`Release: ${releasing?.full_name || ''}`}
          open={releaseOpen}
          onCancel={() => {
            setReleaseOpen(false);
            releaseForm.resetFields();
          }}
          confirmLoading={saving}
          destroyOnHidden
          forceRender
          footer={[
            <Button key="cancel" onClick={() => {
              setReleaseOpen(false);
              releaseForm.resetFields();
            }}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={saving} onClick={submitRelease}>
              OK
            </Button>,
          ]}
        >
          <Form form={releaseForm} layout="vertical" onFinish={handleRelease}>
            <Form.Item
              name="release_reason"
              label="Release Reason"
              rules={[{ required: true, message: 'Please enter a release reason.' }, { min: 5, message: 'Reason must be at least 5 characters.' }]}
            >
              <Input placeholder="Example: Court order, bail, or completed investigation" />
            </Form.Item>
            <Form.Item name="release_notes" label="Additional Notes">
              <TextArea rows={4} placeholder="Enter more details if needed." />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
