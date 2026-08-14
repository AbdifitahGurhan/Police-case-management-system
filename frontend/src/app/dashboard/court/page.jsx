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
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  AuditOutlined,
  HourglassOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CaseStatusStepper from '@/components/shared/CaseStatusStepper';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { requiredRule, textLengthRule } from '@/utils/validation';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const { TextArea } = Input;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];
const judgeFormRoles = ['judge', 'admin', 'court', 'court_admin'];

const statusMeta = {
  court_received: { label: 'Maxkamaddu heshay', tone: 'open' },
  arraignment: { label: 'Horgeyn + Qirasho', tone: 'pending' },
  remand_investigation: { label: 'Muddo Baaris', tone: 'pending' },
  remanded_to_investigator: { label: 'Dib loogu celiyay Baaraha', tone: 'warning' },
  returned_from_remand: { label: 'Baaris soo noqotay', tone: 'open' },
  assigned_legal_team: { label: 'Xilsaarid', tone: 'open' },
  case_scheduled: { label: 'Mudeyn', tone: 'open' },
  trial_hearing: { label: 'Dhageysi', tone: 'pending' },
  evidence_defense: { label: 'Caddeymo & Difaac', tone: 'pending' },
  judgment: { label: 'Xukun', tone: 'open' },
  sentenced: { label: 'Sentenced', tone: 'warning' },
  appealed: { label: 'Appealed', tone: 'critical' },
  closed: { label: 'Closed', tone: 'closed' },
  archived: { label: 'Archived', tone: 'neutral' },
};

const statusTag = (status) => (
  <Tag className={`status-tag status-tag--${statusMeta[status]?.tone || 'neutral'}`}>
    {statusMeta[status]?.label || String(status || '—').replaceAll('_', ' ')}
  </Tag>
);

const safe = (value) => value || '—';

const completedCourtStatuses = ['judgment','sentenced','closed','archived'];
const activeCourtStatuses = ['case_scheduled','trial_hearing','evidence_defense'];

function CourtTrendChart({ rows = [], cases = [] }) {
  const width = 760; const height = 190; const left = 34; const right = 16; const top = 18; const bottom = 32;
  const plotW = width - left - right; const plotH = height - top - bottom;
  const data = rows.map((row) => {
    const monthly = cases.filter((item) => dayjs(item.registration_date).format('YYYY-MM') === row.label);
    return {
      label: dayjs(`${row.label}-01`).format('MMM YYYY'), total: Number(row.value || 0),
      active: monthly.filter((item) => activeCourtStatuses.includes(item.status)).length,
      pending: monthly.filter((item) => !activeCourtStatuses.includes(item.status) && !completedCourtStatuses.includes(item.status)).length,
    };
  });
  const max = Math.max(5, ...data.flatMap((item) => [item.total, item.active, item.pending]));
  const points = (key) => data.map((item, index) => ({ x: left + (plotW * index) / Math.max(1, data.length - 1), y: top + plotH - (item[key] / max) * plotH, value: item[key], label: item.label }));
  const path = (items) => items.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const total = points('total'); const active = points('active'); const pending = points('pending');
  return <div className="court-trend"><div className="cid-chart-legend"><span className="blue">Wadarta Kiisaska</span><span className="green">Dhageysiyo Socda</span><span className="amber">{'Go\'aan Sugaya'}</span></div><svg viewBox={`0 0 ${width} ${height}`} aria-label="Dhaqdhaqaaqa kiisaska maxkamadda">{[0,.25,.5,.75,1].map((ratio)=><line key={ratio} x1={left} x2={width-right} y1={top+plotH*ratio} y2={top+plotH*ratio} className="cid-grid-line"/>)}<path d={path(total)} className="cid-line cid-line-blue"/><path d={path(active)} className="cid-line cid-line-green"/><path d={path(pending)} className="cid-line cid-line-amber"/>{total.map((point)=><g key={point.label}><circle cx={point.x} cy={point.y} r="3.5" className="cid-dot-blue"/><text x={point.x} y={point.y-9} textAnchor="middle" className="cid-chart-value">{point.value}</text><text x={point.x} y={height-8} textAnchor="middle" className="cid-chart-label">{point.label}</text></g>)}</svg></div>;
}

