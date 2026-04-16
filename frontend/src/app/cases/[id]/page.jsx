// src/app/cases/[id]/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Space, Tag, Button, Tabs, Descriptions, 
  Timeline, Table, Modal, Form, Input, Select, Upload, Divider, App
} from 'antd';
import { 
  ArrowLeftOutlined, EditOutlined, ShareAltOutlined, PlusOutlined,
  UserAddOutlined, SolutionOutlined, FileAddOutlined, HistoryOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import HashVerifier from '@/components/shared/HashVerifier';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function CaseDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
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
  const [geography, setGeography] = useState({ regions: [], districts: [], wards: [] });
  const [transferHistory, setTransferHistory] = useState([]);
  
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchCaseDetails = async () => {
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
  };

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
  }, [id]);

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
      await api.post('/arrests', { ...values, case_id: id, suspect_id: selectedSuspect.id });
      message.success("Arrest record created successfully.");
      setIsArrestModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Failed to record arrest.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspect = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/suspects', { ...values, case_id: id });
      message.success("Suspect added successfully.");
      setIsSuspectModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error("Failed to add suspect.");
    } finally {
      setSubmitting(false);
    }
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
      
      if (values.file?.fileList?.[0]?.originFileObj) {
        formData.append('file', values.file.fileList[0].originFileObj);
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

  const referralTab = (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Case Referrals</Title>
        <Button 
          type="primary" 
          icon={<ShareAltOutlined />} 
          onClick={() => setIsReferralModalOpen(true)}
        >
          Refer Case
        </Button>
      </div>
      <Table 
        dataSource={data.referrals} 
        rowKey="id"
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
        <Button 
          type="primary" 
          icon={<FileAddOutlined />} 
          onClick={() => setIsEvidenceModalOpen(true)}
        >
          Add Evidence
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        {data.evidence.map(ev => (
          <Col xs={24} md={12} key={ev.id}>
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
                  <Button type="link" size="small" href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${ev.file_url}`} target="_blank">
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
                    items={ev.custodyLog.map(c => ({
                      children: `${dayjs(c.transfer_date).format('DD MMM')}: ${c.reason} (${c.to_name})`,
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
        <Title level={4}>Profiled Suspects</Title>
        <Button 
          type="primary" 
          icon={<UserAddOutlined />} 
          onClick={() => setIsSuspectModalOpen(true)}
        >
          Add Suspect
        </Button>
      </div>
      <Table 
        dataSource={data.suspects} 
        rowKey="id"
        columns={[
          { title: 'Full Name', dataIndex: 'full_name', render: (t, r) => <Typography.Text strong>{t} {r.alias && `(${r.alias})`}</Typography.Text> },
          { title: 'Gender', dataIndex: 'gender' },
          { title: 'Age', dataIndex: 'age' },
          { title: 'Arrested', dataIndex: 'is_arrested', render: a => a ? <Tag color="success">YES</Tag> : <Tag>NO</Tag> },
          { title: 'Role', dataIndex: 'role_in_case' },
          { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => !record.is_arrested && (
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
        items={data.actions.map(action => ({
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
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space direction="vertical">
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
            {data.status === 'draft' && (
              <Button type="primary" onClick={submitForReview}>Submit for Review</Button>
            )}
            
            {data.status === 'pending_commander_review' && (
              <Space>
                <Button type="primary" color="success" variant="solid" onClick={() => handleConfirmation('confirmed', 'Verified.')}>Confirm Case</Button>
                <Button onClick={() => handleConfirmation('returned', 'Correction needed.')}>Return</Button>
                <Button danger onClick={() => handleConfirmation('rejected', 'Rejected.')}>Reject</Button>
              </Space>
            )}

            <Button icon={<EnvironmentOutlined />} onClick={() => setIsTransferModalOpen(true)}>Transfer</Button>
            <Button icon={<EditOutlined />} onClick={() => setIsStatusModalOpen(true)}>Update Status</Button>
            <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setIsReferralModalOpen(true)}>Refer Case</Button>
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card variant="none">
              <Tabs
                defaultActiveKey="details"
                items={[
                  { key: 'details', label: 'Overview', children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      <Descriptions title="Incident Particulars" bordered column={1}>
                        <Descriptions.Item label="Subject / Nature">{data.title}</Descriptions.Item>
                        <Descriptions.Item label="Category">{data.case_type}</Descriptions.Item>
                        <Descriptions.Item label="Priority"><Tag>{data.priority?.toUpperCase()}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Incident Date">{dayjs(data.incident_date).format('DD MMM YYYY')}</Descriptions.Item>
                        <Descriptions.Item label="Location">{data.incident_location}</Descriptions.Item>
                        <Descriptions.Item label="Occurrence Details">
                          <Paragraph>{data.description}</Paragraph>
                        </Descriptions.Item>
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
                              <Timeline items={transferHistory.map(t => ({
                                children: (
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
                            <Timeline items={data.actions.filter(a => a.action_type === 'CONFIRMED_BY_COMMANDER' || a.action_type.includes('TRANSFER')).map(a => ({
                              children: (
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
                <Descriptions.Item label="Assigned Prosecutor">{data.prosecutor_name || <Text type="secondary">Unassigned</Text>}</Descriptions.Item>
              </Descriptions>
            </Card>
            
            <Card title="Victims & Witnesses" variant="none">
               <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>Victims ({data.victims.length})</Text>
                  {data.victims.length === 0 ? <Text type="secondary" size="small">No victims recorded</Text> : 
                    data.victims.map(v => <Tag key={v.id}>{v.full_name}</Tag>)}
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text strong>Witness Statements ({data.witnesses.length})</Text>
                    <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setIsWitnessModalOpen(true)}>Add Statement</Button>
                  </div>
                  {data.witnesses.length === 0 ? <Text type="secondary" size="small">No statements taken</Text> : 
                    data.witnesses.map(w => (
                      <div key={w.id} style={{ marginBottom: 8 }}>
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
          <Form.Item name="status" label="New Status" rules={[{ required: true }]}>
            <Select>
              <Option value="draft">Draft</Option>
              <Option value="pending_commander_review">Pending Review</Option>
              <Option value="under_investigation">Under Investigation</Option>
              <Option value="referred_cid">Referred to CID</Option>
              <Option value="referred_prosecutor">Referred to Prosecutor</Option>
              <Option value="approved_for_court">Approved for Court</Option>
              <Option value="rejected">Rejected</Option>
              <Option value="closed">Closed</Option>
              <Option value="archived">Archived</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Refer Case" open={isReferralModalOpen} onCancel={() => setIsReferralModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleReferral} layout="vertical">
          <Form.Item name="referred_to_role" label="Refer To" rules={[{ required: true }]}>
            <Select><Option value="cid">CID Investigator</Option><Option value="prosecutor">Public Prosecutor</Option></Select>
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Register Suspect" open={isSuspectModalOpen} onCancel={() => setIsSuspectModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} onFinish={handleSuspect} layout="vertical">
          <Row gutter={16}>
            <Col span={16}><Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="alias" label="Alias"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="role_in_case" label="Role" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Notes"><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Evidence" open={isEvidenceModalOpen} onCancel={() => setIsEvidenceModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleEvidence} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Type" initialValue="document"><Select><Option value="document">Document</Option><Option value="physical">Physical</Option></Select></Form.Item>
          <Form.Item name="file" label="Attachment"><Upload beforeUpload={() => false} maxCount={1}><Button icon={<PlusOutlined />}>Select File</Button></Upload></Form.Item>
        </Form>
      </Modal>

      <Modal title="Record Witness Statement" open={isWitnessModalOpen} onCancel={() => setIsWitnessModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} onFinish={handleWitness} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="statement" label="Statement" rules={[{ required: true }]}><TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Record Arrest: ${selectedSuspect?.full_name}`} open={isArrestModalOpen} onCancel={() => setIsArrestModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleArrest} layout="vertical">
          <Form.Item name="arrest_location" label="Location" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="charges" label="Charges" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Transfer Case / Reassign Officer" open={isTransferModalOpen} onCancel={() => setIsTransferModalOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={handleTransfer}>
          <Form.Item name="transfer_type" label="Transfer Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
               <Select.Option value="location">Location Transfer</Select.Option>
               <Select.Option value="officer">Officer Reassignment</Select.Option>
               <Select.Option value="both">Both</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.transfer_type !== c.transfer_type}>
            {({ getFieldValue }) => (getFieldValue('transfer_type') === 'location' || getFieldValue('transfer_type') === 'both') && (
              <>
                <Form.Item name="to_region_id" label="New Region" rules={[{ required: true }]}><Select placeholder="Region">{geography.regions.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}</Select></Form.Item>
                <Form.Item name="to_district_id" label="New District" rules={[{ required: true }]}><Select placeholder="District">{geography.districts.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></Form.Item>
                <Form.Item name="to_ward_id" label="New Ward" rules={[{ required: true }]}><Select placeholder="Ward">{geography.wards.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}</Select></Form.Item>
              </>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.transfer_type !== c.transfer_type}>
            {({ getFieldValue }) => (getFieldValue('transfer_type') === 'officer' || getFieldValue('transfer_type') === 'both') && (
              <Form.Item name="to_officer_id" label="New Assigned Officer" rules={[{ required: true }]}><Input placeholder="Internal Badge Number or Name" /></Form.Item>
            )}
          </Form.Item>
          <Form.Item name="reason" label="Reason for Transfer" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>Execute Transfer</Button>
        </Form>
      </Modal>
    </ProtectedRoute>
  );
}

