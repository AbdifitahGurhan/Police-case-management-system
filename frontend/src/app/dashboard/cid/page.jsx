'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  SendOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CaseStatusStepper from '@/components/shared/CaseStatusStepper';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const { TextArea } = Input;
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api').replace(/\/api\/?$/, '');
const DISMISSED_CID_ALERTS_KEY = 'dismissed-cid-dashboard-alerts';

const getDismissedAlertIds = () => {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISSED_CID_ALERTS_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const cidRoles = ['admin', 'district_admin', 'investigator', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];
const supervisorRoles = ['admin', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'prosecutor_liaison'];

const statusMeta = {
  open: { label: 'Socota (Open)', tone: 'open' },
  Socota: { label: 'Socota', tone: 'pending' },
  under_investigation: { label: 'Baaritaan Wado (Socota)', tone: 'pending' },
  evidence_collection: { label: 'Uruurinta Caddemaha', tone: 'open' },
  witness_interviews: { label: 'Dhageysiga Markhaatiyaasha', tone: 'pending' },
  suspect_tracking: { label: 'Raadinta Eedeysanaha', tone: 'warning' },
  arrest_made: { label: 'Eedeysane La Xiray', tone: 'critical' },
  investigation_completed: { label: 'Dhammaystiran', tone: 'open' },
  Dhammaystiran: { label: 'Dhammaystiran', tone: 'open' },
  supervisor_review: { label: 'Dib-u-eegista Kormeeraha', tone: 'pending' },
  approved: { label: 'La Ansixiyay', tone: 'open' },
  rejected: { label: 'Xiran / Diiddan', tone: 'critical' },
  Xiran: { label: 'Xiran', tone: 'critical' },
  sent_to_prosecutor: { label: 'U Gudubtay Xeer-ilaalinta', tone: 'open' },
  sent_to_court: { label: 'U Gudubtay Maxkamadda', tone: 'open' },
};

const CID_STATUS_OPTIONS = [
  'Socota',
  'Dhammaystiran',
  'Xiran',
  'open',
  'under_investigation',
  'evidence_collection',
  'witness_interviews',
  'suspect_tracking',
  'arrest_made',
  'investigation_completed',
  'supervisor_review',
  'approved',
];

const CID_STAGE_DETAILS = [
  { key: 'open', label: '1. Furan', help: 'Kiiska CID waa la furay oo wuxuu sugayaa bilaabidda baaritaanka.' },
  { key: 'under_investigation', label: '2. Baaritaan', help: 'Geli hawlaha baaritaanka iyo wixii la ogaaday.' },
  { key: 'evidence_collection', label: '3. Caddeymo', help: 'Diiwaangeli caddeymaha la ururiyey iyo halka laga helay.' },
  { key: 'witness_interviews', label: '4. Markhaati', help: 'Diiwaangeli wareysiyada iyo hadallada markhaatiyaasha.' },
  { key: 'suspect_tracking', label: '5. Raadraac', help: 'Ku qor xogta raadraaca iyo halka tuhmanuhu marayo.' },
  { key: 'arrest_made', label: '6. Xarig', help: 'Xaqiiji qofka la xiray iyo faahfaahinta xarigga.' },
  { key: 'investigation_completed', label: '7. Dhammaad', help: 'Soo koob natiijada baaritaanka iyo talada ugu dambeysa.' },
  { key: 'supervisor_review', label: '8. Dib-u-Eeg', help: 'U gudbi kormeeraha si uu u hubiyo shaqada la dhameystiray.' },
  { key: 'approved', label: '9. La Xaqiijiyey', help: 'Kormeeruhu wuxuu ansixiyaa ama dib ugu celiyaa baaritaanka.' },
];

const assignmentMeta = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  reassigned: 'Reassigned',
  rejected: 'Rejected',
};

const safe = (value) => value || '—';
const statusTag = (value) => (
  <Tag className={`status-tag status-tag--${statusMeta[value]?.tone || 'neutral'}`}>
    {statusMeta[value]?.label || safe(value)}
  </Tag>
);

