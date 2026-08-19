'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Dropdown, Form, Input, Modal, Row, Select, Space, Table, Tag, Timeline, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { Title, Text, Paragraph } = Typography;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const nextStatuses = {
  REGISTERED: 'PRELIMINARY_REVIEW',
  OB_REGISTERED: 'PRELIMINARY_REVIEW',
  PRELIMINARY_REVIEW: 'INVESTIGATION_TRACING',
  INVESTIGATION_TRACING: 'SENT_TO_CID_OR_COURT',
  ARRESTED_IN_CUSTODY: 'SENT_TO_CID_OR_COURT',
  SENT_TO_CID_OR_COURT: 'CLOSED',
};
const statusLabels = {
  REGISTERED: 'La Diiwaangeliyey',
  OB_REGISTERED: 'La Diiwaangeliyey',
  PRELIMINARY_REVIEW: 'Dib-u-eegis Hordhac',
  INVESTIGATION_TRACING: 'Baaritaan',
  ARRESTED_IN_CUSTODY: 'La Qabtay',
  SENT_TO_CID_OR_COURT: 'Maxkamad',
  CONVERTED_TO_CASE: 'Kiis Loo Beddelay',
  CASE_OPENED: 'Kiis La Furay',
  CLOSED: 'La Xiray',
  WANTED: 'La Raadinayo',
  UNDER_TRACING: 'Baadi-goob Ku Jira',
  ARRESTED: 'La Qabtay',
};
const editableStatuses = ['DRAFT', 'REGISTERED', 'OB_REGISTERED', 'PRELIMINARY_REVIEW'];
const resolutionContexts = {
  mediation: 'Kadib wada-hadal, labada dhinac waxay ku heshiiyeen:\n\n1. In khilaafka lagu soo afjaro nabad.\n2. In labada dhinac ixtiraamaan xuquuqda midba midka kale.\n3. In aan dib loo soo celin muranka.',
  withdrawal: 'Kadib heshiis iyo wada-hadal, waxaan goaansaday inaan ka noqdo cabashadii aan gudbiyay.\n\nGoaankan waxaan ku gaaray rabitaankayga anigoon cadaadis lagu saarin.',
  false_report: 'Waxaan caddeynayaa in warbixintii hore ay ahayd warbixin aan sax ahayn oo aan si buuxda uga tarjumayn xaqiiqada. Waxaan codsanayaa in la saxo diiwaanka arrintan.',
};
const resolutionDefaults = {
  reconciliation: '1. In khilaafkii lagu dhammeeyo nabad iyo is-afgarad.\n2. In labada dhinac ay is cafiyeen.\n3. In aysan sameyn doonin wax kale oo khilaaf cusub keena.\n4. In heshiiskan lagu dhaqmo wixii maanta ka dambeeya.',
  warning: 'Waxaa lagaa codsanayaa inaad joojiso fal kasta oo keeni kara khilaaf ama dhibaato kale.\n\nHaddii digniintan la iska indho tiro, waxaa la qaadi karaa tallaabo waafaqsan sharciga.',
  general_agreement: 'Labada dhinac waxay ku heshiiyeen:\n\n1. In khilaafkii hore la soo afjaro.\n2. In mid kasta ixtiraamo kan kale.\n3. In aan la sameyn wax fal ah oo keena muran cusub.\n4. In wixii dhacay lagu xalliyo wada-hadal iyo sharci.',
};

function PanelTitle({ icon, title }) {
  return (
    <div className="ob-panel-title">
      <span>{icon}</span>
      <strong>{title}</strong>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="ob-info-block">
      <span>{label}</span>
      <strong>{value || 'N/A'}</strong>
    </div>
  );
}

