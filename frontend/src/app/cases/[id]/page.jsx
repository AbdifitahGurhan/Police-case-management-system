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
  DownloadOutlined, TeamOutlined, UserOutlined, CheckCircleOutlined,
  PrinterOutlined, EyeOutlined, MinusCircleOutlined
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

const investigationFileConfigs = {
  image: getEvidenceUploadConfig('photo'),
  video: getEvidenceUploadConfig('video'),
  document: getEvidenceUploadConfig('document'),
};

const getInvestigationUploadConfig = (type) => investigationFileConfigs[type] || investigationFileConfigs.document;

const getUploadFile = (value) => {
  if (!Array.isArray(value) || !value.length) return null;
  return value[0]?.originFileObj || null;
};

const parseInvestigationList = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value || '[]');
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
};

const existingUploadList = (url, name = 'Fayl hore') => (
  url ? [{ uid: url, name, status: 'done', url }] : []
);

const normalizeInterviewPeopleForForm = (step) => {
  if (Array.isArray(step.interview_people_list) && step.interview_people_list.length) {
    return step.interview_people_list;
  }
  if (step.interview_people || step.step_text) {
    return [{
      name: step.interview_people || '',
      statement: step.step_text || '',
    }];
  }
  return [{}];
};

const normalizeInterviewPeopleForPayload = (people = []) => (
  people
    .map((person) => ({
      name: String(person?.name || '').trim(),
      statement: String(person?.statement || '').trim(),
    }))
    .filter((person) => person.name || person.statement)
);