export default function CIDDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canInvestigate = user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('cases.investigate');
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [cases, setCases] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [modalType, setModalType] = useState(null);
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();

  const canSupervise = supervisorRoles.includes(user?.role);

  const loadDashboard = useCallback(async (nextFilters = {}) => {
    setLoading(true);
    try {
      const [dashboardRes, casesRes] = await Promise.all([
        api.get('/cid/dashboard'),
        api.get('/cid/cases', { params: { limit: 50, ...nextFilters } }),
      ]);
      const notificationsRes = await api.get('/notifications', { params: { limit: 8 } });
      const dismissedAlertIds = getDismissedAlertIds();
      setDashboard(dashboardRes.data.data);
      setCases(casesRes.data.data || []);
      setAlerts((notificationsRes.data.data || []).filter((item) => !dismissedAlertIds.has(item.id)));
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load CID dashboard.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadDetail = useCallback(async (cidCaseId) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/cid/cases/${cidCaseId}`);
      setSelected(response.data.data);
      setDrawerOpen(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load CID case.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  const acknowledgeCase = async () => {
    const id = selected?.cidCase?.id;
    if (!id) return;
    try {
      await api.patch(`/cid/cases/${id}/acknowledge`);
      message.success('Case acknowledged.');
      setAlerts((current) => current.filter((item) => item.cid_case_id !== id));
      setCases((current) => current.map((item) => (
        item.id === id ? { ...item, assignment_status: 'accepted' } : item
      )));
      await loadDetail(id);
      await loadDashboard(filters);
    } catch (error) {
      message.error(error.response?.data?.message || 'Acknowledge failed.');
    }
  };

  const openAlertCase = async (item) => {
    const dismissedAlertIds = getDismissedAlertIds();
    if (item.id) dismissedAlertIds.add(item.id);
    window.localStorage.setItem(DISMISSED_CID_ALERTS_KEY, JSON.stringify([...dismissedAlertIds]));
    setAlerts((current) => current.filter((alert) => alert.id !== item.id));

    const queuedCase = cases.find((row) => Number(row.id) === Number(item.cid_case_id));
    if (queuedCase?.police_case_id) {
      router.push(`/cases/${queuedCase.police_case_id}`);
      return;
    }

    try {
      const response = await api.get(`/cid/cases/${item.cid_case_id}`);
      const policeCaseId = response.data?.data?.cidCase?.police_case_id;
      if (!policeCaseId) throw new Error('Missing police case id');
      router.push(`/cases/${policeCaseId}`);
    } catch (error) {
      message.error(error.response?.data?.message || 'Case View-ga lama furi karin.');
    }
  };

  const openCaseView = (row) => {
    if (!row?.police_case_id) {
      message.error('Case-ka asalka ah lama helin.');
      return;
    }
    router.push(`/cases/${row.police_case_id}`);
  };

  useEffect(() => {
    loadDashboard(filters);
    const timer = setInterval(() => loadDashboard(filters), 30000);
    return () => clearInterval(timer);
  }, [filters, loadDashboard]);

  const openModal = (type, values = {}) => {
    setModalType(type);
    form.resetFields();
    form.setFieldsValue(values);
  };

  const closeModal = () => {
    setModalType(null);
    form.resetFields();
  };

  const refreshAfterAction = async () => {
    const id = selected?.cidCase?.id;
    await loadDashboard(filters);
    if (id) await loadDetail(id);
  };

  const submitModal = async (values) => {
    try {
      const id = selected?.cidCase?.id;
      if (modalType === 'assign') await api.patch(`/cid/cases/${id}/assign`, values);
      if (modalType === 'investigation') await api.patch(`/cid/cases/${id}/investigation`, values);
      if (modalType === 'scene') {
        await api.post(`/cid/cases/${id}/crime-scenes`, {
          ...values,
          date_visited: values.date_visited ? values.date_visited.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'report') await api.post(`/cid/cases/${id}/reports`, values);
      if (modalType === 'review') await api.patch(`/cid/cases/${id}/review`, values);
      if (modalType === 'prosecutor') await api.post(`/cid/cases/${id}/forward-prosecutor`, values);
      message.success('CID record updated.');
      closeModal();
      await refreshAfterAction();
    } catch (error) {
      message.error(error.response?.data?.message || 'CID action failed.');
    }
  };

  const applyFilters = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => (next[key] === undefined || next[key] === '') && delete next[key]);
    setFilters(next);
    await loadDashboard(next);
  };

  const stats = dashboard?.stats || {};
  const metrics = [
    { title: 'Total CID cases', value: stats.total_cid_cases, icon: <FileSearchOutlined /> },
    { title: 'Active investigations', value: stats.active_investigations, icon: <AuditOutlined /> },
    { title: 'Pending review', value: stats.pending_investigations, icon: <WarningOutlined /> },
    { title: 'Completed', value: stats.completed_investigations, icon: <CheckCircleOutlined /> },
    { title: 'Evidence collected', value: stats.evidence_collected, icon: <FileProtectOutlined /> },
    { title: 'Suspects identified', value: stats.criminals_identified, icon: <TeamOutlined /> },
    { title: 'Arrested suspects', value: stats.arrested_criminals, icon: <UserSwitchOutlined /> },
    { title: 'Sent to prosecutor', value: stats.cases_sent_to_prosecutor, icon: <SendOutlined /> },
  ];

  const chartRows = useMemo(() => [
    { title: 'Investigation status', rows: dashboard?.byStatus || [] },
    { title: 'Cases by crime type', rows: dashboard?.byCrime || [] },
    { title: 'Officer performance', rows: dashboard?.officers || [] },
  ], [dashboard]);

  const columns = [
    { title: 'Case #', dataIndex: 'case_number', render: (value, row) => <Button type="link" onClick={() => openCaseView(row)}>{value}</Button> },
    { title: 'OB #', dataIndex: 'ob_number' },
    { title: 'Title', dataIndex: 'case_title', ellipsis: true },
    { title: 'Crime', dataIndex: 'crime_category' },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (v) => (
        <Tag className={`status-tag status-tag--${v === 'critical' ? 'critical' : v === 'high' ? 'warning' : 'neutral'}`}>
          {safe(v)}
        </Tag>
      ),
    },
    { title: 'Officer', dataIndex: 'assigned_officer', render: safe },
    {
      title: 'Assignment',
      dataIndex: 'assignment_status',
      render: (v) => (
        <Tag className={`status-tag status-tag--${v === 'assigned' ? 'pending' : 'open'}`}>
          {assignmentMeta[v] || safe(v)}
        </Tag>
      ),
    },
    { title: 'Investigation', dataIndex: 'investigation_status', render: statusTag },
    { title: 'Assigned', dataIndex: 'assigned_date', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—') },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openCaseView(row)}>View</Button>
          {row.assignment_status === 'assigned' && (
            <Button
              size="small"
              type="primary"
              onClick={async () => {
                try {
                  await api.patch(`/cid/cases/${row.id}/acknowledge`);
                  message.success('Case acknowledged.');
                  await loadDashboard(filters);
                } catch (error) {
                  message.error(error.response?.data?.message || 'Acknowledge failed.');
                }
              }}
            >
              Acknowledge
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const cidCase = selected?.cidCase;
  const needsAcknowledge = cidCase?.assignment_status === 'assigned';
  const crimeScenes = selected?.crimeScenes || [];
  const currentStageIndex = Math.max(0, CID_STAGE_DETAILS.findIndex((stage) => stage.key === cidCase?.investigation_status));
  const nextStage = CID_STAGE_DETAILS[currentStageIndex + 1];

  const openNextStage = () => {
    if (!nextStage) return;
    if (nextStage.key === 'approved') {
      openModal('review', { decision: 'approved' });
      return;
    }
    openModal('investigation', { investigation_status: nextStage.key });
  };

  return (
    <ProtectedRoute allowedRoles={cidRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Waaxda Baarista Dambiyada</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Hawlaha Baaritaanka
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kiisaska laguu xilsaaray, caddeymaha, markhaatiyaasha, eedaysanayaasha iyo taariikhda baaritaanka.
            </Text>
          </div>
          <Button type="primary" onClick={() => loadDashboard(filters)}>Cusboonaysii</Button>
        </div>

        <Row gutter={[16, 16]}>
          {alerts.length > 0 && alerts.slice(0, 4).map((item) => (
            <Col xs={24} md={12} key={item.id}>
              <Alert
                showIcon
                type={item.type === 'CID_REPORT_SUBMITTED' ? 'warning' : 'info'}
                title={item.title}
                description={<Button type="link" style={{ padding: 0 }} onClick={() => openAlertCase(item)}>{item.message}</Button>}
              />
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} xl={6} key={metric.title}>
              <Card variant="none" className="standard-metric-card">
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value || 0} loading={loading} />
              </Card>
            </Col>
          ))}
        </Row>

        <Card variant="none" className="standard-panel" title="CID search & filters">
          <Form form={filterForm} layout="vertical" onFinish={applyFilters}>
            <Row gutter={12}>
              <Col xs={24} md={6}><Form.Item name="search" label="Case / OB / complainant"><Input /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="officer" label="Assigned officer"><Input /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="priority" label="Priority"><Select allowClear options={['low','medium','high','critical'].map((value) => ({ value, label: value }))} /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="status" label="Investigation status"><Select allowClear options={CID_STATUS_OPTIONS.map((value) => ({ value, label: statusMeta[value].label }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_range" label="Assigned date range"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label=" "><Space><Button type="primary" htmlType="submit">Search</Button><Button onClick={() => { filterForm.resetFields(); setFilters({}); loadDashboard({}); }}>Reset</Button></Space></Form.Item></Col>
            </Row>
          </Form>
        </Card>

        <Row gutter={[16, 16]}>
          {chartRows.map((chart) => (
            <Col xs={24} lg={8} key={chart.title}>
              <Card variant="none" className="standard-panel" title={chart.title}>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {chart.rows.length ? chart.rows.map((row) => (
                    <div key={`${chart.title}-${row.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Text>{statusMeta[row.label]?.label || row.label || 'Unknown'}</Text>
                      <Tag color="blue">{row.value}</Tag>
                    </div>
                  )) : <Text type="secondary">No CID activity yet</Text>}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Card variant="none" className="standard-panel" title="CID case queue">
          <Table columns={columns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1300 }} />
        </Card>

        <Drawer
          title={cidCase ? `${cidCase.case_number} — ${cidCase.case_title}` : 'CID case'}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size="large"
          extra={cidCase && (
            <Space wrap>
              {canInvestigate && needsAcknowledge && (
                <Button type="primary" onClick={acknowledgeCase}>
                  Acknowledge case
                </Button>
              )}
              {canInvestigate && canSupervise && (
                <Button
                  disabled={needsAcknowledge}
                  onClick={() => openModal('assign', { assigned_officer: cidCase.assigned_officer, supervisor: cidCase.supervisor })}
                >
                  Assign
                </Button>
              )}
              {canInvestigate && <Button
                type="primary"
                disabled={needsAcknowledge || !nextStage}
                onClick={openNextStage}
              >
                Dhammeystir marxaladda xigta
              </Button>}
              {canInvestigate && <Button disabled={needsAcknowledge} onClick={() => openModal('scene')}>Diiwaangeli Goobta Dhacdada</Button>}
              {canInvestigate && <Button disabled={needsAcknowledge} onClick={() => router.push(`/cases/${cidCase.police_case_id}`)}>Ku Dar Caddeyn, Markhaati ama Eedaysane</Button>}
              {canInvestigate && <Button disabled={needsAcknowledge} onClick={() => openModal('report')}>Gudbi Warbixinta</Button>}
              {canInvestigate && canSupervise && <Button disabled={needsAcknowledge} onClick={() => openModal('review')}>Dib-u-eegista Kormeeraha</Button>}
              {canInvestigate && canSupervise && <Button disabled={needsAcknowledge} icon={<SendOutlined />} onClick={() => openModal('prosecutor')}>U Gudbi Xeer-ilaalinta</Button>}
            </Space>
          )}
        >
          {cidCase ? (
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              {needsAcknowledge && (
                <Alert
                  showIcon
                  type="warning"
                  title="Acknowledge required"
                  description="You must acknowledge this assigned case before updating investigation notes or logging crime scenes."
                  action={<Button type="primary" size="small" onClick={acknowledgeCase}>Acknowledge case</Button>}
                />
              )}

              <Card size="small" className="standard-panel" title="Investigation progress">
                <CaseStatusStepper status={cidCase.investigation_status} flow="cid" />
                <Space wrap style={{ marginTop: 8 }}>
                  {statusTag(cidCase.investigation_status)}
                  <Tag className={`status-tag status-tag--${needsAcknowledge ? 'pending' : 'open'}`}>
                    {assignmentMeta[cidCase.assignment_status] || safe(cidCase.assignment_status)}
                  </Tag>
                </Space>
              </Card>

              <Card
                size="small"
                className="standard-panel"
                title="Goobta dhammeystirka shaqada"
                extra={nextStage && (
                  <Button type="primary" disabled={needsAcknowledge} onClick={openNextStage}>
                    Dhammeystir: {nextStage.label}
                  </Button>
                )}
              >
                <Row gutter={[12, 12]}>
                  {CID_STAGE_DETAILS.map((stage, index) => {
                    const completed = index < currentStageIndex;
                    const active = index === currentStageIndex;
                    return (
                      <Col xs={24} md={12} xl={8} key={stage.key}>
                        <Card
                          size="small"
                          style={{
                            height: '100%',
                            borderColor: active ? '#a8ff4d' : undefined,
                            opacity: index > currentStageIndex + 1 ? 0.55 : 1,
                          }}
                        >
                          <Space orientation="vertical" size={4}>
                            <Space>
                              {completed && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                              <Text strong={active}>{stage.label}</Text>
                              {active && <Tag color="processing">Hadda</Tag>}
                              {completed && <Tag color="success">Dhameystiran</Tag>}
                            </Space>
                            <Text type="secondary">{stage.help}</Text>
                          </Space>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                {!nextStage && (
                  <Alert
                    showIcon
                    type="success"
                    title="Baaritaanka waa la xaqiijiyey"
                    description="Dhammaan sagaalka marxaladood waa la dhameystiray."
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>

              <Card
                size="small"
                className="standard-panel"
                title={`Crime-scene log (${crimeScenes.length})`}
                extra={!needsAcknowledge && (
                  <Button type="link" size="small" onClick={() => openModal('scene')}>Add scene</Button>
                )}
              >
                {crimeScenes.length === 0 ? (
                  <Empty description="No crime scenes logged yet" />
                ) : (
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={crimeScenes}
                    columns={[
                      { title: 'Location', dataIndex: 'location' },
                      { title: 'Date visited', dataIndex: 'date_visited', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
                      { title: 'Officer', dataIndex: 'officer', render: safe },
                      { title: 'Observations', dataIndex: 'observations', ellipsis: true },
                      { title: 'Evidence', dataIndex: 'collected_evidence', ellipsis: true },
                    ]}
                  />
                )}
              </Card>

              <Tabs
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Case number">{cidCase.case_number}</Descriptions.Item>
                        <Descriptions.Item label="OB number">{cidCase.ob_number}</Descriptions.Item>
                        <Descriptions.Item label="Crime category">{cidCase.crime_category}</Descriptions.Item>
                        <Descriptions.Item label="Priority">{safe(cidCase.priority)}</Descriptions.Item>
                        <Descriptions.Item label="Assigned officer">{safe(cidCase.assigned_officer)}</Descriptions.Item>
                        <Descriptions.Item label="Supervisor">{safe(cidCase.supervisor)}</Descriptions.Item>
                        <Descriptions.Item label="Complainant">{safe(cidCase.complainant_name)}</Descriptions.Item>
                        <Descriptions.Item label="Phone">{safe(cidCase.complainant_phone)}</Descriptions.Item>
                        <Descriptions.Item label="Incident location" span={2}>{safe(cidCase.incident_location)}</Descriptions.Item>
                        <Descriptions.Item label="Description" span={2}>{safe(cidCase.description)}</Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                  {
                    key: 'timeline',
                    label: `Progress (${selected.progress?.length || 0})`,
                    children: selected.progress?.length ? (
                      <Timeline items={selected.progress.map((item) => ({
                        content: (
                          <Space orientation="vertical" size={2}>
                            <Text strong>{statusMeta[item.status]?.label || item.status || 'Progress'}</Text>
                            <Text>{item.note}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {safe(item.created_by)} · {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                            </Text>
                          </Space>
                        ),
                      }))} />
                    ) : <Empty description="No progress notes yet" />,
                  },
                  {
                    key: 'evidence',
                    label: `Evidence (${selected.evidence?.length || 0})`,
                    children: (
                      <Table
                        rowKey="id"
                        dataSource={selected.evidence}
                        columns={[
                          { title: 'Evidence #', dataIndex: 'evidence_number' },
                          { title: 'Title', dataIndex: 'title' },
                          { title: 'Type', dataIndex: 'type' },
                          { title: 'Collected by', dataIndex: 'collected_by', render: safe },
                          { title: 'Status', dataIndex: 'status', render: (v) => <Tag className="status-tag status-tag--neutral">{safe(v)}</Tag> },
                          {
                            title: 'File',
                            dataIndex: 'file_url',
                            render: (url) => url
                              ? <Button size="small" href={`${API_ORIGIN}${url}`} target="_blank">Download</Button>
                              : '—',
                          },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'custody',
                    label: `Custody (${selected.custody?.length || 0})`,
                    children: (
                      <Table
                        rowKey="id"
                        dataSource={selected.custody || []}
                        columns={[
                          { title: 'Evidence', dataIndex: 'evidence_number' },
                          { title: 'From', dataIndex: 'transferred_from', render: safe },
                          { title: 'To', dataIndex: 'transferred_to', render: safe },
                          { title: 'Location', dataIndex: 'location', render: safe },
                          { title: 'Date', dataIndex: 'transfer_date', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
                          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'people',
                    label: 'Witnesses & suspects',
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={12}>
                          <Card title="Witnesses" variant="none" className="standard-panel">
                            <Table
                              rowKey="id"
                              dataSource={selected.witnesses}
                              pagination={false}
                              columns={[
                                { title: 'Name', dataIndex: 'full_name' },
                                { title: 'Phone', dataIndex: 'phone', render: safe },
                                { title: 'Statement', dataIndex: 'statement', ellipsis: true },
                              ]}
                            />
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title="Suspects" variant="none" className="standard-panel">
                            <Table
                              rowKey="id"
                              dataSource={selected.criminals}
                              pagination={false}
                              columns={[
                                { title: 'Name', dataIndex: 'full_name' },
                                { title: 'Phone', dataIndex: 'phone', render: safe },
                                { title: 'Status', dataIndex: 'case_status', render: (v) => <Tag className="status-tag status-tag--neutral">{safe(v)}</Tag> },
                              ]}
                            />
                          </Card>
                        </Col>
                      </Row>
                    ),
                  },
                  {
                    key: 'arrests',
                    label: `Arrests (${selected.arrests?.length || 0})`,
                    children: (
                      <Table
                        rowKey="id"
                        dataSource={selected.arrests}
                        columns={[
                          { title: 'Suspect', dataIndex: 'suspect_name' },
                          { title: 'Date', dataIndex: 'arrest_date', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—') },
                          { title: 'Location', dataIndex: 'arrest_location', render: safe },
                          { title: 'Officer', dataIndex: 'arrested_by', render: safe },
                          { title: 'Status', dataIndex: 'sentence_status', render: (v) => <Tag className="status-tag status-tag--neutral">{safe(v)}</Tag> },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'reports',
                    label: `Reports (${selected.reports?.length || 0})`,
                    children: (
                      <Table
                        rowKey="id"
                        dataSource={selected.reports}
                        columns={[
                          { title: 'Title', dataIndex: 'report_title' },
                          { title: 'Submitted by', dataIndex: 'submitted_by' },
                          { title: 'Submitted', dataIndex: 'submitted_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                          { title: 'Findings', dataIndex: 'findings', ellipsis: true },
                          { title: 'Recommendations', dataIndex: 'recommendations', ellipsis: true },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'audit',
                    label: `Audit (${selected.auditTrail?.length || 0})`,
                    children: (
                      <Table
                        rowKey={(row) => `${row.entity_type}-${row.entity_id}-${row.created_at}-${row.action}`}
                        dataSource={selected.auditTrail || []}
                        columns={[
                          { title: 'User', dataIndex: 'performed_by', render: safe },
                          { title: 'Ficilka', dataIndex: 'action', render: (v) => v?.replaceAll('_', ' ') },
                          { title: 'Date/time', dataIndex: 'created_at', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
                          { title: 'Previous', dataIndex: 'previous_value', ellipsis: true, render: (v) => (v ? JSON.stringify(v) : '—') },
                          { title: 'New', dataIndex: 'new_value', ellipsis: true, render: (v) => (v ? JSON.stringify(v) : '—') },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            </Space>
          ) : <Empty />}
        </Drawer>

        <Modal
          title={modalType ? String(modalType).replaceAll('_', ' ') : 'CID action'}
          open={Boolean(modalType)}
          onCancel={closeModal}
          onOk={() => form.submit()}
          destroyOnHidden
          forceRender
          width={760}
          zIndex={1200}
        >
          <Form form={form} layout="vertical" onFinish={submitModal}>
            {modalType === 'assign' && (
              <Row gutter={16}>
                <Col span={12}><Form.Item name="assigned_officer" label="Assigned officer"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="supervisor" label="Supervisor"><Input /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'investigation' && (
              <>
                <Alert
                  showIcon
                  type="info"
                  title={CID_STAGE_DETAILS.find((stage) => stage.key === form.getFieldValue('investigation_status'))?.label || 'Marxaladda baaritaanka'}
                  description="Buuxi xogta shaqada aad qabatay; markaad kaydiso kiisku wuxuu u gudbayaa marxaladdan."
                  style={{ marginBottom: 16 }}
                />
                <Form.Item name="investigation_status" label="Marxaladda">
                  <Select disabled options={CID_STAGE_DETAILS.map((stage) => ({ value: stage.key, label: stage.label }))} />
                </Form.Item>
                <Form.Item name="progress_note" label="Shaqada la qabtay" rules={[{ required: true, message: 'Qor shaqada lagu dhameystiray marxaladdan.' }]}><TextArea rows={3} /></Form.Item>
                <Form.Item name="findings" label="Waxyaabaha la ogaaday"><TextArea rows={3} /></Form.Item>
                <Form.Item name="recommendations" label="Talooyinka / tallaabada xigta"><TextArea rows={3} /></Form.Item>
              </>
            )}
            {modalType === 'scene' && (
              <>
                <Form.Item name="location" label="Crime scene location" rules={[{ required: true, message: 'Location is required.' }]}><Input /></Form.Item>
                <Form.Item name="date_visited" label="Date visited"><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="observations" label="Observations"><TextArea rows={3} /></Form.Item>
                <Form.Item name="scene_photos" label="Scene photos / file notes"><TextArea rows={2} /></Form.Item>
                <Form.Item name="collected_evidence" label="Collected evidence"><TextArea rows={2} /></Form.Item>
              </>
            )}
            {modalType === 'report' && (
              <>
                <Form.Item name="report_title" label="Report title" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="case_summary" label="Case summary"><TextArea rows={2} /></Form.Item>
                <Form.Item name="activities" label="Investigation activities"><TextArea rows={2} /></Form.Item>
                <Form.Item name="evidence_summary" label="Evidence summary"><TextArea rows={2} /></Form.Item>
                <Form.Item name="witness_summary" label="Witness summary"><TextArea rows={2} /></Form.Item>
                <Form.Item name="suspect_analysis" label="Suspect analysis"><TextArea rows={2} /></Form.Item>
                <Form.Item name="findings" label="Findings" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
                <Form.Item name="recommendations" label="Recommendations"><TextArea rows={3} /></Form.Item>
              </>
            )}
            {modalType === 'review' && (
              <>
                <Form.Item name="decision" label="Decision" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'approved', label: 'Approve investigation' },
                    { value: 'rejected', label: 'Reject investigation' },
                    { value: 'additional_investigation', label: 'Additional investigation required' },
                    { value: 'returned', label: 'Return to officer' },
                  ]} />
                </Form.Item>
                <Form.Item name="notes" label="Supervisor notes"><TextArea rows={4} /></Form.Item>
              </>
            )}
            {modalType === 'prosecutor' && <Form.Item name="notes" label="Forwarding notes"><TextArea rows={4} /></Form.Item>}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
