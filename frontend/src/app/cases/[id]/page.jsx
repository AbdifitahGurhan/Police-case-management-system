// src/app/cases/[id]/page.jsx
'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Space, Tag, Button, Tabs, Descriptions, 
  Timeline, Table, Modal, Form, Input, Select, Upload, Divider, App,
  DatePicker
} from 'antd';
import { 
  ArrowLeftOutlined, EditOutlined, ShareAltOutlined, PlusOutlined,
  UserAddOutlined, SolutionOutlined, FileAddOutlined, HistoryOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import HashVerifier from '@/components/shared/HashVerifier';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  disabledFutureDate,
  nameRules,
  noFutureDateTimeRule,
  phoneRules,
  positiveIntegerRule,
  requiredRule,
  textLengthRule,
} from '@/utils/validation';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function CaseDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isWitnessModalOpen, setIsWitnessModalOpen] = useState(false);
  const [isArrestModalOpen, setIsArrestModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [suspectFaceImage, setSuspectFaceImage] = useState('');
  const [geography, setGeography] = useState({ regions: [], districts: [], wards: [] });
  const [transferHistory, setTransferHistory] = useState([]);
  
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchCaseDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cases/${id}`);
      setData(res.data.data);
      // Fetch transfers
      const tRes = await api.get(`/transfers/history/${id}`);
      setTransferHistory(tRes.data.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load case details.");
      router.push('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, message, router]);

  const fetchGeography = async () => {
    try {
      const res = await api.get('/stations/geography');
      setGeography(res.data.data);
    } catch (err) {
      console.error("Geography load failed", err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCaseDetails();
      fetchGeography();
    }
  }, [id, fetchCaseDetails]);

  const handleUpdateStatus = async (values) => {
    setSubmitting(true);
    try {
      await api.put(`/cases/${id}`, { status: values.status });
      message.success("Case status updated successfully.");
      setIsStatusModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Update failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReferral = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/referrals', { ...values, case_id: id });
      message.success(`Case referred to ${values.referred_to_role.toUpperCase()} successfully.`);
      setIsReferralModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Referral failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArrest = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        case_id: id,
        suspect_id: selectedSuspect.id,
        arrest_date: values.arrest_date ? values.arrest_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        sentence_start_date: values.sentence_start_date ? values.sentence_start_date.format('YYYY-MM-DD') : undefined,
      };
      const res = await api.post('/arrests', payload);
      message.success(res.data?.message || "Arrest record created successfully.");
      setIsArrestModalOpen(false);
      form.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to record arrest.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspect = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/suspects', {
        ...values,
        case_id: id,
        face_capture_image: suspectFaceImage || null,
        arrest_status: values.arrest_status || 'not_arrested',
      });
      message.success("Suspect added successfully.");
      setIsSuspectModalOpen(false);
      setSuspectFaceImage('');
      form.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to add suspect.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspectFaceUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      message.error('Please upload a JPG, PNG, or WEBP face image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSuspectFaceImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleWitness = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/witnesses', { ...values, case_id: id });
      message.success("Witness and statement recorded.");
      setIsWitnessModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Failed to record witness.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvidence = async (values) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('case_id', id);
      formData.append('title', values.title);
      formData.append('type', values.type);
      formData.append('description', values.description || '');
      formData.append('location_found', values.location_found || '');
      formData.append('collection_date', values.collection_date || dayjs().format('YYYY-MM-DD'));
      
      if (values.file?.[0]?.originFileObj) {
        formData.append('file', values.file[0].originFileObj);
      }

      await api.post('/evidence', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      message.success("Evidence uploaded successfully.");
      setIsEvidenceModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Failed to upload evidence.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmation = async (status, comments) => {
    setSubmitting(true);
    try {
      await api.post('/confirmations/respond', { case_id: id, status, comments });
      message.success(`Case ${status} successfully.`);
      fetchCaseDetails();
    } catch (err) {
      message.error("Action failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/transfers', { ...values, case_id: id });
      message.success("Transfer initiated successfully.");
      setIsTransferModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitForReview = async () => {
    try {
      await api.post('/confirmations/submit', { case_id: id });
      message.success("Submitted for Ward Commander review.");
      fetchCaseDetails();
    } catch (err) {
      message.error("Submission failed.");
    }
  };

  if (loading) return <Card loading={true} />;
  if (!data) return <p>Case not found.</p>;

  const role = user?.role;
  const stationOperationRoles = ['district_admin', 'neighborhood_admin'];
  const canSubmitForReview = ['admin', 'officer', ...stationOperationRoles].includes(role);
  const canReviewCase = ['admin', 'ward_commander'].includes(role);
  const canTransferCase = ['admin', 'ward_commander'].includes(role);
  const canUpdateStatus = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const canReferCase = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const canManageInvestigation = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const canAddWitness = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const caseEndedAtCourtReferral = data.status === 'referred_to_court';

  const referralTab = (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Case Referrals</Title>
        {canReferCase && !caseEndedAtCourtReferral && (
          <Button
            type="primary"
            icon={<ShareAltOutlined />}
            onClick={() => setIsReferralModalOpen(true)}
          >
            Refer Case
          </Button>
        )}
      </div>
      <Table 
        dataSource={data.referrals} 
        rowKey={(record) => `referral-${record.id || `${record.referred_to_role}-${record.referred_at}`}`}
        columns={[
          { title: 'Date', dataIndex: 'referred_at', render: d => dayjs(d).format('DD MMM YYYY') },
          { title: 'To', dataIndex: 'referred_to_role', render: r => <Tag color="purple">{r.toUpperCase()}</Tag> },
          { title: 'By', dataIndex: 'referred_by_name' },
          { title: 'Status', dataIndex: 'status', render: s => <Tag color={s === 'pending' ? 'orange' : 'green'}>{s.toUpperCase()}</Tag> },
          { title: 'Reason', dataIndex: 'reason' },
        ]} 
      />
    </Space>
  );

  const evidenceTab = (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Physical & Digital Evidence</Title>
        {canManageInvestigation && !caseEndedAtCourtReferral && (
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={() => setIsEvidenceModalOpen(true)}
          >
            Add Evidence
          </Button>
        )}
      </div>
      <Row gutter={[16, 16]}>
        {data.evidence.map((ev, index) => (
          <Col xs={24} md={12} key={`evidence-${ev.id}-${index}`}>
            <Card title={ev.title} extra={<Tag>{ev.type.toUpperCase()}</Tag>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Evidence #">{ev.evidence_number}</Descriptions.Item>
                <Descriptions.Item label="Date Collected">{dayjs(ev.collection_date).format('DD MMM YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Location">{ev.location_found}</Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: '8px 0' }} />
              <HashVerifier entityType="evidence" entityId={ev.id} initialHash={ev.hash_sha256} />
              {ev.file_url && (
                <div style={{ marginTop: 12 }}>
                  <Button type="link" size="small" href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}${ev.file_url}`} target="_blank">
                    View File Attachment
                  </Button>
                </div>
              )}
              {ev.custodyLog && ev.custodyLog.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Text strong size="small">Custody History:</Typography.Text>
                  <Timeline 
                    mode="left"
                    size="small"
                    style={{ marginTop: 8 }}
                    items={ev.custodyLog.map((c, custodyIndex) => ({
                      key: `custody-${ev.id}-${c.id || custodyIndex}`,
                      content: `${dayjs(c.transfer_date).format('DD MMM')}: ${c.reason} (${c.to_name})`,
                    }))}
                  />
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );

  const suspectsTab = (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Suspects</Title>
        {canManageInvestigation && !caseEndedAtCourtReferral && (
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => {
              form.resetFields();
              setSuspectFaceImage('');
              setIsSuspectModalOpen(true);
            }}
          >
            Add Suspect
          </Button>
        )}
      </div>
      <Table 
        dataSource={data.suspects} 
        rowKey={(record) => `suspect-${record.id || `${record.full_name}-${record.role_in_case}`}`}
        columns={[
          {
            title: 'Face',
            dataIndex: 'face_image',
            render: (src, record) => src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${src}`.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'}${src}` : src} alt={record.full_name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />
            ) : <Tag>Not Captured</Tag>
          },
          { title: 'Full Name', dataIndex: 'full_name', render: (t, r) => <Typography.Text strong>{t} {r.alias && `(${r.alias})`}</Typography.Text> },
          { title: 'Gender', dataIndex: 'gender' },
          { title: 'Age', dataIndex: 'age' },
          { title: 'Phone', dataIndex: 'phone' },
          { title: 'Face Status', dataIndex: 'face_capture_status', render: s => <Tag color={s === 'Captured' ? 'green' : 'default'}>{s}</Tag> },
          { title: 'Arrest Status', dataIndex: 'arrest_status', render: (s, r) => <Tag color={r.is_arrested ? 'red' : 'default'}>{s || (r.is_arrested ? 'arrested' : 'not_arrested')}</Tag> },
          { title: 'Linked Date', dataIndex: 'linked_at', render: d => d ? dayjs(d).format('DD MMM YYYY') : 'N/A' },
          { title: 'Role', dataIndex: 'role_in_case' },
          { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => canManageInvestigation && !caseEndedAtCourtReferral && !record.is_arrested && (
              <Button size="small" icon={<PlusOutlined />} onClick={() => { setSelectedSuspect(record); setIsArrestModalOpen(true); }}>
                Record Arrest
              </Button>
            )
          }
        ]} 
      />
    </Space>
  );

  const timelineTab = (
    <div style={{ padding: '20px 0' }}>
      <Timeline
        mode="start"
        items={data.actions.map((action, index) => ({
          key: `action-${action.id || index}`,
          title: dayjs(action.created_at).format('DD MMM YYYY HH:mm'),
          content: (
            <Space orientation="vertical">
              <Typography.Text strong>{action.action_type.replace('_', ' ')}</Typography.Text>
              <Typography.Text type="secondary">{action.description}</Typography.Text>
              <Typography.Text size="small">By: {action.performed_by_name}</Typography.Text>
            </Space>
          ),
          color: action.action_type === 'CASE_CREATED' ? 'green' : 'blue'
        }))}
      />
    </div>
  );

  return (
    <ProtectedRoute>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space orientation="vertical">
            <Link href="/cases">
              <Button type="text" icon={<ArrowLeftOutlined />}>Return to Case Inventory</Button>
            </Link>
            <Space align="center">
              <Title level={2} style={{ margin: 0 }}>Case Profile: {data.ob_number}</Title>
              <CaseStatusTag status={data.status} />
            </Space>
            <Text type="secondary">Registered by {data.officer_name} ({data.officer_badge}) at {data.station_name}</Text>
          </Space>
          
          <Space>
            {canSubmitForReview && data.status === 'draft' && (
              <Button type="primary" onClick={submitForReview}>Submit for Review</Button>
            )}
            
            {canReviewCase && data.status === 'pending_commander_review' && (
              <Space>
                <Button type="primary" color="success" variant="solid" onClick={() => handleConfirmation('confirmed', 'Verified.')}>Confirm Case</Button>
                <Button onClick={() => handleConfirmation('returned', 'Correction needed.')}>Return</Button>
                <Button danger onClick={() => handleConfirmation('rejected', 'Rejected.')}>Reject</Button>
              </Space>
            )}

            {canTransferCase && !caseEndedAtCourtReferral && <Button icon={<EnvironmentOutlined />} onClick={() => setIsTransferModalOpen(true)}>Transfer</Button>}
            {canUpdateStatus && !caseEndedAtCourtReferral && <Button icon={<EditOutlined />} onClick={() => setIsStatusModalOpen(true)}>Update Status</Button>}
            {canReferCase && !caseEndedAtCourtReferral && <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setIsReferralModalOpen(true)}>Refer Case</Button>}
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card variant="none">
              <Tabs
                defaultActiveKey="details"
                items={[
                  { key: 'details', label: 'Overview', children: (
                    <Space orientation="vertical" style={{ width: '100%' }} size="large">
                      <Descriptions title="Incident Particulars" bordered column={1}>
                        <Descriptions.Item label="Case Number">{data.case_number || data.id}</Descriptions.Item>
                        <Descriptions.Item label="Subject / Nature">{data.title}</Descriptions.Item>
                        <Descriptions.Item label="Category">{data.case_type}</Descriptions.Item>
                        <Descriptions.Item label="Incident Type">{data.incident_type || data.title}</Descriptions.Item>
                        <Descriptions.Item label="Priority"><Tag>{data.priority?.toUpperCase()}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Incident Date">{dayjs(data.incident_date).format('DD MMM YYYY')}</Descriptions.Item>
                        <Descriptions.Item label="Location">{data.incident_location}</Descriptions.Item>
                        <Descriptions.Item label="Occurrence Details">
                          <Paragraph>{data.description}</Paragraph>
                        </Descriptions.Item>
                      </Descriptions>

                      <Descriptions title="Linked OB Information" bordered column={1}>
                        <Descriptions.Item label="Linked OB Number">{data.ob_number}</Descriptions.Item>
                        <Descriptions.Item label="Original OB Staff">{data.ob_registered_by_name || data.original_ob_staff_name || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="OB Registration Date">
                          {data.ob_registration_date ? `${dayjs(data.ob_registration_date).format('DD MMM YYYY')} ${data.ob_registration_time || ''}` : 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="State">{data.state_name || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Region">{data.region_name || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="District / Police Station">{data.district_name || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Waax">{data.ward_name || 'N/A'}</Descriptions.Item>
                      </Descriptions>

                      <Descriptions title="Complainant Snapshot" bordered column={2}>
                        <Descriptions.Item label="Full Name">{data.complainant_name}</Descriptions.Item>
                        <Descriptions.Item label="Phone">{data.complainant_phone}</Descriptions.Item>
                      </Descriptions>
                      
                      <div style={{ padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px', background: '#fafafa' }}>
                        <HashVerifier entityType="case" entityId={data.id} />
                      </div>

                      <Card title="Transfer & Proof History" size="small">
                        <Tabs items={[
                          { key: 'transfers', label: 'Transfers', children: (
                            transferHistory.length === 0 ? <Text type="secondary">No transfer history.</Text> : (
                              <Timeline items={transferHistory.map((t, index) => ({
                                key: `transfer-${t.id || index}`,
                                content: (
                                  <>
                                    <Text strong>{t.transfer_type.toUpperCase()} Transfer</Text> to {t.to_region_name || 'New Ward'}<br/>
                                    <Text type="secondary" style={{ fontSize: '11px' }}>By {t.transferred_by_name} on {dayjs(t.transferred_at).format('DD MMM YYYY HH:mm')}</Text><br/>
                                    <Text italic style={{ display: 'block', marginTop: 4 }}>Reason: {t.transfer_reason}</Text>
                                  </>
                                )
                              }))} />
                            )
                          )},
                          { key: 'proofs', label: 'Blockchain Proofs', children: (
                            <Timeline items={data.actions.filter(a => a.action_type === 'CONFIRMED_BY_COMMANDER' || a.action_type.includes('TRANSFER')).map((a, index) => ({
                              key: `proof-${a.id || index}`,
                              content: (
                                <>
                                  <Text strong>Integrity Proof Generated</Text><br/>
                                  <Text type="secondary" style={{ fontSize: '11px' }}>Version recorded at {dayjs(a.created_at).format('DD MMM YYYY HH:mm')}</Text>
                                </>
                              )
                            }))} />
                          )}
                        ]} />
                      </Card>
                    </Space>
                  )},
                  { key: 'suspects', label: `Suspects (${data.suspects.length})`, children: suspectsTab },
                  { key: 'evidence', label: `Evidence (${data.evidence.length})`, children: evidenceTab },
                  { key: 'referrals', label: `Referrals (${data.referrals.length})`, children: referralTab },
                  { key: 'timeline', label: 'History / Audit Log', children: timelineTab },
                ]}
              />
            </Card>
          </Col>
          
          <Col xs={24} lg={8}>
            <Card title="Case Assignment" variant="none" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Region">{data.region_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="District">{data.district_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Ward">{data.ward_name || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Station">{data.station_name}</Descriptions.Item>
                <Descriptions.Item label="Reporting Officer">{data.officer_name}</Descriptions.Item>
                <Descriptions.Item label="Assigned CID">{data.cid_name || <Text type="secondary">Unassigned</Text>}</Descriptions.Item>
              </Descriptions>
            </Card>
            
            <Card title="Victims & Witnesses" variant="none">
               <Space orientation="vertical" style={{ width: '100%' }}>
                  <Text strong>Victims ({data.victims.length})</Text>
                  {data.victims.length === 0 ? <Text type="secondary" size="small">No victims recorded</Text> : 
                    data.victims.map((v, index) => <Tag key={`victim-${v.id}-${index}`}>{v.full_name}</Tag>)}
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text strong>Witness Statements ({data.witnesses.length})</Text>
                    {canAddWitness && !caseEndedAtCourtReferral && <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setIsWitnessModalOpen(true)}>Add Statement</Button>}
                  </div>
                  {data.witnesses.length === 0 ? <Text type="secondary" size="small">No statements taken</Text> : 
                    data.witnesses.map((w, index) => (
                      <div key={`witness-${w.id}-${index}`} style={{ marginBottom: 8 }}>
                        <Text strong style={{ fontSize: '13px' }}>{w.full_name}</Text>
                        <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0 }}>{w.statement}</Paragraph>
                      </div>
                    ))}
               </Space>
            </Card>
          </Col>
        </Row>
      </Space>

      {/* Modals */}
      <Modal title="Update Case Status" open={isStatusModalOpen} onCancel={() => setIsStatusModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleUpdateStatus} layout="vertical">
          <Form.Item name="status" label="New Status" rules={[requiredRule('Status')]}>
            <Select>
              <Option value="draft">Draft</Option>
              <Option value="pending_commander_review">Pending Review</Option>
              <Option value="under_investigation">Under Investigation</Option>
              <Option value="referred_cid">Referred to CID</Option>
              <Option value="referred_to_court">Referred to Court</Option>
              <Option value="rejected">Rejected</Option>
              <Option value="closed">Closed</Option>
              <Option value="archived">Archived</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Refer Case" open={isReferralModalOpen} onCancel={() => setIsReferralModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleReferral} layout="vertical">
          <Form.Item name="referred_to_role" label="Refer To" rules={[requiredRule('Referral destination')]}>
            <Select>
              <Option value="cid">CID</Option>
              <Option value="court">Court Referral</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[requiredRule('Reason'), textLengthRule('Reason', 5, 1000)]}><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Suspect to Case" open={isSuspectModalOpen} onCancel={() => setIsSuspectModalOpen(false)} onOk={() => form.submit()} width={820}>
        <Form form={form} onFinish={handleSuspect} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={16}><Form.Item name="full_name" label="Full Name" rules={nameRules('Suspect name')}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="alias" label="Alias" rules={[textLengthRule('Alias', 2, 150)]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="gender" label="Gender" initialValue="male">
                <Select><Option value="male">Male</Option><Option value="female">Female</Option></Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="age" label="Age" rules={[positiveIntegerRule('Age', 1, 120)]}><Input type="number" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali" rules={[textLengthRule('Nationality', 2, 100)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="id_type" label="ID Type" rules={[textLengthRule('ID type', 2, 50)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="id_number" label="ID Number" rules={[textLengthRule('ID number', 2, 100)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="phone" label="Phone" rules={phoneRules}><Input /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="arrest_status" label="Arrest Status" initialValue="not_arrested">
                <Select>
                  <Option value="not_arrested">Not Arrested</Option>
                  <Option value="arrested">Arrested</Option>
                  <Option value="released">Released</Option>
                  <Option value="wanted">Wanted</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}><Form.Item name="address" label="Address" rules={[textLengthRule('Address', 3, 255)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item label="Linked Case ID">
                <Input value={id} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Linked OB Number">
                <Input value={data.ob_number} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Offender Photo / Face Capture">
                <div className="face-preview-panel" style={{ minHeight: 180 }}>
                  {suspectFaceImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={suspectFaceImage} alt="Suspect face capture preview" />
                  ) : (
                    <Text type="secondary">No face image captured yet</Text>
                  )}
                </div>
                <Button style={{ marginTop: 8 }}>
                  <label className="face-upload-label">
                    Capture / Upload Face
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSuspectFaceUpload} />
                  </label>
                </Button>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="face_capture_notes" label="Face Capture Notes" rules={[textLengthRule('Face capture notes', 3, 1000)]}><TextArea rows={4} /></Form.Item>
              <Form.Item name="role_in_case" label="Role in Case" rules={[textLengthRule('Role in case', 2, 150)]}><Input /></Form.Item>
            </Col>
            <Col span={24}><Form.Item name="profile_notes" label="Profile Notes" rules={[textLengthRule('Profile notes', 3, 1000)]}><TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="Add Evidence" open={isEvidenceModalOpen} onCancel={() => setIsEvidenceModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleEvidence} layout="vertical">
          <Form.Item name="title" label="Title" rules={[requiredRule('Evidence title'), textLengthRule('Evidence title', 3, 255)]}><Input /></Form.Item>
          <Form.Item name="type" label="Type" initialValue="document"><Select><Option value="document">Document</Option><Option value="physical">Physical</Option></Select></Form.Item>
          <Form.Item name="file" label="Attachment" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList || []}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<PlusOutlined />}>Select File</Button></Upload></Form.Item>
        </Form>
      </Modal>

      <Modal title="Record Witness Statement" open={isWitnessModalOpen} onCancel={() => setIsWitnessModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} onFinish={handleWitness} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={nameRules('Witness name')}><Input /></Form.Item>
          <Form.Item name="statement" label="Statement" rules={[requiredRule('Statement'), textLengthRule('Statement', 10, 5000)]}><TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Record Arrest: ${selectedSuspect?.full_name}`} open={isArrestModalOpen} onCancel={() => setIsArrestModalOpen(false)} onOk={() => form.submit()} width={760}>
        <Form form={form} onFinish={handleArrest} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="arrest_location" label="Location" rules={[requiredRule('Arrest location'), textLengthRule('Arrest location', 3, 255)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="arrest_date" label="Arrest Date" rules={[noFutureDateTimeRule('Arrest date')]}><DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="charges" label="Charges" rules={[requiredRule('Charges'), textLengthRule('Charges', 5, 2000)]}><TextArea rows={3} /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="bail_status" label="Bail Status" initialValue="no_bail">
                <Select>
                  <Option value="no_bail">No Bail</Option>
                  <Option value="bail_pending">Bail Pending</Option>
                  <Option value="bail_granted">Bail Granted</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24}><Form.Item name="notes" label="Custody Notes" rules={[textLengthRule('Custody notes', 3, 1000)]}><TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="Transfer Case / Reassign Officer" open={isTransferModalOpen} onCancel={() => setIsTransferModalOpen(false)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={handleTransfer}>
          <Form.Item name="transfer_type" label="Transfer Type" rules={[requiredRule('Transfer type')]}>
            <Select placeholder="Select type">
               <Select.Option value="location">Location Transfer</Select.Option>
               <Select.Option value="officer">Officer Reassignment</Select.Option>
               <Select.Option value="both">Both</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.transfer_type !== c.transfer_type}>
            {({ getFieldValue }) => (getFieldValue('transfer_type') === 'location' || getFieldValue('transfer_type') === 'both') && (
              <>
                <Form.Item name="to_region_id" label="New Region" rules={[requiredRule('Region')]}><Select placeholder="Region">{geography.regions.map((r, index) => <Option key={`region-${r.id}-${index}`} value={r.id}>{r.name}</Option>)}</Select></Form.Item>
                <Form.Item name="to_district_id" label="New District" rules={[requiredRule('District')]}><Select placeholder="District">{geography.districts.map((d, index) => <Option key={`district-${d.id}-${index}`} value={d.id}>{d.name}</Option>)}</Select></Form.Item>
                <Form.Item name="to_ward_id" label="New Ward" rules={[requiredRule('Ward')]}><Select placeholder="Ward">{geography.wards.map((w, index) => <Option key={`ward-${w.id}-${index}`} value={w.id}>{w.name}</Option>)}</Select></Form.Item>
              </>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.transfer_type !== c.transfer_type}>
            {({ getFieldValue }) => (getFieldValue('transfer_type') === 'officer' || getFieldValue('transfer_type') === 'both') && (
              <Form.Item name="to_officer_id" label="New Assigned Officer" rules={[requiredRule('Assigned officer'), textLengthRule('Assigned officer', 2, 100)]}><Input placeholder="Internal Badge Number or Name" /></Form.Item>
            )}
          </Form.Item>
          <Form.Item name="reason" label="Reason for Transfer" rules={[requiredRule('Transfer reason'), textLengthRule('Transfer reason', 5, 1000)]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>Execute Transfer</Button>
        </Form>
      </Modal>
    </ProtectedRoute>
  );
}

