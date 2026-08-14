'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  EyeOutlined,
  PlusOutlined,
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

const cidRoles = ['admin', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];
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

function InvestigationTrend({ rows = [], cases: caseRows = [] }) {
  const labels = rows.length ? rows.map((row) => dayjs(`${row.label}-01`).format('MMM YYYY')) : [];
  const series = rows.map((row) => {
    const monthlyCases = caseRows.filter((item) => dayjs(item.assigned_date).format('YYYY-MM') === row.label);
    return {
      active: monthlyCases.filter((item) => ['open','under_investigation','evidence_collection','witness_interviews','suspect_tracking','arrest_made'].includes(item.investigation_status)).length,
      completed: monthlyCases.filter((item) => ['investigation_completed','approved','sent_to_prosecutor','sent_to_court'].includes(item.investigation_status)).length,
      pending: monthlyCases.filter((item) => ['open','supervisor_review'].includes(item.investigation_status)).length,
    };
  });
  const values = series.map((item) => item.active);
  const width = 760; const height = 190; const left = 34; const right = 16; const top = 18; const bottom = 32;
  const max = Math.max(5, ...series.flatMap((item) => [item.active,item.completed,item.pending])); const plotW = width - left - right; const plotH = height - top - bottom;
  const points = values.map((value, index) => ({ x: left + (plotW * index) / Math.max(1, values.length - 1), y: top + plotH - (value / max) * plotH, value }));
  const activePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const completed = points.map((point,index) => ({ ...point, y: top + plotH - (series[index].completed / max) * plotH, value: series[index].completed }));
  const pending = points.map((point,index) => ({ ...point, y: top + plotH - (series[index].pending / max) * plotH, value: series[index].pending }));
  const pathOf = (series) => series.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return <div className="cid-trend"><div className="cid-chart-legend"><span className="blue">Baaritaanno Socda</span><span className="green">Baaritaanno Dhammaystiran</span><span className="amber">Baaritaanno Sugaya</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dhaqdhaqaaqa baaritaannada">{[0,.25,.5,.75,1].map((ratio) => <line key={ratio} x1={left} x2={width-right} y1={top+plotH*ratio} y2={top+plotH*ratio} className="cid-grid-line" />)}<path d={activePath} className="cid-line cid-line-blue"/><path d={pathOf(completed)} className="cid-line cid-line-green"/><path d={pathOf(pending)} className="cid-line cid-line-amber"/>{points.map((point,index)=><g key={labels[index]}><circle cx={point.x} cy={point.y} r="3.5" className="cid-dot-blue"/><text x={point.x} y={point.y-9} textAnchor="middle" className="cid-chart-value">{point.value}</text><text x={point.x} y={height-8} textAnchor="middle" className="cid-chart-label">{labels[index]}</text></g>)}</svg></div>;
}

function StatusDonut({ rows = [], total = 0 }) {
  const palette = ['#2878f0','#f5b313','#42ad72','#8b5cf6','#ef6b62'];
  const normalized = rows.slice(0, 5).map((row,index)=>({ ...row, value:Number(row.value||0), color:palette[index] }));
  const sum = normalized.reduce((acc,row)=>acc+row.value,0) || Number(total) || 1;
  const segments = normalized.map((row,index)=>({ ...row, length:(row.value/sum)*358, offset:normalized.slice(0,index).reduce((acc,item)=>acc+(item.value/sum)*358,0) }));
  return <div className="cid-donut-wrap"><svg viewBox="0 0 180 180" className="cid-donut" aria-label="Xaaladda baaritaannada"><circle cx="90" cy="90" r="57" className="cid-donut-track"/>{segments.map((row)=><circle key={row.label} cx="90" cy="90" r="57" fill="none" stroke={row.color} strokeWidth="34" strokeDasharray={`${row.length} ${358-row.length}`} strokeDashoffset={-row.offset} transform="rotate(-90 90 90)"/>)}<text x="90" y="86" textAnchor="middle" className="cid-donut-total">{total}</text><text x="90" y="105" textAnchor="middle" className="cid-donut-caption">Kiisas</text></svg><div className="cid-donut-legend">{normalized.map(row=><div key={row.label}><i style={{background:row.color}}/><span>{statusMeta[row.label]?.label || row.label}</span><strong>{row.value}</strong></div>)}</div></div>;
}

