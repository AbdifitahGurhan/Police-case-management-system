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
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
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
  EllipsisOutlined,
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
import CaseStatusStepper from '@/components/shared/CaseStatusStepper';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';
import { formatUSD } from '@/utils/currency';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const { TextArea } = Input;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  registered: { label: 'Cusub', tone: 'open' },
  awaiting_hearing: { label: 'Sugaya Dhegeysi', tone: 'pending' },
  hearing_scheduled: { label: 'Dhegeysi Qorsheysan', tone: 'open' },
  in_trial: { label: 'Maxkamadayn Socota', tone: 'pending' },
  judgment_issued: { label: "Go'aan La Soo Saaray", tone: 'open' },
  sentenced: { label: 'Xukun La Riday', tone: 'warning' },
  appealed: { label: 'Racfaan La Qaatay', tone: 'critical' },
  closed: { label: 'La Xiray', tone: 'closed' },
  archived: { label: 'Kaydsan', tone: 'neutral' },
};

const decisionColor = { convicted: 'red', acquitted: 'green', dismissed: 'default' };

const roleConfig = {
  admin: { title: 'Maamulka Sare - Maxkamadda', actions: ['assign', 'hearing', 'hearing_manage', 'proceeding', 'witness', 'judgment', 'sentence', 'appeal', 'appeal_decision', 'close', 'documents'] },
  court: { title: 'Maamulka Guud ee Maxkamadda', actions: ['assign', 'hearing', 'hearing_manage', 'proceeding', 'witness', 'judgment', 'sentence', 'appeal', 'appeal_decision', 'close', 'documents'] },
  court_admin: { title: 'Maamulaha Maxkamadda', actions: ['assign', 'hearing', 'hearing_manage', 'proceeding', 'witness', 'appeal_decision', 'close', 'documents'] },
  judge: { title: 'Dashboard-ka Garsooraha', actions: ['hearing_manage', 'proceeding', 'witness', 'judgment', 'sentence', 'appeal_decision', 'documents'] },
  prosecutor: { title: 'Dashboard-ka Xeer-ilaaliyaha', actions: ['appeal', 'documents'] },
  prosecutor_liaison: { title: 'Xiriiriyaha Xeer-ilaalinta', actions: ['appeal', 'documents'] },
  court_clerk: { title: 'Kaaliyaha Maxkamadda', actions: ['hearing', 'hearing_manage', 'proceeding', 'witness', 'documents'] },
};

const statusTag = (status) => {
  const meta = statusMeta[status] || { label: status?.replaceAll('_', ' ') || 'Unknown', tone: 'neutral' };
  return <Tag className={`status-tag status-tag--${meta.tone}`}>{meta.label}</Tag>;
};

const safe = (value) => value || 'N/A';
const formatDate = (value) => {
  if (!value) return null;
  return dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : dayjs(value).format('YYYY-MM-DD');
};

