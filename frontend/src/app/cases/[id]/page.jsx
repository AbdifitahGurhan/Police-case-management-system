// src/app/cases/[id]/page.jsx
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Row, Col, Card, Typography, Space, Tag, Button, Tabs, Descriptions,
  Timeline, Table, Modal, Form, Input, InputNumber, Select, Upload, Divider, App,
  DatePicker, Alert, Avatar
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, ShareAltOutlined, PlusOutlined,
  UserAddOutlined, SolutionOutlined, FileAddOutlined, HistoryOutlined,
  DownloadOutlined, TeamOutlined, UserOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import CaseStatusTag from '@/components/shared/CaseStatusTag';
import CaseStatusStepper from '@/components/shared/CaseStatusStepper';
import HashVerifier from '@/components/shared/HashVerifier';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { compressImageFile } from '@/utils/imageCompression';
import {
  disabledFutureDate,
  disabledUnder8DobDate,
  dynamicIdNumberRule,
  getEvidenceUploadConfig,
  minimumAge8Rule,
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
  const { user, loading: authLoading } = useAuth();
  const { message, modal } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isWitnessModalOpen, setIsWitnessModalOpen] = useState(false);
  const [isVictimModalOpen, setIsVictimModalOpen] = useState(false);
  const [isArrestModalOpen, setIsArrestModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [suspectFaceImage, setSuspectFaceImage] = useState('');
  const [editingSuspect, setEditingSuspect] = useState(null);
  const [assignableOfficers, setAssignableOfficers] = useState([]);
  const [duplicateAlert, setDuplicateAlert] = useState(null);

  const [statusForm] = Form.useForm();
  const [referralForm] = Form.useForm();
  const [suspectForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [witnessForm] = Form.useForm();
  const [victimForm] = Form.useForm();
  const [arrestForm] = Form.useForm();
  const [releaseSuspectForm] = Form.useForm();
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

  const fetchAssignableOfficers = async () => {
    try {
      const res = await api.get('/cases/assignable/officers');
      setAssignableOfficers(res.data.data || []);
    } catch (err) {
      setAssignableOfficers([]);
    }
  };

  useEffect(() => {
    const allowedRoles = [
      'admin', 'staff', 'officer', 'district_admin',
      'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
      'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
      'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
    ];
    if (id && !authLoading && user && allowedRoles.includes(user.role)) {
      fetchCaseDetails();
      const assignRoles = ['admin', 'district_commander', 'police_station_commander', 'district_admin'];
      if (assignRoles.includes(user.role)) {
        fetchAssignableOfficers();
      }
    }
  }, [id, fetchCaseDetails, user, authLoading]);

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

  const handleOpenArrestModal = (suspect) => {
    setSelectedSuspect(suspect);
    arrestForm.resetFields();
    arrestForm.setFieldsValue({
      arrest_location: data.incident_location || data.district_name || data.station_name || '',
      arrest_date: dayjs(),
      bail_status: 'no_bail',
      charges: ''
    });
    setIsArrestModalOpen(true);
  };

  const handleOpenReleaseModal = (suspect) => {
    setSelectedSuspect(suspect);
    releaseSuspectForm.resetFields();
    releaseSuspectForm.setFieldsValue({
      release_reason: 'Released on police bail',
      release_notes: ''
    });
    setIsReleaseModalOpen(true);
  };

  const handleReleaseSuspect = async (values) => {
    if (!selectedSuspect) return;
    setSubmitting(true);
    try {
      await api.post(`/criminals/${selectedSuspect.id}/release`, {
        ...values,
        case_id: id
      });
      message.success("Suspect has been released.");
      setIsReleaseModalOpen(false);
      releaseSuspectForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to release suspect.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditSuspect = (suspect) => {
    setEditingSuspect(suspect);
    suspectForm.setFieldsValue({
      ...suspect,
      date_of_birth: suspect.date_of_birth ? dayjs(suspect.date_of_birth) : null,
    });
    if (suspect.face_capture_image) {
      setSuspectFaceImage(suspect.face_capture_image);
    } else if (suspect.photo_url) {
      setSuspectFaceImage(suspect.photo_url);
    } else {
      setSuspectFaceImage('');
    }
    setIsSuspectModalOpen(true);
  };

  const handleSuspect = async (values) => {
    setSubmitting(true);
    try {
      if (editingSuspect) {
        await api.put(`/criminals/${editingSuspect.id}`, {
          ...values,
          case_id: id,
          face_capture_image: (suspectFaceImage && suspectFaceImage.startsWith('data:')) ? suspectFaceImage : null,
          arrest_status: values.arrest_status || 'not_arrested',
          is_arrested: ['arrested', 'wanted'].includes(values.arrest_status) ? 1 : 0
        });
        message.success("Suspect details updated successfully.");
      } else {
        await api.post('/criminals', {
          ...values,
          case_id: id,
          face_capture_image: (suspectFaceImage && suspectFaceImage.startsWith('data:')) ? suspectFaceImage : null,
          arrest_status: values.arrest_status || 'not_arrested',
        });
        message.success("Suspect added successfully.");
      }
      setIsSuspectModalOpen(false);
      setEditingSuspect(null);
      setSuspectFaceImage('');
      setDuplicateAlert(null);
      suspectForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save suspect details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormValuesChange = async (changedValues, allValues) => {
    if (changedValues.date_of_birth) {
      const dob = dayjs(changedValues.date_of_birth);
      if (dob.isValid()) {
        const calculatedAge = dayjs().diff(dob, 'year');
        if (calculatedAge >= 0) {
          suspectForm.setFieldsValue({ age: calculatedAge });
        }
      }
    }
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
      const permissionDenied = err?.name === 'NotAllowedError';
      setCameraError(permissionDenied
        ? 'Camera permission waa xiran yahay. Ka oggolow browser-ka ama Windows Camera Privacy settings.'
        : 'Camera-ga lama heli karo ama qalab kale ayaa isticmaalaya.');
    }
  };

  // Attach stream to video element whenever cameraStream changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
      video.play().catch(() => {
        setCameraError('Camera preview-ga lama bilaabi karin.');
      });
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
      witnessForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to record witness.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVictim = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/victims', { ...values, case_id: id });
      message.success("Victim details recorded successfully.");
      setIsVictimModalOpen(false);
      victimForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to record victim.");
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

      await api.post('/evidence', formData);

      message.success("Evidence uploaded successfully.");
      setIsEvidenceModalOpen(false);
      evidenceForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to upload evidence.");
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
  const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
  const stationOperationRoles = ['district_admin'];
  const canSubmitForReview = ['admin', 'officer', ...stationOperationRoles].includes(role);
  const canReviewCase = ['admin', ...commanderRoles].includes(role);
  const canAssignCase = ['admin', 'district_admin', 'district_commander', 'police_station_commander'].includes(role);
  const canUpdateStatus = ['admin', 'officer', 'cid', ...stationOperationRoles, ...commanderRoles].includes(role);
  const canReferCase = ['admin', 'officer', 'cid', ...stationOperationRoles, ...commanderRoles].includes(role);
  const canManageInvestigation = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const canAddWitness = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const caseEndedAtCourtReferral = data.status === 'referred_to_court';

  const courtStatusTab = (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <Title level={4} style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Court status</Title>
      <CaseStatusStepper status={data.status} />
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Current status">
          <CaseStatusTag status={data.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Court-ready">
          {['ready_for_court', 'approved_for_court', 'forwarded_to_court', 'referred_to_court', 'court_decided'].includes(data.status)
            ? 'Yes'
            : 'Not yet'}
        </Descriptions.Item>
        <Descriptions.Item label="Allowed next steps">
          {(data.allowed_next_statuses || []).length
            ? data.allowed_next_statuses.map((s) => (
              <Tag key={s} className="status-tag status-tag--neutral" style={{ marginBottom: 4 }}>
                {String(s).replaceAll('_', ' ')}
              </Tag>
            ))
            : 'No further transitions'}
        </Descriptions.Item>
      </Descriptions>
      <Card size="small" title="Court referrals" className="standard-panel">
        <Table
          size="small"
          pagination={false}
          rowKey={(r) => `court-ref-${r.id}`}
          dataSource={(data.referrals || []).filter((r) => String(r.referred_to_role || '').toLowerCase().includes('court'))}
          locale={{ emptyText: 'No court referrals yet' }}
          columns={[
            { title: 'Date', dataIndex: 'referred_at', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'By', dataIndex: 'referred_by_name' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag className="status-tag status-tag--pending">{s}</Tag> },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          ]}
        />
      </Card>
      {canReferCase && !caseEndedAtCourtReferral && (
        <Button type="primary" icon={<ShareAltOutlined />} onClick={() => {
          referralForm.setFieldsValue({ referred_to_role: 'court' });
          setIsReferralModalOpen(true);
        }}>
          Refer to court
        </Button>
      )}
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
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Face',
            dataIndex: 'face_image',
            render: (src, record) => src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${src}`.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'}${src}` : src} alt={record.full_name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />
            ) : (
              <Avatar size={52} icon={<UserOutlined />} />
            )
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
            render: (_, record) => (
              <Space wrap>
                {canManageInvestigation && !caseEndedAtCourtReferral && !record.is_arrested && (
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => handleOpenArrestModal(record)}>
                    Record Arrest
                  </Button>
                )}
                {canManageInvestigation && !caseEndedAtCourtReferral && (record.is_arrested === 1 || record.is_arrested === true || record.arrest_status === 'arrested') && (
                  <Button size="small" type="primary" danger icon={<CheckCircleOutlined />} onClick={() => handleOpenReleaseModal(record)}>
                    Release Suspect
                  </Button>
                )}
                {canManageInvestigation && !caseEndedAtCourtReferral && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditSuspect(record)}>
                    Edit
                  </Button>
                )}
              </Space>
            )
          }
        ]}
      />
    </Space>
  );

  return (
    <ProtectedRoute allowedRoles={[
      'admin', 'staff', 'officer', 'district_admin',
      'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
      'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
      'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
    ]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <Space orientation="vertical">
            <Link href="/cases">
              <Button type="text" icon={<ArrowLeftOutlined />}>Back to cases</Button>
            </Link>
            <Space align="center" wrap>
              <Title level={2} style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>
                {data.case_number || data.ob_number}
              </Title>
              <CaseStatusTag status={data.status} />
            </Space>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {data.title || 'Untitled case'}
              {data.station_name ? ` · ${data.station_name}` : ''}
              {data.officer_name ? ` · ${data.officer_name}` : ''}
            </Text>
          </Space>

          <Space wrap>
            {canSubmitForReview && data.status === 'draft' && (
              <Button type="primary" onClick={submitForReview}>Submit for review</Button>
            )}

            {canReviewCase && data.status === 'pending_commander_review' && (
              <Space>
                <Button type="primary" onClick={() => handleConfirmation('confirmed', 'Verified.')}>Confirm case</Button>
                <Button onClick={() => handleConfirmation('returned', 'Correction needed.')}>Return</Button>
                <Button danger onClick={() => handleConfirmation('rejected', 'Rejected.')}>Reject</Button>
              </Space>
            )}

            {canAssignCase && !caseEndedAtCourtReferral && (
              <Button
                icon={<TeamOutlined />}
                onClick={() => {
                  assignmentForm.setFieldsValue({ officer_id: data.assigned_officer_id });
                  setIsAssignmentModalOpen(true);
                }}
              >
                Assign officer
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
                Update status
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => exportCasePackage('case-package')}>Export package</Button>
            {canReferCase && !caseEndedAtCourtReferral && <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setIsReferralModalOpen(true)}>Refer case</Button>}
          </Space>
        </div>

        <Card variant="none" className="standard-panel" style={{ marginBottom: 0 }}>
          <CaseStatusStepper status={data.status} />
        </Card>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card variant="none" className="standard-panel">
              <Tabs
                defaultActiveKey="overview"
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="large">
                        <Descriptions title="Incident particulars" bordered column={1} size="small">
                          <Descriptions.Item label="Case number">{data.case_number || data.id}</Descriptions.Item>
                          <Descriptions.Item label="Subject">{data.title}</Descriptions.Item>
                          <Descriptions.Item label="Category">{data.case_type || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Incident type">{data.incident_type || data.title}</Descriptions.Item>
                          <Descriptions.Item label="Priority">
                            <Tag className={`status-tag status-tag--${data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'warning' : 'neutral'}`}>
                              {data.priority || '—'}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Incident date">
                            {data.incident_date ? dayjs(data.incident_date).format('DD MMM YYYY HH:mm') : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Location">{data.incident_location || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Occurrence details">
                            <Paragraph style={{ marginBottom: 0 }}>{data.description || '—'}</Paragraph>
                          </Descriptions.Item>
                        </Descriptions>

                        <Descriptions title="Linked OB" bordered column={1} size="small">
                          <Descriptions.Item label="OB number">{data.ob_number || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Original OB staff">{data.ob_registered_by_name || data.original_ob_staff_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="OB registration date">
                            {data.ob_registration_date ? `${dayjs(data.ob_registration_date).format('DD MMM YYYY')} ${data.ob_registration_time || ''}` : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="State">{data.state_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Region">{data.region_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="District station">{data.district_name || '—'}</Descriptions.Item>
                        </Descriptions>

                        <Descriptions title="Complainant" bordered column={2} size="small">
                          <Descriptions.Item label="Full name">{data.complainant_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Phone">{data.complainant_phone || '—'}</Descriptions.Item>
                        </Descriptions>

                        <div style={{ padding: 16, border: '0.5px solid #2B2B2B', borderRadius: 12, background: '#171717' }}>
                          <HashVerifier entityType="case" entityId={data.id} />
                        </div>

                        <Card size="small" title="Activity timeline" className="standard-panel">
                          <Timeline
                            items={(data.actions || []).map((action, index) => ({
                              key: `action-${action.id || index}`,
                              content: (
                                <Space orientation="vertical" size={0}>
                                  <Text strong style={{ fontSize: 13 }}>
                                    {String(action.action_type || '').replaceAll('_', ' ')}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{action.description}</Text>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {dayjs(action.created_at).format('DD MMM YYYY HH:mm')}
                                    {action.performed_by ? ` · ${action.performed_by}` : ''}
                                  </Text>
                                </Space>
                              ),
                            }))}
                          />
                        </Card>
                      </Space>
                    ),
                  },
                  { key: 'suspects', label: `Suspects (${data.suspects?.length || 0})`, children: suspectsTab },
                  { key: 'evidence', label: `Evidence (${data.evidence?.length || 0})`, children: evidenceTab },
                  { key: 'court', label: 'Court status', children: courtStatusTab },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Case assignment" variant="none" className="standard-panel" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Region">{data.region_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="District">{data.district_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Station">{data.station_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Assigned officer">{data.officer_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Station commander">{data.station_commander_name || '—'}</Descriptions.Item>
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
                  Assign / reassign officer
                </Button>
              )}
            </Card>
            <Card title="Victims & witnesses" variant="none" className="standard-panel">
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Victims ({data.victims?.length || 0})</Text>
                  {canAddWitness && !caseEndedAtCourtReferral && (
                    <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setIsVictimModalOpen(true)}>Add victim</Button>
                  )}
                </div>
                {(data.victims?.length || 0) === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>No victims recorded</Text>
                ) : (
                  data.victims.map((v, index) => (
                    <div key={`victim-${v.id || index}-${index}`} style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 13 }}>{v.full_name}</Text>
                        {v.phone && <Tag style={{ fontSize: 11 }}>{v.phone}</Tag>}
                      </div>
                      {v.injury_description && (
                        <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12, marginTop: 4 }}>
                          {v.injury_description}
                        </Paragraph>
                      )}
                    </div>
                  ))
                )}

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text strong>Witness statements ({data.witnesses?.length || 0})</Text>
                  {canAddWitness && !caseEndedAtCourtReferral && (
                    <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setIsWitnessModalOpen(true)}>Add statement</Button>
                  )}
                </div>
                {(data.witnesses?.length || 0) === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>No statements taken</Text>
                ) : (
                  data.witnesses.map((w, index) => (
                    <div key={`witness-${w.id || index}-${index}`} style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 13 }}>{w.full_name}</Text>
                        {w.statement_date && <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(w.statement_date).format('DD MMM YYYY')}</Text>}
                      </div>
                      <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12, marginTop: 4 }}>
                        {w.statement}
                      </Paragraph>
                    </div>
                  ))
                )}
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

      <Modal
        title={editingSuspect ? "Edit Suspect Details" : "Add Suspect to Case"}
        open={isSuspectModalOpen}
        onCancel={() => { setIsSuspectModalOpen(false); setEditingSuspect(null); stopCamera(); setDuplicateAlert(null); }}
        onOk={() => suspectForm.submit()}
        confirmLoading={submitting}
        width={820}
      >
        <Form
          form={suspectForm}
          onFinish={handleSuspect}
          onFinishFailed={({ errorFields }) => {
            const firstField = errorFields[0]?.name;
            if (firstField) suspectForm.scrollToField(firstField, { behavior: 'smooth', block: 'center' });
            message.error('Fadlan buuxi meelaha casaanka lagu calaamadeeyey.');
          }}
          onValuesChange={handleFormValuesChange}
          layout="vertical"
        >
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
            <Col xs={24} md={8}><Form.Item name="age" label="Age" rules={[positiveIntegerRule('Age', 8, 120)]}><Input type="number" min={8} max={120} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="date_of_birth" label="Date of Birth" rules={[minimumAge8Rule()]}><DatePicker style={{ width: '100%' }} disabledDate={disabledUnder8DobDate} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali" rules={[textLengthRule('Nationality', 2, 100)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="id_type" label="ID Type" rules={[requiredRule('ID type')]}>
                <Select placeholder="Select ID type">
                  <Select.Option value="National ID">National ID</Select.Option>
                  <Select.Option value="Passport">Passport</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}><Form.Item name="id_number" label="ID Number" dependencies={['id_type']} rules={[dynamicIdNumberRule('id_type')]}><Input placeholder="14 digits (National ID) / 9 chars (Passport)" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="phone" label="Phone" rules={phoneRules}><Input /></Form.Item></Col>
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
                        beforeUpload={async (file) => {
                          try {
                            setSuspectFaceImage(await compressImageFile(file));
                            setCameraError('');
                          } catch (error) {
                            setCameraError(error.message);
                          }
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

      <Modal title="Add Evidence (Ku dar Caddeyn)" open={isEvidenceModalOpen} onCancel={() => setIsEvidenceModalOpen(false)} onOk={() => evidenceForm.submit()} confirmLoading={submitting}>
        <Form form={evidenceForm} onFinish={handleEvidence} layout="vertical" initialValues={{ type: 'document' }}>
          <Form.Item name="title" label="Cinwaanka Caddeynta (Evidence Title)" rules={[requiredRule('Evidence title'), textLengthRule('Evidence title', 3, 255)]}>
            <Input placeholder="e.g. Heshiis, Warqad, ama Sawir" />
          </Form.Item>
          <Form.Item name="type" label="Nooca Caddeynta (Type)" rules={[requiredRule('Type')]}>
            <Select
              options={[
                { value: 'document', label: 'Dokumiinti (PDF, DOC, DOCX, TXT, XLS)' },
                { value: 'photo', label: 'Sawir (JPG, JPEG, PNG, WEBP)' },
                { value: 'video', label: 'Fiidiyow (MP4, MOV, AVI, WEBM)' },
                { value: 'physical', label: 'Physical Evidence (Fayl Guud)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="location_found" label="Goobta laga helay (Location Found)" rules={[textLengthRule('Location found', 2, 255)]}>
            <Input placeholder="Location found" />
          </Form.Item>
          <Form.Item name="collection_date" label="Taariikhda la soo helay (Collection Date)">
            <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
          </Form.Item>
          <Form.Item name="description" label="Sharaxaadda Caddeynta">
            <Input.TextArea rows={3} placeholder="Faahfaahin ku saabsan caddeynta" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const currentType = getFieldValue('type') || 'document';
              const config = getEvidenceUploadConfig(currentType);

              return (
                <Form.Item
                  name="file"
                  label={config.label}
                  valuePropName="fileList"
                  getValueFromEvent={(event) => event?.fileList || []}
                  rules={[{ required: true, message: 'Fadlan dooro ama soo xaree faylka caddeynta.' }]}
                >
                  <Upload
                    beforeUpload={(file) => {
                      const errorMsg = config.validate(file);
                      if (errorMsg) {
                        message.error(errorMsg);
                        return Upload.LIST_IGNORE;
                      }
                      return false;
                    }}
                    accept={config.accept}
                    maxCount={1}
                  >
                    <Button icon={<PlusOutlined />}>{config.buttonText}</Button>
                  </Upload>
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Record Witness Statement" open={isWitnessModalOpen} onCancel={() => setIsWitnessModalOpen(false)} onOk={() => witnessForm.submit()} width={700}>
        <Form form={witnessForm} onFinish={handleWitness} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={nameRules('Witness name')}><Input /></Form.Item>
          <Form.Item name="statement" label="Statement" rules={[requiredRule('Statement'), textLengthRule('Statement', 10, 5000)]}><TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Record Victim Details (Diiwaangeli Dhibbanaha)" open={isVictimModalOpen} onCancel={() => setIsVictimModalOpen(false)} onOk={() => victimForm.submit()} width={700} confirmLoading={submitting}>
        <Form form={victimForm} onFinish={handleVictim} layout="vertical" initialValues={{ gender: 'male', nationality: 'Somali' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="full_name" label="Magaca Buuxa (Full Name)" rules={nameRules('Victim name')}>
                <Input placeholder="Full name of victim" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="gender" label="Jinsiga (Gender)">
                <Select options={[{ value: 'male', label: 'Laba' }, { value: 'female', label: 'Dheddig' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="age" label="Da'da (Age)">
                <InputNumber min={0} max={120} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Telefoonka (Phone)" rules={phoneRules}>
                <Input placeholder="+252..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="address" label="Cinwaanka (Address)">
                <Input placeholder="Address" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="injury_description" label="Dhaawaca / Sharaxaad Dhibta (Injury / Impact Details)">
                <Input.TextArea rows={3} placeholder="Faahfaahin ku saabsan dhibta ama dhaawaca gaaray..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Record Arrest: ${selectedSuspect?.full_name || 'Suspect'}`}
        open={isArrestModalOpen}
        onCancel={() => setIsArrestModalOpen(false)}
        onOk={() => arrestForm.submit()}
        confirmLoading={submitting}
        width={760}
      >
        <Card size="small" variant="none" style={{ marginBottom: 16, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Eedeysanaha (Suspect)</Text><br />
              <Text strong style={{ fontSize: 14 }}>{selectedSuspect?.full_name}</Text> {selectedSuspect?.alias && <Tag color="blue">{selectedSuspect.alias}</Tag>}
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Kiiska (Case)</Text><br />
              <Text strong style={{ fontSize: 14 }}>{data.case_number || data.ob_number}</Text>
            </Col>
          </Row>
        </Card>

        <Form form={arrestForm} onFinish={handleArrest} layout="vertical" initialValues={{ bail_status: 'no_bail' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="arrest_location" label="Goobta Qabashada (Arrest Location)" rules={[requiredRule('Arrest location'), textLengthRule('Arrest location', 3, 255)]}>
                <Input placeholder="Location where suspect was apprehended" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="arrest_date" label="Taariikhda iyo Waqtiga (Arrest Date & Time)" rules={[noFutureDateTimeRule('Arrest date')]}>
                <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="bail_status" label="Heerka Damaanadda (Bail Status)" initialValue="no_bail">
                <Select
                  options={[
                    { value: 'no_bail', label: 'No Bail (Damaanad La\'aan)' },
                    { value: 'bail_pending', label: 'Bail Pending (Sugaya Damaanad)' },
                    { value: 'bail_granted', label: 'Bail Granted (La Siiyay Damaanad)' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="charges" label="Dambiyada Loo Haysto (Charges)" rules={[textLengthRule('Charges', 3, 2000)]}>
                <TextArea rows={3} placeholder="Qrib dambiyada ama eedaha loo haysto..." />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="notes" label="Sharaxaad Dheeraad ah / Xabsiga (Custody Notes)" rules={[textLengthRule('Custody notes', 3, 1000)]}>
                <TextArea rows={2} placeholder="Warbixin dheeraad ah oo ku saabsan xiritaanka ama xabsiga..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Release Suspect: ${selectedSuspect?.full_name || 'Suspect'}`}
        open={isReleaseModalOpen}
        onCancel={() => setIsReleaseModalOpen(false)}
        onOk={() => releaseSuspectForm.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Card size="small" variant="none" style={{ marginBottom: 16, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Eedeysanaha (Suspect)</Text><br />
              <Text strong style={{ fontSize: 14 }}>{selectedSuspect?.full_name}</Text> {selectedSuspect?.alias && <Tag color="blue">{selectedSuspect.alias}</Tag>}
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Kiiska (Case)</Text><br />
              <Text strong style={{ fontSize: 14 }}>{data.case_number || data.ob_number}</Text>
            </Col>
          </Row>
        </Card>

        <Form form={releaseSuspectForm} onFinish={handleReleaseSuspect} layout="vertical">
          <Form.Item name="release_reason" label="Sababta Sii Daaynta (Release Reason)" rules={[requiredRule('Release reason'), textLengthRule('Release reason', 3, 255)]}>
            <Select
              options={[
                { value: 'Released on police bail', label: 'Released on police bail (Damaanad Saldhig)' },
                { value: 'Insufficient evidence', label: 'Insufficient evidence (Caddeyn La\'aan)' },
                { value: 'Complainant withdrew complaint', label: 'Complainant withdrew complaint (Cabashadii lagu soo celiyay)' },
                { value: 'Reconciliation / Agreement reached', label: 'Reconciliation / Agreement reached (Heshiis La Gaaray)' },
                { value: 'Authorized by station commander', label: 'Authorized by station commander (Oggolaansho Taliye)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="release_notes" label="Sharaxaad Dheeraad ah (Release Notes)">
            <Input.TextArea rows={3} placeholder="Faahfaahin ku saabsan sii daaynta eedeysanaha..." />
          </Form.Item>
        </Form>
      </Modal>

    </ProtectedRoute>
  );
}