const renderInterviewPeople = (step) => {
  const people = normalizeInterviewPeopleForPayload(step.interview_people_list);
  if (people.length) {
    const peopleHtml = people.map((person, index) => (
      `${index + 1}. <b>${person.name || '—'}</b>${person.statement ? `<br/>Warbixinta: ${person.statement}` : ''}`
    )).join('<br/><br/>');
    return `${peopleHtml}${step.step_text ? `<br/><br/><b>Gunaanadka wareysiga:</b> ${step.step_text}` : ''}`;
  }
  return `<b>Dadka la wareystay:</b> ${step.interview_people || '—'}<br/><b>Warbixinta wareysiga:</b> ${step.step_text || '—'}`;
};
export default function CaseDetailsPage({ caseId, mode = 'page', onClose, onBack } = {}) {
  const params = useParams();
  const id = caseId || params?.id;
  const router = useRouter();
  const isOverlayMode = mode === 'overlay';
  const { user, loading: authLoading } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = (key) => user?.role === 'admin' || userPermissions.includes('*') || userPermissions.includes(key);
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
  const [isInvestigationModalOpen, setIsInvestigationModalOpen] = useState(false);
  const [isReturnRemandModalOpen, setIsReturnRemandModalOpen] = useState(false);
  const [editingInvestigation, setEditingInvestigation] = useState(null);
  const [previewInvestigation, setPreviewInvestigation] = useState(null);
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
  const [investigationForm] = Form.useForm();
  const [returnRemandForm] = Form.useForm();
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
      if (!isOverlayMode) router.push('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, isOverlayMode, message, router]);

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
      'admin', 'staff', 'officer', 'investigator', 'station_jail', 'region_admin', 'district_admin',
      'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
      'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
      'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
    ];
    const permissions = user?.permissions || [];
    const canRead = user && (
      allowedRoles.includes(user.role)
      || permissions.includes('*')
      || permissions.includes('cases.view')
      || permissions.includes('cases.investigate')
    );
    if (id && !authLoading && canRead) {
      fetchCaseDetails();
      const assignRoles = ['admin', 'district_commander', 'police_station_commander', 'district_admin'];
      if (assignRoles.includes(user.role)) {
        fetchAssignableOfficers();
      }
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [id, fetchCaseDetails, user?.id, user?.role, user?.permissions, authLoading]);

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
      await api.post('/referrals', {
        ...values,
        case_id: id,
        reason: values.reason || 'Case forwarded to court.',
      });
      message.success('Case referred to court successfully.');
      setIsReferralModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Referral failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnCourtRemand = async (values) => {
    const remandId = data?.pendingCourtRemand?.id;
    if (!remandId) {
      message.error('Ma jiro remand maxkamadeed oo sugaya soo celin.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/cases/${id}/remands/${remandId}/return`, {
        investigation_id: values.investigation_id || null,
        return_notes: values.return_notes,
      });
      message.success('Baarista dheeraadka ah waxaa lagu celiyay maxkamadda.');
      setIsReturnRemandModalOpen(false);
      returnRemandForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || 'Soo celinta maxkamadda way fashilantay.');
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

  const handleSaveSuspect = async (values) => {
    setSubmitting(true);
    try {
      if (editingSuspect) {
        await api.put(`/criminals/${editingSuspect.id}`, {
          ...values,
          case_id: id,
          face_capture_image: (suspectFaceImage && suspectFaceImage.startsWith('data:')) ? suspectFaceImage : null,
          arrest_status: values.arrest_status || 'arrested',
          is_arrested: (values.arrest_status || 'arrested') === 'arrested' ? 1 : 0
        });
        message.success("Suspect details updated successfully.");
      } else {
        await api.post('/criminals', {
          ...values,
          case_id: id,
          face_capture_image: (suspectFaceImage && suspectFaceImage.startsWith('data:')) ? suspectFaceImage : null,
          arrest_status: values.arrest_status || 'arrested',
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
    if (changedValues.id_number !== undefined || changedValues.id_type !== undefined || changedValues.phone !== undefined) {
      const idType = allValues.id_type;
      const idNumber = allValues.id_number ? String(allValues.id_number).trim() : '';
      const phone = allValues.phone ? String(allValues.phone).trim() : '';
      if ((idNumber && idNumber.length >= 3) || (phone && phone.length >= 6)) {
        try {
          const res = await api.get('/criminals/check-duplicate', {
            params: {
              id_type: idType || undefined,
              id_number: idNumber || undefined,
              phone: phone || undefined,
            }
          });
          if (res.data.exists) {
            setDuplicateAlert({ ...res.data.data, matchReason: res.data.matchReason });
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
      mother_name: criminal.mother_name || undefined,
      alias: criminal.alias || undefined,
      gender: criminal.gender || 'male',
      age: criminal.age || undefined,
      date_of_birth: criminal.date_of_birth ? dayjs(criminal.date_of_birth) : undefined,
      nationality: criminal.nationality || 'Somali',
      id_type: criminal.id_type || 'National ID',
      id_number: criminal.id_number || undefined,
      phone: criminal.phone || undefined,
      address: criminal.address || undefined,
      description: criminal.description || undefined,
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
      message.success('Case assigned to baare successfully.');
      setIsAssignmentModalOpen(false);
      assignmentForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || 'Assignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenInvestigationModal = async () => {
    setEditingInvestigation(null);
    investigationForm.resetFields();
    const defaultInvestigatorName = data.officer_name || user?.fullName || user?.username || '';
    investigationForm.setFieldsValue({
      investigation_number: `INV-${dayjs().format('YYYY')}-${Math.floor(10000 + Math.random() * 90000)}`,
      ob_number: data.ob_number || '',
      investigator_name: defaultInvestigatorName,
      investigation_date: dayjs(),
      status: 'Socota',
      evidence_data: [],
      witnesses_data: [],
      steps_data: [],
    });
    setIsInvestigationModalOpen(true);
    if (!data.officer_name && user?.role === 'district_admin') {
      try {
        const res = await api.get('/users/sub-admins');
        const investigator = (res.data.data || []).find(item => String(item.role || '').toLowerCase().replace('-', '_') === 'investigator');
        if (investigator?.full_name) {
          investigationForm.setFieldsValue({ investigator_name: investigator.full_name });
        }
      } catch {
        // Keep the visible fallback name; failing to prefill should not block the form.
      }
    }
  };

  const handleOpenEditInvestigationModal = (inv) => {
    const evidenceData = parseInvestigationList(inv.evidence_data).map((item, index) => ({
      ...item,
      file: existingUploadList(item.file_url, `Caddeyn ${index + 1}`),
    }));
    const stepsData = parseInvestigationList(inv.steps_data).map((item, index) => ({
      ...item,
      interview_people_list: normalizeInterviewPeopleForForm(item),
      step_file_url: item.step_file,
      step_file: existingUploadList(item.step_file, `Tallaabo ${index + 1}`),
    }));

    setEditingInvestigation(inv);
    investigationForm.resetFields();
    investigationForm.setFieldsValue({
      investigation_number: inv.investigation_number,
      ob_number: inv.ob_number || data.ob_number || '',
      investigator_name: inv.investigator_name || data.officer_name || user?.fullName || user?.username || '',
      investigation_date: inv.investigation_date ? dayjs(inv.investigation_date) : dayjs(),
      status: inv.status || 'Socota',
      evidence_data: evidenceData,
      witnesses_data: parseInvestigationList(inv.witnesses_data),
      steps_data: stepsData,
      summary: inv.summary || '',
      outcome: inv.outcome || '',
      recommendation: inv.recommendation || '',
    });
    setIsInvestigationModalOpen(true);
  };

  const handleCreateInvestigation = async (values) => {
    setSubmitting(true);
    try {
      const evidenceItems = (values.evidence_data || []).map((item) => ({
        evidence_type: item.evidence_type || 'document',
        description: item.description || '',
        file_url: item.file_url || '',
      }));
      const stepItems = (values.steps_data || []).map((item) => ({
        ...item,
        step_label: item.step_label || '',
        type: item.type || 'interview',
        interview_people_list: normalizeInterviewPeopleForPayload(item.interview_people_list),
        interview_people: normalizeInterviewPeopleForPayload(item.interview_people_list).map((person) => person.name).join(', '),
        step_text: item.step_text || normalizeInterviewPeopleForPayload(item.interview_people_list).map((person) => person.statement).filter(Boolean).join('\n'),
        description: item.description || '',
        step_file: item.step_file_url || item.step_file || '',
      }));
      const payload = {
        ...values,
        ob_number: data.ob_number || '',
        investigation_date: values.investigation_date ? values.investigation_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        evidence_data: evidenceItems,
        steps_data: stepItems,
      };
      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      (values.evidence_data || []).forEach((item, index) => {
        const file = getUploadFile(item.file);
        if (file) formData.append(`evidence_file_${index}`, file);
      });
      (values.steps_data || []).forEach((item, index) => {
        const file = getUploadFile(item.step_file);
        if (file) formData.append(`step_file_${index}`, file);
      });
      if (editingInvestigation?.id) {
        await api.put(`/cases/${id}/investigations/${editingInvestigation.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success("Warbixinta baaritaanka si guul leh ayaa loo cusboonaysiiyay.");
      } else {
        await api.post(`/cases/${id}/investigations`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success("Warbixinta baaritaanka si guul leh ayaa loo diiwaangeliyey.");
      }
      setIsInvestigationModalOpen(false);
      setEditingInvestigation(null);
      investigationForm.resetFields();
      fetchCaseDetails();
    } catch (err) {
      message.error(err.response?.data?.message || "Diiwaangelinta baaritaanka way fashilantay.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintInvestigationReport = (inv) => {
    if (!inv) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.warning('Fadlan ogolow popups-ka si aad u daabacdo warbixinta baaritaanka.');
      return;
    }

    const rawEvList = typeof inv.evidence_data === 'string' ? JSON.parse(inv.evidence_data || '[]') : (inv.evidence_data || inv.evList || []);
    const witList = typeof inv.witnesses_data === 'string' ? JSON.parse(inv.witnesses_data || '[]') : (inv.witnesses_data || inv.witList || []);
    const rawStepList = typeof inv.steps_data === 'string' ? JSON.parse(inv.steps_data || '[]') : (inv.steps_data || inv.stepList || []);
    const fileTypeLabel = (type) => ({
      image: 'Sawir',
      video: 'CCTV / Video',
      document: 'Fayl',
      interview: 'Wareysi',
      text: 'Qoraal',
      file: 'Sawir/Fayl',
    }[type] || type || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â');
    const stepDetails = (step) => {
      if (step.type === 'interview') {
        return renderInterviewPeople(step);
      }
      return `${step.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}${step.step_file ? `<br/><a href="${step.step_file}" target="_blank">Eeg Attachment</a>` : ''}`;
    };

    const evList = rawEvList.map((item) => ({
      ...item,
      description: item.evidence_type
        ? `${fileTypeLabel(item.evidence_type)} - ${item.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}`
        : item.description,
    }));
    const stepList = rawStepList.map((item) => {
      if (['image', 'video', 'document'].includes(item.type)) {
        return {
          ...item,
          type: 'file',
          step_text: item.description || item.step_text,
        };
      }
      if (item.type === 'interview') {
        return {
          ...item,
          type: 'text',
          step_text: stepDetails(item),
        };
      }
      return item;
    });
    const printEvList = rawEvList.map((item) => ({
      ...item,
      type_label: fileTypeLabel(item.evidence_type),
      description: item.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',
    }));

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Warbixinta Baaritaanka #${inv.investigation_number}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; padding: 20px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; color: #002B49; }
            .header h2 { margin: 4px 0 0 0; font-size: 16px; font-weight: normal; color: #555; }
            .section-title { font-size: 14px; font-weight: bold; background: #eef2f6; padding: 6px 10px; margin-top: 20px; margin-bottom: 10px; border-left: 4px solid #002B49; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
            th { background-color: #f7f9fa; font-weight: 600; width: 30%; }
            .box { border: 1px solid #ccc; padding: 10px; background: #fafafa; border-radius: 4px; font-size: 13px; white-space: pre-wrap; margin-bottom: 10px; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-block { width: 45%; text-align: center; border-top: 1px dashed #777; padding-top: 8px; margin-top: 50px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CIIDANKA BOOLISKA SOOMAALIYEED</h1>
            <h2>Diiwaanka Rasmiga ah ee Baaritaanka Kiisaska (Police Investigation Report)</h2>
          </div>

          <div class="section-title">1. XOGTA OTOMAATIG AH EE OB-GA IYO BAARITAANKA</div>
          <table>
            <tr><th>Lambarka Baaritaanka (Investigation No.)</th><td><b>${inv.investigation_number}</b></td></tr>
            <tr><th>Lambarka OB</th><td>${inv.ob_number || data.ob_number || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Cinwaanka Dacwadda</th><td>${data.title || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Nooca Dacwadda</th><td>${data.case_type || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Goobta Dhacdada</th><td>${data.incident_location || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Taariikhda & Waqtiga Dhacdada</th><td>${data.incident_date ? dayjs(data.incident_date).format('DD/MM/YYYY HH:mm') : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Soo Dacwoodaha (Complainant)</th><td>${data.complainant_name ? `${data.complainant_name} (${data.complainant_phone || ''})` : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Laga Dacwooday (Accused)</th><td>${(data.suspects || []).map(s => s.full_name).join(', ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Dhibbanaha/Dhibbanayaasha</th><td>${(data.victims || []).map(v => v.full_name).join(', ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
            <tr><th>Faahfaahinta Dacwadda (OB Summary)</th><td>${data.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
          </table>

          <div class="section-title">2. CADDEYMAHA LA HELAY (EVIDENCE COLLECTED)</div>
          ${printEvList.length === 0 ? '<p style="font-size:13px; color:#666;">Wax caddeymo ah oo la qaray ma jiraan.</p>' : `
            <table>
              <thead><tr><th style="width:10%">#</th><th style="width:20%">Nooca</th><th style="width:40%">Faahfaahinta Caddaynta</th><th style="width:30%">Faylka / Sawirka Attached</th></tr></thead>
              <tbody>
                ${printEvList.map((e, idx) => `<tr><td>${idx + 1}</td><td>${e.type_label || 'Ã¢â‚¬â€'}</td><td>${e.description || 'Ã¢â‚¬â€'}</td><td>${e.file_url ? `<a href="${e.file_url}" target="_blank">Eeg Faylka</a>` : 'File ma leh'}</td></tr>`).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">3. MARKHAATIYAASHA IYO WARBIXINTOODA (WITNESSES & STATEMENTS)</div>
          ${witList.length === 0 ? '<p style="font-size:13px; color:#666;">Wax markhaatiyo ah oo la qaray ma jiraan.</p>' : `
            <table>
              <thead><tr><th style="width:30%">Magaca Markhaatiga</th><th style="width:25%">Telefoonka</th><th style="width:45%">Hadalka / Warbixinta Markhaatiga</th></tr></thead>
              <tbody>
                ${witList.map(w => `<tr><td><b>${w.full_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</b></td><td>${w.phone || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td><td>${w.statement || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>`).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">4. TALLAABOOYINKA BAARITAANKA (INVESTIGATION STEPS)</div>
          ${stepList.length === 0 ? '<p style="font-size:13px; color:#666;">Wax tallaabooyin ah oo la qaray ma jiraan.</p>' : `
            <table>
              <thead><tr><th style="width:30%">Magaca Tallaabada</th><th style="width:20%">Nooca</th><th style="width:50%">Faahfaahinta / Attachments</th></tr></thead>
              <tbody>
                ${stepList.map(s => `<tr><td><b>${s.step_label || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</b></td><td>${s.type === 'file' ? 'Sawir/Fayl' : 'Qoraal'}</td><td>${s.type === 'file' ? (s.step_file ? `<a href="${s.step_file}" target="_blank">Eeg Attachment</a>` : 'Fayl ma leh') : (s.step_text || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')}</td></tr>`).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">5. GUNGAARKA BAARITAANKA (INVESTIGATION SUMMARY)</div>
          <div class="box">${inv.summary || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</div>

          <div class="section-title">6. NATIIJADA BAARITAANKA (INVESTIGATION OUTCOME)</div>
          <div class="box">${inv.outcome || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</div>

          <div class="section-title">7. GO'AANKA BAARAHA (INVESTIGATOR RECOMMENDATION)</div>
          <div class="box">${inv.recommendation || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</div>

          <table>
            <tr><th>Xaaladda Baaritaanka</th><td><b>${inv.status || 'Socota'}</b></td></tr>
            <tr><th>Magaca Baaraha</th><td><b>${inv.investigator_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</b></td></tr>
            <tr><th>Taariikhda Baaritaanka la Furay</th><td>${inv.investigation_date ? dayjs(inv.investigation_date).format('DD/MM/YYYY') : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td></tr>
          </table>

          <div class="footer">
            <div class="signature-block">
              Saxiixa Sarkaalka Baaraha<br />
              <b>${inv.investigator_name || 'Sarkaal Baare'}</b>
            </div>
            <div class="signature-block">
              Xaqiijinta & Shaambadda Saldhigga<br />
              <b>Taliyaha Saldhigga / Xafiiska Baarista</b>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
  const canReferCase = ['admin', 'officer', 'investigator', 'cid', ...stationOperationRoles, ...commanderRoles].includes(role);
  const canManageInvestigation = ['admin', 'sub_admin', 'officer', 'investigator', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...stationOperationRoles, ...commanderRoles].includes(role) || user?.permissions?.includes('*') || user?.permissions?.includes('cases.investigate');
  const canAddWitness = ['admin', 'officer', 'cid', ...stationOperationRoles].includes(role);
  const canCreateSuspects = hasPermission('suspects.create') || hasPermission('suspects.manage');
  const canUpdateSuspects = hasPermission('suspects.update') || hasPermission('suspects.manage');
  const caseEndedAtCourtReferral = data.status === 'referred_to_court';
  const pendingCourtRemand = data.pendingCourtRemand || null;
  const hasPendingCourtRemand = Boolean(pendingCourtRemand);
  const canWorkOnInvestigation = canManageInvestigation && (!caseEndedAtCourtReferral || hasPendingCourtRemand);
  const latestInvestigation = (data.investigations || [])[0] || {};
  const assignedOfficerName = data.officer_name || latestInvestigation.investigator_name || null;
  const stationCommanderName = data.station_commander_name || null;

  const courtStatusTab = (
    <Space className="case-court-tab" orientation="vertical" style={{ width: '100%' }} size="large">
      <Title className="case-court-title" level={4}>Court status</Title>
      <CaseStatusStepper status={data.status} />
      <Descriptions className="case-detail-descriptions" bordered column={1} size="small">
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
      <Card size="small" title="Court referrals" className="case-detail-panel case-court-referrals">
        <Table
          className="case-detail-table"
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
        {canManageInvestigation && canCreateSuspects && !caseEndedAtCourtReferral && (
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
    <Space className="case-suspects-tab" orientation="vertical" style={{ width: '100%' }} size={12}>
      <div className="case-suspects-toolbar">
        <div>
          <Title className="case-suspects-title" level={4}>Suspects</Title>
          <Text className="case-suspects-count">{data.suspects?.length || 0} linked suspects</Text>
        </div>
        {canManageInvestigation && !caseEndedAtCourtReferral && (
          <Button
            className="case-suspects-add"
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
        className="case-suspects-table"
        size="small"
        dataSource={data.suspects}
        rowKey={(record) => `suspect-${record.id || `${record.full_name}-${record.role_in_case}`}`}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Face',
            dataIndex: 'face_image',
            render: (src, record) => src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="case-suspect-face" src={`${src}`.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'}${src}` : src} alt={record.full_name} />
            ) : (
              <Avatar className="case-suspect-face case-suspect-face--empty" size={52} icon={<UserOutlined />} />
            )
          },
          {
            title: 'Full Name',
            dataIndex: 'full_name',
            render: (t, r) => (
              <Space className="case-suspect-name-cell" orientation="vertical" size={2}>
                <Typography.Text strong>{t}</Typography.Text>
                {r.alias && <Tag className="status-tag status-tag--neutral">{r.alias}</Tag>}
              </Space>
            ),
          },
          { title: 'Gender', dataIndex: 'gender' },
          { title: 'Age', dataIndex: 'age' },
          { title: 'Phone', dataIndex: 'phone' },
          { title: 'Face Status', dataIndex: 'face_capture_status', render: s => <Tag color={s === 'Captured' ? 'green' : 'default'}>{s}</Tag> },
          { title: 'Arrest Status', dataIndex: 'arrest_status', render: (s, r) => <Tag color={r.is_arrested ? 'red' : 'default'}>{s || (r.is_arrested ? 'arrested' : 'not_arrested')}</Tag> },
          { title: 'Linked Date', dataIndex: 'linked_at', render: d => d ? dayjs(d).format('DD MMM YYYY') : 'N/A' },
          { title: 'Role', dataIndex: 'role_in_case' },
          {
            title: 'Ficilka',
            key: 'action',
            render: (_, record) => (
              <Space wrap>
                {canManageInvestigation && !caseEndedAtCourtReferral && !record.is_arrested && (
                  <Button className="case-suspect-action" size="small" type="primary" icon={<PlusOutlined />} onClick={() => handleOpenArrestModal(record)}>
                    Record Arrest
                  </Button>
                )}
                {canManageInvestigation && !caseEndedAtCourtReferral && (record.is_arrested === 1 || record.is_arrested === true || record.arrest_status === 'arrested') && (
                  <Button className="case-suspect-action" size="small" type="primary" danger icon={<CheckCircleOutlined />} onClick={() => handleOpenReleaseModal(record)}>
                    Release Suspect
                  </Button>
                )}
                {canManageInvestigation && canUpdateSuspects && !caseEndedAtCourtReferral && (
                  <Button className="case-suspect-action" size="small" icon={<EditOutlined />} onClick={() => handleOpenEditSuspect(record)}>
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

  const investigationTab = (
    <Space className="case-investigation-tab" orientation="vertical" style={{ width: '100%' }}>
      <div className="case-investigation-toolbar">
        <div>
          <Title className="case-investigation-title" level={4}>Diiwaanka Baaritaanka Kiiska</Title>
          <Text className="case-investigation-subtitle">Maamul oo diiwaangeli warbixinta baaritaanka nidaamka</Text>
        </div>
        {canWorkOnInvestigation && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenInvestigationModal}
          >
            Ku dar baaris
          </Button>
        )}
      </div>

      {hasPendingCourtRemand && (
        <Alert
          type="warning"
          showIcon
          title="Maxkamaddu waxay dalbatay Baaris Dheeraad ah"
          description={
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
              <Text>{pendingCourtRemand.instructions}</Text>
              <Space wrap>
                {pendingCourtRemand.court_case_number && <Tag color="gold">{pendingCourtRemand.court_case_number}</Tag>}
                {pendingCourtRemand.deadline_date && <Tag color="orange">Deadline: {dayjs(pendingCourtRemand.deadline_date).format('DD MMM YYYY')}</Tag>}
                {pendingCourtRemand.reason && <Tag>{pendingCourtRemand.reason}</Tag>}
              </Space>
              <Space wrap>
                {canWorkOnInvestigation && (
                  <Button icon={<PlusOutlined />} onClick={handleOpenInvestigationModal}>
                    Ku dar Warbixin Baaritaan
                  </Button>
                )}
                {canWorkOnInvestigation && (
                  <Button
                    type="primary"
                    icon={<ShareAltOutlined />}
                    onClick={() => {
                      returnRemandForm.setFieldsValue({
                        investigation_id: latestInvestigation?.id,
                        return_notes: '',
                      });
                      setIsReturnRemandModalOpen(true);
                    }}
                  >
                    Soo Celi Maxkamadda
                  </Button>
                )}
              </Space>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {(data.investigations || []).length === 0 ? (
        <Card className="case-investigation-empty" size="small" style={{ textAlign: 'center', padding: 32 }}>
          <Space orientation="vertical" size="middle">
            <Text type="secondary">Wali ma jiro baaritaan la diiwaangeliyey kiiskan. Taabo batoonka hoose si aad u furto foomka baaritaanka cusub.</Text>
            {canWorkOnInvestigation && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleOpenInvestigationModal}>
                Ku dar baaris
              </Button>
            )}
          </Space>
        </Card>
      ) : (
        <Space className="case-investigation-list" orientation="vertical" style={{ width: '100%' }}>
          {(data.investigations || []).map((inv, idx) => {
            const statusColor = inv.status === 'Dhammaystiran' ? 'green' : inv.status === 'Xiran' ? 'red' : 'blue';

            return (
              <Card className="case-investigation-record" key={`inv-${inv.id || idx}`} size="small" title={`Warbixinta Baaritaanka #${inv.investigation_number}`} extra={
                <Space>
                  <Tag color={statusColor}>{inv.status}</Tag>
                  {canWorkOnInvestigation && (
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditInvestigationModal(inv)}>
                      Wax ka beddel
                    </Button>
                  )}
                  <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintInvestigationReport(inv)}>
                    Preview / Daabac Dukumentiga
                  </Button>
                </Space>
              }>
                <Descriptions className="case-investigation-descriptions" column={2} size="small" bordered style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Lambarka Baaritaanka"><b>{inv.investigation_number}</b></Descriptions.Item>
                  <Descriptions.Item label="Lambarka OB">{inv.ob_number || data.ob_number || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                  <Descriptions.Item label="Magaca Baaraha">{inv.investigator_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                  <Descriptions.Item label="Taariikhda la Furay">{inv.investigation_date ? dayjs(inv.investigation_date).format('DD MMM YYYY') : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                </Descriptions>
                
                {inv.summary && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Gungaarka Baaritaanka:</Text>
                    <Paragraph className="case-investigation-note">{inv.summary}</Paragraph>
                  </div>
                )}
                {inv.outcome && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Natiijada Baaritaanka:</Text>
                    <Paragraph className="case-investigation-note">{inv.outcome}</Paragraph>
                  </div>
                )}
                {inv.recommendation && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Go&apos;aanka Baaraha:</Text>
                    <Paragraph className="case-investigation-note">{inv.recommendation}</Paragraph>
                  </div>
                )}
              </Card>
            );
          })}
        </Space>
      )}
    </Space>
  );

  return (
    <ProtectedRoute allowedRoles={[
      'admin', 'staff', 'officer', 'investigator', 'station_jail', 'district_admin',
      'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
      'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
      'prosecutor', 'judge', 'court_clerk', 'court', 'court_admin', 'jail',
    ]} requiredPermissions={['cases.view', 'cases.investigate']}>
      <Space className={`case-detail-shell ${isOverlayMode ? 'case-detail-shell--overlay' : ''}`} orientation="vertical" size={0} style={{ width: '100%' }}>
        <div className="case-detail-hero">
          <Space className="case-detail-title-block" orientation="vertical">
            {isOverlayMode ? (
              <Button className="case-detail-back" type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>Back to cases</Button>
            ) : (
              <Link href="/cases">
                <Button className="case-detail-back" type="text" icon={<ArrowLeftOutlined />}>Back to cases</Button>
              </Link>
            )}
            <Space className="case-detail-title-row" align="center" wrap>
              <Title className="case-detail-title" level={2} style={{ margin: 0 }}>
                {data.case_number || data.ob_number}
              </Title>
              <CaseStatusTag status={data.status} />
            </Space>
            <Text className="case-detail-meta">
              {data.title || 'Untitled case'}
              {data.station_name ? ` · ${data.station_name}` : ''}
              {assignedOfficerName ? ` · ${assignedOfficerName}` : ''}
            </Text>
          </Space>

          <Space className="case-detail-hero-actions" wrap>
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
                Assign baare
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
            {canReferCase && !caseEndedAtCourtReferral && (
              <Button
                type="primary"
                icon={<ShareAltOutlined />}
                onClick={() => {
                  referralForm.setFieldsValue({ referred_to_role: 'court' });
                  setIsReferralModalOpen(true);
                }}
              >
                U Gudbi Maxkamad
              </Button>
            )}
          </Space>
        </div>

        <div className="case-detail-content">
          <Card variant="none" className="case-detail-stepper-card">
            <CaseStatusStepper status={data.status} />
          </Card>

        <Row className="case-detail-grid" gutter={[14, 14]}>
          <Col xs={24} lg={16}>
            <Card variant="none" className="case-detail-panel case-detail-tabs-panel">
              <Tabs
                defaultActiveKey="overview"
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="large">
                        <Descriptions className="case-detail-descriptions" title="Incident particulars" bordered column={1} size="small">
                          <Descriptions.Item label="Case number">{data.case_number || data.id}</Descriptions.Item>
                          <Descriptions.Item label="Subject">{data.title}</Descriptions.Item>
                          <Descriptions.Item label="Category">{data.case_type || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="Incident type">{data.incident_type || data.title}</Descriptions.Item>
                          <Descriptions.Item label="Priority">
                            <Tag className={`status-tag status-tag--${data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'warning' : 'neutral'}`}>
                              {data.priority || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Incident date">
                            {data.incident_date ? dayjs(data.incident_date).format('DD MMM YYYY HH:mm') : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Location">{data.incident_location || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="Occurrence details">
                            <Paragraph style={{ marginBottom: 0 }}>{data.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Paragraph>
                          </Descriptions.Item>
                        </Descriptions>

                        <Descriptions className="case-detail-descriptions" title="Linked OB" bordered column={1} size="small">
                          <Descriptions.Item label="OB number">{data.ob_number || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="Original OB staff">{data.ob_registered_by_name || data.original_ob_staff_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="OB registration date">
                            {data.ob_registration_date ? `${dayjs(data.ob_registration_date).format('DD MMM YYYY')} ${data.ob_registration_time || ''}` : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                          </Descriptions.Item>
                          <Descriptions.Item label="State">{data.state_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="Region">{data.region_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="District station">{data.district_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                        </Descriptions>

                        <Descriptions className="case-detail-descriptions" title="Complainant" bordered column={2} size="small">
                          <Descriptions.Item label="Full name">{data.complainant_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                          <Descriptions.Item label="Phone">{data.complainant_phone || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
                        </Descriptions>

                        <div className="case-detail-hash-panel">
                          <HashVerifier entityType="case" entityId={data.id} />
                        </div>

                        <Card size="small" title="Activity timeline" className="case-detail-panel case-detail-activity">
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
                                    {action.performed_by ? ` Ãƒâ€šÃ‚Â· ${action.performed_by}` : ''}
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
                  { key: 'investigation', label: `Baaritaan (${(data.investigations || []).length})`, children: investigationTab },
                  { key: 'court', label: 'Court status', children: courtStatusTab },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Case assignment" variant="none" className="case-detail-panel case-detail-side-card">
              <Descriptions className="case-detail-side-descriptions" column={1} size="small">
                <Descriptions.Item label="Region">{data.region_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="District">{data.district_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Station">{data.station_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Assigned baare">{assignedOfficerName || '—'}</Descriptions.Item>
                <Descriptions.Item label="Station commander">{stationCommanderName || '—'}</Descriptions.Item>
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
                  Assign / reassign baare
                </Button>
              )}
            </Card>
            <Card title="Victims & witnesses" variant="none" className="case-detail-panel case-detail-side-card">
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
                    <div className="case-side-person-row" key={`victim-${v.id || index}-${index}`}>
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
                    <div className="case-side-person-row" key={`witness-${w.id || index}-${index}`}>
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
          <div className="case-detail-footer-actions">
            {isOverlayMode ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <Link href="/cases">
                <Button>Close</Button>
              </Link>
            )}
            {canReferCase && !caseEndedAtCourtReferral && (
              <Button
                type="primary"
                icon={<ShareAltOutlined />}
                onClick={() => {
                  referralForm.setFieldsValue({ referred_to_role: 'court' });
                  setIsReferralModalOpen(true);
                }}
              >
                U Gudbi Maxkamad
              </Button>
            )}
          </div>
        </div>
      </Space>

      {/* Modals */}
      <Modal title="Assign Case Baare" open={isAssignmentModalOpen} onCancel={() => setIsAssignmentModalOpen(false)} onOk={() => assignmentForm.submit()}>
        <Form form={assignmentForm} onFinish={handleAssignment} layout="vertical">
          <Form.Item name="officer_id" label="Baare" rules={[requiredRule('Baare')]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select active baare"
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

      <Modal title="Refer Case to Court" open={isReferralModalOpen} onCancel={() => setIsReferralModalOpen(false)} onOk={() => referralForm.submit()}>
        <Form form={referralForm} onFinish={handleReferral} layout="vertical">
          <Form.Item name="referred_to_role" label="Refer To" rules={[requiredRule('Referral destination')]}>
            <Select>
              <Option value="court">Court Referral</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Soo Celi Maxkamadda"
        open={isReturnRemandModalOpen}
        onCancel={() => {
          setIsReturnRemandModalOpen(false);
          returnRemandForm.resetFields();
        }}
        onOk={() => returnRemandForm.submit()}
        confirmLoading={submitting}
        okText="Soo Celi"
        cancelText="Jooji"
      >
        <Form form={returnRemandForm} onFinish={handleReturnCourtRemand} layout="vertical">
          <Form.Item name="investigation_id" label="Warbixinta Baaritaanka">
            <Select
              allowClear
              placeholder="Dooro warbixinta baaritaanka"
              options={(data.investigations || []).map((inv) => ({
                value: inv.id,
                label: `${inv.investigation_number || `INV-${inv.id}`} - ${inv.status || 'Socota'}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="return_notes"
            label="Faahfaahinta Soo Celinta"
            rules={[requiredRule('Faahfaahinta soo celinta'), textLengthRule('Faahfaahinta soo celinta', 5, 2000)]}
          >
            <TextArea rows={4} placeholder="Qor waxa baaris dheeraad ah laga qabtay iyo waxa maxkamadda loo celinayo..." />
          </Form.Item>
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
          onFinish={handleSaveSuspect}
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
                  description={
                    <div>
                      <div><strong>Magaca:</strong> {duplicateAlert.full_name} ({duplicateAlert.gender === 'female' ? 'Dheddig' : 'Lab'}, {duplicateAlert.age ? `${duplicateAlert.age} jir` : "Da'da lama hayo"})</div>
                      <div style={{ marginTop: '2px' }}>
                        {duplicateAlert.id_number && <span><strong>ID:</strong> {duplicateAlert.id_type ? `${duplicateAlert.id_type} - ` : ''}{duplicateAlert.id_number} &nbsp;|&nbsp; </span>}
                        {duplicateAlert.phone && <span><strong>Tel:</strong> {duplicateAlert.phone}</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                        {duplicateAlert.matchReason === 'both' && '✅ Waxaa lagu aqoonsaday Aqoonsiga Qaranka iyo Taleefanka labadaba.'}
                        {duplicateAlert.matchReason === 'id_number' && '🔍 Waxaa lagu aqoonsaday Lambarka Aqoonsiga (National ID / Passport).'}
                        {duplicateAlert.matchReason === 'phone' && '📞 Waxaa lagu aqoonsaday Lambarka Taleefanka.'}
                      </div>
                    </div>
                  }
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
            <Col xs={24} md={8}><Form.Item name="age" label="Age (Auto-calculated from DOB)" rules={[positiveIntegerRule('Age', 8, 120)]}><Input type="number" min={8} max={120} disabled placeholder="Calculated from DOB" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="date_of_birth" label="Date of Birth" rules={[minimumAge8Rule()]}><DatePicker style={{ width: '100%' }} disabledDate={disabledUnder8DobDate} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali" rules={[textLengthRule('Nationality', 2, 100)]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="id_type" label="ID Type">
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
                  borderRadius: 8,
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
        <Card className="case-modal-summary-card" size="small" variant="none" style={{ marginBottom: 16 }}>
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
              <Form.Item name="bail_status" label="Heerka Damaanadda (Bail Status)">
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
        <Card className="case-modal-summary-card" size="small" variant="none" style={{ marginBottom: 16 }}>
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

      {/* Ku Dar Baaris Modal */}
      <Modal
        title={editingInvestigation ? "Wax ka beddel Warbixinta Baaritaanka" : "Ku Dar Warbixinta Baaritaanka (Add Investigation Record)"}
        open={isInvestigationModalOpen}
        onCancel={() => {
          setIsInvestigationModalOpen(false);
          setEditingInvestigation(null);
          investigationForm.resetFields();
        }}
        onOk={() => investigationForm.submit()}
        confirmLoading={submitting}
        width={950}
        okText={editingInvestigation ? "Cusboonaysii Baaritaanka" : "Kaydi Baaritaanka"}
        cancelText="Jooji"
      >
        <Alert
          title="Xogta si Otomaatig ah looga soo qaaday OB-ga (Read-Only for Verification)"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          description={
            <Descriptions column={2} size="small" style={{ marginTop: 8 }}>
              <Descriptions.Item label="Lambarka OB"><b>{data.ob_number || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</b></Descriptions.Item>
              <Descriptions.Item label="Cinwaanka Dacwadda">{data.title || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Nooca Dacwadda">{data.case_type || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Goobta Dhacdada">{data.incident_location || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Taariikhda & Waqtiga Dhacdada">{data.incident_date ? dayjs(data.incident_date).format('YYYY-MM-DD HH:mm') : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Soo Dacwoodaha">{data.complainant_name ? `${data.complainant_name} (${data.complainant_phone || ''})` : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Laga Dacwooday (Accused)">{(data.suspects || []).map(s => s.full_name).join(', ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Dhibbanayaasha">{(data.victims || []).map(v => v.full_name).join(', ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
              <Descriptions.Item label="Faahfaahinta OB" span={2}>{data.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</Descriptions.Item>
            </Descriptions>
          }
        />

        <Form form={investigationForm} onFinish={handleCreateInvestigation} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item name="investigation_number" label="Lambarka Baaritaanka (Auto)" rules={[requiredRule('Lambarka baaritaanka')]}>
                <Input readOnly />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="investigator_name" label="Magaca Baaraha" rules={[requiredRule('Magaca baaraha')]}>
                <Input placeholder="Magaca sarkaalka baaraha" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="investigation_date" label="Taariikhda la Furay" rules={[requiredRule('Taariikhda baaritaanka')]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="status" label="Xaaladda Baaritaanka" rules={[requiredRule('Xaaladda baaritaanka')]}>
                <Select options={[
                  { value: 'Socota', label: 'Socota (Ongoing)' },
                  { value: 'Dhammaystiran', label: 'Dhammaystiran (Completed)' },
                  { value: 'Xiran', label: 'Xiran (Closed)' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="1. Caddeymaha la Helay (Evidence Collected)" style={{ marginBottom: 16 }}>
            <Form.List name="evidence_data">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Row gutter={8} key={key} style={{ marginBottom: 8 }} align="middle">
                      <Col span={5}>
                        <Form.Item {...rest} name={[name, 'evidence_type']} label="Nooca Caddaynta" rules={[requiredRule('Nooca caddaynta')]} style={{ marginBottom: 0 }}>
                          <Select options={[
                            { value: 'image', label: 'Sawir' },
                            { value: 'video', label: 'CCTV / Video' },
                            { value: 'document', label: 'Fayl' },
                          ]} />
                        </Form.Item>
                      </Col>
                      <Col span={7}>
                        <Form.Item noStyle shouldUpdate>
                          {() => {
                            const evidenceType = investigationForm.getFieldValue(['evidence_data', name, 'evidence_type']) || 'document';
                            const uploadConfig = getInvestigationUploadConfig(evidenceType);
                            return (
                              <Form.Item
                                {...rest}
                                name={[name, 'file']}
                                label={uploadConfig.label}
                                valuePropName="fileList"
                                getValueFromEvent={(event) => event?.fileList || []}
                                rules={[requiredRule('Faylka caddaynta')]}
                                style={{ marginBottom: 0 }}
                              >
                                <Upload
                                  maxCount={1}
                                  accept={uploadConfig.accept}
                                  beforeUpload={(file) => {
                                    const errorMsg = uploadConfig.validate(file);
                                    if (errorMsg) {
                                      message.error(errorMsg);
                                      return Upload.LIST_IGNORE;
                                    }
                                    return false;
                                  }}
                                >
                                  <Button icon={<FileAddOutlined />}>{uploadConfig.buttonText}</Button>
                                </Upload>
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={11}>
                        <Form.Item {...rest} name={[name, 'description']} label="Faahfaahinta Caddaynta" rules={[requiredRule('Faahfaahinta caddaynta')]} style={{ marginBottom: 0 }}>
                          <Input placeholder="Qor faahfaahinta caddaynta..." />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ textAlign: 'center', marginTop: 22 }}>
                        <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ evidence_type: 'document' })}>
                    Ku Dar Caddayn Kale
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Card size="small" title="2. Markhaatiyaasha (Witnesses)" style={{ marginBottom: 16 }}>
            <Form.List name="witnesses_data">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Row gutter={8} key={key} style={{ marginBottom: 8 }} align="middle">
                      <Col span={7}>
                        <Form.Item {...rest} name={[name, 'full_name']} label="Magaca Markhaatiga" style={{ marginBottom: 0 }}>
                          <Input placeholder="Magaca oo buuxa..." />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...rest} name={[name, 'phone']} label="Telefoonka" rules={phoneRules} style={{ marginBottom: 0 }}>
                          <Input placeholder="Lambarka telefoonka..." />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item {...rest} name={[name, 'statement']} label="Hadalka / Warbixinta Markhaatiga" style={{ marginBottom: 0 }}>
                          <Input placeholder="Hadalkii uu qaray markhaatigu..." />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ textAlign: 'center', marginTop: 22 }}>
                        <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                    Ku Dar Markhaati Kale (Add More)
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Card size="small" title="3. Tallaabooyinka Baaritaanka (Investigation Steps)" style={{ marginBottom: 16 }}>
            <Form.List name="steps_data">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => {
                    return (
                      <Row gutter={8} key={key} style={{ marginBottom: 8 }} align="middle">
                        <Col span={7}>
                          <Form.Item {...rest} name={[name, 'step_label']} label="Label-ka Tallaabada" style={{ marginBottom: 0 }}>
                            <Input placeholder="tusaale Goob baaris, Wareysi..." />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item {...rest} name={[name, 'type']} label="Ikhtiyaarka" style={{ marginBottom: 0 }}>
                            <Select options={[
                              { value: 'interview', label: 'Wareysi' },
                              { value: 'image', label: 'Sawir' },
                              { value: 'video', label: 'CCTV / Video' },
                              { value: 'document', label: 'Fayl' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={11}>
                          <Form.Item noStyle shouldUpdate>
                            {() => {
                              const activeStepType = investigationForm.getFieldValue(['steps_data', name, 'type']) || 'interview';
                              if (activeStepType === 'interview') {
                                return (
                                  <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                                    <Form.List name={[name, 'interview_people_list']}>
                                      {(personFields, { add: addPerson, remove: removePerson }) => (
                                        <>
                                          {personFields.map(({ key: personKey, name: personName, ...personRest }) => (
                                            <Row gutter={8} key={personKey} align="middle">
                                              <Col span={8}>
                                                <Form.Item {...personRest} name={[personName, 'name']} label="Magaca qofka" rules={[requiredRule('Magaca qofka')]} style={{ marginBottom: 0 }}>
                                                  <Input placeholder="Magaca qofka..." />
                                                </Form.Item>
                                              </Col>
                                              <Col span={15}>
                                                <Form.Item {...personRest} name={[personName, 'statement']} label="Hadalka qofka" rules={[requiredRule('Hadalka qofka')]} style={{ marginBottom: 0 }}>
                                                  <Input placeholder="Qor hadalka qofkan..." />
                                                </Form.Item>
                                              </Col>
                                              <Col span={1} style={{ textAlign: 'center', marginTop: 22 }}>
                                                <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => removePerson(personName)} />
                                              </Col>
                                            </Row>
                                          ))}
                                          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addPerson({})}>
                                            Ku Dar Qof Kale oo la Wareystay
                                          </Button>
                                        </>
                                      )}
                                    </Form.List>
                                    <Form.Item {...rest} name={[name, 'step_text']} label="Gunaanadka Wareysiga" style={{ marginBottom: 0 }}>
                                      <Input placeholder="Qor gunaanad guud haddii loo baahdo..." />
                                    </Form.Item>
                                  </Space>
                                );
                              }
                              const uploadConfig = getInvestigationUploadConfig(activeStepType);
                              return (
                                <Row gutter={8}>
                                  <Col span={10}>
                                    <Form.Item
                                      {...rest}
                                      name={[name, 'step_file']}
                                      label={uploadConfig.label}
                                      valuePropName="fileList"
                                      getValueFromEvent={(event) => event?.fileList || []}
                                      rules={[requiredRule('Faylka tallaabada')]}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <Upload
                                        maxCount={1}
                                        accept={uploadConfig.accept}
                                        beforeUpload={(file) => {
                                          const errorMsg = uploadConfig.validate(file);
                                          if (errorMsg) {
                                            message.error(errorMsg);
                                            return Upload.LIST_IGNORE;
                                          }
                                          return false;
                                        }}
                                      >
                                        <Button icon={<FileAddOutlined />}>{uploadConfig.buttonText}</Button>
                                      </Upload>
                                    </Form.Item>
                                  </Col>
                                  <Col span={14}>
                                    <Form.Item {...rest} name={[name, 'description']} label="Faahfaahinta Tallaabada" rules={[requiredRule('Faahfaahinta tallaabada')]} style={{ marginBottom: 0 }}>
                                      <Input placeholder="Qor faahfaahinta faylka/sawirka/video-ga..." />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col span={1} style={{ textAlign: 'center', marginTop: 22 }}>
                          <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                        </Col>
                      </Row>
                    );
                  })}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ type: 'interview', interview_people_list: [{}] })}>
                    Ku Dar Tallaabo Kale (Add More)
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Form.Item name="summary" label="Gungaarka Baaritaanka (Investigation Summary / Conclusion)">
            <TextArea rows={3} placeholder="Warbixin kooban oo Baaraha qoro oo sheegaysa gunaanadka guud ee baaritaanka..." />
          </Form.Item>

          <Form.Item name="outcome" label="Natiijada Baaritaanka (Investigation Outcome)">
            <TextArea rows={3} placeholder="Warbixinta guud ee natiijada baaritaanku keenay..." />
          </Form.Item>

          <Form.Item name="recommendation" label="Go'aanka Baaraha (Investigator Recommendation)">
            <TextArea rows={3} placeholder="Go'aanka ama talada uu Baaraha soo bandhigayo..." />
          </Form.Item>
        </Form>
      </Modal>

    </ProtectedRoute>
  );
}
