'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Calendar as AntCalendar,
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
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Gavel, Scale } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const { TextArea } = Input;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  registered: { label: 'New', color: 'blue' },
  awaiting_hearing: { label: 'Awaiting Hearing', color: 'gold' },
  hearing_scheduled: { label: 'Hearing Scheduled', color: 'processing' },
  in_trial: { label: 'In Trial', color: 'purple' },
  judgment_issued: { label: 'Judgment Issued', color: 'cyan' },
  sentenced: { label: 'Sentenced', color: 'volcano' },
  appealed: { label: 'Appealed', color: 'magenta' },
  closed: { label: 'Closed', color: 'green' },
  archived: { label: 'Closed', color: 'default' },
};

const decisionColor = { convicted: 'red', acquitted: 'green', dismissed: 'default' };
const iconStyle = { width: 22, height: 22 };

const roleConfig = {
  admin: { title: 'System Administrator Court View', actions: ['assign', 'hearing', 'proceeding', 'judgment', 'sentence', 'appeal', 'close', 'documents'] },
  court: { title: 'Court Administration Dashboard', actions: ['assign', 'hearing', 'proceeding', 'judgment', 'sentence', 'appeal', 'close', 'documents'] },
  court_admin: { title: 'Court Administrator Dashboard', actions: ['assign', 'hearing', 'proceeding', 'close', 'documents'] },
  judge: { title: 'Judge Dashboard', actions: ['proceeding', 'judgment', 'sentence', 'documents'] },
  prosecutor: { title: 'Prosecutor Dashboard', actions: ['appeal', 'documents'] },
  prosecutor_liaison: { title: 'Prosecutor Liaison Dashboard', actions: ['appeal', 'documents'] },
  court_clerk: { title: 'Court Clerk Dashboard', actions: ['hearing', 'proceeding', 'documents'] },
};

