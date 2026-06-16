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
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const { TextArea } = Input;

const cidRoles = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];
const supervisorRoles = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'prosecutor_liaison'];

const statusMeta = {
  open: { label: 'Open', color: 'blue' },
  under_investigation: { label: 'Under Investigation', color: 'processing' },
  evidence_collection: { label: 'Evidence Collection', color: 'purple' },
  witness_interviews: { label: 'Witness Interviews', color: 'cyan' },
  suspect_tracking: { label: 'Suspect Tracking', color: 'gold' },
  arrest_made: { label: 'Arrest Made', color: 'volcano' },
  investigation_completed: { label: 'Investigation Completed', color: 'green' },
  supervisor_review: { label: 'Supervisor Review', color: 'magenta' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  sent_to_prosecutor: { label: 'Sent to Prosecutor', color: 'geekblue' },
  sent_to_court: { label: 'Sent to Court', color: 'green' },
};

const assignmentMeta = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  reassigned: 'Reassigned',
  rejected: 'Rejected',
};

const safe = (value) => value || 'N/A';
const statusTag = (value) => <Tag color={statusMeta[value]?.color || 'default'}>{statusMeta[value]?.label || safe(value)}</Tag>;

export default function CIDDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
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
      setDashboard(dashboardRes.data.data);
      setCases(casesRes.data.data || []);
      setAlerts(notificationsRes.data.data || []);
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
      const detail = response.data.data;
      if (detail?.cidCase?.assignment_status === 'assigned') {
        await api.patch(`/cid/cases/${cidCaseId}/acknowledge`);
        detail.cidCase.assignment_status = 'accepted';
        setAlerts((current) => current.filter((item) => item.cid_case_id !== cidCaseId));
        setCases((current) => current.map((item) => item.id === cidCaseId ? { ...item, assignment_status: 'accepted' } : item));
      }
      setSelected(detail);
      setDrawerOpen(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load CID case.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  const openAlertCase = async (item) => {
    await loadDashboard(filters);
    if (item.cid_case_id) await loadDetail(item.cid_case_id);
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
    { title: 'Total CID Cases', value: stats.total_cid_cases, icon: <FileSearchOutlined /> },
    { title: 'Active Investigations', value: stats.active_investigations, icon: <AuditOutlined /> },
    { title: 'Pending Review', value: stats.pending_investigations, icon: <WarningOutlined /> },
    { title: 'Completed', value: stats.completed_investigations, icon: <CheckCircleOutlined /> },
    { title: 'Evidence Collected', value: stats.evidence_collected, icon: <FileProtectOutlined /> },
    { title: 'Suspects Identified', value: stats.suspects_identified, icon: <TeamOutlined /> },
    { title: 'Arrested Suspects', value: stats.arrested_suspects, icon: <UserSwitchOutlined /> },
    { title: 'Sent to Prosecutor', value: stats.cases_sent_to_prosecutor, icon: <SendOutlined /> },
  ];

  const chartRows = useMemo(() => [
    { title: 'Investigation Status Distribution', rows: dashboard?.byStatus || [] },
    { title: 'Cases by Crime Type', rows: dashboard?.byCrime || [] },
    { title: 'Officer Performance', rows: dashboard?.officers || [] },
  ], [dashboard]);

  const columns = [
    { title: 'Case #', dataIndex: 'case_number', render: (value, row) => <Button type="link" onClick={() => loadDetail(row.id)}>{value}</Button> },
    { title: 'OB #', dataIndex: 'ob_number' },
    { title: 'Title', dataIndex: 'case_title', ellipsis: true },
    { title: 'Crime', dataIndex: 'crime_category' },
    { title: 'Priority', dataIndex: 'priority', render: (v) => <Tag>{safe(v).toUpperCase()}</Tag> },
    { title: 'Officer', dataIndex: 'assigned_officer', render: safe },
    { title: 'Assignment', dataIndex: 'assignment_status', render: (v) => <Tag>{assignmentMeta[v] || safe(v)}</Tag> },
    { title: 'Investigation', dataIndex: 'investigation_status', render: statusTag },
    { title: 'Assigned', dataIndex: 'assigned_date', render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : 'N/A' },
  ];

  const cidCase = selected?.cidCase;

  return (
    <ProtectedRoute allowedRoles={cidRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Criminal Investigation Department</Text>
            <Title level={2}>CID Investigation Dashboard</Title>
            <Text type="secondary">Only cases assigned or referred to CID appear here.</Text>
          </div>
          <Button type="primary" onClick={() => loadDashboard(filters)}>Refresh CID Queue</Button>
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

        <Card variant="none" className="standard-panel" title="CID Search & Filters">
          <Form form={filterForm} layout="vertical" onFinish={applyFilters}>
            <Row gutter={12}>
              <Col xs={24} md={6}><Form.Item name="search" label="Case / OB / Complainant"><Input /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="officer" label="Assigned Officer"><Input /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="priority" label="Priority"><Select allowClear options={['low','medium','high','critical'].map((value) => ({ value, label: value.toUpperCase() }))} /></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item name="status" label="Investigation Status"><Select allowClear options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_range" label="Assigned Date Range"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
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

        <Card variant="none" className="standard-panel" title="CID Case Queue">
          <Table columns={columns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1200 }} />
        </Card>

        <Drawer
          title={cidCase ? `${cidCase.case_number} - ${cidCase.case_title}` : 'CID Case'}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size="large"
          extra={cidCase && (
            <Space wrap>
              {canSupervise && <Button onClick={() => openModal('assign', { assigned_officer: cidCase.assigned_officer, supervisor: cidCase.supervisor })}>Assign</Button>}
              <Button type="primary" onClick={() => openModal('investigation')}>Update Investigation</Button>
              <Button onClick={() => openModal('scene')}>Crime Scene</Button>
              <Button onClick={() => openModal('report')}>Submit Report</Button>
              {canSupervise && <Button onClick={() => openModal('review')}>Supervisor Review</Button>}
              {canSupervise && <Button icon={<SendOutlined />} onClick={() => openModal('prosecutor')}>Forward Prosecutor</Button>}
            </Space>
          )}
        >
          {cidCase ? (
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: 'Overview',
                  children: <Descriptions bordered column={2}>
                    <Descriptions.Item label="Case Number">{cidCase.case_number}</Descriptions.Item>
                    <Descriptions.Item label="OB Number">{cidCase.ob_number}</Descriptions.Item>
                    <Descriptions.Item label="Crime Category">{cidCase.crime_category}</Descriptions.Item>
                    <Descriptions.Item label="Priority">{safe(cidCase.priority).toUpperCase()}</Descriptions.Item>
                    <Descriptions.Item label="Assigned Officer">{safe(cidCase.assigned_officer)}</Descriptions.Item>
                    <Descriptions.Item label="Supervisor">{safe(cidCase.supervisor)}</Descriptions.Item>
                    <Descriptions.Item label="Assignment">{assignmentMeta[cidCase.assignment_status] || safe(cidCase.assignment_status)}</Descriptions.Item>
                    <Descriptions.Item label="Investigation">{statusTag(cidCase.investigation_status)}</Descriptions.Item>
                    <Descriptions.Item label="Complainant">{safe(cidCase.complainant_name)}</Descriptions.Item>
                    <Descriptions.Item label="Phone">{safe(cidCase.complainant_phone)}</Descriptions.Item>
                    <Descriptions.Item label="Incident Location" span={2}>{safe(cidCase.incident_location)}</Descriptions.Item>
                    <Descriptions.Item label="Description" span={2}>{safe(cidCase.description)}</Descriptions.Item>
                  </Descriptions>,
                },
                {
                  key: 'timeline',
                  label: `Progress (${selected.progress.length})`,
                  children: selected.progress.length ? <Timeline items={selected.progress.map((item) => ({
                    children: <Space direction="vertical" size={2}><Text strong>{statusMeta[item.status]?.label || item.status || 'Progress'}</Text><Text>{item.note}</Text><Text type="secondary">{safe(item.created_by)} - {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</Text></Space>,
                  }))} /> : <Empty description="No progress notes yet" />,
                },
                {
                  key: 'evidence',
                  label: `Evidence (${selected.evidence.length})`,
                  children: <Table rowKey="id" dataSource={selected.evidence} columns={[
                    { title: 'Evidence #', dataIndex: 'evidence_number' },
                    { title: 'Title', dataIndex: 'title' },
                    { title: 'Type', dataIndex: 'type' },
                    { title: 'Collected By', dataIndex: 'collected_by', render: safe },
                    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{safe(v)}</Tag> },
                    { title: 'File', dataIndex: 'file_url', render: (url) => url ? <Button size="small" href={`http://localhost:5001${url}`} target="_blank">Download</Button> : 'N/A' },
                  ]} />,
                },
                {
                  key: 'custody',
                  label: `Custody (${selected.custody.length})`,
                  children: <Table rowKey="id" dataSource={selected.custody} columns={[
                    { title: 'Evidence', dataIndex: 'evidence_number' },
                    { title: 'From', dataIndex: 'transferred_from', render: safe },
                    { title: 'To', dataIndex: 'transferred_to' },
                    { title: 'Location', dataIndex: 'location', render: safe },
                    { title: 'Date', dataIndex: 'transfer_date', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
                  ]} />,
                },
                {
                  key: 'people',
                  label: 'Witnesses & Suspects',
                  children: <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}><Card title="Witnesses" variant="none"><Table rowKey="id" dataSource={selected.witnesses} pagination={false} columns={[{ title: 'Name', dataIndex: 'full_name' }, { title: 'Phone', dataIndex: 'phone', render: safe }, { title: 'Statement', dataIndex: 'statement', ellipsis: true }]} /></Card></Col>
                    <Col xs={24} lg={12}><Card title="Suspects" variant="none"><Table rowKey="id" dataSource={selected.suspects} pagination={false} columns={[{ title: 'Name', dataIndex: 'full_name' }, { title: 'Phone', dataIndex: 'phone', render: safe }, { title: 'Status', dataIndex: 'case_status', render: (v) => <Tag>{safe(v)}</Tag> }]} /></Card></Col>
                  </Row>,
                },
                {
                  key: 'arrests',
                  label: `Arrests (${selected.arrests.length})`,
                  children: <Table rowKey="id" dataSource={selected.arrests} columns={[
                    { title: 'Suspect', dataIndex: 'suspect_name' },
                    { title: 'Date', dataIndex: 'arrest_date', render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : 'N/A' },
                    { title: 'Location', dataIndex: 'arrest_location', render: safe },
                    { title: 'Officer', dataIndex: 'arrested_by', render: safe },
                    { title: 'Status', dataIndex: 'sentence_status', render: (v) => <Tag>{safe(v)}</Tag> },
                  ]} />,
                },
                {
                  key: 'scenes',
                  label: `Crime Scenes (${selected.crimeScenes.length})`,
                  children: <Table rowKey="id" dataSource={selected.crimeScenes} columns={[
                    { title: 'Location', dataIndex: 'location' },
                    { title: 'Date Visited', dataIndex: 'date_visited' },
                    { title: 'Officer', dataIndex: 'officer', render: safe },
                    { title: 'Observations', dataIndex: 'observations', ellipsis: true },
                    { title: 'Evidence', dataIndex: 'collected_evidence', ellipsis: true },
                  ]} />,
                },
                {
                  key: 'reports',
                  label: `Reports (${selected.reports.length})`,
                  children: <Table rowKey="id" dataSource={selected.reports} columns={[
                    { title: 'Title', dataIndex: 'report_title' },
                    { title: 'Submitted By', dataIndex: 'submitted_by' },
                    { title: 'Submitted', dataIndex: 'submitted_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                    { title: 'Findings', dataIndex: 'findings', ellipsis: true },
                    { title: 'Recommendations', dataIndex: 'recommendations', ellipsis: true },
                  ]} />,
                },
                {
                  key: 'audit',
                  label: `Audit (${selected.auditTrail.length})`,
                  children: <Table rowKey={(row) => `${row.entity_type}-${row.entity_id}-${row.created_at}-${row.action}`} dataSource={selected.auditTrail} columns={[
                    { title: 'User', dataIndex: 'performed_by', render: safe },
                    { title: 'Action', dataIndex: 'action', render: (v) => v?.replaceAll('_', ' ') },
                    { title: 'Date/Time', dataIndex: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                    { title: 'Previous', dataIndex: 'previous_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                    { title: 'New', dataIndex: 'new_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                  ]} />,
                },
              ]}
            />
          ) : <Empty />}
        </Drawer>

        <Modal title={modalType?.replaceAll('_', ' ').toUpperCase() || 'CID Action'} open={Boolean(modalType)} onCancel={closeModal} onOk={() => form.submit()} destroyOnHidden forceRender width={760}>
          <Form form={form} layout="vertical" onFinish={submitModal}>
            {modalType === 'assign' && <Row gutter={16}><Col span={12}><Form.Item name="assigned_officer" label="Assigned Officer"><Input /></Form.Item></Col><Col span={12}><Form.Item name="supervisor" label="Supervisor"><Input /></Form.Item></Col></Row>}
            {modalType === 'investigation' && <>
              <Form.Item name="investigation_status" label="Investigation Status"><Select options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item>
              <Form.Item name="progress_note" label="Progress Note"><TextArea rows={3} /></Form.Item>
              <Form.Item name="findings" label="Findings"><TextArea rows={3} /></Form.Item>
              <Form.Item name="recommendations" label="Recommendations"><TextArea rows={3} /></Form.Item>
            </>}
            {modalType === 'scene' && <>
              <Form.Item name="location" label="Crime Scene Location" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="date_visited" label="Date Visited"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="observations" label="Observations"><TextArea rows={3} /></Form.Item>
              <Form.Item name="scene_photos" label="Scene Photos / File Notes"><TextArea rows={2} /></Form.Item>
              <Form.Item name="collected_evidence" label="Collected Evidence"><TextArea rows={2} /></Form.Item>
            </>}
            {modalType === 'report' && <>
              <Form.Item name="report_title" label="Report Title" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="case_summary" label="Case Summary"><TextArea rows={2} /></Form.Item>
              <Form.Item name="activities" label="Investigation Activities"><TextArea rows={2} /></Form.Item>
              <Form.Item name="evidence_summary" label="Evidence Summary"><TextArea rows={2} /></Form.Item>
              <Form.Item name="witness_summary" label="Witness Summary"><TextArea rows={2} /></Form.Item>
              <Form.Item name="suspect_analysis" label="Suspect Analysis"><TextArea rows={2} /></Form.Item>
              <Form.Item name="findings" label="Findings" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
              <Form.Item name="recommendations" label="Recommendations"><TextArea rows={3} /></Form.Item>
            </>}
            {modalType === 'review' && <>
              <Form.Item name="decision" label="Decision" rules={[{ required: true }]}><Select options={[
                { value: 'approved', label: 'Approve Investigation' },
                { value: 'rejected', label: 'Reject Investigation' },
                { value: 'additional_investigation', label: 'Additional Investigation Required' },
                { value: 'returned', label: 'Return to Officer' },
              ]} /></Form.Item>
              <Form.Item name="notes" label="Supervisor Notes"><TextArea rows={4} /></Form.Item>
            </>}
            {modalType === 'prosecutor' && <Form.Item name="notes" label="Forwarding Notes"><TextArea rows={4} /></Form.Item>}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
