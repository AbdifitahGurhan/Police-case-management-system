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
  EditOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  PrinterOutlined,
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

const { Text, Title } = Typography;
const { TextArea } = Input;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  court_received: { label: 'Maxkamaddu Heshay', tone: 'open' },
  arraignment: { label: 'Horgeyn + Qirasho', tone: 'pending' },
  remand_investigation: { label: 'Muddo Baaris', tone: 'pending' },
  remanded_to_investigator: { label: 'Dib loogu celiyay Baaraha', tone: 'warning' },
  returned_from_remand: { label: 'Baaris Soo Noqotay', tone: 'open' },
  assigned_legal_team: { label: 'Xilsaarid', tone: 'open' },
  case_scheduled: { label: 'Mudeyn', tone: 'open' },
  trial_hearing: { label: 'Dhageysi', tone: 'pending' },
  evidence_defense: { label: 'Caddeymo & Difaac', tone: 'pending' },
  judgment: { label: 'Xukun', tone: 'open' },
  sentenced: { label: 'Xukun La Riday', tone: 'warning' },
  appealed: { label: 'Racfaan La Qaatay', tone: 'critical' },
  closed: { label: 'La Xiray', tone: 'closed' },
  archived: { label: 'Kaydsan', tone: 'neutral' },
};

const decisionColor = { convicted: 'red', acquitted: 'green', dismissed: 'default' };

const roleConfig = {
  admin: { title: 'Maamulka Sare - Maxkamadda', actions: ['arraignment', 'assign', 'hearing', 'hearing_manage', 'proceeding', 'evidence_defense', 'witness', 'judgment', 'sentence', 'appeal', 'appeal_decision', 'close', 'documents', 'remand'] },
  court: { title: 'Maamulka Guud ee Maxkamadda', actions: ['arraignment', 'assign', 'hearing', 'hearing_manage', 'proceeding', 'evidence_defense', 'witness', 'judgment', 'sentence', 'appeal', 'appeal_decision', 'close', 'documents', 'remand'] },
  court_admin: { title: 'Maamulaha Maxkamadda', actions: ['arraignment', 'assign', 'hearing', 'hearing_manage', 'proceeding', 'evidence_defense', 'witness', 'appeal_decision', 'close', 'documents', 'remand'] },
  judge: { title: 'Dashboard-ka Garsooraha', actions: ['arraignment', 'hearing_manage', 'proceeding', 'evidence_defense', 'witness', 'judgment', 'sentence', 'appeal_decision', 'documents'] },
  prosecutor: { title: 'Dashboard-ka Xeer-ilaaliyaha', actions: ['appeal', 'documents'] },
  prosecutor_liaison: { title: 'Xiriiriyaha Xeer-ilaalinta', actions: ['appeal', 'documents'] },
  court_clerk: { title: 'Kaaliyaha Maxkamadda', actions: ['arraignment', 'hearing', 'hearing_manage', 'proceeding', 'witness', 'documents'] },
};

const statusTag = (status) => {
  const meta = statusMeta[status] || { label: status?.replaceAll('_', ' ') || 'Unknown', tone: 'neutral' };
  return <Tag className={`status-tag status-tag--${meta.tone}`}>{meta.label}</Tag>;
};

const safe = (value) => value || 'N/A';
const parseStoredList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const evidenceTypeLabel = (type) => ({
  image: 'Sawir',
  photo: 'Sawir',
  video: 'CCTV / Video',
  document: 'Fayl',
  physical: 'Physical',
  audio: 'Cod',
  other: 'Kale',
}[type] || safe(type));

const formatDate = (value) => {
  if (!value) return null;
  return dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : dayjs(value).format('YYYY-MM-DD');
};

const documentStatusOrder = {
  court_received: 0,
  arraignment: 1,
  remand_investigation: 2,
  remanded_to_investigator: 2,
  returned_from_remand: 2,
  assigned_legal_team: 3,
  case_scheduled: 4,
  trial_hearing: 5,
  evidence_defense: 6,
  judgment: 7,
  sentenced: 8,
  appealed: 9,
  closed: 10,
  archived: 10,
};

