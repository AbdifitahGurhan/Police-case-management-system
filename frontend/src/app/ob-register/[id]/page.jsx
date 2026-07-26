'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, EyeOutlined, FileAddOutlined, FileOutlined, PaperClipOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatUSD } from '@/utils/currency';

const { Title, Text, Paragraph } = Typography;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const resolutionContexts = {
  mediation: 'Kadib wada-hadal, labada dhinac waxay ku heshiiyeen:\n\n1. In khilaafka lagu soo afjaro nabad.\n2. In labada dhinac ixtiraamaan xuquuqda midba midka kale.\n3. In aan dib loo soo celin muranka.',
  withdrawal: 'Kadib heshiis iyo wada-hadal, waxaan go’aansaday inaan ka noqdo cabashadii aan gudbiyay.\n\nGo’aankan waxaan ku gaaray rabitaankayga anigoon cadaadis lagu saarin.',
  false_report: 'Waxaan caddeynayaa in warbixintii hore ay ahayd warbixin aan sax ahayn oo aan si buuxda uga tarjumayn xaqiiqada. Waxaan codsanayaa in la saxo diiwaanka arrintan.',
};
const resolutionDefaults = {
  reconciliation: '1. In khilaafkii lagu dhammeeyo nabad iyo is-afgarad.\n2. In labada dhinac ay is cafiyeen.\n3. In aysan sameyn doonin wax kale oo khilaaf cusub keena.\n4. In heshiiskan lagu dhaqmo wixii maanta ka dambeeya.',
  warning: 'Waxaa lagaa codsanayaa inaad joojiso fal kasta oo keeni kara khilaaf ama dhibaato kale.\n\nHaddii digniintan la iska indho tiro, waxaa la qaadi karaa tallaabo waafaqsan sharciga.',
  general_agreement: 'Labada dhinac waxay ku heshiiyeen:\n\n1. In khilaafkii hore la soo afjaro.\n2. In mid kasta ixtiraamo kan kale.\n3. In aan la sameyn wax fal ah oo keena muran cusub.\n4. In wixii dhacay lagu xalliyo wada-hadal iyo sharci.',
};