const statusTag = (status) => {
  const meta = statusMeta[status] || { label: status?.replaceAll('_', ' ') || 'Unknown', color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
};

const safe = (value) => value || 'N/A';

export default function CourtDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [cases, setCases] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [activeHearing, setActiveHearing] = useState(null);
  const [filters, setFilters] = useState({});
  const [calendarFilters, setCalendarFilters] = useState({});
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [calendarForm] = Form.useForm();

  const role = user?.role || 'court';
  const config = roleConfig[role] || roleConfig.court;
  const can = (action) => config.actions.includes(action);

  const loadDashboard = useCallback(async (nextFilters = {}, nextCalendarFilters = {}) => {
    setLoading(true);
    try {
      const [dashboardRes, casesRes, notificationsRes, calendarRes] = await Promise.all([
        api.get('/court/dashboard'),
        api.get('/court/cases', { params: { limit: 50, ...nextFilters } }),
        api.get('/court/notifications'),
        api.get('/court/calendar', { params: nextCalendarFilters }),
      ]);
      setDashboard(dashboardRes.data.data);
      setCases(casesRes.data.data || []);
      setNotifications(notificationsRes.data.data || []);
      setCalendarItems(calendarRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load court dashboard.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadDetail = useCallback(async (courtCaseId) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/court/cases/${courtCaseId}`);
      setSelected(response.data.data);
      setDetailOpen(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load court case.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadDashboard(filters, calendarFilters);
    const timer = setInterval(() => loadDashboard(filters, calendarFilters), 30000);
    return () => clearInterval(timer);
  }, [calendarFilters, filters, loadDashboard]);

  const openModal = (type, initial = {}) => {
    setModalType(type);
    setActiveHearing(initial.hearing || null);
    form.resetFields();
    form.setFieldsValue(initial.values || {});
  };

  const closeModal = () => {
    setModalType(null);
    setActiveHearing(null);
    form.resetFields();
  };

  const refreshAfterAction = async () => {
    const id = selected?.courtCase?.id;
    await loadDashboard(filters, calendarFilters);
    if (id) await loadDetail(id);
  };

  const openNotificationCase = async (courtCaseId) => {
    await loadDashboard(filters, calendarFilters);
    await loadDetail(courtCaseId);
  };

  const submitModal = async (values) => {
    try {
      const id = selected?.courtCase?.id;
      if (modalType === 'assign') await api.patch(`/court/cases/${id}/assign`, values);
      if (modalType === 'hearing') {
        await api.post(`/court/cases/${id}/hearings`, {
          ...values,
          hearing_date: values.hearing_date.format('YYYY-MM-DD'),
          hearing_time: values.hearing_time.format('HH:mm:ss'),
        });
      }
      if (modalType === 'proceeding') await api.post(`/court/hearings/${activeHearing.id}/proceedings`, values);
      if (modalType === 'judgment') {
        await api.post(`/court/cases/${id}/judgments`, {
          ...values,
          decision_date: values.decision_date ? values.decision_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'sentence') {
        await api.post(`/court/cases/${id}/sentences`, {
          ...values,
          sentence_date: values.sentence_date ? values.sentence_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'appeal') {
        await api.post(`/court/cases/${id}/appeals`, {
          ...values,
          filing_date: values.filing_date ? values.filing_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'close') await api.patch(`/court/cases/${id}/close`, values);
      message.success('Court record updated.');
      closeModal();
      await refreshAfterAction();
    } catch (error) {
      message.error(error.response?.data?.message || 'Court action failed.');
    }
  };

  const applySearch = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => (next[key] === undefined || next[key] === '') && delete next[key]);
    setFilters(next);
    await loadDashboard(next, calendarFilters);
  };

  const applyCalendarFilters = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => (next[key] === undefined || next[key] === '') && delete next[key]);
    setCalendarFilters(next);
    await loadDashboard(filters, next);
  };

  const printCourtDocument = (type) => {
    if (!selected?.courtCase) return;
    const cc = selected.courtCase;
    const latestHearing = selected.hearings?.[0];
    const latestJudgment = selected.judgments?.[0];
    const latestSentence = selected.sentences?.[0];
    const latestAppeal = selected.appeals?.[0];
    const titles = {
      summons: 'Witness Summons',
      hearing_notice: 'Hearing Notice',
      judgment_order: 'Judgment Order',
      sentence_order: 'Sentence Order',
      appeal_receipt: 'Appeal Receipt',
      closure_certificate: 'Closure Certificate',
    };
    const rows = [
      ['Court Case Number', cc.court_case_number],
      ['Police Case Number', cc.police_case_number],
      ['OB Number', cc.ob_number],
      ['Case Title', cc.case_title],
      ['Assigned Judge', cc.assigned_judge],
      ['Assigned Prosecutor', cc.assigned_prosecutor],
      ['Status', statusMeta[cc.status]?.label || cc.status],
      ['Hearing', latestHearing ? `${latestHearing.hearing_date} ${latestHearing.hearing_time || ''} - ${safe(latestHearing.court_room)}` : 'No hearing scheduled'],
      ['Judgment', latestJudgment ? `${latestJudgment.decision_type}: ${latestJudgment.judgment_summary}` : 'Pending'],
      ['Sentence', latestSentence ? `${latestSentence.sentence_type} ${latestSentence.duration || ''}` : 'Pending'],
      ['Appeal', latestAppeal ? `${latestAppeal.filed_by}: ${latestAppeal.appeal_reason}` : 'No appeal recorded'],
    ];
    const html = `
      <html><head><title>${titles[type]}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:36px;color:#111827}
        h1{font-size:24px;margin-bottom:4px} h2{font-size:16px;color:#4b5563;margin-top:0}
        table{width:100%;border-collapse:collapse;margin-top:24px}td{border:1px solid #d1d5db;padding:10px;vertical-align:top}
        td:first-child{width:220px;font-weight:700;background:#f3f4f6}.sign{margin-top:56px;display:flex;justify-content:space-between}
      </style></head><body>
      <h1>${titles[type]}</h1><h2>Regional Police Department - Court Management Module</h2>
      <table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${safe(value)}</td></tr>`).join('')}</table>
      <div class="sign"><span>Prepared by: ${safe(user?.fullName || user?.username)}</span><span>Date: ${dayjs().format('YYYY-MM-DD HH:mm')}</span></div>
      </body></html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const stats = dashboard?.stats || {};
  const metrics = [
    { title: 'Total Court Cases', value: stats.total_court_cases, icon: <BankOutlined style={iconStyle} /> },
    { title: 'Pending Cases', value: stats.pending_cases, icon: <FileTextOutlined style={iconStyle} /> },
    { title: 'Active Hearings', value: stats.active_hearings, icon: <CalendarOutlined style={iconStyle} /> },
    { title: 'Completed Cases', value: stats.completed_cases, icon: <FileDoneOutlined style={iconStyle} /> },
    { title: 'Convicted Cases', value: stats.convicted_cases, icon: <Gavel style={iconStyle} /> },
    { title: 'Acquitted Cases', value: stats.acquitted_cases, icon: <CheckCircleOutlined style={iconStyle} /> },
    { title: 'Appeals Filed', value: stats.appeals_filed, icon: <AuditOutlined style={iconStyle} /> },
    { title: 'Judges / Prosecutors', value: `${stats.judges || 0} / ${stats.prosecutors || 0}`, icon: <TeamOutlined style={iconStyle} /> },
  ];

  const chartRows = useMemo(() => [
    { title: 'Cases by Status', rows: dashboard?.byStatus || [] },
    { title: 'Cases by Crime Category', rows: dashboard?.byCrime || [] },
    { title: 'Monthly Court Activity', rows: dashboard?.monthlyActivity || [] },
  ], [dashboard]);

  const hearingsByDate = useMemo(() => {
    const grouped = {};
    calendarItems.forEach((item) => {
      const key = dayjs(item.hearing_date).format('YYYY-MM-DD');
      grouped[key] = grouped[key] || [];
      grouped[key].push(item);
    });
    return grouped;
  }, [calendarItems]);

  const caseColumns = [
    { title: 'Court Case #', dataIndex: 'court_case_number', render: (value, row) => <Button type="link" onClick={() => loadDetail(row.id)}>{value}</Button> },
    { title: 'Police Case #', dataIndex: 'police_case_number' },
    { title: 'OB #', dataIndex: 'ob_number' },
    { title: 'Title', dataIndex: 'case_title', ellipsis: true },
    { title: 'Complainant', dataIndex: 'complainant_name', render: safe },
    { title: 'Judge', dataIndex: 'assigned_judge', render: (value) => value || <Text type="secondary">Unassigned</Text> },
    { title: 'Status', dataIndex: 'status', render: statusTag },
    { title: 'Outcome', dataIndex: 'final_outcome', render: (value) => value ? <Tag color={decisionColor[value]}>{value.toUpperCase()}</Tag> : <Text type="secondary">Pending</Text> },
  ];

  const courtCase = selected?.courtCase;

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Judiciary Dashboard</Text>
            <Title level={2}>{config.title}</Title>
            <Text type="secondary">Role-based court case handling, hearing calendars, legal documents, audit trail, and final closure.</Text>
          </div>
          <Space wrap>
            {role === 'admin' && <Button icon={<AuditOutlined style={{ width: 16 }} />} href="/reports">Reports</Button>}
            <Button type="primary" icon={<Scale style={{ width: 16 }} />} onClick={() => loadDashboard(filters, calendarFilters)}>Refresh Court Queue</Button>
          </Space>
        </div>

        {notifications.length > 0 && (
          <Row gutter={[12, 12]}>
            {notifications.slice(0, 6).map((item, index) => (
              <Col xs={24} md={12} xl={8} key={`${item.type}-${item.court_case_id}-${index}`}>
                <Alert
                  showIcon
                  type={item.type === 'case_overdue' || item.type === 'witness_absent' ? 'warning' : 'info'}
                  title={item.title}
                  description={<Button type="link" style={{ padding: 0 }} onClick={() => openNotificationCase(item.court_case_id)}>{item.message}</Button>}
                />
              </Col>
            ))}
          </Row>
        )}

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

        <Card variant="none" className="standard-panel" title="Advanced Search">
          <Form form={searchForm} layout="vertical" onFinish={applySearch}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="court_case_number" label="Court Case Number"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="police_case_number" label="Police Case Number"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="ob_number" label="OB Number"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="suspect_name" label="Suspect Name"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="complainant_name" label="Complainant Name"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="judge" label="Judge"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="Status"><Select allowClear options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_range" label="Registration Date Range"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item label=" ">
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>Search</Button>
                    <Button onClick={() => { searchForm.resetFields(); setFilters({}); loadDashboard({}, calendarFilters); }}>Reset</Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={15}>
            <Card variant="none" className="standard-panel" title="Hearing Calendar">
              <Form form={calendarForm} layout="vertical" onFinish={applyCalendarFilters}>
                <Row gutter={12}>
                  <Col xs={24} md={6}><Form.Item name="judge" label="Judge"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="court_room" label="Court Room"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="hearing_type" label="Hearing Type"><Select allowClear options={[
                    { value: 'preliminary', label: 'Preliminary Hearing' },
                    { value: 'evidence', label: 'Evidence Hearing' },
                    { value: 'witness', label: 'Witness Hearing' },
                    { value: 'final', label: 'Final Hearing' },
                    { value: 'appeal', label: 'Appeal Hearing' },
                  ]} /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="case_status" label="Case Status"><Select allowClear options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="date_range" label="Date Range"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item label=" "><Button htmlType="submit">Apply Calendar Filters</Button></Form.Item></Col>
                </Row>
              </Form>
              <AntCalendar
                fullscreen={false}
                cellRender={(current) => {
                  const list = hearingsByDate[current.format('YYYY-MM-DD')] || [];
                  return list.slice(0, 3).map((item) => (
                    <div key={item.id} style={{ fontSize: 11, lineHeight: 1.2 }}>
                      <Tag color="blue">{item.hearing_type}</Tag>
                      <Text>{item.court_case_number}</Text>
                    </div>
                  ));
                }}
              />
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card variant="none" className="standard-panel" title="Upcoming Hearings">
              <Table
                size="small"
                rowKey="id"
                dataSource={calendarItems.slice(0, 8)}
                pagination={false}
                columns={[
                  { title: 'Date', dataIndex: 'hearing_date' },
                  { title: 'Case', dataIndex: 'court_case_number' },
                  { title: 'Room', dataIndex: 'court_room', render: safe },
                  { title: 'Status', dataIndex: 'case_status', render: statusTag },
                ]}
              />
            </Card>
          </Col>
        </Row>

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
                  )) : <Text type="secondary">No court activity yet</Text>}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Card variant="none" className="standard-panel" title="Court Case Register">
          <Table columns={caseColumns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1250 }} />
        </Card>

        <Drawer
          title={courtCase ? `${courtCase.court_case_number} - ${courtCase.case_title}` : 'Court Case'}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          size="large"
          extra={courtCase && (
            <Space wrap>
              {can('assign') && <Button onClick={() => openModal('assign', { values: { assigned_judge: courtCase.assigned_judge, assigned_prosecutor: courtCase.assigned_prosecutor } })}>Assign</Button>}
              {can('hearing') && <Button type="primary" onClick={() => openModal('hearing')}>Schedule Hearing</Button>}
              {can('judgment') && <Button onClick={() => openModal('judgment')}>Judgment</Button>}
              {can('sentence') && <Button onClick={() => openModal('sentence')}>Sentence</Button>}
              {can('appeal') && <Button onClick={() => openModal('appeal')}>Appeal</Button>}
              {can('close') && <Button danger onClick={() => openModal('close')}>Close</Button>}
            </Space>
          )}
        >
          {courtCase ? (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              {can('documents') && (
                <Card size="small" title="Court Document Generator">
                  <Space wrap>
                    {[
                      ['summons', 'Summons'],
                      ['hearing_notice', 'Hearing Notice'],
                      ['judgment_order', 'Judgment Order'],
                      ['sentence_order', 'Sentence Order'],
                      ['appeal_receipt', 'Appeal Receipt'],
                      ['closure_certificate', 'Closure Certificate'],
                    ].map(([type, label]) => (
                      <Button key={type} icon={<PrinterOutlined />} onClick={() => printCourtDocument(type)}>{label}</Button>
                    ))}
                  </Space>
                </Card>
              )}

              <Tabs
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <Descriptions bordered column={2}>
                        <Descriptions.Item label="Court Case">{courtCase.court_case_number}</Descriptions.Item>
                        <Descriptions.Item label="Police Case">
                          {role === 'admin' ? <Link href={`/cases/${courtCase.police_case_id}`}>{courtCase.police_case_number}</Link> : courtCase.police_case_number}
                        </Descriptions.Item>
                        <Descriptions.Item label="OB Number">{courtCase.ob_number}</Descriptions.Item>
                        <Descriptions.Item label="Crime Category">{courtCase.crime_category}</Descriptions.Item>
                        <Descriptions.Item label="Judge">{safe(courtCase.assigned_judge)}</Descriptions.Item>
                        <Descriptions.Item label="Prosecutor">{safe(courtCase.assigned_prosecutor)}</Descriptions.Item>
                        <Descriptions.Item label="Status">{statusTag(courtCase.status)}</Descriptions.Item>
                        <Descriptions.Item label="Outcome">{safe(courtCase.final_outcome)}</Descriptions.Item>
                        <Descriptions.Item label="Description" span={2}>{courtCase.case_description || 'No description.'}</Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                  {
                    key: 'police_file',
                    label: 'Police File',
                    children: (
                      <Descriptions bordered column={2}>
                        <Descriptions.Item label="Complainant">{safe(courtCase.complainant_name)}</Descriptions.Item>
                        <Descriptions.Item label="Phone">{safe(courtCase.complainant_phone)}</Descriptions.Item>
                        <Descriptions.Item label="Incident Location">{safe(courtCase.incident_location)}</Descriptions.Item>
                        <Descriptions.Item label="Priority">{safe(courtCase.priority)}</Descriptions.Item>
                        <Descriptions.Item label="Investigation Officer">{safe(courtCase.officer_name)}</Descriptions.Item>
                        <Descriptions.Item label="Arrest Records">{selected.arrests?.length || 0}</Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                  {
                    key: 'suspects',
                    label: `Suspects (${selected.suspects.length})`,
                    children: <Table rowKey="id" dataSource={selected.suspects} columns={[
                      { title: 'Name', dataIndex: 'full_name' },
                      { title: 'Phone', dataIndex: 'phone', render: safe },
                      { title: 'National ID', dataIndex: 'national_id', render: safe },
                      { title: 'Role', dataIndex: 'role_in_case', render: safe },
                      { title: 'Arrest', dataIndex: 'arrest_status', render: (v) => <Tag>{safe(v)}</Tag> },
                    ]} />,
                  },
                  {
                    key: 'witnesses',
                    label: `Witnesses (${selected.witnesses.length})`,
                    children: <Table rowKey="id" dataSource={selected.witnesses} columns={[
                      { title: 'Name', dataIndex: 'full_name' },
                      { title: 'Phone', dataIndex: 'phone', render: safe },
                      { title: 'Address', dataIndex: 'address', render: safe },
                      { title: 'Court Status', dataIndex: 'court_status', render: (v) => <Tag>{v || 'pending'}</Tag> },
                      { title: 'Statement', dataIndex: 'statement', ellipsis: true },
                    ]} />,
                  },
                  {
                    key: 'evidence',
                    label: `Evidence (${selected.evidence.length})`,
                    children: <Table rowKey="id" dataSource={selected.evidence} columns={[
                      { title: 'Evidence #', dataIndex: 'evidence_number', render: safe },
                      { title: 'Title', dataIndex: 'title', render: safe },
                      { title: 'Type', dataIndex: 'type', render: safe },
                      { title: 'Collected By', dataIndex: 'collected_by', render: safe },
                      { title: 'File', dataIndex: 'file_url', render: (url) => url ? <Button size="small" href={`http://localhost:5001${url}`} target="_blank">Download</Button> : 'N/A' },
                      { title: 'Court Notes', dataIndex: 'court_notes', ellipsis: true },
                    ]} />,
                  },
                  {
                    key: 'hearings',
                    label: `Hearings (${selected.hearings.length})`,
                    children: <Table rowKey="id" dataSource={selected.hearings} columns={[
                      { title: 'Type', dataIndex: 'hearing_type' },
                      { title: 'Date', dataIndex: 'hearing_date' },
                      { title: 'Time', dataIndex: 'hearing_time' },
                      { title: 'Room', dataIndex: 'court_room', render: safe },
                      { title: 'Judge', dataIndex: 'assigned_judge', render: safe },
                      { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                      { title: 'Action', render: (_, row) => can('proceeding') ? <Button size="small" onClick={() => openModal('proceeding', { hearing: row })}>Add Proceedings</Button> : null },
                    ]} />,
                  },
                  {
                    key: 'proceedings',
                    label: `Proceedings (${selected.proceedings.length})`,
                    children: <Table rowKey="id" dataSource={selected.proceedings} columns={[
                      { title: 'Date', dataIndex: 'proceeding_date' },
                      { title: 'Hearing', dataIndex: 'hearing_type', render: safe },
                      { title: 'Notes', dataIndex: 'notes', ellipsis: true },
                      { title: 'Judge Remarks', dataIndex: 'judge_remarks', ellipsis: true },
                      { title: 'Prosecutor Remarks', dataIndex: 'prosecutor_remarks', ellipsis: true },
                      { title: 'Defense Remarks', dataIndex: 'defense_remarks', ellipsis: true },
                    ]} />,
                  },
                  {
                    key: 'judgment',
                    label: 'Judgment',
                    children: <Table rowKey="id" dataSource={selected.judgments} columns={[
                      { title: 'Date', dataIndex: 'decision_date' },
                      { title: 'Judge', dataIndex: 'judge_name', render: safe },
                      { title: 'Decision', dataIndex: 'decision_type', render: (v) => <Tag color={decisionColor[v]}>{safe(v)}</Tag> },
                      { title: 'Summary', dataIndex: 'judgment_summary', ellipsis: true },
                    ]} />,
                  },
                  {
                    key: 'sentence',
                    label: 'Sentence',
                    children: <Table rowKey="id" dataSource={selected.sentences} columns={[
                      { title: 'Defendant', dataIndex: 'defendant_name' },
                      { title: 'Type', dataIndex: 'sentence_type' },
                      { title: 'Duration', dataIndex: 'duration', render: safe },
                      { title: 'Fine', dataIndex: 'fine_amount', render: safe },
                      { title: 'Date', dataIndex: 'sentence_date' },
                    ]} />,
                  },
                  {
                    key: 'appeals',
                    label: `Appeals (${selected.appeals.length})`,
                    children: <Table rowKey="id" dataSource={selected.appeals} columns={[
                      { title: 'Filed By', dataIndex: 'filed_by' },
                      { title: 'Reason', dataIndex: 'appeal_reason', ellipsis: true },
                      { title: 'Date', dataIndex: 'filing_date' },
                      { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                    ]} />,
                  },
                  {
                    key: 'audit',
                    label: `Audit Trail (${selected.auditTrail?.length || 0})`,
                    children: selected.auditTrail?.length ? <Table rowKey={(row) => `${row.entity_type}-${row.entity_id}-${row.created_at}-${row.action}`} dataSource={selected.auditTrail} columns={[
                      { title: 'Who', dataIndex: 'performed_by', render: safe },
                      { title: 'What Changed', dataIndex: 'action', render: (v) => v?.replaceAll('_', ' ') },
                      { title: 'Date/Time', dataIndex: 'created_at', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : 'N/A' },
                      { title: 'Previous Value', dataIndex: 'previous_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                      { title: 'New Value', dataIndex: 'new_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                    ]} /> : <Empty description="No audit activity yet" />,
                  },
                ]}
              />
            </Space>
          ) : <Empty />}
        </Drawer>

        <Modal
          title={modalType ? modalType.replaceAll('_', ' ').toUpperCase() : 'Court Action'}
          open={Boolean(modalType)}
          onCancel={closeModal}
          onOk={() => form.submit()}
          destroyOnHidden
          forceRender
          width={720}
        >
          <Form form={form} layout="vertical" onFinish={submitModal}>
            {modalType === 'assign' && (
              <Row gutter={16}>
                <Col span={12}><Form.Item name="assigned_judge" label="Assigned Judge"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="assigned_prosecutor" label="Assigned Prosecutor"><Input /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'hearing' && (
              <Row gutter={16}>
                <Col span={12}><Form.Item name="hearing_type" label="Hearing Type" rules={[{ required: true }]}><Select options={[
                  { value: 'preliminary', label: 'Preliminary Hearing' },
                  { value: 'evidence', label: 'Evidence Hearing' },
                  { value: 'witness', label: 'Witness Hearing' },
                  { value: 'final', label: 'Final Hearing' },
                  { value: 'appeal', label: 'Appeal Hearing' },
                ]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="court_room" label="Court Room"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="hearing_date" label="Hearing Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="hearing_time" label="Hearing Time" rules={[{ required: true }]}><TimePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={24}><Form.Item name="assigned_judge" label="Assigned Judge"><Input /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'proceeding' && (
              <>
                <Form.Item name="notes" label="Session Notes"><TextArea rows={3} /></Form.Item>
                <Form.Item name="judge_remarks" label="Judge Remarks"><TextArea rows={2} /></Form.Item>
                <Form.Item name="prosecutor_remarks" label="Prosecutor Remarks"><TextArea rows={2} /></Form.Item>
                <Form.Item name="defense_remarks" label="Defense Remarks"><TextArea rows={2} /></Form.Item>
              </>
            )}
            {modalType === 'judgment' && (
              <>
                <Form.Item name="judge_name" label="Judge"><Input /></Form.Item>
                <Form.Item name="decision_date" label="Decision Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="decision_type" label="Decision" rules={[{ required: true }]}><Select options={[
                  { value: 'convicted', label: 'Convicted' },
                  { value: 'acquitted', label: 'Acquitted' },
                  { value: 'dismissed', label: 'Dismissed' },
                ]} /></Form.Item>
                <Form.Item name="judgment_summary" label="Judgment Summary" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
              </>
            )}
            {modalType === 'sentence' && (
              <Row gutter={16}>
                <Col span={24}><Form.Item name="defendant_name" label="Defendant Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="sentence_type" label="Sentence Type" rules={[{ required: true }]}><Select options={[
                  { value: 'imprisonment', label: 'Imprisonment' },
                  { value: 'fine', label: 'Fine' },
                  { value: 'probation', label: 'Probation' },
                  { value: 'community_service', label: 'Community Service' },
                ]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="sentence_date" label="Sentence Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="duration" label="Duration"><Input placeholder="2 years, 6 months..." /></Form.Item></Col>
                <Col span={12}><Form.Item name="fine_amount" label="Fine Amount"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'appeal' && (
              <>
                <Form.Item name="filed_by" label="Filed By" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="filing_date" label="Filing Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="appeal_reason" label="Appeal Reason" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
              </>
            )}
            {modalType === 'close' && (
              <>
                <Form.Item name="final_outcome" label="Final Outcome"><Select options={[
                  { value: 'convicted', label: 'Convicted' },
                  { value: 'acquitted', label: 'Acquitted' },
                  { value: 'dismissed', label: 'Dismissed' },
                ]} /></Form.Item>
                <Form.Item name="closure_reason" label="Closure Reason"><TextArea rows={4} /></Form.Item>
                <Form.Item name="archive" label="Archive" initialValue={false}><Select options={[
                  { value: false, label: 'Close Only' },
                  { value: true, label: 'Close and Archive' },
                ]} /></Form.Item>
              </>
            )}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
