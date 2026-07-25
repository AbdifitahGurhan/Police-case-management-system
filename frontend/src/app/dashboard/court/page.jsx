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
  registered: { label: 'Registered', tone: 'open' },
  awaiting_hearing: { label: 'Awaiting hearing', tone: 'pending' },
  hearing_scheduled: { label: 'Hearing scheduled', tone: 'open' },
  in_trial: { label: 'In trial', tone: 'pending' },
  judgment_issued: { label: 'Judgment issued', tone: 'open' },
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
    setModalType(type);
    form.resetFields();
    if (type === 'sentence') {
      const suspects = selected?.suspects || [];
      if (suspects.length === 1) {
        values.criminal_id = suspects[0].id;
        values.defendant_name = suspects[0].full_name;
      }
    }
    form.setFieldsValue(values);
  };

  const closeModal = () => {
    setModalType(null);
    form.resetFields();
  };

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
  const canIssueJudgment = canJudgeForms && ['in_trial', 'hearing_scheduled', 'awaiting_hearing'].includes(courtCase?.status);
  const canIssueSentence = canJudgeForms && courtCase?.status === 'judgment_issued';

  const metrics = [
    { title: 'Total court cases', value: stats.total_court_cases || 0, icon: <BankOutlined /> },
    { title: 'Pending decision', value: stats.pending_cases || 0, icon: <FileTextOutlined /> },
    { title: 'Active hearings', value: stats.active_hearings || 0, icon: <CalendarOutlined /> },
    { title: 'Completed', value: stats.completed_cases || 0, icon: <FileDoneOutlined /> },
    { title: 'Convicted', value: stats.convicted_cases || 0, icon: <AuditOutlined /> },
    { title: 'Acquitted', value: stats.acquitted_cases || 0, icon: <CheckCircleOutlined /> },
  ];

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Court administration</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Court dashboard
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Hearings calendar, case status progress, and judge judgment/sentence actions.
            </Text>
          </div>
          <Space wrap>
            <Link href="/dashboard/court/cases">
              <Button type="primary" icon={<BankOutlined />}>Court cases</Button>
            </Link>
            <Button onClick={() => loadDashboard(calendarFilters)}>Refresh</Button>
          </Space>
        </div>

        {notifications.length > 0 && (
          <Row gutter={[16, 16]}>
            {notifications.slice(0, 4).map((item, index) => (
              <Col xs={24} md={12} key={`${item.type}-${item.court_case_id}-${index}`}>
                <Alert
                  showIcon
                  type={item.type === 'new_case' ? 'info' : 'warning'}
                  title={<Text strong>{item.title}</Text>}
                  description={
                    <Space orientation="vertical" size={2}>
                      <Text>{item.message}</Text>
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => loadCaseDetail(item.court_case_id)}>
                        Open case
                      </Button>
                    </Space>
                  }
                />
              </Col>
            ))}
          </Row>
        )}

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} xl={8} key={metric.title}>
              <Card variant="none" className="standard-metric-card">
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value} loading={loading} />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card variant="none" className="standard-panel" title="Cases by status">
              {(dashboard?.byStatus || []).length ? (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {dashboard.byStatus.map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Text>{statusMeta[row.label]?.label || String(row.label).replaceAll('_', ' ')}</Text>
                      <Tag className="status-tag status-tag--neutral">{row.value}</Tag>
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty description="No status data yet" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card
              variant="none"
              className="standard-panel"
              title="Hearings list"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{calendarItems.length} scheduled</Text>}
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
                disabled={!canIssueJudgment && courtCase.status !== 'in_trial'}
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
                    <Button type="primary" onClick={() => openModal('judgment', { decision_date: dayjs(), decision_type: 'convicted' })}>
                      Record judgment
                    </Button>
                    <Button
                      disabled={courtCase.status !== 'judgment_issued'}
                      onClick={() => openModal('sentence', { sentence_date: dayjs(), sentence_type: 'imprisonment' })}
                    >
                      Issue sentence
                    </Button>
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
      </Space>
    </ProtectedRoute>
  );
}