function CourtStatusDonut({ stats }) {
  const rows=[{label:'Socda',value:Number(stats.active_hearings||0),color:'#2878f0'},{label:'Sugaya',value:Number(stats.pending_cases||0),color:'#f5b313'},{label:'Dhammaystiran',value:Number(stats.completed_cases||0),color:'#42ad72'}];
  const total=Number(stats.total_court_cases||0);const sum=rows.reduce((acc,row)=>acc+row.value,0)||1;const segments=rows.map((row,index)=>({...row,length:(row.value/sum)*358,offset:rows.slice(0,index).reduce((acc,item)=>acc+(item.value/sum)*358,0)}));
  return <div className="cid-donut-wrap"><svg viewBox="0 0 180 180" className="cid-donut" aria-label="Xaaladda kiisaska"><circle cx="90" cy="90" r="57" className="cid-donut-track"/>{segments.map(row=><circle key={row.label} cx="90" cy="90" r="57" fill="none" stroke={row.color} strokeWidth="34" strokeDasharray={`${row.length} ${358-row.length}`} strokeDashoffset={-row.offset} transform="rotate(-90 90 90)"/>)}<text x="90" y="86" textAnchor="middle" className="cid-donut-total">{total}</text><text x="90" y="105" textAnchor="middle" className="cid-donut-caption">Kiisas</text></svg><div className="cid-donut-legend">{rows.map(row=><div key={row.label}><i style={{background:row.color}}/><span>{row.label}</span><strong>{row.value}</strong></div>)}<div className="court-total-row"><span>Wadarta Kiisaska</span><strong>{total}</strong></div></div></div>;
}