export default function ObDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = (key) => user?.role === 'admin' || userPermissions.includes('*') || userPermissions.includes(key);
  const { message } = App.useApp();
  const [ob, setOb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [arrestTarget, setArrestTarget] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveForm] = Form.useForm();
  const [reopenForm] = Form.useForm();
  const [arrestForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [previewHtml, setPreviewHtml] = useState('');
  const resolutionMethod = Form.useWatch('resolution_method', resolveForm);

  const caseReadRoles = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
  const canReadCases = user && caseReadRoles.includes(user.role);

  const loadOb = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/ob-entries/${id}`);
      setOb(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Faahfaahinta OB-ga lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    if (id) loadOb();
  }, [id, loadOb]);

  const converted = ob?.linked_case_id || ['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob?.status);
  const resolutionStatuses = ['CLOSED', 'RESOLVED_BY_RECONCILIATION', 'WARNING_ISSUED', 'MEDIATION_COMPLETED', 'COMPLAINT_WITHDRAWN', 'FALSE_REPORT_CORRECTED', 'GENERAL_AGREEMENT_COMPLETED'];
  const closedAtOb = resolutionStatuses.includes(ob?.status) && !ob?.linked_case_id;
  const registeredOfficerName = ob?.registered_by_display_name || ob?.registered_by_name || ob?.created_by || 'Sarkaalka diiwaangeliyey';
  const registeredOfficerInitials = registeredOfficerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const resolveOb = async (values) => {
    setActionLoading(true);
    try {
      await api.post(`/ob-entries/${id}/resolve`, { resolution_method: values.resolution_method, document_data: values.document_data || {} });
      setResolveOpen(false);
      resolveForm.resetFields();
      await loadOb();
    } catch (error) {
      message.error(error.response?.data?.message || 'OB-ga lama xirin karin.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDocument = async (document, print = false) => {
    try {
      const response = await api.get(`/ob-entries/${id}/resolution-documents/${document.id}`);
      const html = response.data.data.official_html;
      if (print) {
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 300);
      } else {
        setPreviewHtml(html);
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Warqadda lama furi karin.');
    }
  };

  const previewDraft = async () => {
    try {
      const values = await resolveForm.validateFields();
      const details = Object.entries(values.document_data || {}).map(([key, value]) => `<p><b>${key.replaceAll('_', ' ')}:</b> ${String(value || '').replaceAll('\n', '<br>')}</p>`).join('');
      const fixed = (resolutionContexts[values.resolution_method] || '').replaceAll('\n', '<br>');
      setPreviewHtml(`<html><body style="font-family:Arial;padding:35px;line-height:1.65"><h2 style="text-align:center">${values.resolution_method.replaceAll('_', ' ').toUpperCase()}</h2><p><b>OB Number:</b> ${ob.ob_number}</p><p><b>Dacwoodaha:</b> ${ob.reported_by} - ID: ${ob.reporter_id_number || 'N/A'} - Tel: ${ob.reporter_phone || 'N/A'}</p><hr>${fixed ? `<p>${fixed}</p>` : ''}${details}</body></html>`);
    } catch {}
  };

  const reopenOb = async (values) => {
    setActionLoading(true);
    try {
      await api.post(`/ob-entries/${id}/reopen`, values);
      setReopenOpen(false);
      reopenForm.resetFields();
      await loadOb();
    } catch (error) {
      message.error(error.response?.data?.message || 'OB-ga dib looma furi karin.');
    } finally {
      setActionLoading(false);
    }
  };

  const registerArrest = async (values) => {
    setActionLoading(true);
    try {
      await api.post(`/ob-entries/${id}/accused/${arrestTarget.id}/arrest`, { ...values, arrest_date: values.arrest_date.format('YYYY-MM-DD HH:mm:ss') });
      message.success('Qabashada waxaa lagu daray OB-gii asalka ahaa.');
      setArrestTarget(null);
      arrestForm.resetFields();
      await loadOb();
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaangelinta qabashadu way fashilantay.');
    } finally {
      setActionLoading(false);
    }
  };

  const advanceStatus = async () => {
    const status = nextStatuses[ob.status];
    if (!status) return;
    try {
      await api.post(`/ob-entries/${id}/status`, { status, reason: status === 'CLOSED' ? 'Baaritaankii iyo gudbintii sharci waa la dhammaystiray.' : `Waxaa loo gudbiyey ${statusLabels[status] || status}` });
      message.success(`Xaaladda OB-ga waxaa loo beddelay ${statusLabels[status] || status}.`);
      await loadOb();
    } catch (error) {
      message.error(error.response?.data?.message || 'Beddelka xaaladdu wuu fashilmay.');
    }
  };

  const openEdit = () => {
    editForm.setFieldsValue({
      case_title: ob.case_title,
      case_type: ob.case_type,
      incident_type: ob.incident_type,
      incident_location: ob.incident_location,
      incident_datetime: ob.incident_datetime ? dayjs(ob.incident_datetime) : null,
      description: ob.description,
      reported_by: ob.reported_by,
      reporter_phone: ob.reporter_phone,
      reporter_id_type: ob.reporter_id_type,
      reporter_id_number: ob.reporter_id_number,
      reporter_address: ob.reporter_address,
    });
    setEditOpen(true);
  };

  const updateOb = async (values) => {
    setActionLoading(true);
    try {
      await api.patch(`/ob-entries/${id}`, { ...values, incident_datetime: values.incident_datetime?.format('YYYY-MM-DD HH:mm:ss') });
      message.success('Xogta OB-ga waa la cusboonaysiiyey.');
      setEditOpen(false);
      await loadOb();
    } catch (error) {
      message.error(error.response?.data?.message || 'Xogta OB-ga lama cusboonaysiin karin.');
    } finally {
      setActionLoading(false);
    }
  };

  const convertToCase = async () => {
    setConverting(true);
    try {
      const response = await api.post(`/ob-entries/${id}/convert-to-case`);
      message.success(response.data.alreadyExists ? `Kiiskii jiray ayaa la furay: ${response.data.caseNumber}` : `Kiis ayaa laga furay OB-ga: ${response.data.caseNumber}`);
      router.push(canReadCases ? `/cases/${response.data.caseId}` : '/ob-register');
    } catch (error) {
      const existingCaseId = error.response?.data?.caseId;
      if (existingCaseId) {
        message.warning(error.response?.data?.message || 'This OB already has a case.');
        router.push(canReadCases ? `/cases/${existingCaseId}` : '/ob-register');
        return;
      }
      message.error(error.response?.data?.message || 'OB-ga kiis looma beddeli karin.');
    } finally {
      setConverting(false);
    }
  };

  const statusTag = ob?.status ? <Tag color={converted ? 'green' : closedAtOb ? 'purple' : 'orange'}>{statusLabels[ob.status] || ob.status}</Tag> : null;
  const timelineItems = useMemo(() => (ob?.statusHistory || []).map((item) => ({
    color: item.new_status === 'CLOSED' ? 'green' : 'blue',
    content: (
      <>
        <Text strong>{statusLabels[item.previous_status] || 'Bilow'} - {statusLabels[item.new_status] || item.new_status}</Text>
        <br />
        <Text type="secondary">{item.created_at} - {item.performed_by}{item.reason ? ` - ${item.reason}` : ''}</Text>
      </>
    ),
  })), [ob]);

  const overview = ob && (
    <div className="ob-detail-grid">
      <div className="ob-detail-main">
        <Card className="ob-card" title={<PanelTitle icon={<FileOutlined />} title="Macluumaadka Dhacdada" />}>
          <div className="ob-info-grid">
            <InfoBlock label="Lambarka Kiiska" value={ob.ob_number} />
            <InfoBlock label="Faahfaahinta Falka" value={ob.incident_type || ob.case_title} />
            <InfoBlock label="Goobta" value={ob.incident_location} />
            <InfoBlock label="Cinwaanka" value={ob.case_title} />
            <InfoBlock label="Mudnaanta" value={ob.case_level || 'normal'} />
            <InfoBlock label="Taariikhda Dhacdada" value={ob.incident_datetime} />
          </div>
          <Paragraph className="ob-description">{ob.description || 'Lama diiwaangelin sharaxaad.'}</Paragraph>
        </Card>

        <Card className="ob-card" title={<PanelTitle icon={<FileOutlined />} title="Xogta OB-ga" />}>
          <div className="ob-info-grid ob-info-grid--compact">
            <InfoBlock label="OB Number" value={ob.ob_number} />
            <InfoBlock label="Shaqaalihii Diiwaangeliyey" value={registeredOfficerName} />
            <InfoBlock label="Taariikhda Diiwaangelinta" value={`${ob.registration_date || ''} ${ob.registration_time || ''}`.trim()} />
            <InfoBlock label="State" value={ob.state_name} />
            <InfoBlock label="Region" value={ob.region_name} />
            <InfoBlock label="Saldhigga Degmada" value={ob.district_police_station_name} />
          </div>
        </Card>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Card className="ob-card ob-person-card">
              <PanelTitle icon={<UserOutlined />} title="Soo Dacwoodaha" />
              <div>
                <Text strong>{ob.reported_by || 'N/A'}</Text>
                <br />
                <Text>{ob.reporter_phone || 'N/A'}</Text>
                <Link href="#" className="ob-card-link">Arag Faahfaahinta</Link>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card className="ob-card ob-warning-card">
              <WarningOutlined />
              <div>
                <Text strong>Digniin Amni</Text>
                <Tag color="red">TAMPER DETECTED</Tag>
                <p>Hubinta integrity-ga diiwaanka waxay u baahan tahay baaritaan.</p>
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="ob-card" title={<PanelTitle icon={<ReloadOutlined />} title="Dhaqdhaqaaqii Ugu Dambeeyey" />}>
          <Timeline items={timelineItems.length ? timelineItems : [{ color: 'blue', content: 'OB la diiwaangeliyey.' }]} />
        </Card>
      </div>

      <div className="ob-detail-side">
        <Card className="ob-card" title={<PanelTitle icon={<SafetyOutlined />} title="Maamulka Kiiska" />}>
          <div className="ob-manager">
            <div className="ob-avatar">{registeredOfficerInitials || 'SP'}</div>
            <div>
              <Text strong>{registeredOfficerName}</Text>
              <br />
              <Text type="secondary">Sarkaalka diiwaangeliyey OB-ga</Text>
            </div>
          </div>
          <div className="ob-meta-list">
            <span>Region:<strong>{ob.region_name || 'N/A'}</strong></span>
            <span>District:<strong>{ob.district_police_station_name || 'N/A'}</strong></span>
            <span>Station:<strong>{ob.district_police_station_name || 'N/A'}</strong></span>
          </div>
          {editableStatuses.includes(ob.status) && <Button block icon={<EditOutlined />} onClick={openEdit}>Beddel Sarkaalka</Button>}
        </Card>

        <Card className="ob-card" title={<PanelTitle icon={<TeamOutlined />} title="Dhibbanayaasha & Markhaatiyasha" />}>
          <div className="ob-mini-stats">
            <span>Dhibbanayaal<strong>{ob.victims?.length || 0}</strong></span>
            <span>Markhaatiyaal<strong>0</strong></span>
          </div>
          {(ob.victims || []).slice(0, 2).map((victim) => (
            <div className="ob-list-row" key={victim.id || victim.full_name}>
              <UserOutlined />
              <div><Text strong>{victim.full_name}</Text><br /><Text type="secondary">{victim.details || victim.phone || 'N/A'}</Text></div>
            </div>
          ))}
        </Card>

        <Card className="ob-card" title="Kooban Kiiska">
          <div className="ob-summary-grid">
            <span><TeamOutlined />Dhibbanayaal<strong>{ob.victims?.length || 0}</strong></span>
            <span><UserOutlined />Eedeysanayaal<strong>{ob.accused?.length || 0}</strong></span>
            <span><FileOutlined />Caddeymo<strong>{ob.attachments?.length || 0}</strong></span>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'investigator', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles]} requiredPermissions={['ob.view', 'ob.update', 'ob.print', 'cases.investigate']}>
      <div className="ob-page">
        <div className="ob-page-header ob-detail-header">
          <div>
            <div className="ob-breadcrumb">Diiwaanka OB-da / Faahfaahinta OB</div>
            <Title level={1}>{ob?.ob_number || id}</Title>
            <div className="ob-subtitle">{ob?.case_title || 'Faahfaahinta OB-ga'} - {ob?.district_police_station_name || 'Saldhigga'}</div>
            <Text>La diiwaangeliyey {ob?.registration_date || 'N/A'} {ob?.registration_time || ''}</Text>
          </div>
          <Space wrap>
            {statusTag}
            <Button icon={<DownloadOutlined />} onClick={() => window.print()}>Soo Deji</Button>
            <Button icon={<ReloadOutlined />} onClick={loadOb}>Cusboonaysii</Button>
            {ob && !closedAtOb && !converted && <Button type="primary" icon={<BankOutlined />} loading={converting} onClick={convertToCase}>U Gudbi Maxkamad</Button>}
            <Dropdown
              menu={{
                items: [
                  ...(ob && editableStatuses.includes(ob.status) ? [{ key: 'edit', label: 'Wax ka Beddel OB-ga', icon: <EditOutlined />, onClick: openEdit }] : []),
                  ...(ob && nextStatuses[ob.status] && !converted ? [{ key: 'advance', label: `U Gudbi: ${statusLabels[nextStatuses[ob.status]]}`, onClick: advanceStatus }] : []),
                  ...(!closedAtOb && !converted ? [{ key: 'resolve', label: 'Ku xalli OB-ga', icon: <CheckCircleOutlined />, onClick: () => setResolveOpen(true) }] : []),
                  ...(closedAtOb ? [{ key: 'reopen', label: 'Dib u fur OB', icon: <ReloadOutlined />, onClick: () => setReopenOpen(true) }] : []),
                ],
              }}
            >
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        </div>

        {loading ? (
          <Card className="ob-card" loading />
        ) : ob ? (
          <>
            {overview}

            {ob.attachments?.length > 0 && (
              <Card className="ob-card" title="Caddeymaha & Faylasha Ku Xiran">
                <Table className="ob-detail-table" rowKey="id" pagination={false} dataSource={ob.attachments} columns={[
                  { title: 'Magaca Faylka', dataIndex: 'file_name', render: (text) => <Space><PaperClipOutlined /> <Text strong>{text}</Text></Space> },
                  { title: 'Nooca', dataIndex: 'mime_type' },
                  { title: 'Kii Soo Upload-gareeyey', dataIndex: 'uploaded_by' },
                  { title: 'Ficil', render: (_, record) => <Button icon={<EyeOutlined />} href={record.file_url ? `http://localhost:5000${record.file_url}` : '#'} target="_blank">Eeg / Soo Degso</Button> },
                ]} />
              </Card>
            )}

            {ob.resolutionDocuments?.length > 0 && (
              <Card className="ob-card" title="Warqadaha Rasmiga ah ee Xalinta OB-ga">
                <Table className="ob-detail-table" rowKey="id" pagination={false} dataSource={ob.resolutionDocuments} columns={[
                  { title: 'Warqadda', dataIndex: 'document_title' },
                  { title: 'Nooca', dataIndex: 'document_type', render: (value) => <Tag color="blue">{value}</Tag> },
                  { title: 'Sameeyey', dataIndex: 'created_by' },
                  { title: 'Taariikhda', dataIndex: 'created_at' },
                  { title: 'Ficil', render: (_, record) => <Space><Button icon={<EyeOutlined />} onClick={() => openDocument(record)}>Hordhac</Button><Button icon={<PrinterOutlined />} onClick={() => openDocument(record, true)}>Daabac</Button></Space> },
                ]} />
              </Card>
            )}
          </>
        ) : null}

        <Modal title="Ku xalli oo xir OB-ga" open={resolveOpen} onCancel={() => setResolveOpen(false)} footer={null}>
          <Form form={resolveForm} layout="vertical" onFinish={resolveOb}>
            <Form.Item name="resolution_method" label="Nooca warqadda" rules={[{ required: true }]}>
              <Select onChange={(value) => resolveForm.setFieldValue('document_data', value === 'warning' ? { warning_reason: resolutionDefaults.warning } : resolutionDefaults[value] ? { agreement_terms: resolutionDefaults[value] } : {})} options={[
                { value: 'reconciliation', label: 'Heshiis Dib-u-Heshiisiin' },
                { value: 'warning', label: 'Warqad Digniin' },
                { value: 'mediation', label: 'Warqad Dhexdhexaadin' },
                { value: 'withdrawal', label: 'Ka-Noqoshada Cabashada' },
                { value: 'false_report', label: 'Caddeyn Warbixin Qaldan' },
                { value: 'general_agreement', label: 'Heshiis Guud' },
              ]} />
            </Form.Item>
            {resolutionMethod === 'reconciliation' && <><Form.Item name={['document_data', 'agreement_terms']} label="Agreement terms" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={6} /></Form.Item><Form.Item name={['document_data', 'witnesses']} label="Magaca markhaatiga" rules={[{ required: true }]}><Input /></Form.Item></>}
            {resolutionMethod === 'warning' && <Form.Item name={['document_data', 'warning_reason']} label="Arrinta digniinta la xiriirta" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item>}
            {resolutionMethod === 'mediation' && <><Form.Item name={['document_data', 'mediator_name']} label="Magaca dhexdhexaadiyaha" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name={['document_data', 'disputed_issues']} label="Arrinta la isku hayay" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item></>}
            {resolutionMethod === 'withdrawal' && <Form.Item name={['document_data', 'withdrawal_reason']} label="Arrinta / sababta cabashada looga noqday" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item>}
            {resolutionMethod === 'false_report' && <><Form.Item name={['document_data', 'incorrect_information']} label="Warbixintii qaldanayd" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} /></Form.Item><Form.Item name={['document_data', 'corrected_information']} label="Xogta saxda ah" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} /></Form.Item></>}
            {resolutionMethod === 'general_agreement' && <><Form.Item name={['document_data', 'agreement_terms']} label="Agreement terms" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={7} /></Form.Item><Form.Item name={['document_data', 'witness_1']} label="Magaca Markhaati 1" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name={['document_data', 'witness_2']} label="Magaca Markhaati 2" rules={[{ required: true }]}><Input /></Form.Item></>}
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setResolveOpen(false)}>Jooji</Button><Button icon={<EyeOutlined />} onClick={previewDraft}>Hordhac</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Abuur Warqad oo Xir</Button></Space>
          </Form>
        </Modal>

        <Modal width={850} title="Hordhaca Warqadda Xalinta" open={!!previewHtml} onCancel={() => setPreviewHtml('')} footer={<Space><Button onClick={() => setPreviewHtml('')}>Xir</Button><Button icon={<PrinterOutlined />} onClick={() => { const win = window.open('', '_blank'); win.document.write(previewHtml); win.document.close(); setTimeout(() => win.print(), 300); }}>Daabac / Soo Degso PDF</Button></Space>}><iframe className="ob-preview-frame" title="Hordhaca warqadda xalinta" srcDoc={previewHtml} style={{ width: '100%', height: '65vh' }} /></Modal>

        <Modal title="Dib u fur OB-ga" open={reopenOpen} onCancel={() => setReopenOpen(false)} footer={null}>
          <Form form={reopenForm} layout="vertical" onFinish={reopenOb}>
            <Form.Item name="reason" label="Sababta dib loogu furayo" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setReopenOpen(false)}>Jooji</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Dib u fur</Button></Space>
          </Form>
        </Modal>

        <Modal title={`Wax ka Beddel OB-ga - ${ob?.ob_number || ''}`} open={editOpen} onCancel={() => setEditOpen(false)} width={900} footer={null}>
          <Form form={editForm} layout="vertical" onFinish={updateOb}>
            <Card className="ob-modal-card" size="small" title="Xogta Dacwadda" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="case_title" label="Cinwaanka Dacwadda" rules={[{ required: true, message: 'Cinwaanka geli.' }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="incident_type" label="Nooca Dhacdada" rules={[{ required: true, message: 'Nooca dhacdada geli.' }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="incident_location" label="Goobta Dhacdada" rules={[{ required: true, message: 'Goobta geli.' }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="incident_datetime" label="Taariikhda iyo Waqtiga Dhacdada" rules={[{ required: true, message: 'Taariikhda geli.' }]}><DatePicker showTime style={{ width: '100%' }} disabledDate={(date) => date?.isAfter(new Date(), 'day')} /></Form.Item></Col>
                <Col span={24}><Form.Item name="description" label="Sharaxaadda Dacwadda" rules={[{ required: true, min: 10, message: 'Sharaxaad ugu yaraan 10 xaraf ah geli.' }]}><Input.TextArea rows={4} /></Form.Item></Col>
              </Row>
            </Card>
            <Card className="ob-modal-card" size="small" title="Xogta Dacwoodaha">
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item name="reported_by" label="Magaca oo Buuxa" rules={[{ required: true, message: 'Magaca geli.' }]}><Input /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item name="reporter_phone" label="Telefoonka" rules={[{ required: true, message: 'Telefoonka geli.' }]}><Input /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item name="reporter_id_type" label="Nooca Aqoonsiga"><Select options={['Aqoonsiga Qaranka', 'Baasaboor', 'Laysanka Darawalnimada', 'Aqoonsiga Booliska/Milatariga', 'Kale'].map((value) => ({ value, label: value }))} /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item name="reporter_id_number" label="Lambarka Aqoonsiga"><Input /></Form.Item></Col>
                <Col xs={24} md={16}><Form.Item name="reporter_address" label="Cinwaanka"><Input /></Form.Item></Col>
              </Row>
            </Card>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}><Button onClick={() => setEditOpen(false)}>Jooji</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Kaydi Isbeddellada</Button></Space>
          </Form>
        </Modal>

        <Modal title={`Diiwaangeli Qabashada - ${arrestTarget?.full_name || ''}`} open={!!arrestTarget} onCancel={() => setArrestTarget(null)} footer={null}>
          <Form form={arrestForm} layout="vertical" onFinish={registerArrest}>
            <Form.Item name="arrest_date" label="Taariikhda iyo Waqtiga Qabashada" rules={[{ required: true, message: 'Taariikhda qabashada geli.' }]}><DatePicker showTime style={{ width: '100%' }} disabledDate={(date) => date?.isAfter(new Date(), 'day')} /></Form.Item>
            <Form.Item name="arrest_location" label="Goobta Lagu Qabtay" rules={[{ required: true, min: 3, message: 'Goobta qabashada geli.' }]}><Input /></Form.Item>
            <Form.Item name="arresting_officer" label="Sarkaalka Qabtay" rules={[{ required: true, message: 'Sarkaalka qabtay geli.' }]}><Input /></Form.Item>
            <Form.Item name="notes" label="Faallooyin"><Input.TextArea rows={3} /></Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setArrestTarget(null)}>Jooji</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Ku Diiwaangeli OB-ga Jira</Button></Space>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
