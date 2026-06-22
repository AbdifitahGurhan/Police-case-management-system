// src/app/cases/[id]/page.jsx
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Row, Col, Card, Typography, Space, Tag, Button, Tabs, Descriptions,
  Timeline, Table, Modal, Form, Input, Select, Upload, Divider, App,
  DatePicker, Alert
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, ShareAltOutlined, PlusOutlined,
  UserAddOutlined, SolutionOutlined, FileAddOutlined, HistoryOutlined,
  EnvironmentOutlined, DownloadOutlined, TeamOutlined
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
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [suspectFaceImage, setSuspectFaceImage] = useState('');
  const [geography, setGeography] = useState({ regions: [], districts: [], wards: [] });
  const [transferHistory, setTransferHistory] = useState([]);
  const [assignableOfficers, setAssignableOfficers] = useState([]);
  const [duplicateAlert, setDuplicateAlert] = useState(null);

  const [statusForm] = Form.useForm();
  const [referralForm] = Form.useForm();
  const [suspectForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [witnessForm] = Form.useForm();
  const [arrestForm] = Form.useForm();
  const [assignmentForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  const fetchCaseDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cases/${id}`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to load case details.");
      router.push('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, message, router]);

  const fetchTransferHistory = useCallback(async () => {
    try {
      const tRes = await api.get(`/transfers/history/${id}`);
      setTransferHistory(tRes.data.data || []);
    } catch (err) {
      setTransferHistory([]);
    }
  }, [id]);

  const fetchGeography = async () => {
    try {
      const res = await api.get('/stations/geography');
      setGeography(res.data.data);
    } catch (err) {
      console.error("Geography load failed", err);
    }
  };

  const fetchAssignableOfficers = async () => {
    try {
      const res = await api.get('/cases/assignable/officers');
      setAssignableOfficers(res.data.data || []);
    } catch (err) {
      setAssignableOfficers([]);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCaseDetails();
      fetchTransferHistory();
      fetchGeography();
      // Only fetch assignable officers if user has the right role
      const assignRoles = ['admin', 'ward_commander', 'district_commander', 'police_station_commander', 'waax_commander', 'district_admin', 'neighborhood_admin'];
      if (user && assignRoles.includes(user.role)) {
        fetchAssignableOfficers();
      }
    }
  }, [id, fetchCaseDetails, fetchTransferHistory]);

  const handleUpdateStatus = async (values) => {
    setSubmitting(true);
    try {
      await api.put(`/cases/${id}`, { status: values.status });
      message.success("Case status updated successfully.");
      setIsStatusModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Update failed.");
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
      arrestForm.resetFields();
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
      await api.post('/criminals', {
        ...values,
        case_id: id,
        face_capture_image: suspectFaceImage || null,
        arrest_status: values.arrest_status || 'not_arrested',
      });
      message.success("Suspect added successfully.");
      setIsSuspectModalOpen(false);
      setSuspectFaceImage('');
      setDuplicateAlert(null);
      suspectForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to add suspect.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormValuesChange = async (changedValues, allValues) => {
    if (changedValues.id_number !== undefined || changedValues.id_type !== undefined) {
      const idType = allValues.id_type;
      const idNumber = allValues.id_number;
      if (idType && idNumber && idNumber.length >= 3) {
        try {
          const res = await api.get('/criminals/check-duplicate', {
            params: { id_type: idType, id_number: idNumber }
          });
          if (res.data.exists) {
            setDuplicateAlert(res.data.data);
          } else {
            setDuplicateAlert(null);
          }
        } catch (err) {
          console.error("Duplicate check failed", err);
        }
      } else {
        setDuplicateAlert(null);
      }
    }
  };

  const handleLinkExisting = (criminal) => {
    suspectForm.setFieldsValue({
      full_name: criminal.full_name,
      alias: criminal.alias,
      gender: criminal.gender,
      age: criminal.age,
      nationality: criminal.nationality || 'Somali',
      phone: criminal.phone,
      address: criminal.address,
    });
    if (criminal.face_capture_image) {
      setSuspectFaceImage(criminal.face_capture_image);
    } else if (criminal.photo_url) {
      setSuspectFaceImage(criminal.photo_url);
    }
    setDuplicateAlert(null);
    message.success("Macluumaadka dambiilaha hore waa la soo qaatay!");
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isSuspectModalOpen) stopCamera();
  }, [isSuspectModalOpen]);

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera error', err);
      setCameraError('Camera access denied or unavailable.');
    }
  };

  // Attach stream to video element whenever cameraStream changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
      video.play().catch((e) => console.error('Video play error:', e));
    }
  }, [cameraStream]);

  const captureFace = () => {
    const video = videoRef.current;
    if (!video) return;

    const doCapture = () => {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Flip horizontally to un-mirror (selfie preview is mirrored, saved image should be correct)
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setSuspectFaceImage(imageDataUrl);
      stopCamera();
    };

    if (video.readyState >= 2 && video.videoWidth > 0) {
      doCapture();
    } else {
      // Wait for first decodable frame
      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        doCapture();
      };
      video.addEventListener('canplay', onCanPlay);
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

  const handleAssignment = async (values) => {
    setSubmitting(true);
    try {
      await api.patch(`/cases/${id}/assign`, { officer_id: values.officer_id });
      message.success('Case assigned successfully.');
      setIsAssignmentModalOpen(false);
      assignmentForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || 'Assignment failed.');
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

  const exportCasePackage = async (documentType = 'case-package') => {
    try {
      const response = await api.get(`/cases/${id}/export`);
      const payload = response.data.data;
      const html = `
        <html>
          <head>
            <title>${payload.case.case_number || payload.case.ob_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
              h1 { margin-bottom: 4px; }
              h2 { border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-top: 28px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #f3f4f6; }
              .meta { color: #4b5563; margin-bottom: 20px; }
              .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
              .box { border: 1px solid #d1d5db; padding: 10px; }
            </style>
          </head>
          <body>
            <h1>${documentType.replaceAll('-', ' ').toUpperCase()}</h1>
            <div class="meta">Generated by ${payload.generatedBy} on ${dayjs(payload.generatedAt).format('DD MMM YYYY HH:mm')}</div>
            <div class="grid">
              <div class="box"><strong>Case #:</strong> ${payload.case.case_number || 'N/A'}</div>
              <div class="box"><strong>OB #:</strong> ${payload.case.ob_number || 'N/A'}</div>
              <div class="box"><strong>Status:</strong> ${payload.case.status || 'N/A'}</div>
              <div class="box"><strong>Priority:</strong> ${payload.case.priority || 'N/A'}</div>
              <div class="box"><strong>Station:</strong> ${payload.case.station_name || 'N/A'}</div>
              <div class="box"><strong>Officer:</strong> ${payload.case.officer_name || 'N/A'}</div>
            </div>
            <h2>Summary</h2>
            <p><strong>${payload.case.title || ''}</strong></p>
            <p>${payload.case.description || 'No description recorded.'}</p>
            <h2>Suspects</h2>
            <table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th></tr></thead><tbody>
              ${payload.suspects.map((s) => `<tr><td>${s.full_name || ''}</td><td>${s.phone || ''}</td><td>${s.role_in_case || ''}</td><td>${s.arrest_status || ''}</td></tr>`).join('') || '<tr><td colspan="4">No suspects recorded.</td></tr>'}
            </tbody></table>
            <h2>Evidence</h2>
            <table><thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Location</th></tr></thead><tbody>
              ${payload.evidence.map((e) => `<tr><td>${e.title || ''}</td><td>${e.type || ''}</td><td>${e.collection_date || ''}</td><td>${e.location_found || ''}</td></tr>`).join('') || '<tr><td colspan="4">No evidence recorded.</td></tr>'}
            </tbody></table>
            <h2>Timeline</h2>
            <table><thead><tr><th>Date</th><th>Action</th><th>By</th><th>Description</th></tr></thead><tbody>
              ${payload.timeline.map((a) => `<tr><td>${dayjs(a.created_at).format('DD MMM YYYY HH:mm')}</td><td>${a.action_type || ''}</td><td>${a.performed_by || ''}</td><td>${a.description || ''}</td></tr>`).join('') || '<tr><td colspan="4">No timeline recorded.</td></tr>'}
            </tbody></table>
            ${documentType === 'arrest-warrant' ? '<h2>Arrest Warrant</h2><p>This document supports an arrest warrant request for suspects linked to this case.</p>' : ''}
            ${documentType === 'court-referral' ? '<h2>Court Referral</h2><p>This document packages the case facts, evidence, suspects, and timeline for court referral.</p>' : ''}
            ${documentType === 'release-certificate' ? '<h2>Release Certificate</h2><p>This document records authorized release or closure details for this case.</p>' : ''}
            ${documentType === 'evidence-receipt' ? '<h2>Evidence Receipt</h2><p>This document confirms evidence items collected and filed for this case.</p>' : ''}
          </body>
        </html>`;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        message.warning('Please allow popups to print the case package.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      message.error(err.response?.data?.message || 'Could not export case package.');
    }
  };

  if (loading) return <Card loading={true} />;
  if (!data) return <p>Case not found.</p>;

  const role = user?.role;
  const commanderRoles = ['ward_commander', 'state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];
  const stationOperationRoles = ['district_admin', 'neighborhood_admin'];
  const canSubmitForReview = ['admin', 'officer', ...stationOperationRoles].includes(role);
  const canReviewCase = ['admin', 'ward_commander', ...commanderRoles].includes(role);
  const canTransferCase = ['admin', 'ward_commander', ...commanderRoles].includes(role);
  const canAssignCase = ['admin', 'ward_commander', 'district_admin', 'neighborhood_admin', 'district_commander', 'police_station_commander', 'waax_commander'].includes(role);
  const canUpdateStatus = ['admin', 'officer', 'cid', ...stationOperationRoles, ...commanderRoles].includes(role);
  const canReferCase = ['admin', 'officer', 'cid', ...stationOperationRoles, ...commanderRoles].includes(role);
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
              suspectForm.resetFields();
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
    <ProtectedRoute allowedRoles={['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'state_commander', 'region_commander', 'district_commander']}>
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
            {canAssignCase && !caseEndedAtCourtReferral && (
              <Button
                icon={<TeamOutlined />}
                onClick={() => {
                  assignmentForm.setFieldsValue({ officer_id: data.assigned_officer_id });
                  setIsAssignmentModalOpen(true);
                }}
              >
                Assign Officer
              </Button>
            )}
            {canUpdateStatus && !caseEndedAtCourtReferral && (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  statusForm.setFieldsValue({ status: data.allowed_next_statuses?.[0] });
                  setIsStatusModalOpen(true);
                }}
              >
                Update Status
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('case-package')}>Export Package</Button>
            {canReferCase && !caseEndedAtCourtReferral && <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setIsReferralModalOpen(true)}>Refer Case</Button>}
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card variant="none">
              <Tabs
                defaultActiveKey="details"
                items={[
                  {
                    key: 'details', label: 'Overview', children: (
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
                            {
                              key: 'transfers', label: 'Transfers', children: (
                                transferHistory.length === 0 ? <Text type="secondary">No transfer history.</Text> : (
                                  <Timeline items={transferHistory.map((t, index) => ({
                                    key: `transfer-${t.id || index}`,
                                    content: (
                                      <>
                                        <Text strong>{t.transfer_type.toUpperCase()} Transfer</Text> to {t.to_region_name || 'New Ward'}<br />
                                        <Text type="secondary" style={{ fontSize: '11px' }}>By {t.transferred_by_name} on {dayjs(t.transferred_at).format('DD MMM YYYY HH:mm')}</Text><br />
                                        <Text italic style={{ display: 'block', marginTop: 4 }}>Reason: {t.transfer_reason}</Text>
                                      </>
                                    )
                                  }))} />
                                )
                              )
                            },
                            {
                              key: 'proofs', label: 'Blockchain Proofs', children: (
                                <Timeline items={data.actions.filter(a => a.action_type === 'CONFIRMED_BY_COMMANDER' || a.action_type.includes('TRANSFER')).map((a, index) => ({
                                  key: `proof-${a.id || index}`,
                                  content: (
                                    <>
                                      <Text strong>Integrity Proof Generated</Text><br />
                                      <Text type="secondary" style={{ fontSize: '11px' }}>Version recorded at {dayjs(a.created_at).format('DD MMM YYYY HH:mm')}</Text>
                                    </>
                                  )
                                }))} />
                              )
                            }
                          ]} />
                        </Card>
                      </Space>
                    )
                  },
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
              {canAssignCase && !caseEndedAtCourtReferral && (
                <Button
                  style={{ marginTop: 12 }}
                  icon={<TeamOutlined />}
                  onClick={() => {
                    assignmentForm.setFieldsValue({ officer_id: data.assigned_officer_id });
                    setIsAssignmentModalOpen(true);
                  }}
                  block
                >
                  Assign / Reassign Officer
                </Button>
              )}
            </Card>
            <Card title="Documents" variant="none" style={{ marginBottom: 24 }}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('case-summary')} block>Case Summary</Button>
                <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('arrest-warrant')} block>Arrest Warrant</Button>
                <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('court-referral')} block>Court Referral</Button>
                <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('release-certificate')} block>Release Certificate</Button>
                <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('evidence-receipt')} block>Evidence Receipt</Button>
              </Space>
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
      <Modal title="Assign Case Officer" open={isAssignmentModalOpen} onCancel={() => setIsAssignmentModalOpen(false)} onOk={() => assignmentForm.submit()}>
        <Form form={assignmentForm} onFinish={handleAssignment} layout="vertical">
          <Form.Item name="officer_id" label="Officer" rules={[requiredRule('Officer')]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select active officer"
              options={assignableOfficers.map((officer) => ({
                value: officer.id,
                label: `${officer.full_name} (${officer.force_number || 'No force #'}${officer.rank_name ? `, ${officer.rank_name}` : ''})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Update Case Status" open={isStatusModalOpen} onCancel={() => setIsStatusModalOpen(false)} onOk={() => statusForm.submit()}>
        <Form form={statusForm} onFinish={handleUpdateStatus} layout="vertical">
          <Form.Item name="status" label="New Status" rules={[requiredRule('Status')]}>
            <Select>
              {(data.allowed_next_statuses || []).map((status) => (
                <Option key={status} value={status}>{status.replaceAll('_', ' ').toUpperCase()}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Refer Case" open={isReferralModalOpen} onCancel={() => setIsReferralModalOpen(false)} onOk={() => referralForm.submit()}>
        <Form form={referralForm} onFinish={handleReferral} layout="vertical">
          <Form.Item name="referred_to_role" label="Refer To" rules={[requiredRule('Referral destination')]}>
            <Select>
              <Option value="cid">CID</Option>
              <Option value="court">Court Referral</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[requiredRule('Reason'), textLengthRule('Reason', 5, 1000)]}><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Suspect to Case" open={isSuspectModalOpen} onCancel={() => { setIsSuspectModalOpen(false); stopCamera(); setDuplicateAlert(null); }} onOk={() => suspectForm.submit()} width={820}>
        <Form form={suspectForm} onFinish={handleSuspect} onValuesChange={handleFormValuesChange} layout="vertical">
          <Row gutter={16}>
            {duplicateAlert && (
              <Col span={24}>
                <Alert
                  title="Dambiilahan horey ayaa loo diiwaan-geliyey!"
                  description={`Magaca: ${duplicateAlert.full_name} (${duplicateAlert.gender}, ${duplicateAlert.age} jir) - ID: ${duplicateAlert.id_number}`}
                  type="warning"
                  showIcon
                  action={
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleLinkExisting(duplicateAlert)}
                    >
                      Isticmaal dambiilahan
                    </Button>
                  }
                  style={{ marginBottom: 16 }}
                />
              </Col>
            )}
            <Col xs={24} md={16}><Form.Item name="full_name" label="Full Name" rules={nameRules('Suspect name')}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="alias" label="Alias" rules={[textLengthRule('Alias', 2, 150)]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="gender" label="Gender" initialValue="male">
                <Select><Option value="male">Male</Option><Option value="female">Female</Option></Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="age" label="Age" rules={[positiveIntegerRule('Age', 1, 120)]}><Input type="number" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali" rules={[textLengthRule('Nationality', 2, 100)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="id_type" label="ID Type" rules={[requiredRule('ID type')]}>
                <Select placeholder="Select ID type">
                  <Select.Option value="National ID">National ID</Select.Option>
                  <Select.Option value="Passport">Passport</Select.Option>
                </Select>
              </Form.Item>
            </Col>
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
            <Col xs={24} md={12}>
              <Form.Item name="role_in_case" label="Role in Case" rules={[requiredRule('Role in case')]}>
                <Select placeholder="Select role">
                  <Option value="suspect">Suspect</Option>
                  <Option value="Principal Offender">Principal Offender</Option>
                  <Option value="Accomplice">Accomplice</Option>
                  <Option value="Conspirator">Conspirator</Option>
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
            <Col span={24}>
              <Form.Item label="Offender Photo / Face Capture">
                <div className="face-preview-panel" style={{
                  height: 280,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed #d9d9d9',
                  borderRadius: 8,
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden'
                }}>
                  {suspectFaceImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={suspectFaceImage.startsWith('data:') || suspectFaceImage.startsWith('http') ? suspectFaceImage : `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '')}${suspectFaceImage}`} alt="Suspect face capture preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  ) : isCameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="face-camera-video"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        borderRadius: 6
                      }}
                    />
                  ) : (
                    <Text type="secondary">No face image captured yet. Use the camera or upload a file.</Text>
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {!isCameraActive && !suspectFaceImage && (
                    <>
                      <Button type="primary" onClick={startCamera}>Start Camera</Button>
                      <Upload
                        beforeUpload={(file) => {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setSuspectFaceImage(e.target.result);
                          };
                          reader.readAsDataURL(file);
                          return false;
                        }}
                        showUploadList={false}
                        accept="image/*"
                      >
                        <Button>Upload Photo File</Button>
                      </Upload>
                    </>
                  )}
                  {isCameraActive && (
                    <>
                      <Button type="primary" onClick={captureFace}>Capture Photo</Button>
                      <Button onClick={stopCamera}>Stop Camera</Button>
                    </>
                  )}
                  {suspectFaceImage && (
                    <>
                      <Button type="primary" onClick={() => { setSuspectFaceImage(''); startCamera(); }}>Retake Photo</Button>
                      <Button danger onClick={() => setSuspectFaceImage('')}>Remove Photo</Button>
                    </>
                  )}
                </div>
                {cameraError && <Text type="danger" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>{cameraError}</Text>}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="Add Evidence" open={isEvidenceModalOpen} onCancel={() => setIsEvidenceModalOpen(false)} onOk={() => evidenceForm.submit()}>
        <Form form={evidenceForm} onFinish={handleEvidence} layout="vertical">
          <Form.Item name="title" label="Title" rules={[requiredRule('Evidence title'), textLengthRule('Evidence title', 3, 255)]}><Input /></Form.Item>
          <Form.Item name="type" label="Type" initialValue="document"><Select><Option value="document">Document</Option><Option value="physical">Physical</Option></Select></Form.Item>
          <Form.Item name="file" label="Attachment" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList || []}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<PlusOutlined />}>Select File</Button></Upload></Form.Item>
        </Form>
      </Modal>

      <Modal title="Record Witness Statement" open={isWitnessModalOpen} onCancel={() => setIsWitnessModalOpen(false)} onOk={() => witnessForm.submit()} width={700}>
        <Form form={witnessForm} onFinish={handleWitness} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={nameRules('Witness name')}><Input /></Form.Item>
          <Form.Item name="statement" label="Statement" rules={[requiredRule('Statement'), textLengthRule('Statement', 10, 5000)]}><TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Record Arrest: ${selectedSuspect?.full_name}`} open={isArrestModalOpen} onCancel={() => setIsArrestModalOpen(false)} onOk={() => arrestForm.submit()} width={760}>
        <Form form={arrestForm} onFinish={handleArrest} layout="vertical">
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