export default function CourtDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarFilters, setCalendarFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalInitialValues, setModalInitialValues] = useState({});
  const [calendarForm] = Form.useForm();
  const [form] = Form.useForm();

  const canJudgeForms = judgeFormRoles.includes(user?.role);

  const loadDashboard = useCallback(async (nextCalendarFilters = {}) => {
    setLoading(true);
    try {
      const [dashboardRes, notificationsRes, calendarRes] = await Promise.all([
        api.get('/court/dashboard'),
        api.get('/court/notifications'),
        api.get('/court/calendar', { params: nextCalendarFilters }),
      ]);
      setDashboard(dashboardRes.data.data);
      setNotifications(notificationsRes.data.data || []);
      setCalendarItems(calendarRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load court dashboard.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadCaseDetail = useCallback(async (courtCaseId) => {
    if (!courtCaseId) return;
    setDetailLoading(true);
    try {
      const response = await api.get(`/court/cases/${courtCaseId}`);
      setSelected(response.data.data);
      setDrawerOpen(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load court case.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadDashboard(calendarFilters);
    const timer = setInterval(() => loadDashboard(calendarFilters), 30000);
    return () => clearInterval(timer);
  }, [calendarFilters, loadDashboard]);

  const applyCalendarFilters = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => {
      if (next[key] === undefined || next[key] === '') delete next[key];
    });
    setCalendarFilters(next);
    await loadDashboard(next);
  };

  const openModal = (type, values = {}) => {
    if (type === 'sentence') {
      const suspects = selected?.suspects || [];
      if (suspects.length === 1) {
        values.criminal_id = suspects[0].id;
        values.defendant_name = suspects[0].full_name;
      }
    }
    setModalInitialValues(values);
    setModalType(type);
  };

  const closeModal = () => {
    form.resetFields();
    setModalType(null);
    setModalInitialValues({});
  };

  useEffect(() => {
    if (!modalType) return;
    form.resetFields();
    form.setFieldsValue(modalInitialValues);
  }, [form, modalInitialValues, modalType]);

  const submitModal = async (values) => {
    const id = selected?.courtCase?.id;
    if (!id) return;
    try {
      if (modalType === 'judgment') {
        await api.post(`/court/cases/${id}/judgments`, {
          ...values,
          decision_date: values.decision_date ? values.decision_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'sentence') {
        const suspects = selected?.suspects || [];
        await api.post(`/court/cases/${id}/sentences`, {
          ...values,
          sentence_date: values.sentence_date ? values.sentence_date.format('YYYY-MM-DD') : null,
        });
      }
      message.success(modalType === 'judgment' ? 'Judgment saved.' : 'Sentence issued.');
      closeModal();
      await loadCaseDetail(id);
      await loadDashboard(calendarFilters);
    } catch (error) {
      message.error(error.response?.data?.message || 'Court action failed.');
    }
  };

  const uniqueRooms = useMemo(() => {
    const rooms = calendarItems.map((item) => item.court_room).filter(Boolean);
    return [...new Set(rooms)];
  }, [calendarItems]);

  const stats = dashboard?.stats || {};
  const courtCase = selected?.courtCase;
  const canIssueJudgment = canJudgeForms && courtCase?.status === 'evidence_defense';
  const canIssueSentence = canJudgeForms && ['judgment', 'sentenced'].includes(courtCase?.status);
  const sentenceByCriminalId = useMemo(() => {
    const map = new Map();
    for (const sentence of selected?.sentences || []) {
      const criminalId = Number(sentence.criminal_id);
      if (!map.has(criminalId)) map.set(criminalId, sentence);
    }
    return map;
  }, [selected?.sentences]);
  const hasUnsentencedSuspect = useMemo(() => (
    (selected?.suspects || []).some((suspect) => !sentenceByCriminalId.has(Number(suspect.id)))
  ), [selected?.suspects, sentenceByCriminalId]);
  const canReopenForSentence = canJudgeForms
    && courtCase?.status === 'closed'
    && courtCase?.final_outcome === 'convicted'
    && hasUnsentencedSuspect;

  const reopenForSentence = async () => {
    const id = selected?.courtCase?.id;
    if (!id) return;
    try {
      await api.patch(`/court/cases/${id}/reopen-for-sentence`, {}, { skipErrorNotification: true });
      message.success('Court case reopened for sentencing.');
      await loadCaseDetail(id);
      await loadDashboard(calendarFilters);
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not reopen court case for sentencing.');
    }
  };

  const metrics = [
    { title: 'Wadarta Kiisaska', note: 'Kiisaska oo dhan', value: stats.total_court_cases || 0, icon: <BankOutlined />, tone: 'blue' },
    { title: "Go'aan Sugaya", note: "Go'aannada sugaya", value: stats.pending_cases || 0, icon: <FileTextOutlined />, tone: 'orange' },
    { title: 'Dhageysiyo Socda', note: 'Dhageysiyada socda', value: stats.active_hearings || 0, icon: <HourglassOutlined />, tone: 'amber' },
    { title: 'La Dhammaystiray', note: 'Kiisaska la xidhay', value: stats.completed_cases || 0, icon: <CheckCircleOutlined />, tone: 'green' },
    { title: 'La Xukumay', note: 'Kiisaska la xukumay', value: stats.convicted_cases || 0, icon: <AuditOutlined />, tone: 'purple' },
    { title: 'La Sii Daayay', note: 'Kiisaska la sii daayay', value: stats.acquitted_cases || 0, icon: <UserOutlined />, tone: 'cyan' },
  ];

  const judgeRows = Object.values((dashboard?.recentCases || []).reduce((acc, item) => {
    const name = item.assigned_judge || 'Lama xilsaarin';
    if (!acc[name]) acc[name] = { name, total: 0, completed: 0 };
    acc[name].total += 1;
    if (completedCourtStatuses.includes(item.status)) acc[name].completed += 1;
    return acc;
  }, {})).slice(0, 4);

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <div className="standard-dashboard court-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Bogga Hore&nbsp;&nbsp; / &nbsp;&nbsp;Maamulka Maxkamadda</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Hawlaha Maxkamadda
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {'La soco kiisaska maxkamadda, dhageysiyada, go\'aannada iyo waxqabadka garsoorayaasha.'}
            </Text>
          </div>
          <Space wrap>
            <Link href="/dashboard/court/cases">
              <Button type="primary" icon={<BankOutlined />}>Kiisaska Maxkamadda</Button>
            </Link>
            <Button onClick={() => loadDashboard(calendarFilters)}>Cusboonaysii</Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} lg={8} xl={4} key={metric.title}>
              <Card variant="none" className={`standard-metric-card court-metric court-metric-${metric.tone}`}>
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value} loading={loading} />
                <Text type="secondary">{metric.note}</Text>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16,16]}>
          <Col xs={24} xl={16}>
            <Card variant="none" className="standard-panel court-chart-card" title="Dhaqdhaqaaqa Kiisaska Maxkamadda" extra={<Select size="small" defaultValue="7" options={[{value:'7',label:'7 Bilood'}]} />}>
              {(dashboard?.monthlyActivity || []).length ? <CourtTrendChart rows={dashboard.monthlyActivity.slice(-7)} cases={dashboard?.recentCases || []} /> : <Empty description="Xog bille ah lama helin" />}
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card variant="none" className="standard-panel court-chart-card" title="Xaaladda Kiisaska"><CourtStatusDonut stats={stats} /></Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8} className="court-side-column">
            <Space orientation="vertical" size={12} style={{width:'100%'}}>
              <Card variant="none" className="standard-panel court-side-card" title="Waxqabadka Garsoorayaasha"><div className="cid-officer-list">{judgeRows.length?judgeRows.map(row=>{const percent=row.total?Math.round((row.completed/row.total)*100):0;return <div className="cid-officer" key={row.name}><div className="cid-officer-avatar">{row.name.split(' ').map(part=>part[0]).slice(0,2).join('')}</div><div><strong>{row.name}</strong><span>Dhageysiyo {row.total} · {row.completed} Dhammaystiray</span><div className="cid-progress"><i style={{width:`${percent}%`}}/></div></div><b>{percent}%</b></div>;}):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Xog garsoore lama helin"/>}</div></Card>
              <Card variant="none" className="standard-panel court-side-card" title="Dhageysiyada Soo Socda"><div className="court-upcoming">{calendarItems.slice(0,3).map((item,index)=><button type="button" key={item.id||index} onClick={()=>loadCaseDetail(item.court_case_id)}><WarningOutlined/><span><strong>{item.court_case_number} · {item.case_title}</strong><small>{item.hearing_date} · {item.hearing_time} · {item.court_room}</small></span><b>Soo socda</b></button>)}{!calendarItems.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Dhageysi soo socda ma jiro"/>}</div></Card>
            </Space>
          </Col>

          <Col xs={24} lg={16} className="court-table-column">
            <Card
              variant="none"
              className="standard-panel"
              title="Jadwalka Dhageysiyada"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{calendarItems.length} dhageysi</Text>}
            >
              <Form
                form={calendarForm}
                layout="vertical"
                onFinish={applyCalendarFilters}
                style={{ marginBottom: 16 }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={10}>
                    <Form.Item name="date_range" label="Hearing date range">
                      <RangePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={7}>
                    <Form.Item name="court_room" label="Court room">
                      <Select
                        allowClear
                        placeholder="All rooms"
                        options={uniqueRooms.map((room) => ({ value: room, label: room }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={7}>
                    <Form.Item name="case_status" label="Case status">
                      <Select
                        allowClear
                        placeholder="All statuses"
                        options={Object.entries(statusMeta).map(([value, meta]) => ({
                          value,
                          label: meta.label,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Space>
                      <Button type="primary" htmlType="submit">Apply filters</Button>
                      <Button onClick={() => {
                        calendarForm.resetFields();
                        setCalendarFilters({});
                        loadDashboard({});
                      }}>
                        Reset
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Form>

              <Table
                size="middle"
                loading={loading || detailLoading}
                dataSource={calendarItems}
                rowKey={(row) => row.id || `${row.court_case_id}-${row.hearing_date}-${row.hearing_time}`}
                pagination={{ pageSize: 8, showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}` }}
                scroll={{ x: 900 }}
                columns={[
                  {
                    title: 'Court case',
                    dataIndex: 'court_case_number',
                    render: (v, row) => (
                      <Button type="link" style={{ padding: 0 }} onClick={() => loadCaseDetail(row.court_case_id)}>
                        {v}
                      </Button>
                    ),
                  },
                  { title: 'Title', dataIndex: 'case_title', ellipsis: true },
                  {
                    title: 'Hearing type',
                    dataIndex: 'hearing_type',
                    render: (type) => <Tag className="status-tag status-tag--neutral">{type || '—'}</Tag>,
                  },
                  {
                    title: 'Date & time',
                    render: (_, row) => `${row.hearing_date || '—'} ${row.hearing_time || ''}`.trim(),
                  },
                  { title: 'Room', dataIndex: 'court_room', render: safe },
                  { title: 'Judge', dataIndex: 'assigned_judge', render: safe },
                  {
                    title: 'Case status',
                    dataIndex: 'case_status',
                    render: (s) => statusTag(s),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        <Drawer
          title={courtCase ? `${courtCase.court_case_number} — ${courtCase.case_title}` : 'Court case'}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size="large"
          extra={courtCase && canJudgeForms && (
            <Space wrap>
              <Button
                type="primary"
                disabled={!canIssueJudgment}
                onClick={() => openModal('judgment', {
                  decision_date: dayjs(),
                  decision_type: 'convicted',
                })}
              >
                Record judgment
              </Button>
              <Button
                disabled={!canIssueSentence}
                onClick={() => openModal('sentence', {
                  sentence_date: dayjs(),
                  sentence_type: 'imprisonment',
                })}
              >
                Issue sentence
              </Button>
              {canReopenForSentence && (
                <Button type="primary" onClick={reopenForSentence}>
                  Dib u fur si xukun loogu sameeyo
                </Button>
              )}
            </Space>
          )}
        >
          {courtCase ? (
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <Card size="small" className="standard-panel" title="Court case progress">
                <CaseStatusStepper status={courtCase.status} flow="court" />
                <Space wrap style={{ marginTop: 8 }}>
                  {statusTag(courtCase.status)}
                  {courtCase.final_outcome && (
                    <Tag className="status-tag status-tag--open">{courtCase.final_outcome}</Tag>
                  )}
                </Space>
              </Card>

              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Court case #">{courtCase.court_case_number}</Descriptions.Item>
                <Descriptions.Item label="Police case #">{safe(courtCase.police_case_number)}</Descriptions.Item>
                <Descriptions.Item label="OB #">{safe(courtCase.ob_number)}</Descriptions.Item>
                <Descriptions.Item label="Complainant">{safe(courtCase.complainant_name)}</Descriptions.Item>
                <Descriptions.Item label="Assigned judge">{safe(courtCase.assigned_judge)}</Descriptions.Item>
                <Descriptions.Item label="Assigned prosecutor">{safe(courtCase.assigned_prosecutor)}</Descriptions.Item>
              </Descriptions>

              <Card size="small" className="standard-panel" title={`Hearings (${selected.hearings?.length || 0})`}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={selected.hearings || []}
                  locale={{ emptyText: 'No hearings scheduled' }}
                  columns={[
                    { title: 'Type', dataIndex: 'hearing_type' },
                    { title: 'Date', dataIndex: 'hearing_date' },
                    { title: 'Time', dataIndex: 'hearing_time', render: safe },
                    { title: 'Room', dataIndex: 'court_room', render: safe },
                    { title: 'Status', dataIndex: 'status', render: (v) => <Tag className="status-tag status-tag--neutral">{v}</Tag> },
                  ]}
                />
              </Card>

              {canJudgeForms && (
                <Card size="small" className="standard-panel" title="Judge actions">
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                    Judgment and sentence forms are available to judges (and court admins).
                  </Text>
                  <Space wrap>
                    <Button type="primary" disabled={!canIssueJudgment} onClick={() => openModal('judgment', { decision_date: dayjs(), decision_type: 'convicted' })}>
                      Record judgment
                    </Button>
                    <Button
                      disabled={!canIssueSentence}
                      onClick={() => openModal('sentence', { sentence_date: dayjs(), sentence_type: 'imprisonment' })}
                    >
                      Issue sentence
                    </Button>
                    {canReopenForSentence && (
                      <Button type="primary" onClick={reopenForSentence}>
                        Dib u fur si xukun loogu sameeyo
                      </Button>
                    )}
                    <Link href={`/dashboard/court/cases?id=${courtCase.id}`}>
                      <Button>Open full case file</Button>
                    </Link>
                  </Space>
                </Card>
              )}

              <Card size="small" className="standard-panel" title={`Judgments (${selected.judgments?.length || 0})`}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={selected.judgments || []}
                  locale={{ emptyText: 'No judgments yet' }}
                  columns={[
                    { title: 'Decision', dataIndex: 'decision_type' },
                    { title: 'Date', dataIndex: 'decision_date' },
                    { title: 'Summary', dataIndex: 'judgment_summary', ellipsis: true },
                  ]}
                />
              </Card>

              <Card size="small" className="standard-panel" title={`Defendants (${selected.suspects?.length || 0})`}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={selected.suspects || []}
                  locale={{ emptyText: 'No active suspects linked to this case' }}
                  columns={[
                    { title: 'Defendant', dataIndex: 'full_name' },
                    {
                      title: 'Sentence status',
                      render: (_, row) => {
                        const sentence = sentenceByCriminalId.get(Number(row.id));
                        return sentence
                          ? <Tag color="red">{`${sentence.sentence_type}${sentence.duration ? ` - ${sentence.duration}` : ''}`}</Tag>
                          : <Tag>Suspect cusub - wali xukun looma ridin</Tag>;
                      },
                    },
                    {
                      title: 'Action',
                      render: (_, row) => {
                        if (!canIssueSentence) return null;
                        const sentence = sentenceByCriminalId.get(Number(row.id));
                        return sentence ? null : (
                          <Button size="small" type="primary" onClick={() => openModal('sentence', {
                            criminal_id: row.id,
                            defendant_name: row.full_name,
                            sentence_date: dayjs(),
                            sentence_type: 'imprisonment',
                          })}>
                            Xukun u samee / Issue sentence
                          </Button>
                        );
                      },
                    },
                  ]}
                />
              </Card>

              <Card size="small" className="standard-panel" title={`Sentences (${selected.sentences?.length || 0})`}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={selected.sentences || []}
                  locale={{ emptyText: 'No sentences yet' }}
                  columns={[
                    { title: 'Defendant', dataIndex: 'defendant_name' },
                    { title: 'Type', dataIndex: 'sentence_type' },
                    { title: 'Duration', dataIndex: 'duration', render: safe },
                    { title: 'Date', dataIndex: 'sentence_date' },
                  ]}
                />
              </Card>
            </Space>
          ) : (
            <Empty />
          )}
        </Drawer>

        <Modal
          title={modalType === 'judgment' ? 'Record judgment' : 'Issue sentence'}
          open={Boolean(modalType)}
          onCancel={closeModal}
          onOk={() => form.submit()}
          destroyOnHidden
          forceRender
          width={640}
        >
          <Form form={form} layout="vertical" onFinish={submitModal}>
            {modalType === 'judgment' && (
              <>
                <Form.Item name="decision_type" label="Decision" rules={[requiredRule('Decision')]}>
                  <Select
                    options={[
                      { value: 'convicted', label: 'Convicted' },
                      { value: 'acquitted', label: 'Acquitted' },
                      { value: 'dismissed', label: 'Dismissed' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="decision_date" label="Decision date" rules={[requiredRule('Decision date')]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  name="judgment_summary"
                  label="Judgment summary"
                  rules={[requiredRule('Judgment summary'), textLengthRule('Judgment summary', 5, 5000)]}
                >
                  <TextArea rows={4} />
                </Form.Item>
              </>
            )}
            {modalType === 'sentence' && (() => {
              const suspects = selected?.suspects || [];
              return (
                <>
                  {suspects.length > 1 ? (
                    <Form.Item name="criminal_id" label="Defendant name" rules={[requiredRule('Defendant name')]}>
                      <Select
                        placeholder="Select defendant"
                        options={suspects.map(s => ({ value: s.id, label: s.full_name }))}
                      />
                    </Form.Item>
                  ) : suspects.length === 1 ? (
                    <>
                      <Form.Item label="Defendant name">
                        <Input value={suspects[0].full_name} disabled />
                      </Form.Item>
                      <Form.Item name="criminal_id" hidden>
                        <Input />
                      </Form.Item>
                    </>
                  ) : (
                    <Form.Item label="Defendant name">
                      <Input disabled placeholder="No active suspects linked to this case" />
                    </Form.Item>
                  )}
                  <Form.Item name="sentence_type" label="Sentence type" rules={[requiredRule('Sentence type')]}>
                  <Select
                    options={[
                      { value: 'imprisonment', label: 'Imprisonment' },
                      { value: 'fine', label: 'Fine' },
                      { value: 'both', label: 'Imprisonment and fine' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="duration" label="Duration (e.g. 2 years)">
                  <Input placeholder="Optional for fine-only sentences" />
                </Form.Item>
                <Form.Item name="fine_amount" label="Fine amount">
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} step={0.01} stringMode prefix="$" />
                </Form.Item>
                <Form.Item name="sentence_date" label="Sentence date" rules={[requiredRule('Sentence date')]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="notes" label="Notes" rules={[textLengthRule('Notes', 3, 2000)]}>
                  <TextArea rows={3} />
                </Form.Item>
              </>
            );
          })()}
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