const documentDefinitions = [
  ['summons', 'Yeerid Maxkamadeed', 'case_scheduled'],
  ['hearing_notice', 'Ogeysiiska Dhegeysiga', 'case_scheduled'],
  ['judgment_order', "Go'aanka (PDF)", 'judgment'],
  ['sentence_order', 'Amar Xukun (PDF)', 'sentenced'],
  ['appeal_receipt', 'Rasiidhka Racfaanka', 'appealed'],
  ['closure_certificate', 'Shahaadada Xiritaanka', 'closed'],
];

const documentAvailable = (currentStatus, requiredStatus) => (
  (documentStatusOrder[currentStatus] ?? -1) >= (documentStatusOrder[requiredStatus] ?? 999)
);

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
  const [courtPersonnel, setCourtPersonnel] = useState({ judges: [], prosecutors: [] });
  const [form] = Form.useForm();

  const role = user?.role || 'court';
  const config = roleConfig[role] || roleConfig.court;
  const can = (action) => config.actions.includes(action);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    loadCases();
    const timer = setInterval(() => loadCases(), 30000);
    return () => clearInterval(timer);
  }, [loadCases]);

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
    const assignedJudge = selected?.courtCase?.assigned_judge || selected?.courtCase?.judge_name || selected?.courtCase?.judge || '';
    if (type === 'arraignment') {
      values.arraignment_date = values.arraignment_date ? dayjs(values.arraignment_date) : dayjs();
      values.judge_name = values.judge_name || assignedJudge;
      values.defendant_present = values.defendant_present ?? true;
      values.plea = values.plea || 'no_plea';
    }
    if (type === 'hearing') {
      values.assigned_judge = assignedJudge;
      values.hearing_date = values.hearing_date ? dayjs(values.hearing_date) : dayjs();
    }
    if (type === 'judgment') {
      values.judge_name = assignedJudge;
      values.decision_date = values.decision_date ? dayjs(values.decision_date) : dayjs();
    }
    if (type === 'remand') {
      values.sent_to_role = values.sent_to_role || 'station';
      values.deadline_date = values.deadline_date ? dayjs(values.deadline_date) : dayjs().add(7, 'day');
    }
    if (type === 'sentence') {
      const sent = initial.sentence || null;
      if (sent) {
        values.criminal_id = sent.criminal_id || values.criminal_id;
        values.sentence_type = sent.sentence_type || 'imprisonment';
        values.sentence_date = sent.sentence_date ? dayjs(sent.sentence_date) : dayjs();
        values.fine_amount = sent.fine_amount !== undefined && sent.fine_amount !== null ? sent.fine_amount : values.fine_amount;
        if (sent.duration) {
          const parts = String(sent.duration).trim().split(' ');
          if (parts.length >= 2 && !isNaN(Number(parts[0]))) {
            values.duration_value = Number(parts[0]);
            values.duration_unit = parts[1].toLowerCase();
          }
        }
      } else {
        values.sentence_type = values.sentence_type || 'imprisonment';
        values.sentence_date = values.sentence_date ? dayjs(values.sentence_date) : dayjs();
        values.duration_unit = values.duration_unit || 'sano';
      }
      const suspects = selected?.suspects || [];
      if (!values.criminal_id && suspects.length === 1) {
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

  const reopenForSentence = async () => {
    const id = selected?.courtCase?.id;
    if (!id) return;
    try {
      await api.patch(`/court/cases/${id}/reopen-for-sentence`, {}, { skipErrorNotification: true });
      message.success('Kiiska waxaa dib loogu furay xukun qof cusub.');
      await loadDetail(id);
      await loadCases();
    } catch (error) {
      message.error(error.response?.data?.message || 'Kiiska dib looma furi karin.');
    }
  };

  const refreshAfterAction = async () => {
    const id = selected?.courtCase?.id;
    await loadCases();
    if (id) await loadDetail(id);
  };

  const submitModal = async (values) => {
    try {
      const id = selected?.courtCase?.id;
      if (modalType === 'arraignment') {
        await api.post(`/court/cases/${id}/arraignment`, {
          ...values,
          arraignment_date: formatDate(values.arraignment_date),
        });
      }
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
      if (modalType === 'remand') {
        await api.post(`/court/cases/${id}/remands`, {
          ...values,
          deadline_date: formatDate(values.deadline_date),
        });
      }
      if (modalType === 'evidence_defense') {
        await api.post(`/court/cases/${id}/evidence-defense`, values);
      }
      if (modalType === 'judgment') {
        await api.post(`/court/cases/${id}/judgments`, {
          ...values,
          decision_date: formatDate(values.decision_date),
        });
      }
      if (modalType === 'sentence') {
        let durationStr = values.duration;
        if ((values.sentence_type === 'imprisonment' || values.sentence_type === 'both') && values.duration_value) {
          durationStr = `${values.duration_value} ${values.duration_unit || 'years'}`;
        }
        const hasDuration = Boolean(String(durationStr || '').trim());
        const hasFine = Number(values.fine_amount) > 0;
        const sentenceType = hasDuration && hasFine ? 'both' : values.sentence_type;
        await api.post(`/court/cases/${id}/sentences`, {
          ...values,
          duration: durationStr,
          sentence_period_value: values.duration_value,
          sentence_period_unit: values.duration_unit,
          sentence_start_date: values.sentence_date ? formatDate(values.sentence_date) : null,
          expected_release_date: values.expected_release_date ? formatDate(values.expected_release_date) : null,
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
  const investigationWitnesses = (selected?.investigations || []).flatMap((inv) => (
    parseStoredList(inv.witnesses_data).map((item, index) => ({
      id: `inv-witness-${inv.id}-${index}`,
      full_name: item.full_name || item.name,
      phone: item.phone,
      address: item.address,
      statement: item.statement,
      court_status: item.court_status,
      source: inv.investigation_number,
    }))
  ));
  const investigationInterviewWitnesses = (selected?.investigations || []).flatMap((inv) => (
    parseStoredList(inv.steps_data).flatMap((step, stepIndex) => {
      if (step.type !== 'interview') return [];
      const people = parseStoredList(step.interview_people_list);
      if (people.length) {
        return people.map((person, personIndex) => ({
          id: `inv-step-witness-${inv.id}-${stepIndex}-${personIndex}`,
          full_name: person.name || person.full_name,
          phone: person.phone,
          address: person.address,
          statement: person.statement || step.step_text,
          court_status: 'pending',
          source: `${inv.investigation_number} / ${step.step_label || 'Wareysi'}`,
        }));
      }
      return String(step.interview_people || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name, personIndex) => ({
          id: `inv-step-witness-${inv.id}-${stepIndex}-${personIndex}`,
          full_name: name,
          statement: step.step_text,
          court_status: 'pending',
          source: `${inv.investigation_number} / ${step.step_label || 'Wareysi'}`,
        }));
    })
  ));
  const mergedWitnesses = [...(selected?.witnesses || []), ...investigationWitnesses, ...investigationInterviewWitnesses];
  const investigationEvidence = (selected?.investigations || []).flatMap((inv) => (
    parseStoredList(inv.evidence_data).map((item, index) => ({
      id: `inv-evidence-${inv.id}-${index}`,
      evidence_number: `${inv.investigation_number || 'INV'}-${index + 1}`,
      title: item.description || 'Caddeyn baaritaan',
      type: item.evidence_type || item.type,
      collected_by: inv.investigator_name,
      file_url: item.file_url,
      court_notes: inv.investigation_number,
    }))
  ));
  const mergedEvidence = [...(selected?.evidence || []), ...investigationEvidence];
  const investigatorName = courtCase?.officer_name || selected?.latestInvestigation?.investigator_name;

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
            <Button type="primary" icon={<Scale style={{ width: 16 }} />} onClick={() => loadCases()}>Cusbooneysii</Button>
          </Space>
        </div>

        <Card variant="none" className="standard-panel" title="Kiisaska Maxkamadda">
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
                <CaseStatusStepper status={courtCase.status} outcome={courtCase.final_outcome} flow="court" />
                {['remanded_to_investigator', 'returned_from_remand'].includes(courtCase.status) && selected?.latestRemand && (
                  <Alert
                    style={{ marginTop: 14 }}
                    type={courtCase.status === 'returned_from_remand' ? 'success' : 'warning'}
                    showIcon
                    title={courtCase.status === 'returned_from_remand' ? 'Baaris dheeraad ah waa soo noqotay' : 'Baaris dheeraad ah ayaa loo diray'}
                    description={
                      <Space orientation="vertical" size={2}>
                        <Text>Tilmaamaha: {selected.latestRemand.instructions || 'N/A'}</Text>
                        <Text>Sababta: {selected.latestRemand.reason || 'N/A'}</Text>
                        <Text>Deadline: {selected.latestRemand.deadline_date ? dayjs(selected.latestRemand.deadline_date).format('YYYY-MM-DD') : 'N/A'}</Text>
                        {selected.latestRemand.return_notes && <Text>Soo celin: {selected.latestRemand.return_notes}</Text>}
                      </Space>
                    }
                  />
                )}
              </div>

              {/* ── Action Buttons (Two-Tier) ──────────────────────────── */}
              {(() => {
                const s = courtCase.status;
                const canReopenForSentence = can('sentence')
                  && s === 'closed'
                  && courtCase.final_outcome === 'convicted'
                  && hasUnsentencedSuspect;
                const primaryAction = (() => {
                  if (canReopenForSentence)
                    return { label: 'Dib u fur si xukun loogu sameeyo', action: 'reopen_for_sentence' };
                  if (s === 'court_received' && can('arraignment'))
                    return { label: 'Samee Horgeyn + Qirasho', action: 'arraignment' };
                  if (s === 'arraignment' && can('remand'))
                    return { label: 'U Dir Baaris Dheeraad ah', action: 'remand' };
                  if (s === 'returned_from_remand' && can('assign'))
                    return { label: 'U Gudub Xilsaarid', action: 'assign' };
                  if (s === 'assigned_legal_team' && can('hearing'))
                    return { label: 'Qorshee Dhegeysi', action: 'hearing' };
                  if (s === 'case_scheduled' && can('proceeding'))
                    return { label: 'Bilow Dhageysi', action: 'proceeding' };
                  if (s === 'trial_hearing' && can('evidence_defense'))
                    return { label: 'Caddeymo & Difaac', action: 'evidence_defense' };
                  if (s === 'evidence_defense' && can('judgment'))
                    return { label: "Go'aan ka gaar", action: 'judgment' };
                  if (s === 'judgment' && courtCase.final_outcome === 'convicted' && can('sentence'))
                    return { label: 'Xukun rid', action: 'sentence' };
                  return null;
                })();

                const overflowItems = [
                  can('assign') && ['arraignment', 'returned_from_remand', 'assigned_legal_team'].includes(s) ? {
                    key: 'assign',
                    label: 'U Xilsaar',
                    onClick: () => openModal('assign', {
                      values: {
                        assigned_judge: courtCase.assigned_judge,
                        assigned_prosecutor: courtCase.assigned_prosecutor,
                      },
                    }),
                  } : null,
                  can('remand') && ['arraignment', 'returned_from_remand'].includes(s) ? {
                    key: 'remand',
                    label: 'U Dir Baaris Dheeraad ah',
                    onClick: () => openModal('remand'),
                  } : null,
                  can('proceeding') && ['trial_hearing'].includes(s) ? {
                    key: 'proceeding',
                    label: 'Ku dar Qoraalka Fadhiga',
                    onClick: () => openModal('proceeding'),
                  } : null,
                  can('sentence') && ['judgment', 'sentenced'].includes(s) ? {
                    key: 'sentence',
                    label: 'Xukun rid (Issue Sentence)',
                    onClick: () => openModal('sentence'),
                  } : null,
                  can('appeal') && ['judgment', 'sentenced'].includes(s) ? {
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
                        onClick={() => primaryAction.action === 'reopen_for_sentence' ? reopenForSentence() : openModal(primaryAction.action)}
                        style={{ fontWeight: 600 }}
                      >
                        {primaryAction.label}
                      </Button>
                    )}
                    {can('close') && ['judgment', 'sentenced', 'appealed'].includes(s) && (
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
                    {documentDefinitions
                      .filter(([, , requiredStatus]) => documentAvailable(courtCase.status, requiredStatus))
                      .map(([type, label]) => (
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
                    {documentDefinitions.every(([, , requiredStatus]) => !documentAvailable(courtCase.status, requiredStatus)) && (
                      <Text type="secondary">Dukumenti wali diyaar uma aha status-kan.</Text>
                    )}
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
                        <Card title="Horgeynta & Qirashada" size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.arraignments || []}
                            pagination={false}
                            locale={{ emptyText: 'Weli lama diiwaangelin Horgeyn + Qirasho.' }}
                            columns={[
                              { title: 'Taariikhda', dataIndex: 'arraignment_date' },
                              { title: 'Garsooraha', dataIndex: 'judge_name', render: safe },
                              { title: 'Kaaliyaha', dataIndex: 'clerk_name', render: safe },
                              { title: 'Eedaysanaha', dataIndex: 'defendant_present', render: (value) => value ? 'Wuu joogay' : 'Ma joogin' },
                              {
                                title: 'Qirasho',
                                dataIndex: 'plea',
                                render: (value) => ({
                                  guilty: 'Qirtay',
                                  not_guilty: 'Ma qiran',
                                  no_plea: 'Qirasho lama diiwaangelin',
                                }[value] || safe(value)),
                              },
                              { title: 'Faahfaahin', dataIndex: 'notes', ellipsis: true, render: safe },
                            ]}
                          />
                        </Card>

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
                                    {can('proceeding') && ['case_scheduled', 'trial_hearing'].includes(courtCase.status) && <Button size="small" onClick={() => openModal('proceeding', { hearing: row })}>Ku dar Qoraalka</Button>}
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
                                  {
                                    title: 'Ficil',
                                    render: (_, row) => can('sentence') && courtCase.status === 'judgment' && (
                                      <Button size="small" icon={<EditOutlined />} onClick={() => openModal('sentence', { sentence: row })}>
                                        Baddal Xukunka
                                      </Button>
                                    ),
                                  },
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
                          <Descriptions.Item label="Sarkaalka Baaraha ah">{safe(investigatorName)}</Descriptions.Item>
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
                              { title: 'Aqoonsiga', render: (_, row) => safe(row.national_id || row.id_number) },
                              { title: 'Doorka Kiiska', dataIndex: 'role_in_case', render: safe },
                              { title: 'Heerka Xarigga', dataIndex: 'arrest_status', render: (v) => <Tag>{safe(v)}</Tag> },
                              {
                                title: 'Xukunka',
                                render: (_, row) => {
                                  const sentence = sentenceByCriminalId.get(Number(row.id));
                                  return sentence
                                    ? <Tag color="red">{`${sentence.sentence_type}${sentence.duration ? ` - ${sentence.duration}` : ''}`}</Tag>
                                    : <Tag color="default">Wali xukun looma ridin</Tag>;
                                },
                              },
                              {
                                title: 'Ficil',
                                render: (_, row) => {
                                  if (!can('sentence') || !['judgment', 'sentenced'].includes(courtCase.status)) return null;
                                  const sentence = sentenceByCriminalId.get(Number(row.id));
                                  return sentence ? (
                                    <Button size="small" icon={<EditOutlined />} onClick={() => openModal('sentence', { sentence })}>
                                      Baddal Xukunka
                                    </Button>
                                  ) : (
                                    <Button size="small" type="primary" onClick={() => openModal('sentence', {
                                      values: {
                                        criminal_id: row.id,
                                        defendant_name: row.full_name,
                                        sentence_type: 'imprisonment',
                                        sentence_date: dayjs(),
                                        duration_unit: 'sano',
                                      },
                                    })}>
                                      Xukun u samee
                                    </Button>
                                  );
                                },
                              },
                            ]}
                          />
                        </Card>
                        <Card title={`Hadallada Markhaatiyaasha (Witnesses) (${mergedWitnesses.length})`} size="small">
                          <Table
                            size="small" rowKey="id" dataSource={mergedWitnesses} pagination={false}
                            locale={{ emptyText: 'Wax markhaatiyo ah lama diiwaangelin.' }}
                            columns={[
                              { title: 'Magaca', dataIndex: 'full_name' },
                              { title: 'Telefoonka', dataIndex: 'phone', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'address', render: safe },
                              { title: 'Heerka Maxkamadda', dataIndex: 'court_status', render: (v) => <Tag>{v || 'pending'}</Tag> },
                              { title: 'Hadalka Markhaatiga', dataIndex: 'statement', ellipsis: true },
                              { title: 'Isha', dataIndex: 'source', render: safe },
                              {
                                title: 'Ficil',
                                render: (_, row) => can('witness') && !String(row.id).startsWith('inv-witness-')
                                  ? <Button size="small" onClick={() => openModal('witness', { values: { witness_id: row.id, status: row.court_status || 'summoned', testimony: row.testimony } })}>Maamul</Button>
                                  : null,
                              },
                            ]}
                          />
                        </Card>
                        <Card title={`Caddeymaha Kiiska (Evidence) (${mergedEvidence.length})`} size="small">
                          <Table
                            size="small" rowKey="id" dataSource={mergedEvidence} pagination={false}
                            locale={{ emptyText: 'Wax caddeymo ah lama diiwaangelin.' }}
                            columns={[
                              { title: 'Lambarka Caddeynta', dataIndex: 'evidence_number', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'title', render: safe },
                              { title: 'Nooca', dataIndex: 'type', render: evidenceTypeLabel },
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
        arraignment: 'Horgeyn + Qirasho',
        assign: 'U-xilsaar Garsoore / Xeer-ilaaliye (Assign)',
        hearing: 'Qorshee Dhegeysi Cusub (Schedule Hearing)',
        hearing_update: 'Maamul Dhegeysiga (Update Hearing)',
        proceeding: 'Qoraalka Dacwadda (Add Proceedings)',
        evidence_defense: 'Caddeymo & Difaac',
        witness: 'Maamul Markhaatiga (Witness)',
        remand: 'U Dir Baaris Dheeraad ah',
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
    forceRender
    width={720}
    zIndex={1050}
  >
    <Form
      form={form}
      layout="vertical"
      onFinish={submitModal}
      onValuesChange={(_, allValues) => {
        if (modalType === 'sentence') {
          const periodVal = allValues.duration_value;
          const periodUnit = allValues.duration_unit || 'sano';
          const startDate = allValues.sentence_date;

          if (periodVal && startDate) {
            const num = Number(periodVal);
            const start = dayjs.isDayjs(startDate) ? startDate : dayjs(startDate);
            if (!isNaN(num) && num > 0 && start && typeof start.isValid === 'function' && start.isValid()) {
              let expected;
              const normUnit = String(periodUnit).toLowerCase();
              if (normUnit === 'sano' || normUnit === 'years') expected = start.add(num, 'year');
              else if (normUnit === 'bilood' || normUnit === 'months') expected = start.add(num, 'month');
              else if (normUnit === 'cisho' || normUnit === 'days') expected = start.add(num, 'day');

              if (expected && typeof expected.isValid === 'function' && expected.isValid()) {
                form.setFieldValue('expected_release_date', expected);
              }
            }
          }
        }
      }}
    >
      {modalType === 'arraignment' && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="arraignment_date" label="Taariikhda Horgeynta" rules={[{ required: true, message: 'Taariikhda horgeynta waa qasab' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="plea" label="Qirashada" rules={[{ required: true, message: 'Qirashada waa qasab' }]}>
              <Select options={[
                { value: 'guilty', label: 'Qirtay' },
                { value: 'not_guilty', label: 'Ma qiran' },
                { value: 'no_plea', label: 'Qirasho lama diiwaangelin' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="judge_name" label="Garsooraha">
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
            <Form.Item name="clerk_name" label="Kaaliyaha Maxkamadda">
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="defendant_present" label="Eedaysanaha wuu joogaa?" initialValue={true}>
              <Select options={[
                { value: true, label: 'Haa' },
                { value: false, label: 'Maya' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="notes" label="Faahfaahinta Horgeynta">
              <TextArea rows={4} />
            </Form.Item>
          </Col>
        </Row>
      )}
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
          <Col span={12}><Form.Item name="hearing_type" label="Nooca Dhegeysiga" rules={[{ required: true, message: 'Fadlan dooro nooca dhegeysiga' }]}><Select options={[
            { value: 'preliminary', label: 'Dhegeysiga Hordhaca Ah' },
            { value: 'evidence', label: 'Dhegeysiga Caddeymaha' },
            { value: 'witness', label: 'Dhegeysiga Markhaatiyaasha' },
            { value: 'final', label: 'Dhegeysiga kama dambaysta ah' },
            { value: 'appeal', label: 'Racfaanka' },
          ]} /></Form.Item></Col>
          <Col span={12}><Form.Item name="court_room" label="Qolka Maxkamadda"><Input placeholder="Tusaale. 7" /></Form.Item></Col>
          <Col span={12}>
            <Form.Item
              name="hearing_date"
              label="Taariikhda Dhegeysiga"
              rules={[
                { required: true, message: 'Fadlan dooro taariikhda dhegeysiga' },
                {
                  validator: (_, val) => {
                    if (!val) return Promise.resolve();
                    if (val.isBefore(dayjs().startOf('day'))) {
                      return Promise.reject(new Error('Taariikhda dhegeysiga ma noqon karto taariikh la soo dhaafay'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </Col>
          <Col span={12}><Form.Item name="hearing_time" label="Saacadda Dhegeysiga" rules={[{ required: true, message: 'Fadlan dooro saacadda dhegeysiga' }]}><TimePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item></Col>
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
      {modalType === 'evidence_defense' && (
        <>
          <Form.Item name="summary" label="Koobsiga Caddeymaha & Difaaca" rules={[{ required: true, message: 'Koobsiga waa qasab' }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="prosecutor_notes" label="Qoraalka Xeer-ilaaliyaha">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="defense_notes" label="Qoraalka Difaaca">
            <TextArea rows={3} />
          </Form.Item>
        </>
      )}
      {modalType === 'hearing_update' && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="hearing_date"
              label="Taariikhda Dhegeysiga"
              rules={[
                { required: true, message: 'Fadlan dooro taariikhda dhegeysiga' },
                {
                  validator: (_, val) => {
                    if (!val) return Promise.resolve();
                    if (val.isBefore(dayjs().startOf('day'))) {
                      return Promise.reject(new Error('Taariikhda dhegeysiga ma noqon karto taariikh la soo dhaafay'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </Col>
          <Col span={12}><Form.Item name="hearing_time" label="Saacadda Dhegeysiga"><TimePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item></Col>
          <Col span={12}><Form.Item name="court_room" label="Qolka Maxkamadda"><Input placeholder="Tusaale. 7" /></Form.Item></Col>
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
      {modalType === 'remand' && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="sent_to_role" label="Cidda loo dirayo" initialValue="station">
              <Select options={[
                { value: 'station', label: 'Saldhiggii soo gudbiyay' },
                { value: 'cid', label: 'CID' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="deadline_date"
              label="Deadline"
              rules={[
                { required: true, message: 'Fadlan dooro taariikhda deadline-ka' },
                {
                  validator: (_, val) => {
                    if (!val) return Promise.resolve();
                    if (val.isBefore(dayjs().startOf('day'))) {
                      return Promise.reject(new Error('Taariikhda deadline-ka ma noqon karto taariikh la soo dhaafay'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Alert
              showIcon
              type="info"
              title="Haddii Saldhiggii soo gudbiyay la doorto, nidaamku wuxuu si otomaatig ah ugu celinayaa degmada/saldhigga case-ka soo gudbiyay. Haddii CID la doorto, kiisku wuxuu ka muuqanayaa dashboard-ka CID."
            />
          </Col>
          <Col span={24}>
            <Form.Item name="reason" label="Sababta">
              <Input placeholder="Tusaale: Caddeymo dheeraad ah ayaa loo baahan yahay" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="instructions" label="Tilmaamaha Maxkamadda" rules={[{ required: true, message: 'Tilmaamaha waa qasab' }]}>
              <TextArea rows={5} placeholder="Qor waxa baaraha/saldhigga laga rabo inuu soo dhameystiro" />
            </Form.Item>
          </Col>
        </Row>
      )}
      {modalType === 'judgment' && (
        <>
          <Form.Item name="judge_name" label="Magaca Garsooraha"><Input placeholder="Tusaale. Xaakim Xasan Cali Maxamud" /></Form.Item>
          <Form.Item
            name="decision_date"
            label="Taariikhda Go'aanka"
            rules={[
              { required: true, message: 'Fadlan dooro taariikhda go\'aanka' },
              {
                validator: (_, val) => {
                  if (!val) return Promise.resolve();
                  if (val.isAfter(dayjs().endOf('day'))) {
                    return Promise.reject(new Error('Taariikhda go\'aanka ma noqon karto taariikh soo socota (mustaqbal)'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current.isAfter(dayjs().endOf('day'))} />
          </Form.Item>
          <Form.Item name="decision_type" label="Go'aanka" rules={[{ required: true, message: 'Fadlan dooro go\'aanka maxkamadda' }]}><Select options={[
            { value: 'convicted', label: 'Eedaysanaha la Xukumay (Convicted)' },
            { value: 'acquitted', label: 'Eedaysanaha la Sii Daayay (Acquitted)' },
            { value: 'dismissed', label: 'Kiiska la Laalay (Dismissed)' },
          ]} /></Form.Item>
          <Form.Item name="judgment_summary" label="Koobsiga Go'aanka Maxkamadda" rules={[{ required: true, message: 'Koobsiga waa qasab' }]}><TextArea rows={4} /></Form.Item>
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
            <Col span={12}><Form.Item name="sentence_type" label="Nooca Xukunka" initialValue="imprisonment" rules={[{ required: true }]}><Select options={[
              { value: 'imprisonment', label: 'Xabsi (Imprisonment)' },
              { value: 'fine', label: 'Ganaax Lacageed (Fine)' },
              { value: 'both', label: 'Xabsi iyo Ganaax (Both)' },
            ]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="sentence_date" label="Taariikhda Xukunka"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.sentence_type !== curr.sentence_type}>
              {({ getFieldValue }) => {
                const type = getFieldValue('sentence_type') || 'imprisonment';
                const showImprisonment = type === 'imprisonment' || type === 'both';
                const showFine = type === 'fine' || type === 'both';

                return (
                  <>
                    {showImprisonment && (
                      <>
                        <Col span={showFine ? 12 : 12}>
                          <Row gutter={8}>
                            <Col span={14}>
                              <Form.Item
                                name="duration_value"
                                label="Muddada Xabsiga"
                                rules={[
                                  { required: true, message: 'Geli nambar' },
                                  {
                                    validator: (_, val) => {
                                      if (val === undefined || val === null || val === '') return Promise.resolve();
                                      const num = Number(val);
                                      if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
                                        return Promise.reject(new Error('Geli nambar togan (tusaale: 2)'));
                                      }
                                      if (num > 100) {
                                        return Promise.reject(new Error('Muddadu ma ka badan karto 100'));
                                      }
                                      return Promise.resolve();
                                    }
                                  }
                                ]}
                              >
                                <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="tusaale. 2" />
                              </Form.Item>
                            </Col>
                            <Col span={10}>
                              <Form.Item
                                name="duration_unit"
                                label="Unugga"
                                initialValue="years"
                                rules={[{ required: true, message: 'Dooro unug' }]}
                              >
                                <Select options={[
                                  { value: 'years', label: 'Sano (Years)' },
                                  { value: 'months', label: 'Bilood (Months)' },
                                  { value: 'days', label: 'Cisho (Days)' },
                                ]} />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="expected_release_date" label="Taariikhda Sii Daaynta (Expected Release Date)">
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </>
                    )}
                    {showFine && (
                      <Col span={showImprisonment ? 12 : 24}>
                        <Form.Item
                          name="fine_amount"
                          label="Cadadka Ganaaxa Lacageed (Fine Amount USD)"
                          rules={[{ required: true, message: 'Fadlan geli cadadka ganaaxa lacageed' }]}
                        >
                          <InputNumber min={0} precision={2} step={0.01} stringMode prefix="$" style={{ width: '100%' }} placeholder="tusaale. $500.00" />
                        </Form.Item>
                      </Col>
                    )}
                  </>
                );
              }}
            </Form.Item>
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