export default function CourtCasesPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [activeHearing, setActiveHearing] = useState(null);
  const [filters, setFilters] = useState({});
  const [courtPersonnel, setCourtPersonnel] = useState({ judges: [], prosecutors: [] });
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const role = user?.role || 'court';
  const config = roleConfig[role] || roleConfig.court;
  const can = (action) => config.actions.includes(action);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const loadCases = useCallback(async (nextFilters = {}) => {
    setLoading(true);
    try {
      const casesRes = await api.get('/court/cases', { params: { limit: 50, ...nextFilters } });
      setCases(casesRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro kiisaska.');
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
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro faahfaahinta kiiska.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadCases(filters);
    const timer = setInterval(() => loadCases(filters), 30000);
    return () => clearInterval(timer);
  }, [filters, loadCases]);

  useEffect(() => {
    const loadCourtPersonnel = async () => {
      try {
        const response = await api.get('/court/personnel');
        setCourtPersonnel(response.data.data || { judges: [], prosecutors: [] });
      } catch (error) {
        message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro shaqaalaha maxkamadda.');
      }
    };
    loadCourtPersonnel();
  }, [message]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const caseId = params.get('id');
      if (caseId) {
        loadDetail(caseId);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [loadDetail]);

  const openModal = (type, initial = {}) => {
    setModalType(type);
    const hearing = initial.hearing
      || (type === 'proceeding' ? selected?.hearings?.[0] : null);
    setActiveHearing(hearing || null);
    form.resetFields();

    const values = initial.values || {};
    if (type === 'sentence') {
      const suspects = selected?.suspects || [];
      if (suspects.length === 1) {
        values.criminal_id = suspects[0].id;
        values.defendant_name = suspects[0].full_name;
      }
    }
    if (type === 'hearing_update' && initial.hearing) {
      values.hearing_date = initial.hearing.hearing_date ? dayjs(initial.hearing.hearing_date) : null;
      values.hearing_time = initial.hearing.hearing_time ? dayjs(initial.hearing.hearing_time, 'HH:mm:ss') : null;
      values.court_room = initial.hearing.court_room;
      values.assigned_judge = initial.hearing.assigned_judge;
      values.status = initial.hearing.status;
    }

    form.setFieldsValue(values);
  };

  const closeModal = () => {
    setModalType(null);
    setActiveHearing(null);
    form.resetFields();
  };

  const refreshAfterAction = async () => {
    const id = selected?.courtCase?.id;
    await loadCases(filters);
    if (id) await loadDetail(id);
  };

  const submitModal = async (values) => {
    try {
      const id = selected?.courtCase?.id;
      if (modalType === 'assign') await api.patch(`/court/cases/${id}/assign`, values);
      if (modalType === 'hearing') {
        await api.post(`/court/cases/${id}/hearings`, {
          ...values,
          hearing_date: formatDate(values.hearing_date),
          hearing_time: dayjs.isDayjs(values.hearing_time)
            ? values.hearing_time.format('HH:mm:ss')
            : dayjs(values.hearing_time).format('HH:mm:ss'),
        });
      }
      if (modalType === 'proceeding') {
        if (!activeHearing?.id) {
          throw new Error('Ma jiro dhegeysi la doortay. Fadlan marka hore qorshee ama ka dooro dhegeysi jadwalka.');
        }
        await api.post(`/court/hearings/${activeHearing.id}/proceedings`, values);
      }
      if (modalType === 'hearing_update') {
        if (!activeHearing?.id) throw new Error('Ma jiro dhegeysi la doortay.');
        await api.patch(`/court/hearings/${activeHearing.id}`, {
          ...values,
          hearing_date: formatDate(values.hearing_date),
          hearing_time: values.hearing_time ? dayjs(values.hearing_time).format('HH:mm:ss') : null,
        });
      }
      if (modalType === 'witness') {
        await api.patch(`/court/cases/${id}/witnesses/${values.witness_id}`, values);
      }
      if (modalType === 'appeal_decision') {
        await api.patch(`/court/appeals/${values.appeal_id}/decision`, { status: values.status });
      }
      if (modalType === 'judgment') {
        await api.post(`/court/cases/${id}/judgments`, {
          ...values,
          decision_date: formatDate(values.decision_date),
        });
      }
      if (modalType === 'sentence') {
        const hasDuration = Boolean(String(values.duration || '').trim());
        const hasFine = Number(values.fine_amount) > 0;
        const sentenceType = hasDuration && hasFine ? 'both' : values.sentence_type;
        await api.post(`/court/cases/${id}/sentences`, {
          ...values,
          sentence_type: sentenceType,
          sentence_date: formatDate(values.sentence_date),
        }, {
          skipErrorNotification: true,
        });
      }
      if (modalType === 'appeal') {
        await api.post(`/court/cases/${id}/appeals`, {
          ...values,
          filing_date: formatDate(values.filing_date),
        });
      }
      if (modalType === 'close') await api.patch(`/court/cases/${id}/close`, values);
      message.success('Diiwaanka maxkamadda waa la cusbooneysiiyey.');
      closeModal();
      await refreshAfterAction();
    } catch (error) {
      message.error(
        error.response?.data?.message
        || error.message
        || 'Ficilka maxkamaddu waa ku guuldareystay.'
      );
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
    await loadCases(next);
  };

  const printCourtDocument = (type) => {
    if (!selected?.courtCase) return;
    const cc = selected.courtCase;
    const latestHearing = selected.hearings?.[0];
    const latestJudgment = selected.judgments?.[0];
    const latestSentence = selected.sentences?.[0];
    const latestAppeal = selected.appeals?.[0];
    const titles = {
      summons: 'Summons (U-yeerid Maxkamadeed)',
      hearing_notice: 'Ogeysiiska Dhegeysiga',
      judgment_order: 'Go\'aanka Maxkamadda',
      sentence_order: 'Warqadda Xukunka',
      appeal_receipt: 'Rasiidhka Racfaanka',
      closure_certificate: 'Shahaadada Xiritaanka',
    };
    const rows = [
      ['Lambarka Kiiska Maxkamadda', cc.court_case_number],
      ['Lambarka Kiiska Booliska', cc.police_case_number],
      ['Lambarka Diiwaanka (OB #)', cc.ob_number],
      ['Cinwaanka Kiiska', cc.case_title],
      ['Garsooraha loo Xilsaaray', cc.assigned_judge],
      ['Xeer-ilaaliyaha loo Xilsaaray', cc.assigned_prosecutor],
      ['Heerka (Status)', statusMeta[cc.status]?.label || cc.status],
      ['Dhegeysiga', latestHearing ? `${latestHearing.hearing_date} ${latestHearing.hearing_time || ''} - ${safe(latestHearing.court_room)}` : 'Ma jiraan dhageysi loo qorsheeyay'],
      ['Go\'aanka', latestJudgment ? `${latestJudgment.decision_type}: ${latestJudgment.judgment_summary}` : 'Sugaya'],
      ['Xukunka', latestSentence ? `${latestSentence.sentence_type} ${latestSentence.duration || ''}` : 'Sugaya'],
      ['Racfaanka', latestAppeal ? `${latestAppeal.filed_by}: ${latestAppeal.appeal_reason}` : 'Ma jiraan racfaan la diiwaangeliyey'],
    ];
    const html = `
      <html><head><title>${titles[type]}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:36px;color:#111827}
        h1{font-size:24px;margin-bottom:4px} h2{font-size:16px;color:#4b5563;margin-top:0}
        table{width:100%;border-collapse:collapse;margin-top:24px}td{border:1px solid #d1d5db;padding:10px;vertical-align:top}
        td:first-child{width:220px;font-weight:700;background:#f3f4f6}.sign{margin-top:56px;display:flex;justify-content:space-between}
      </style></head><body>
      <h1>${titles[type]}</h1><h2>Waaxda Booliska Gobolka - Qaybta Maamulka Maxkamadda</h2>
      <table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${safe(value)}</td></tr>`).join('')}</table>
      <div class="sign"><span>Loo diyaariyey: ${safe(user?.fullName || user?.username)}</span><span>Taariikhda: ${dayjs().format('YYYY-MM-DD HH:mm')}</span></div>
      </body></html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const caseColumns = [
    { title: 'Kiiska Maxkamadda #', dataIndex: 'court_case_number', render: (value, row) => <Button type="link" onClick={() => loadDetail(row.id)}>{value}</Button> },
    { title: 'Kiiska Booliska #', dataIndex: 'police_case_number' },
    { title: 'OB #', dataIndex: 'ob_number' },
    { title: 'Cinwaanka', dataIndex: 'case_title', ellipsis: true },
    { title: 'Dhibanaha (Complainant)', dataIndex: 'complainant_name', render: safe },
    { title: 'Garsooraha', dataIndex: 'assigned_judge', render: (value) => value || <Text type="secondary">Aan la xilsaarin</Text> },
    { title: 'Heerka', dataIndex: 'status', render: statusTag },
    { title: 'Natiijada', dataIndex: 'final_outcome', render: (value) => value ? <Tag color={decisionColor[value]}>{value === 'convicted' ? 'XUKUN LA RIDAY' : value === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag> : <Text type="secondary">Sugaya</Text> },
  ];

  const courtCase = selected?.courtCase;

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Diiwaanka Maxkamadaha</Text>
            <Title level={2}>Kiisaska Maxkamadda (Court Cases)</Title>
            <Text type="secondary">Maamul kiisaska, dhageysiyada, go&apos;aannada iyo xukunada maxkamadda.</Text>
          </div>
          <Space wrap>
            {role === 'admin' && <Button icon={<AuditOutlined style={{ width: 16 }} />} href="/reports">Warbixinada</Button>}
            <Button type="primary" icon={<Scale style={{ width: 16 }} />} onClick={() => loadCases(filters)}>Cusbooneysii</Button>
          </Space>
        </div>

        <Card variant="none" className="standard-panel" title="Baaritaan Dheeraad Ah">
          <Form form={searchForm} layout="vertical" onFinish={applySearch}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="court_case_number" label="Lambarka Kiiska Maxkamadda"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="police_case_number" label="Lambarka Kiiska Booliska"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="ob_number" label="Lambarka Diiwaanka (OB #)"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="suspect_name" label="Magaca Eedaysanaha"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="complainant_name" label="Magaca Dhibanaha (Complainant)"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="judge" label="Garsooraha"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="Heerka (Status)"><Select allowClear options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_range" label="Muddada Diiwaangelinta"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item label=" ">
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>Baar</Button>
                    <Button onClick={() => { searchForm.resetFields(); setFilters({}); loadCases({}); }}>Dib u Deji</Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card variant="none" className="standard-panel" title="Diiwaanka Kiisaska Maxkamadda">
          <Table columns={caseColumns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1250 }} />
        </Card>

        <Modal
          title={
            <span style={{ fontWeight: 600, fontSize: 15, color: isDark ? '#FFFFFF' : '#0F172A' }}>
              Faahfaahinta Kiiska Maxkamadda
            </span>
          }
          open={detailOpen}
          onCancel={() => setDetailOpen(false)}
          footer={null}
          width={1100}
          centered
          destroyOnHidden
          styles={{
            header: {
              borderBottom: `1px solid ${isDark ? '#2B2B2B' : '#e5e7eb'}`,
              padding: '14px 24px',
              background: isDark ? '#171717' : '#ffffff',
            },
            body: {
              maxHeight: 'calc(100vh - 150px)',
              padding: 24,
              background: isDark ? '#171717' : '#f8fafc',
              overflow: 'auto',
            },
          }}
        >
          {courtCase ? (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>

              {/* ── Case Identity Block ────────────────────────────────── */}
              <div style={{
                background: isDark ? '#1C1C1C' : '#ffffff',
                padding: '16px 20px 20px',
                borderRadius: 10,
                border: `1px solid ${isDark ? '#2B2B2B' : '#e2e8f0'}`,
              }}>
                <Text style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#707070', display: 'block', marginBottom: 6,
                }}>
                  FAYLKA KIISKA EE FIRFIRCOON
                </Text>
                <Title level={4} style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 500, color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {courtCase.court_case_number}
                </Title>
                <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                  {statusTag(courtCase.status)}
                  {courtCase.final_outcome && (
                    <Tag color={decisionColor[courtCase.final_outcome]}>
                      {courtCase.final_outcome === 'convicted' ? 'XUKUN LA RIDAY' : courtCase.final_outcome === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}
                    </Tag>
                  )}
                </Space>
                <Text style={{ display: 'block', fontSize: 13, color: '#A5A5A5', marginBottom: 18 }}>
                  {courtCase.case_title}
                </Text>
                <CaseStatusStepper status={courtCase.status} flow="court" />
              </div>

              {/* ── Action Buttons (Two-Tier) ──────────────────────────── */}
              {(() => {
                const s = courtCase.status;
                const canRecordJudgment = can('judgment') && ['hearing_scheduled', 'in_trial'].includes(s);
                const primaryAction = (() => {
                  if (['registered', 'awaiting_hearing'].includes(s) && can('hearing'))
                    return { label: 'Qorshee Dhegeysi', action: 'hearing' };
                  if (['hearing_scheduled', 'in_trial'].includes(s) && can('proceeding'))
                    return { label: 'Ku dar Qoraalka', action: 'proceeding' };
                  if (s === 'judgment_issued' && courtCase.final_outcome === 'convicted' && can('sentence'))
                    return { label: 'Xukun rid', action: 'sentence' };
                  return null;
                })();

                const overflowItems = [
                  can('judgment') && !canRecordJudgment ? {
                    key: 'judgment',
                    label: "Duubaa Go'aanka Maxkamadda",
                    onClick: () => openModal('judgment'),
                  } : null,
                  can('appeal') ? {
                    key: 'appeal',
                    label: 'Duubaa Racfaanka',
                    onClick: () => openModal('appeal'),
                  } : null,
                ].filter(Boolean);

                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {primaryAction && (
                      <Button
                        type="primary"
                        onClick={() => openModal(primaryAction.action)}
                        style={{ fontWeight: 600 }}
                      >
                        {primaryAction.label}
                      </Button>
                    )}
                    {canRecordJudgment && (
                      <Button
                        type="primary"
                        icon={<FileDoneOutlined />}
                        onClick={() => openModal('judgment')}
                        style={{ fontWeight: 600 }}
                      >
                        Go&apos;aan ka gaar
                      </Button>
                    )}
                    {can('assign') && (
                      <Button onClick={() => openModal('assign', {
                        values: {
                          assigned_judge: courtCase.assigned_judge,
                          assigned_prosecutor: courtCase.assigned_prosecutor,
                        },
                      })}>
                        U Xilsaar
                      </Button>
                    )}
                    {can('close') && (
                      <Button danger onClick={() => openModal('close')}>
                        Xir Kiiska
                      </Button>
                    )}
                    {overflowItems.length > 0 && (
                      <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
                        <Button icon={<EllipsisOutlined />}>Falal dheeraad ah</Button>
                      </Dropdown>
                    )}
                  </div>
                );
              })()}

              {/* ── Court Documents Grid ───────────────────────────────── */}
              {can('documents') && (
                <div>
                  <Text style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#707070', display: 'block', marginBottom: 10,
                  }}>
                    DUKUMENTIYADA MAXKAMADDA
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['summons', 'Yeerid Maxkamadeed'],
                      ['hearing_notice', 'Ogeysiiska Dhegeysiga'],
                      ['judgment_order', "Go'aanka (PDF)"],
                      ['sentence_order', 'Amar Xukun (PDF)'],
                      ['appeal_receipt', 'Rasiidhka Racfaanka'],
                      ['closure_certificate', 'Shahaadada Xiritaanka'],
                    ].map(([type, label]) => (
                      <Button
                        key={type}
                        icon={<PrinterOutlined />}
                        onClick={() => printCourtDocument(type)}
                        style={{
                          background: isDark ? '#1C1C1C' : '#ffffff',
                          border: `1px solid ${isDark ? '#2B2B2B' : '#e5e7eb'}`,
                          color: isDark ? '#A5A5A5' : '#475569',
                          textAlign: 'left',
                          height: 38,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 8,
                          borderRadius: 8,
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Tabs: Court Activity / Overview / Evidence / Audit ─── */}
              <Tabs
                defaultActiveKey="court_activity"
                items={[
                  {
                    key: 'court_activity',
                    label: 'Hawlaha Maxkamadda',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Card title="Dhegeysiyada Maxkamadda (Hearings)" size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.hearings}
                            pagination={false}
                            columns={[
                              { title: 'Nooca', dataIndex: 'hearing_type' },
                              { title: 'Taariikhda', dataIndex: 'hearing_date' },
                              { title: 'Saacadda', dataIndex: 'hearing_time' },
                              { title: 'Qolka Maxkamadda', dataIndex: 'court_room', render: safe },
                              { title: 'Garsooraha', dataIndex: 'assigned_judge', render: safe },
                              { title: 'Heerka', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                              {
                                title: 'Ficil',
                                render: (_, row) => (
                                  <Space>
                                    {can('proceeding') && <Button size="small" onClick={() => openModal('proceeding', { hearing: row })}>Ku dar Qoraalka</Button>}
                                    {can('hearing_manage') && <Button size="small" onClick={() => openModal('hearing_update', { hearing: row })}>Maamul</Button>}
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Card>

                        <Card title="Qoraallada Fadhiyada Maxkamadda (Proceedings)" size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.proceedings}
                            pagination={false}
                            columns={[
                              { title: 'Taariikhda', dataIndex: 'proceeding_date' },
                              { title: 'Dhegeysiga', dataIndex: 'hearing_type', render: safe },
                              { title: 'Qoraalka Fadhiga', dataIndex: 'notes', ellipsis: true },
                              { title: 'Hadallada Garsooraha', dataIndex: 'judge_remarks', ellipsis: true },
                              { title: 'Hadallada Xeer-ilaaliyaha', dataIndex: 'prosecutor_remarks', ellipsis: true },
                              { title: 'Hadallada Qareenka Difaaca', dataIndex: 'defense_remarks', ellipsis: true },
                            ]}
                          />
                        </Card>

                        <Card title="Go'aannada, Xukunnada & Racfaannada" size="small">
                          {selected.judgments?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Go&apos;aannada Maxkamadda (Judgments):</Typography.Text>
                              <Table
                                size="small" rowKey="id" dataSource={selected.judgments} pagination={false}
                                columns={[
                                  { title: 'Taariikhda', dataIndex: 'decision_date' },
                                  { title: 'Garsooraha', dataIndex: 'judge_name', render: safe },
                                  { title: "Go'aanka", dataIndex: 'decision_type', render: (v) => <Tag color={decisionColor[v]}>{v === 'convicted' ? 'XUKUN LA RIDAY' : v === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag> },
                                  { title: "Koobsiga Go'aanka", dataIndex: 'judgment_summary', ellipsis: true },
                                ]}
                              />
                            </div>
                          )}
                          {selected.sentences?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Xukunnada La Riday (Sentences):</Typography.Text>
                              <Table
                                size="small" rowKey="id" dataSource={selected.sentences} pagination={false}
                                columns={[
                                  { title: 'Eedaysanaha', dataIndex: 'defendant_name' },
                                  { title: 'Nooca Xukunka', dataIndex: 'sentence_type' },
                                  { title: 'Muddada', dataIndex: 'duration', render: safe },
                                  { title: 'Ganaaxa', dataIndex: 'fine_amount', render: (v) => v === null || v === undefined ? 'N/A' : formatUSD(v) },
                                  { title: 'Taariikhda', dataIndex: 'sentence_date' },
                                ]}
                              />
                            </div>
                          )}
                          {selected.appeals?.length > 0 && (
                            <div>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Racfaannada La Qaatay (Appeals):</Typography.Text>
                              <Table
                                size="small" rowKey="id" dataSource={selected.appeals} pagination={false}
                                columns={[
                                  { title: 'Ciddii Gudbisay', dataIndex: 'filed_by' },
                                  { title: 'Sababta', dataIndex: 'appeal_reason', ellipsis: true },
                                  { title: 'Taariikhda', dataIndex: 'filing_date' },
                                  { title: 'Heerka', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                                  {
                                    title: 'Go’aan',
                                    render: (_, row) => can('appeal_decision') && row.status === 'pending'
                                      ? <Button size="small" onClick={() => openModal('appeal_decision', { values: { appeal_id: row.id } })}>Go’aan ka gaar</Button>
                                      : null,
                                  },
                                ]}
                              />
                            </div>
                          )}
                          {(!selected.judgments?.length && !selected.sentences?.length && !selected.appeals?.length) && (
                            <Empty description="Ma jiraan wax go'aanno, xukunno, ama racfaanno ah oo weli la diiwaangeliyey." />
                          )}
                        </Card>
                      </Space>
                    ),
                  },
                  {
                    key: 'overview',
                    label: 'Guudmar & Faahfaahin',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Descriptions title="Macluumaadka Kiiska & Maxkamadda" bordered column={2}>
                          <Descriptions.Item label="Kiiska Maxkamadda">{courtCase.court_case_number}</Descriptions.Item>
                          <Descriptions.Item label="Kiiska Booliska">
                            {role === 'admin' ? <Link href={`/cases/${courtCase.police_case_id}`}>{courtCase.police_case_number}</Link> : courtCase.police_case_number}
                          </Descriptions.Item>
                          <Descriptions.Item label="OB Number">{courtCase.ob_number}</Descriptions.Item>
                          <Descriptions.Item label="Qaybta Dambiga">{courtCase.crime_category}</Descriptions.Item>
                          <Descriptions.Item label="Garsooraha">{safe(courtCase.assigned_judge)}</Descriptions.Item>
                          <Descriptions.Item label="Xeer-ilaaliyaha">{safe(courtCase.assigned_prosecutor)}</Descriptions.Item>
                          <Descriptions.Item label="Heerka">{statusTag(courtCase.status)}</Descriptions.Item>
                          <Descriptions.Item label="Natiijada">{safe(courtCase.final_outcome)}</Descriptions.Item>
                          <Descriptions.Item label="Sharaxaad" span={2}>{courtCase.case_description || 'Faahfaahin lama diiwaangelin.'}</Descriptions.Item>
                        </Descriptions>
                        <Descriptions title="Faahfaahinta Baarista Booliska" bordered column={2}>
                          <Descriptions.Item label="Dhibanaha (Complainant)">{safe(courtCase.complainant_name)}</Descriptions.Item>
                          <Descriptions.Item label="Telefoonka">{safe(courtCase.complainant_phone)}</Descriptions.Item>
                          <Descriptions.Item label="Goobta Dhacdada">{safe(courtCase.incident_location)}</Descriptions.Item>
                          <Descriptions.Item label="Muhiimadda">{safe(courtCase.priority)}</Descriptions.Item>
                          <Descriptions.Item label="Sarkaalka Baaraha ah">{safe(courtCase.officer_name)}</Descriptions.Item>
                          <Descriptions.Item label="Diiwaanka Xarigga">{selected.arrests?.length || 0}</Descriptions.Item>
                        </Descriptions>
                      </Space>
                    ),
                  },
                  {
                    key: 'police_evidence',
                    label: `Faylka Booliska & Caddeymaha`,
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Card title={`Eedaysanayaasha Kiiska Ku Xiran (Offenders) (${selected.criminals.length})`} size="small">
                          <Table
                            size="small" rowKey="id" dataSource={selected.criminals} pagination={false}
                            columns={[
                              { title: 'Magaca', dataIndex: 'full_name' },
                              { title: 'Telefoonka', dataIndex: 'phone', render: safe },
                              { title: 'Aqoonsiga (National ID)', dataIndex: 'national_id', render: safe },
                              { title: 'Doorka Kiiska', dataIndex: 'role_in_case', render: safe },
                              { title: 'Heerka Xarigga', dataIndex: 'arrest_status', render: (v) => <Tag>{safe(v)}</Tag> },
                            ]}
                          />
                        </Card>
                        <Card title={`Hadallada Markhaatiyaasha (Witnesses) (${selected.witnesses.length})`} size="small">
                          <Table
                            size="small" rowKey="id" dataSource={selected.witnesses} pagination={false}
                            columns={[
                              { title: 'Magaca', dataIndex: 'full_name' },
                              { title: 'Telefoonka', dataIndex: 'phone', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'address', render: safe },
                              { title: 'Heerka Maxkamadda', dataIndex: 'court_status', render: (v) => <Tag>{v || 'pending'}</Tag> },
                              { title: 'Hadalka Markhaatiga', dataIndex: 'statement', ellipsis: true },
                              {
                                title: 'Ficil',
                                render: (_, row) => can('witness')
                                  ? <Button size="small" onClick={() => openModal('witness', { values: { witness_id: row.id, status: row.court_status || 'summoned', testimony: row.testimony } })}>Maamul</Button>
                                  : null,
                              },
                            ]}
                          />
                        </Card>
                        <Card title={`Caddeymaha Kiiska (Evidence) (${selected.evidence.length})`} size="small">
                          <Table
                            size="small" rowKey="id" dataSource={selected.evidence} pagination={false}
                            columns={[
                              { title: 'Lambarka Caddeynta', dataIndex: 'evidence_number', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'title', render: safe },
                              { title: 'Nooca', dataIndex: 'type', render: safe },
                              { title: 'Ciddii Soo Ururisay', dataIndex: 'collected_by', render: safe },
                              { title: 'Faylka', dataIndex: 'file_url', render: (url) => url ? <Button size="small" href={`http://localhost:5001${url}`} target="_blank">Soo Degso</Button> : 'N/A' },
                              { title: 'Xusuus-qorka Maxkamadda', dataIndex: 'court_notes', ellipsis: true },
                            ]}
                          />
                        </Card>
                      </Space>
                    ),
                  },
                  {
                    key: 'audit',
                    label: `Dabagalka Nidaamka (${selected.auditTrail?.length || 0})`,
                    children: selected.auditTrail?.length ? (
                      <Table
                        size="small"
                        rowKey={(row) => `${row.entity_type}-${row.entity_id}-${row.created_at}-${row.action}`}
                        dataSource={selected.auditTrail}
                        columns={[
                          { title: 'Ciddii Beddesay', dataIndex: 'performed_by', render: safe },
                          { title: 'Wixii Isbeddelay', dataIndex: 'action', render: (v) => v?.replaceAll('_', ' ') },
                          { title: 'Taariikhda/Saacadda', dataIndex: 'created_at', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : 'N/A' },
                          { title: 'Qiimihii Hore', dataIndex: 'previous_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                          { title: 'Qiimaha Cusub', dataIndex: 'new_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                        ]}
                      />
                    ) : (
                      <Empty description="Weli ma jiraan wax dabagal ah oo la diiwaangeliyey." />
                    ),
                  },
                ]}
              />
            </Space>
          ) : <Empty />}
        </Modal>

  <Modal
    title={modalType ? (() => {
      const titles = {
        assign: 'U-xilsaar Garsoore / Xeer-ilaaliye (Assign)',
        hearing: 'Qorshee Dhegeysi Cusub (Schedule Hearing)',
        hearing_update: 'Maamul Dhegeysiga (Update Hearing)',
        proceeding: 'Qoraalka Dacwadda (Add Proceedings)',
        witness: 'Maamul Markhaatiga (Witness)',
        judgment: 'Go\'aanka Maxkamadda (Judgment)',
        sentence: 'Xukun Ridis (Sentence)',
        appeal: 'Gudbi Racfaan (Appeal)',
        appeal_decision: 'Go’aanka Racfaanka (Appeal Decision)',
        close: 'Xiridda Kiiska Maxkamadda (Close)',
      };
      return titles[modalType] || 'Ficilka Maxkamadda';
    })() : 'Ficilka Maxkamadda'}
    open={Boolean(modalType)}
    onCancel={closeModal}
    onOk={() => form.submit()}
    destroyOnHidden
    forceRender
    width={720}
    zIndex={1050}
  >
    <Form
      form={form}
      layout="vertical"
      onFinish={submitModal}
      onValuesChange={(_, allValues) => {
        if (
          modalType === 'sentence'
          && String(allValues.duration || '').trim()
          && Number(allValues.fine_amount) > 0
          && allValues.sentence_type !== 'both'
        ) {
          form.setFieldValue('sentence_type', 'both');
        }
      }}
    >
      {modalType === 'assign' && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="assigned_judge" label="Garsooraha Kiiska loo Xilsaaray">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Dooro garsoore"
                options={courtPersonnel.judges}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="assigned_prosecutor" label="Xeer-ilaaliyaha Kiiska">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Dooro xeer-ilaaliye"
                options={courtPersonnel.prosecutors}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
      {modalType === 'hearing' && (
        <Row gutter={16}>
          <Col span={12}><Form.Item name="hearing_type" label="Nooca Dhegeysiga" rules={[{ required: true }]}><Select options={[
            { value: 'preliminary', label: 'Dhegeysiga Hordhaca Ah' },
            { value: 'evidence', label: 'Dhegeysiga Caddeymaha' },
            { value: 'witness', label: 'Dhegeysiga Markhaatiyaasha' },
            { value: 'final', label: 'Dhegeysiga kama dambaysta ah' },
            { value: 'appeal', label: 'Racfaanka' },
          ]} /></Form.Item></Col>
          <Col span={12}><Form.Item name="court_room" label="Qolka Maxkamadda"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="hearing_date" label="Taariikhda Dhegeysiga" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="hearing_time" label="Saacadda Dhegeysiga" rules={[{ required: true }]}><TimePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={24}>
            <Form.Item name="assigned_judge" label="Garsooraha Kiiska loo Xilsaaray">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Dooro garsoore"
                options={courtPersonnel.judges}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
      {modalType === 'proceeding' && (
        <>
          <Form.Item name="notes" label="Qoraalka Fadhiga"><TextArea rows={3} /></Form.Item>
          <Form.Item name="judge_remarks" label="Hadallada Garsooraha"><TextArea rows={2} /></Form.Item>
          <Form.Item name="prosecutor_remarks" label="Hadallada Xeer-ilaaliyaha"><TextArea rows={2} /></Form.Item>
          <Form.Item name="defense_remarks" label="Hadallada Qareenka Difaaca"><TextArea rows={2} /></Form.Item>
        </>
      )}
      {modalType === 'hearing_update' && (
        <Row gutter={16}>
          <Col span={12}><Form.Item name="hearing_date" label="Taariikhda Dhegeysiga"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="hearing_time" label="Saacadda Dhegeysiga"><TimePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="court_room" label="Qolka Maxkamadda"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="assigned_judge" label="Garsooraha"><Select allowClear options={courtPersonnel.judges} /></Form.Item></Col>
          <Col span={24}><Form.Item name="status" label="Heerka"><Select options={[
            { value: 'scheduled', label: 'Qorshaysan' },
            { value: 'completed', label: 'La dhammeeyey' },
            { value: 'cancelled', label: 'La baajiyey' },
          ]} /></Form.Item></Col>
        </Row>
      )}
      {modalType === 'witness' && (
        <>
          <Form.Item name="witness_id" hidden><Input /></Form.Item>
          <Form.Item name="status" label="Heerka Markhaatiga" rules={[{ required: true }]}><Select options={[
            { value: 'summoned', label: 'Loo yeeray' },
            { value: 'present', label: 'Wuu yimid' },
            { value: 'absent', label: 'Wuu maqnaa' },
          ]} /></Form.Item>
          <Form.Item name="testimony" label="Markhaati-furka"><TextArea rows={5} /></Form.Item>
        </>
      )}
      {modalType === 'appeal_decision' && (
        <>
          <Form.Item name="appeal_id" hidden><Input /></Form.Item>
          <Form.Item name="status" label="Go’aanka Racfaanka" rules={[{ required: true }]}><Select options={[
            { value: 'approved', label: 'La aqbalay' },
            { value: 'rejected', label: 'La diiday' },
          ]} /></Form.Item>
        </>
      )}
      {modalType === 'judgment' && (
        <>
          <Form.Item name="judge_name" label="Magaca Garsooraha"><Input /></Form.Item>
          <Form.Item name="decision_date" label="Taariikhda Go'aanka"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="decision_type" label="Go'aanka" rules={[{ required: true }]}><Select options={[
            { value: 'convicted', label: 'Eedaysanaha la Xukumay (Convicted)' },
            { value: 'acquitted', label: 'Eedaysanaha la Sii Daayay (Acquitted)' },
            { value: 'dismissed', label: 'Kiiska la Laalay (Dismissed)' },
          ]} /></Form.Item>
          <Form.Item name="judgment_summary" label="Koobsiga Go'aanka Maxkamadda" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
        </>
      )}
      {modalType === 'sentence' && (() => {
        const suspects = selected?.suspects || [];
        return (
          <Row gutter={16}>
            <Col span={24}>
              {suspects.length > 1 ? (
                <Form.Item name="criminal_id" label="Magaca Eedaysanaha" rules={[{ required: true, message: 'Fadlan dooro eedaysanaha' }]}>
                  <Select
                    placeholder="Dooro eedaysanaha"
                    options={suspects.map(s => ({ value: s.id, label: s.full_name }))}
                  />
                </Form.Item>
              ) : suspects.length === 1 ? (
                <>
                  <Form.Item label="Magaca Eedaysanaha">
                    <Input value={suspects[0].full_name} disabled style={{ color: 'rgba(0,0,0,0.85)' }} />
                  </Form.Item>
                  <Form.Item name="criminal_id" hidden>
                    <Input />
                  </Form.Item>
                </>
              ) : (
                <Form.Item label="Magaca Eedaysanaha">
                  <Input disabled placeholder="Ma jiraan eedaysanayaal firfircoon oo kiiskaan ku xiran" />
                </Form.Item>
              )}
            </Col>
            <Col span={12}><Form.Item name="sentence_type" label="Nooca Xukunka" rules={[{ required: true }]}><Select options={[
              { value: 'imprisonment', label: 'Xabsi' },
              { value: 'fine', label: 'Ganaax Lacageed' },
              { value: 'both', label: 'Xabsi iyo Ganaax' },
            ]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="sentence_date" label="Taariikhda Xukunka"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="duration" label="Muddada Xukunka"><Input placeholder="tusaale. 2 sano, 6 bilood..." /></Form.Item></Col>
            <Col span={12}><Form.Item name="fine_amount" label="Cadadka Ganaaxa (USD)"><InputNumber min={0} precision={2} step={0.01} stringMode prefix="$" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        );
      })()}
      {modalType === 'appeal' && (
        <>
          <Form.Item name="filed_by" label="Ciddii Racfaanka Qaadatay" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="filing_date" label="Taariikhda Racfaanka"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="appeal_reason" label="Sababta Racfaanka" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
        </>
      )}
      {modalType === 'close' && (
        <>
          <Form.Item name="final_outcome" label="Natiijada kama dambaysta ah"><Select options={[
            { value: 'convicted', label: 'Eedaysanaha la Xukumay (Convicted)' },
            { value: 'acquitted', label: 'Eedaysanaha la Sii Daayay (Acquitted)' },
            { value: 'dismissed', label: 'Kiiska la Laalay (Dismissed)' },
          ]} /></Form.Item>
          <Form.Item name="closure_reason" label="Sababta Kiiska loo Xiray"><TextArea rows={4} /></Form.Item>
          <Form.Item name="archive" label="Kaydi Kiiska" initialValue={false}><Select options={[
            { value: false, label: 'Xir Keliya' },
            { value: true, label: 'Xir oo Kaydi' },
          ]} /></Form.Item>
        </>
      )}
    </Form>
  </Modal>
      </Space >
    </ProtectedRoute >
  );
}