export default function CIDDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canInvestigate = user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('cases.investigate');
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [chartPeriod, setChartPeriod] = useState(7);
  const [loadError, setLoadError] = useState('');
  const [modalType, setModalType] = useState(null);
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();

  const canSupervise = supervisorRoles.includes(user?.role);

  const loadDashboard = useCallback(async (nextFilters = {}) => {
    setLoading(true);
    setLoadError('');
    try {
      const [dashboardRes, casesRes] = await Promise.all([
        api.get('/cid/dashboard'),
        api.get('/cid/cases', { params: { limit: 50, ...nextFilters } }),
      ]);
      setDashboard(dashboardRes.data.data);
      setCases(casesRes.data.data || []);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Dashboard-ka CID lama soo qaadi karin.';
      setLoadError(errorMessage);
      message.error(errorMessage);
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
      setCases((current) => current.map((item) => (
        item.id === id ? { ...item, assignment_status: 'accepted' } : item
      )));
      await loadDetail(id);
      await loadDashboard(filters);
    } catch (error) {
      message.error(error.response?.data?.message || 'Acknowledge failed.');
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
    { title: 'Kiisaska CID', description: 'Maxkamaddu CID u dirtay', value: stats.total_cid_cases, icon: <FileSearchOutlined /> },
    { title: 'Baaritaanno Socda', description: 'Baaritaanno firfircoon', value: stats.active_investigations, icon: <AuditOutlined /> },
    { title: 'Dib-u-eegis Sugaya', description: 'Sugaya dib-u-eegis', value: stats.pending_investigations, icon: <WarningOutlined /> },
    { title: 'La Dhammaystiray', description: 'Kiisaska la xiray', value: stats.completed_investigations, icon: <CheckCircleOutlined /> },
    { title: 'Caddeymo La Ururiyey', description: 'Caddeymo la diiwaan geliyey', value: stats.evidence_collected, icon: <FileProtectOutlined /> },
    { title: 'Eedeysanayaal La Aqoonsaday', description: 'Eedeysanayaal la aqoonsaday', value: stats.criminals_identified, icon: <TeamOutlined /> },
  ];

  const statusRows = dashboard?.byStatus || [];
  const crimeRows = dashboard?.byCrime || [];
  const officerRows = dashboard?.officers || [];
  const trendRows = dashboard?.monthly || [];
  const urgentTasks = [
    ...cases
      .filter((item) => (
        ['critical', 'high'].includes(String(item.priority || '').toLowerCase())
        || item.assignment_status === 'assigned'
        || item.investigation_status === 'supervisor_review'
      ))
      .slice(0, 3)
      .map((item) => ({
        key: `case-${item.id}`,
        title: `${item.ob_number || item.case_number}`,
        message: item.case_title || item.crime_category,
        action: () => openCaseView(item),
        tone: item.priority === 'critical' ? 'critical' : 'warning',
      })),
  ].slice(0, 5);

  const columns = [
    { title: 'Kiiska', dataIndex: 'case_number', sorter: (a,b) => String(a.case_number || '').localeCompare(String(b.case_number || '')), render: (value, row) => <Button type="link" onClick={() => openCaseView(row)}>{value}</Button> },
    { title: 'OB', dataIndex: 'ob_number', render: (value, row) => <Button type="link" onClick={() => openCaseView(row)}>{value}</Button> },
    { title: 'Cinwaanka', dataIndex: 'case_title', ellipsis: true },
    { title: 'Nooca Dambiga', dataIndex: 'crime_category' },
    {
      title: 'Mudnaanta',
      dataIndex: 'priority',
      render: (v) => (
        <Tag className={`status-tag status-tag--${v === 'critical' ? 'critical' : v === 'high' ? 'warning' : 'neutral'}`}>
          {{ critical: 'Degdeg', high: 'Sare', medium: 'Dhexe', low: 'Hoose' }[v] || safe(v)}
        </Tag>
      ),
    },
    { title: 'Sarkaalka', dataIndex: 'assigned_officer', render: safe },
    {
      title: 'Xil-saaridda',
      dataIndex: 'assignment_status',
      render: (v) => (
        <Tag className={`status-tag status-tag--${v === 'assigned' ? 'pending' : 'open'}`}>
          {assignmentMeta[v] || safe(v)}
        </Tag>
      ),
    },
    { title: 'Marxaladda', dataIndex: 'investigation_status', render: statusTag },
    { title: 'Assigned', dataIndex: 'assigned_date', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—') },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openCaseView(row)}>Eeg</Button>
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
              Aqbal
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
      <div className="standard-dashboard cid-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Bogga Hore&nbsp;&nbsp; / &nbsp;&nbsp;Hawlaha Baaritaanka</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Hawlaha Baaritaanka
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              La soco kiisaska ay maxkamaddu u dirtay CID, baaritaannada socda, caddeymaha iyo hawlaha saraakiisha.
            </Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/cases/new')}>Qaado Kiis Cusub</Button>
        </div>

        {loadError && <Alert showIcon type="error" title="Xogta lama soo qaadi karin" description={loadError} action={<Button onClick={() => loadDashboard(filters)}>Mar kale isku day</Button>} />}

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} lg={8} xl={4} key={metric.title}>
              <Card variant="none" className="standard-metric-card">
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value || 0} loading={loading} />
                <Text type="secondary" style={{ fontSize: 12 }}>{metric.description}</Text>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card variant="none" className="standard-panel cid-chart-card" title="Dhaqdhaqaaqa Baaritaannada" extra={<Select aria-label="Dooro muddada jaantuska" size="small" value={chartPeriod} onChange={setChartPeriod} options={[{value:6,label:'6 Bilood'},{value:7,label:'7 Bilood'},{value:12,label:'12 Bilood'}]}/>}>
              {trendRows.length ? <InvestigationTrend rows={trendRows.slice(-chartPeriod)} cases={cases} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Xog bille ah lama helin" />}
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card variant="none" className="standard-panel cid-chart-card" title="Xaaladda Baaritaannada">
              <StatusDonut rows={statusRows} total={Number(stats.total_cid_cases || 0)} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={17}>
            <Card variant="none" className="standard-panel" title="Safka Kiisaska CID">
              <Form form={filterForm} className="cid-table-filters" onFinish={applyFilters}>
                <Row gutter={8} align="bottom">
                  <Col xs={24} md={7}><Form.Item name="search"><Input prefix={<FileSearchOutlined />} placeholder="Raadi CASE, OB ama dacwo..." /></Form.Item></Col>
                  <Col xs={12} md={4}><Form.Item name="officer"><Input placeholder="Sarkaalka" /></Form.Item></Col>
                  <Col xs={12} md={4}><Form.Item name="priority"><Select allowClear placeholder="Mudnaanta" options={['low','medium','high','critical'].map((value) => ({ value, label: value }))} /></Form.Item></Col>
                  <Col xs={12} md={5}><Form.Item name="status"><Select allowClear placeholder="Xaaladda" options={CID_STATUS_OPTIONS.map((value) => ({ value, label: statusMeta[value].label }))} /></Form.Item></Col>
                  <Col xs={12} md={4}><Form.Item><Button block type="primary" htmlType="submit">Sifee</Button></Form.Item></Col>
                  <Col xs={24} md={9}><Form.Item name="date_range"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </Form>
              <Table columns={columns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1300 }} />
            </Card>
          </Col>
          <Col xs={24} xl={7}>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <Card variant="none" className="standard-panel" title="Waxqabadka Saraakiisha" extra={<Select size="small" defaultValue="all" options={[{value:'all',label:'Dhammaan'}]}/>}>
                <div className="cid-officer-list">
                  {officerRows.length ? officerRows.slice(0,4).map((row) => {
                    const assigned = cases.filter((item) => item.assigned_officer === row.label);
                    const completedCount = assigned.filter((item) => ['investigation_completed','approved','sent_to_prosecutor','sent_to_court'].includes(item.investigation_status)).length;
                    const percent = assigned.length ? Math.round((completedCount / assigned.length) * 100) : 0;
                    return <div className="cid-officer" key={`officer-${row.label}`}><div className="cid-officer-avatar">{String(row.label || 'U').split(' ').map(part=>part[0]).slice(0,2).join('')}</div><div><strong>{row.label || 'Lama xilsaarin'}</strong><span>{row.value} Kiis La Qaaday · {completedCount} Dhammaystiray</span><div className="cid-progress"><i style={{width:`${percent}%`}}/></div></div><b>{percent}%</b></div>;
                  }) : <Text type="secondary">Wali waxqabad sarkaal lama hayo.</Text>}
                </div>
              </Card>
              <Card variant="none" className="standard-panel" title="Hawlaha Degdegga ah">
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {urgentTasks.length ? urgentTasks.map((item) => (
                    <Button
                      key={item.key}
                      type="text"
                      block
                      onClick={item.action}
                      style={{ height: 'auto', padding: 10, textAlign: 'left' }}
                    >
                      <Space align="start">
                        <WarningOutlined style={{ color: item.tone === 'critical' ? '#ef4444' : '#f59e0b', marginTop: 3 }} />
                        <span>
                          <Text strong>{item.title}</Text>
                          <br />
                          <Text type="secondary" style={{ whiteSpace: 'normal' }}>{item.message}</Text>
                        </span>
                      </Space>
                    </Button>
                  )) : <Text type="secondary">Ma jiraan hawlo degdeg ah.</Text>}
                </Space>
              </Card>
              <Card variant="none" className="standard-panel" title="Noocyada Dambiyada">
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {crimeRows.length ? crimeRows.map((row) => (
                    <div key={`crime-${row.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Text>{row.label || 'Unknown'}</Text>
                      <Tag>{row.value}</Tag>
                    </div>
                  )) : <Text type="secondary">Wali xog nooc dambi lama hayo.</Text>}
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>

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
      </div>
    </ProtectedRoute>
  );
}