export default function ObDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [ob, setOb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveForm] = Form.useForm();
  const [reopenForm] = Form.useForm();
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
      message.error(error.response?.data?.message || 'Failed to load OB entry.');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    if (id) loadOb();
  }, [id, loadOb]);

  const converted = ob?.linked_case_id || ['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob?.status);
  const resolutionStatuses=['CLOSED','RESOLVED_BY_RECONCILIATION','WARNING_ISSUED','MEDIATION_COMPLETED','COMPLAINT_WITHDRAWN','FALSE_REPORT_CORRECTED','GENERAL_AGREEMENT_COMPLETED'];
  const closedAtOb = resolutionStatuses.includes(ob?.status) && !ob?.linked_case_id;

  const resolveOb = async (values) => {
    setActionLoading(true);
    try {
      await api.post(`/ob-entries/${id}/resolve`,{resolution_method:values.resolution_method,document_data:values.document_data||{}});
      setResolveOpen(false); resolveForm.resetFields(); await loadOb();
    } catch(error){message.error(error.response?.data?.message||'OB-ga lama xirin karin.')} finally{setActionLoading(false)}
  };

  const openDocument = async (document, print=false) => {
    try { const response=await api.get(`/ob-entries/${id}/resolution-documents/${document.id}`); const html=response.data.data.official_html; if(print){const win=window.open('','_blank');win.document.write(html);win.document.close();setTimeout(()=>win.print(),300)}else setPreviewHtml(html); }
    catch(error){message.error(error.response?.data?.message||'Warqadda lama furi karin.')}
  };

  const previewDraft = async () => {
    try { const values=await resolveForm.validateFields(); const details=Object.entries(values.document_data||{}).map(([k,v])=>`<p><b>${k.replaceAll('_',' ')}:</b> ${String(v||'').replaceAll('\n','<br>')}</p>`).join(''); const fixed=(resolutionContexts[values.resolution_method]||'').replaceAll('\n','<br>'); setPreviewHtml(`<html><body style="font-family:Arial;padding:35px;line-height:1.65"><h2 style="text-align:center">${values.resolution_method.replaceAll('_',' ').toUpperCase()}</h2><p><b>OB Number:</b> ${ob.ob_number}</p><p><b>Dacwoodaha:</b> ${ob.reported_by} — ID: ${ob.reporter_id_number||'N/A'} — Tel: ${ob.reporter_phone||'N/A'}</p><p><b>Laga dacwooday:</b> ${ob.respondent_name||'N/A'} — ID: ${ob.respondent_id_number||'N/A'} — Tel: ${ob.respondent_phone||'N/A'}</p><hr>${fixed?`<p>${fixed}</p>`:''}${details}<p style="margin-top:50px">Saxiixa Dhinaca Koowaad: ____________________</p><p style="margin-top:35px">Saxiixa Dhinaca Labaad: ____________________</p><p style="margin-top:35px">Sarkaal/Markhaati: ____________________</p></body></html>`); } catch{}
  };

  const reopenOb = async (values) => {
    setActionLoading(true);
    try { await api.post(`/ob-entries/${id}/reopen`,values); setReopenOpen(false); reopenForm.resetFields(); await loadOb(); }
    catch(error){message.error(error.response?.data?.message||'OB-ga dib looma furi karin.')} finally{setActionLoading(false)}
  };

  const convertToCase = async () => {
    setConverting(true);
    try {
      const response = await api.post(`/ob-entries/${id}/convert-to-case`);
      message.success(response.data.alreadyExists ? `Existing case opened: ${response.data.caseNumber}` : `Case opened from OB: ${response.data.caseNumber}`);
      if (canReadCases) {
        router.push(`/cases/${response.data.caseId}`);
      } else {
        router.push('/ob-register');
      }
    } catch (error) {
      const existingCaseId = error.response?.data?.caseId;
      if (existingCaseId) {
        message.warning(error.response?.data?.message || 'This OB already has a case.');
        if (canReadCases) {
          router.push(`/cases/${existingCaseId}`);
        } else {
          router.push('/ob-register');
        }
        return;
      }
      message.error(error.response?.data?.message || 'Failed to convert OB to case.');
    } finally {
      setConverting(false);
    }
  };

  const getLevelTag = (level) => {
    if (level === 'urgent') return <Tag color="orange">Degdeg (Urgent)</Tag>;
    if (level === 'critical') return <Tag color="red">Halis (Critical)</Tag>;
    return <Tag color="blue">Caadi (Normal)</Tag>;
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Space orientation="vertical">
            <Link href="/ob-register">
              <Button type="text" icon={<ArrowLeftOutlined />}>Dib ugu laab OB Register</Button>
            </Link>
            <Title level={2} style={{ margin: 0 }}>Faahfaahinta OB-ga: {ob?.ob_number || id}</Title>
            <Text type="secondary">Xogta dhammaystiran ee diiwaanka buugga dhacdooyinka (Occurrence Book).</Text>
          </Space>
          <Space wrap>
            {ob?.status && <Tag color={converted ? 'green' : closedAtOb ? 'purple' : 'blue'}>{ob.status}</Tag>}
            {closedAtOb && <Button icon={<ReloadOutlined/>} onClick={()=>setReopenOpen(true)}>Dib u fur OB</Button>}
            {ob && !closedAtOb && (converted ? (
              ob?.linked_case_id && canReadCases ? (
                <Link href={`/cases/${ob.linked_case_id}`}>
                  <Button type="primary">Faqidaad Kiiska Ku Xiran</Button>
                </Link>
              ) : (
                <Button disabled>OB-gan waxaa loo beddelay kiis.</Button>
              )
            ) : (
              <>
                <Button icon={<CheckCircleOutlined/>} onClick={()=>setResolveOpen(true)}>Ku xalli OB-ga</Button>
                <Link href={`/cases/new?ob_entry_id=${ob.id}`}>
                  <Button icon={<FileAddOutlined />}>Foomka Kiiska Buuxa</Button>
                </Link>
                <Button type="primary" icon={<FileAddOutlined />} loading={converting} onClick={convertToCase}>
                  U beddel Kiis
                </Button>
              </>
            ))}
          </Space>
        </div>

        {loading ? (
          <Card variant="none" loading={true} />
        ) : ob ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {/* Card 1: Xogta Dacwadda & Dhacdada */}
            <Card variant="none" title="1. Xogta Dacwadda & Dhacdada (Case & Incident Information)">
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Lambarka OB (OB Number)"><Text strong>{ob.ob_number}</Text></Descriptions.Item>
                <Descriptions.Item label="Heerka (Status)"><Tag color={converted ? 'green' : 'blue'}>{ob.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Cinwaanka Dacwadda">{ob.case_title || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Nooca Dacwadda">{ob.case_type || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Heerka Muhiimada">{getLevelTag(ob.case_level)}</Descriptions.Item>
                <Descriptions.Item label="Nooca Dhacdada"><Text strong>{ob.incident_type || 'N/A'}</Text></Descriptions.Item>
                <Descriptions.Item label="Goobta Dhacdada">{ob.incident_location || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Taariikhda Dhacdada">{ob.incident_datetime || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Qiimaha Dacwadda (Claim USD)" span={2}>
                  <Text strong style={{ color: '#2563EB', fontSize: 16 }}>
                    {ob.claim_value != null ? formatUSD(ob.claim_value) : 'N/A'}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Card 2: Dacwoodaha */}
            <Card variant="none" title="2. Xogta Dacwoodaha (Complainant / Reporter)">
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Magaca Dacwoodaha"><Text strong>{ob.reported_by || 'N/A'}</Text></Descriptions.Item>
                <Descriptions.Item label="Telefoonka">{ob.reporter_phone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Nooca Aqoonsiga">{ob.reporter_id_type || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Lambarka Aqoonsiga">{ob.reporter_id_number || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Email-ka">{ob.reporter_email || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Cinwaanka">{ob.reporter_address || 'N/A'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Card 3: Laga Dacwooday */}
            <Card variant="none" title="3. Xogta Laga Dacwooday (Respondent / Accused)">
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Magaca Laga Dacwooday"><Text strong>{ob.respondent_name || 'N/A'}</Text></Descriptions.Item>
                <Descriptions.Item label="Telefoonka">{ob.respondent_phone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Nooca Aqoonsiga">{ob.respondent_id_type || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Lambarka Aqoonsiga">{ob.respondent_id_number || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Email-ka">{ob.respondent_email || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Cinwaanka">{ob.respondent_address || 'N/A'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Card 4: Sharaxaadda Dhacdada */}
            <Card variant="none" title="4. Sharaxaadda Faahfaahsan (Incident Description)">
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 14, lineHeight: 1.6 }}>
                {ob.description || 'Lama diiwaangelin sharaxaad.'}
              </Paragraph>
            </Card>

            {/* Card 5: Caddeymaha & Faylasha */}
            {ob.attachments && ob.attachments.length > 0 && (
              <Card variant="none" title={`5. Caddeymaha & Faylasha Ku Xiran (${ob.attachments.length})`}>
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={ob.attachments}
                  columns={[
                    {
                      title: 'Magaca Faylka',
                      dataIndex: 'file_name',
                      key: 'file_name',
                      render: (text) => <Space><PaperClipOutlined /> <Text strong>{text}</Text></Space>,
                    },
                    { title: 'Nooca', dataIndex: 'mime_type', key: 'mime_type' },
                    {
                      title: 'Baaxadda (Size)',
                      dataIndex: 'file_size',
                      key: 'file_size',
                      render: (size) => size ? `${(size / 1024).toFixed(1)} KB` : 'N/A',
                    },
                    { title: 'Kii Soo Upload-gareeyey', dataIndex: 'uploaded_by', key: 'uploaded_by' },
                    {
                      title: 'Ficil',
                      key: 'action',
                      render: (_, record) => (
                        <Button
                          icon={<EyeOutlined />}
                          href={record.file_url ? `http://localhost:5000${record.file_url}` : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Eeg / Soo Degso
                        </Button>
                      ),
                    },
                  ]}
                />
              </Card>
            )}

            {/* Card 6: Xogta Diiwaangelinta & Location */}
            <Card variant="none" title="6. Xogta Diiwaangelinta & Xafiiska (Registration Metadata)">
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Sarkaalka Diiwaangeliyey">{ob.registered_by_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Doorka (Role)"><Tag color="blue">{ob.registered_by_role || 'N/A'}</Tag></Descriptions.Item>
                <Descriptions.Item label="Darajada (Rank)">{ob.registered_by_rank || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Taariikhda Diiwaangelinta">{ob.registration_date} {ob.registration_time || ''}</Descriptions.Item>
                <Descriptions.Item label="Dowlad Goboleedka (State)">{ob.state_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Gobolka (Region)">{ob.region_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Degmada / Saldhigga" span={2}>{ob.district_police_station_name || 'N/A'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Card 7: Xogta Xalinta haddii la xiray */}
            {closedAtOb && (
              <Card variant="none" title="7. Xogta Xalinta & Xiritaanka OB-ga (Resolution Details)">
                <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="Habka Xalinta">{ob.resolution_method || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Sarkaalka Xiray">{ob.resolved_by || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Waqtiga Xalinta">{ob.resolved_at || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Dhinacyada Heshiiyey">{ob.resolution_parties || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Qoraalka Xalinta" span={2}>
                    <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ob.resolution_notes || 'N/A'}</Paragraph>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* Warqadaha Xalinta (haddii ay jiraan) */}
            {ob?.resolutionDocuments?.length > 0 && (
              <Card variant="none" title="Warqadaha Rasmiga ah ee Xalinta OB-ga">
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={ob.resolutionDocuments}
                  columns={[
                    { title: 'Warqadda', dataIndex: 'document_title' },
                    { title: 'Nooca', dataIndex: 'document_type', render: (v) => <Tag color="blue">{v}</Tag> },
                    { title: 'Sameeyey', dataIndex: 'created_by' },
                    { title: 'Taariikhda', dataIndex: 'created_at' },
                    {
                      title: 'Ficil',
                      render: (_, record) => (
                        <Space>
                          <Button icon={<EyeOutlined />} onClick={() => openDocument(record)}>Preview</Button>
                          <Button icon={<PrinterOutlined />} onClick={() => openDocument(record, true)}>Print</Button>
                          <Button icon={<DownloadOutlined />} onClick={() => openDocument(record, true)}>Download PDF</Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </Space>
        ) : null}

        {/* Modal-ada Resolution, Preview & Reopen */}
        <Modal title="Ku xalli oo xir OB-ga" open={resolveOpen} onCancel={() => setResolveOpen(false)} footer={null}>
          <Form form={resolveForm} layout="vertical" onFinish={resolveOb}>
            <Form.Item name="resolution_method" label="Nooca warqadda" rules={[{ required: true }]}><Select onChange={(value) => resolveForm.setFieldValue('document_data', value === 'warning' ? { warning_reason: resolutionDefaults.warning } : resolutionDefaults[value] ? { agreement_terms: resolutionDefaults[value] } : {})} options={[{ value: 'reconciliation', label: 'Heshiis Dib-u-Heshiisiin' }, { value: 'warning', label: 'Warqad Digniin' }, { value: 'mediation', label: 'Warqad Dhexdhexaadin' }, { value: 'withdrawal', label: 'Ka-Noqoshada Cabashada' }, { value: 'false_report', label: 'Caddeyn Warbixin Qaldan' }, { value: 'general_agreement', label: 'Heshiis Guud' }]} /></Form.Item>
            {resolutionMethod && resolutionContexts[resolutionMethod] && <Card size="small" title="Qoraalka rasmiga ah ee warqadda" style={{ marginBottom: 16, background: '#fafafa' }}><Paragraph style={{ whiteSpace: 'pre-line', margin: 0 }}>{resolutionContexts[resolutionMethod]}</Paragraph></Card>}
            {resolutionMethod === 'reconciliation' && <><Form.Item name={['document_data', 'agreement_terms']} label="Agreement terms" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={6} /></Form.Item><Form.Item name={['document_data', 'witnesses']} label="Magaca markhaatiga" rules={[{ required: true }]}><Input /></Form.Item></>}
            {resolutionMethod === 'warning' && <Form.Item name={['document_data', 'warning_reason']} label="Arrinta digniinta la xiriirta" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item>}
            {resolutionMethod === 'mediation' && <><Form.Item name={['document_data', 'mediator_name']} label="Magaca dhexdhexaadiyaha" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name={['document_data', 'disputed_issues']} label="Arrinta la isku hayay" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item></>}
            {resolutionMethod === 'withdrawal' && <Form.Item name={['document_data', 'withdrawal_reason']} label="Arrinta / sababta cabashada looga noqday" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item>}
            {resolutionMethod === 'false_report' && <><Form.Item name={['document_data', 'incorrect_information']} label="Warbixintii qaldanayd" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} /></Form.Item><Form.Item name={['document_data', 'corrected_information']} label="Xogta saxda ah" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} /></Form.Item></>}
            {resolutionMethod === 'general_agreement' && <><Form.Item name={['document_data', 'agreement_terms']} label="Agreement terms" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={7} /></Form.Item><Form.Item name={['document_data', 'witness_1']} label="Magaca Markhaati 1" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name={['document_data', 'witness_2']} label="Magaca Markhaati 2" rules={[{ required: true }]}><Input /></Form.Item></>}
            {resolutionMethod && <Tag color="gold" style={{ marginBottom: 16 }}>Meelaha saxiixyada warqadda daabacan way bannaan yihiin si gacanta loogu saxiixo.</Tag>}
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setResolveOpen(false)}>Jooji</Button><Button icon={<EyeOutlined />} onClick={previewDraft}>Preview</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Abuur Warqad & Xir</Button></Space>
          </Form>
        </Modal>
        <Modal width={850} title="Preview Warqadda Xalinta" open={!!previewHtml} onCancel={() => setPreviewHtml('')} footer={<Space><Button onClick={() => setPreviewHtml('')}>Xir</Button><Button icon={<PrinterOutlined />} onClick={() => { const win = window.open('', '_blank'); win.document.write(previewHtml); win.document.close(); setTimeout(() => win.print(), 300); }}>Print / Download PDF</Button></Space>}><iframe title="Resolution document preview" srcDoc={previewHtml} style={{ width: '100%', height: '65vh', border: '1px solid #ddd' }} /></Modal>
        <Modal title="Dib u fur OB-ga" open={reopenOpen} onCancel={() => setReopenOpen(false)} footer={null}>
          <Form form={reopenForm} layout="vertical" onFinish={reopenOb}><Form.Item name="reason" label="Sababta dib loogu furayo" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} /></Form.Item><Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setReopenOpen(false)}>Jooji</Button><Button type="primary" htmlType="submit" loading={actionLoading}>Dib u fur</Button></Space></Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}

