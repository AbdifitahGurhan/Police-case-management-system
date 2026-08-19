'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  App,
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  FileImageOutlined,
  HistoryOutlined,
  IdcardOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { compressImageFile } from '@/utils/imageCompression';
import { disabledUnder8DobDate, minimumAge8Rule } from '@/utils/validation';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const UPLOAD_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const getRequestErrorMessage = (err, fallback) => {
  if (err.code === 'ECONNABORTED') {
    return 'The request timed out. Please make sure the backend API is running on port 5000.';
  }
  if (!err.response) {
    return 'Cannot reach the backend API. Please make sure the backend server is running.';
  }
  return err.response?.data?.message || fallback;
};

export default function OffendersPage() {
  const { message } = App.useApp();
  const messageRef = useRef(message);
  const { user } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = (key) => user?.role === 'admin' || userPermissions.includes('*') || userPermissions.includes(key);
  const [form] = Form.useForm();
  const [releaseForm] = Form.useForm();
  const [sentenceForm] = Form.useForm();
  const [custodyForm] = Form.useForm();
  const [offenders, setOffenders] = useState([]);
  const [sentenceAlerts, setSentenceAlerts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedArrest, setSelectedArrest] = useState(null);
  const [custodyAction, setCustodyAction] = useState(null);
  const [filters, setFilters] = useState({ search: '', gender: undefined, arrested: undefined, repeat: undefined });
  const canCreateOffenders = hasPermission('suspects.create') || hasPermission('suspects.manage');
  const canUpdateOffenders = hasPermission('suspects.update') || hasPermission('suspects.manage');
  const canReleaseOffenders = ['admin', 'jail'].includes(user?.role);
  const canManageSentence = ['admin', 'court', 'jail'].includes(user?.role);
  const canManageCustody = ['admin', 'court', 'jail', 'cid', 'district_admin'].includes(user?.role);

  const [suspectFaceImage, setSuspectFaceImage] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const [duplicateAlert, setDuplicateAlert] = useState(null);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const fetchOffenders = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
      const res = await api.get('/criminals', { params });
      setOffenders(res.data.data || []);
      setLoadError('');
    } catch (err) {
      console.error(err);
      const errorMessage = getRequestErrorMessage(err, 'Failed to load offenders.');
      setLoadError(errorMessage);
      messageRef.current.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSentenceAlerts = useCallback(async () => {
    if (!['admin', 'jail'].includes(user?.role)) return;
    try {
      const res = await api.get('/criminals/sentence-alerts');
      setSentenceAlerts(res.data.data || []);
    } catch (err) {
      console.error(err);
      messageRef.current.warning(getRequestErrorMessage(err, 'Failed to load sentence alerts.'));
    }
  }, [user?.role]);

  useEffect(() => {
    fetchOffenders();
    fetchSentenceAlerts();
  }, [fetchOffenders, fetchSentenceAlerts]);

  const stats = useMemo(() => {
    const total = offenders.length;
    const arrested = offenders.filter((item) => Number(item.is_arrested) === 1).length;
    const repeat = offenders.filter((item) => Number(item.case_count || 0) > 1).length;
    const withPhotos = offenders.filter((item) => item.photo_url).length;
    return { total, arrested, repeat, withPhotos };
  }, [offenders]);

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
    if (!modalOpen) stopCamera();
  }, [modalOpen]);

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
      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        doCapture();
      };
      video.addEventListener('canplay', onCanPlay);
    }
  };

  const handleFormValuesChange = async (changedValues, allValues) => {
    if (changedValues.date_of_birth) {
      const dob = dayjs(changedValues.date_of_birth);
      if (dob.isValid()) {
        const calculatedAge = dayjs().diff(dob, 'year');
        if (calculatedAge >= 0) {
          form.setFieldsValue({ age: calculatedAge });
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
    form.setFieldsValue({
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
      profile_notes: criminal.profile_notes || undefined,
    });
    if (criminal.face_capture_image) {
      setSuspectFaceImage(criminal.face_capture_image);
    } else if (criminal.photo_url) {
      setSuspectFaceImage(criminal.photo_url);
    }
    setDuplicateAlert(null);
    message.success("Macluumaadka dambiilaha hore waa la soo qaatay!");
  };

  const openCreate = () => {
    setEditing(null);
    setSuspectFaceImage('');
    setDuplicateAlert(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = async (record) => {
    setDuplicateAlert(null);
    setLoading(true);
    try {
      const res = await api.get(`/criminals/${record.id}`);
      const fullRecord = res.data.data;
      setEditing(fullRecord);
      setSuspectFaceImage(fullRecord.face_capture_image || fullRecord.photo_url || '');
      form.setFieldsValue({
        ...fullRecord,
        age: fullRecord.age ? Number(fullRecord.age) : null,
        date_of_birth: fullRecord.date_of_birth ? dayjs(fullRecord.date_of_birth) : null,
      });
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      message.error('Failed to load offender details.');
    } finally {
      setLoading(false);
    }
  };

  const openRelease = (record) => {
    setReleasing(record);
    releaseForm.resetFields();
    setReleaseOpen(true);
  };

  const openHistory = async (record) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setSelectedProfile(null);
    try {
      const res = await api.get(`/criminals/${record.id}/history`);
      setSelectedProfile(res.data.data);
    } catch (err) {
      console.error(err);
      message.error('Failed to load offender history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSentenceFormValuesChange = (changedValues, allValues) => {
    const periodValue = allValues.sentence_period_value;
    const periodUnit = allValues.sentence_period_unit;
    const startDate = allValues.sentence_start_date;

    if (periodValue && periodUnit && startDate) {
      const val = Number(periodValue);
      const start = dayjs.isDayjs(startDate) ? startDate : dayjs(startDate);

      if (!isNaN(val) && val > 0 && start && typeof start.isValid === 'function' && start.isValid()) {
        let expected;
        if (periodUnit === 'days') expected = start.add(val, 'day');
        else if (periodUnit === 'months') expected = start.add(val, 'month');
        else if (periodUnit === 'years') expected = start.add(val, 'year');

        if (expected && typeof expected.isValid === 'function' && expected.isValid()) {
          sentenceForm.setFieldsValue({ expected_release_date: expected });
        }
      }
    }
  };

  const openSentence = (arrest) => {
    setSelectedArrest(arrest);
    const startDate = arrest.sentence_start_date ? dayjs(arrest.sentence_start_date) : dayjs();
    const periodValue = arrest.sentence_period_value ? Number(arrest.sentence_period_value) : null;
    const periodUnit = arrest.sentence_period_unit || 'days';
    let expectedRelease = arrest.expected_release_date ? dayjs(arrest.expected_release_date) : null;

    if (!expectedRelease && periodValue && startDate && typeof startDate.isValid === 'function' && startDate.isValid()) {
      if (periodUnit === 'days') expectedRelease = startDate.add(periodValue, 'day');
      else if (periodUnit === 'months') expectedRelease = startDate.add(periodValue, 'month');
      else if (periodUnit === 'years') expectedRelease = startDate.add(periodValue, 'year');
    }

    sentenceForm.setFieldsValue({
      court_decision: arrest.court_decision || 'pending',
      court_decision_notes: arrest.court_decision_notes,
      sentence_period_value: periodValue,
      sentence_period_unit: periodUnit,
      sentence_start_date: startDate,
      expected_release_date: expectedRelease,
      sentence_status: arrest.sentence_status || 'awaiting_trial',
      final_status: arrest.final_status,
      notes: arrest.notes,
    });
    setSentenceOpen(true);
  };

  const refreshSelectedProfile = async () => {
    if (!selectedProfile?.profile?.id) return;
    const res = await api.get(`/criminals/${selectedProfile.profile.id}/history`);
    setSelectedProfile(res.data.data);
  };

  const openCustodyAction = (action) => {
    setCustodyAction(action);
    custodyForm.resetFields();
    setCustodyOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'photo') return;
        if (key === 'date_of_birth' && value) {
          payload.append(key, value.format('YYYY-MM-DD'));
          return;
        }
        if (value !== undefined && value !== null) payload.append(key, value);
      });
      const file = values.photo?.[0]?.originFileObj;
      if (file) payload.append('photo', file);
      if (suspectFaceImage && suspectFaceImage.startsWith('data:')) {
        payload.append('face_capture_image', suspectFaceImage);
      }

      if (editing) {
        await api.put(`/criminals/${editing.id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success('Offender profile updated.');
      } else {
        await api.post('/criminals', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success('Offender profile registered.');
      }
      setModalOpen(false);
      fetchOffenders();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.matchedExisting) {
        // Profile already exists — no action taken, just inform the officer
        const matched = err.response.data.data;
        message.warning(
          matched
            ? `Qofkan horey ayaa loo diiwaan-geliyey: ${matched.full_name}. Wax ficil ah oo cusub lama samayn.`
            : err.response.data.message || 'Qofkan horey ayaa loo diiwaan-geliyey.'
        );
        setModalOpen(false);
        stopCamera();
        setDuplicateAlert(null);
      } else {
        console.error(err);
        message.error(err.response?.data?.message || 'Validation failed. Please check the form.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (values) => {
    if (!releasing) return;
    setSaving(true);
    try {
      await api.post(`/criminals/${releasing.id}/release`, values);
      message.success('The offender has been released.');
      setReleaseOpen(false);
      setReleasing(null);
      releaseForm.resetFields();
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Release failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitRelease = async () => {
    try {
      const values = await releaseForm.validateFields();
      await handleRelease(values);
    } catch {
      // Ant Design will display validation messages next to the fields.
    }
  };

  const handleSentenceUpdate = async (values) => {
    if (!selectedArrest) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        sentence_start_date: values.sentence_start_date ? values.sentence_start_date.format('YYYY-MM-DD') : null,
        expected_release_date: values.expected_release_date ? values.expected_release_date.format('YYYY-MM-DD') : null,
      };
      await api.put(`/arrests/${selectedArrest.id}/sentence`, payload);
      if (values.sentence_status && values.sentence_status !== selectedArrest.sentence_status) {
        await api.patch(`/arrests/${selectedArrest.id}/status`, {
          sentence_status: values.sentence_status,
          final_status: values.final_status,
          notes: values.notes,
        });
      }
      message.success('Sentence and prisoner status updated.');
      setSentenceOpen(false);
      if (selectedProfile?.profile?.id) {
        await refreshSelectedProfile();
      }
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to update sentence.');
    } finally {
      setSaving(false);
    }
  };

  const handleCustodySubmit = async (values) => {
    if (!selectedProfile?.profile?.id || !custodyAction) return;
    setSaving(true);
    try {
      const suspectId = selectedProfile.profile.id;
      const arrestId = values.arrest_id || selectedProfile.arrests?.[0]?.id || null;
      const datePayload = {
        ...values,
        arrest_id: arrestId,
        transfer_date: values.transfer_date ? values.transfer_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        record_date: values.record_date ? values.record_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        visit_date: values.visit_date ? values.visit_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
      };

      if (custodyAction === 'document') {
        const payload = new FormData();
        Object.entries(datePayload).forEach(([key, value]) => {
          if (key !== 'document' && value !== undefined && value !== null) payload.append(key, value);
        });
        const file = values.document?.[0]?.originFileObj;
        if (file) payload.append('document', file);
        await api.post(`/custody/criminals/${suspectId}/documents`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const endpointByAction = {
          biometric: 'biometrics',
          transfer: 'transfers',
          medical: 'medical-records',
          visitor: 'visitor-logs',
          release: 'release-approvals',
        };
        await api.post(`/custody/criminals/${suspectId}/${endpointByAction[custodyAction]}`, datePayload);
      }

      message.success('Custody record saved.');
      setCustodyOpen(false);
      await refreshSelectedProfile();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to save custody record.');
    } finally {
      setSaving(false);
    }
  };

  const releaseStatusColor = (status) => ({
    pending_admin_review: 'orange',
    admin_reviewed: 'blue',
    prison_confirmed: 'purple',
    court_approved: 'cyan',
    certificate_generated: 'geekblue',
    released: 'green',
    rejected: 'red',
  }[status] || 'default');

  const releaseStepIndex = (status) => ({
    pending_admin_review: 0,
    admin_reviewed: 1,
    prison_confirmed: 2,
    court_approved: 3,
    certificate_generated: 4,
    released: 5,
  }[status] ?? 0);

  const releaseStepItems = [
    { title: 'Admin Review', content: 'Admin' },
    { title: 'Prison Confirm', content: 'Jail' },
    { title: 'Court Approval', content: 'Court/Admin' },
    { title: 'Approved', content: 'Ready for certificate' },
    { title: 'Certificate', content: 'Generated' },
    { title: 'Released', content: 'Final' },
  ];

  const printReleaseCertificate = (certificate) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Release Certificate ${certificate.certificate_number}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:40px;color:#111827}
            .cert{border:4px solid #163b73;padding:32px;max-width:760px;margin:auto}
            h1{text-align:center;margin:0 0 8px;color:#163b73}
            h2{text-align:center;margin:0 0 28px;font-size:16px;color:#475467}
            .row{display:flex;justify-content:space-between;border-bottom:1px solid #d0d5dd;padding:12px 0}
            .label{font-weight:bold}
            .footer{margin-top:40px;display:flex;justify-content:space-between}
          </style>
        </head>
        <body>
          <div class="cert">
            <h1>Somali Police Force</h1>
            <h2>Release Certificate</h2>
            <div class="row"><span class="label">Certificate No.</span><span>${certificate.certificate_number}</span></div>
            <div class="row"><span class="label">Released Person</span><span>${certificate.suspect_name}</span></div>
            <div class="row"><span class="label">Case OB Number</span><span>${certificate.ob_number}</span></div>
            <div class="row"><span class="label">Case Title</span><span>${certificate.case_title}</span></div>
            <div class="row"><span class="label">Issued By</span><span>${certificate.issued_by}</span></div>
            <div class="row"><span class="label">Issued At</span><span>${dayjs(certificate.issued_at).format('YYYY-MM-DD HH:mm')}</span></div>
            <div class="row"><span class="label">Final Status</span><span>Released</span></div>
            <p>${certificate.notes || ''}</p>
            <div class="footer"><span>Prison Officer</span><span>Court/Authority</span><span>Admin</span></div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const reviewReleaseApproval = async (approval, action) => {
    setSaving(true);
    try {
      const endpointByAction = {
        admin_review: `/custody/release-approvals/${approval.id}/admin-review`,
        prison_confirm: `/custody/release-approvals/${approval.id}/prison-confirmation`,
        court_approve: `/custody/release-approvals/${approval.id}/court-approval`,
        reject: `/custody/release-approvals/${approval.id}`,
      };
      const payloadByAction = {
        admin_review: { decision: 'approved', notes: 'Admin reviewed sentence completion and approved release workflow.' },
        prison_confirm: { notes: 'Prison officer confirmed identity, custody file, and readiness for release.' },
        court_approve: { decision: 'approved', notes: 'Court/authority approved final release.' },
        reject: { status: 'rejected', review_notes: 'Release workflow rejected after review.' },
      };
      const res = await api.patch(endpointByAction[action], payloadByAction[action]);
      message.success(res.data.message || 'Release workflow updated.');
      await refreshSelectedProfile();
      fetchOffenders();
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to review release request.');
    } finally {
      setSaving(false);
    }
  };

  const generateReleaseCertificate = async (approval) => {
    setSaving(true);
    try {
      const res = await api.post(`/custody/release-approvals/${approval.id}/certificate`, {
        notes: 'Release certificate generated after full approval workflow.',
      });
      message.success(res.data.message || 'Release certificate generated.');
      fetchSentenceAlerts();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Release failed.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'Alias', 'Gender', 'Age', 'Nationality', 'Phone', 'Cases', 'Arrested'],
      ...offenders.map((item) => [
        item.full_name,
        item.alias || '',
        item.gender || '',
        item.age || '',
        item.nationality || '',
        item.phone || '',
        item.case_count || 0,
        Number(item.is_arrested) === 1 ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `offenders-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printList = () => {
    const htmlRows = offenders.map((item) => `
      <tr>
        <td>${item.full_name || ''}</td>
        <td>${item.alias || ''}</td>
        <td>${item.gender || ''}</td>
        <td>${item.nationality || ''}</td>
        <td>${item.case_count || 0}</td>
        <td>${Number(item.is_arrested) === 1 ? 'Gacanta lagu hayaa' : 'Lama hayo'}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Diiwaanka Eedeysanayaasha</title>
      <style>body{font-family:Arial;padding:28px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e2ef;padding:10px;text-align:left}th{background:#eef6ff}h1{margin-bottom:4px}</style>
      </head><body><h1>Ciidanka Booliska Soomaaliyeed</h1><h2>Diiwaanka Eedeysanayaasha</h2><p>La soo saaray ${dayjs().format('YYYY-MM-DD HH:mm')}</p><table><thead><tr><th>Magaca</th><th>Naaneysta</th><th>Jinsiga</th><th>Dhalashada</th><th>Kiisaska</th><th>Xaaladda</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>
    `);
    win.document.close();
    win.print();
  };

  const columns = [
    {
      title: 'Eedeysanaha / Dambiilaha',
      dataIndex: 'full_name',
      width: 260,
      render: (name, row) => (
        <Space className="offender-identity-cell" align="start">
          {(row.face_capture_image || row.photo_url) ? (
            <Avatar className="offender-avatar" size={48} src={<Image src={(() => { const img = row.face_capture_image || row.photo_url; return (img.startsWith('data:') || img.startsWith('http')) ? img : `${UPLOAD_BASE_URL}${img}`; })()} alt={name} preview={false} />} />
          ) : (
            <Avatar className="offender-avatar offender-avatar--empty" size={48} icon={<UserOutlined />} />
          )}
          <div className="offender-identity-copy">
            <Text strong>{name}</Text>
            <Text type="secondary">{row.alias || 'Naaneys ma leh'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Jinsiga',
      dataIndex: 'gender',
      width: 110,
      render: (value) => {
        const norm = String(value || '').toLowerCase();
        return <Tag>{norm === 'male' || norm === 'lab' ? 'Lab' : norm === 'female' || norm === 'dhedig' ? 'Dhedig' : '—'}</Tag>;
      },
    },
    { title: 'Da\'da', dataIndex: 'age', width: 80 },
    { title: 'Dhalashada', dataIndex: 'nationality', width: 140, ellipsis: { showTitle: false } },
    { title: 'Telefoonka', dataIndex: 'phone', width: 150, ellipsis: { showTitle: false } },
    { title: 'Kiisaska Ku Xiran', dataIndex: 'case_count', width: 130, align: 'center', render: (value) => <Tag color={value > 1 ? 'red' : 'blue'}>{value || 0} kiis</Tag> },
    { title: 'Xaaladda Xarigga', dataIndex: 'is_arrested', width: 140, render: (value) => Number(value) === 1 ? <Tag color="red">Gacanta lagu hayaa</Tag> : <Tag color="green">Lama hayo</Tag> },
    {
      title: 'Hawlaha',
      key: 'actions',
      width: 240,
      render: (_, row) => (
        <Space wrap size="small">
          {canUpdateOffenders && <Button size="small" onClick={() => openEdit(row)}>Wax ka beddel</Button>}
          <Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(row)}>Taariikhda</Button>
          {canReleaseOffenders && Number(row.is_arrested) === 1 && (
            <Button size="small" type="primary" icon={<UnlockOutlined />} onClick={() => openRelease(row)}>
              Sii-deyn
            </Button>
          )}
          {!canUpdateOffenders && !(canReleaseOffenders && Number(row.is_arrested) === 1) && <Tag color="blue">Akhris Keliya</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_commander', 'officer', 'cid', 'court', 'jail', 'district_admin', 'ob_staff']} requiredPermissions={['suspects.view', 'suspects.manage']}>
      <div className="offenders-page">
        {loadError && (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            title="Xogta eedeysanayaasha lama soo sharixi karo"
            description={loadError}
          />
        )}

        {sentenceAlerts.length > 0 && (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            title={`${sentenceAlerts.length} maxbuus ayaa dhammeystay muddadii xabsiga waxaana loo baahan yahay dib-u-eegis sii-deyn.`}
            description={sentenceAlerts.slice(0, 3).map((alert) => alert.message).join(' ')}
          />
        )}

        <div className="offenders-hero">
          <div>
            <Text className="dashboard-eyebrow">Diiwaanka Dambi-baarista</Text>
            <Title level={2}>Eedeysanayaasha & Dambiilayaasha</Title>
            <Text className="offenders-hero-subtitle">Maamul aqoonsiga, sawirrada, baaritaanka faraha, iyo taariikhda dambiyada hore.</Text>
          </div>
          <Space className="offenders-hero-actions" wrap>
            <Button icon={<PrinterOutlined />} onClick={printList}>Daabac</Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>Soo Dejiso (CSV)</Button>
            {canCreateOffenders && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Diiwaangeli Eedeysane</Button>}
          </Space>
        </div>

        <Row className="offenders-kpi-row" gutter={[14, 14]}>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="offender-kpi-card"><Statistic title="Wadarta Eedeysanayaasha" value={stats.total} prefix={<TeamOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="offender-kpi-card"><Statistic title="Dambiyada Soo Laalaabtay" value={stats.repeat} prefix={<IdcardOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="offender-kpi-card"><Statistic title="Gacanta Lagu Hayo" value={stats.arrested} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card variant="none" className="offender-kpi-card"><Statistic title="Kuwa Sawirrada Leh" value={stats.withPhotos} prefix={<FileImageOutlined />} /></Card></Col>
        </Row>

        <Card variant="none" className="offenders-panel">
          <Row className="offenders-filter-row" gutter={[12, 12]}>
            <Col xs={24} lg={10}>
              <Input prefix={<SearchOutlined />} placeholder="Raadi magac, naaneys, lambar aqoonsi, telefoon, ama cinwaan..." value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} allowClear />
            </Col>
            <Col xs={12} lg={4}><Select placeholder="Jinsiga" value={filters.gender} onChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))} allowClear style={{ width: '100%' }} options={[{ value: 'male', label: 'Lab' }, { value: 'female', label: 'Dhedig' }]} /></Col>
            <Col xs={12} lg={4}><Select placeholder="Xaaladda" value={filters.arrested} onChange={(value) => setFilters((prev) => ({ ...prev, arrested: value }))} allowClear style={{ width: '100%' }} options={[{ value: '1', label: 'Gacanta Lagu Hayo' }, { value: '0', label: 'Lama hayo' }]} /></Col>
            <Col xs={24} lg={4}><Select placeholder="Dambiyada soo laalaabtay" value={filters.repeat} onChange={(value) => setFilters((prev) => ({ ...prev, repeat: value }))} allowClear style={{ width: '100%' }} options={[{ value: '1', label: 'Haa' }]} /></Col>
          </Row>
          <Table className="offenders-table" columns={columns} dataSource={offenders} rowKey="id" loading={loading} scroll={{ x: 1200 }} />
        </Card>

        <Modal
          title={editing ? 'Edit Offender Profile' : 'Register Offender'}
          open={modalOpen}
          onCancel={() => { setModalOpen(false); stopCamera(); setDuplicateAlert(null); }}
          onOk={() => form.submit()}
          confirmLoading={saving}
          width={820}
          destroyOnHidden
          forceRender
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleFormValuesChange}>
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
              <Col xs={24} md={12}><Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: 'Full name is required.' }, { min: 3 }]}><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="mother_name" label="Mother's Name"><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="alias" label="Alias"><Input /></Form.Item></Col>
              <Col xs={24} md={12}>
                <Form.Item name="date_of_birth" label="Date of Birth" rules={[minimumAge8Rule()]}>
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Select DOB" disabledDate={disabledUnder8DobDate} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="gender" label="Gender" initialValue="male" rules={[{ required: true }]}><Select options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="age" label="Age" rules={[{ type: 'number', min: 8, max: 120, message: "Da'da waa in ay ahaataa ugu yaraan 8 jir." }]}><InputNumber style={{ width: '100%' }} min={8} max={120} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="nationality" label="Nationality" initialValue="Somali"><Input /></Form.Item></Col>
              <Col xs={24} md={12}>
                <Form.Item name="id_type" label="ID Type">
                  <Select placeholder="Select ID type">
                    <Select.Option value="National ID">National ID</Select.Option>
                    <Select.Option value="Passport">Passport</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}><Form.Item name="id_number" label="ID Number"><Input placeholder="Optional ID number" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="phone" label="Phone" rules={[{ pattern: /^[+\d][\d\s-]{6,24}$/, message: 'Use a valid phone number.' }]}><Input /></Form.Item></Col>
              <Col xs={24}><Form.Item name="address" label="Address"><Input /></Form.Item></Col>
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
                      <img src={suspectFaceImage.startsWith('data:') || suspectFaceImage.startsWith('http') ? suspectFaceImage : `${UPLOAD_BASE_URL}${suspectFaceImage}`} alt="Suspect face capture preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
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

        <Modal
          title={selectedProfile ? `Complete History: ${selectedProfile.profile.full_name}` : 'Complete History'}
          open={historyOpen}
          onCancel={() => setHistoryOpen(false)}
          footer={[
            <Button key="close" onClick={() => setHistoryOpen(false)}>Close</Button>,
            <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>,
          ]}
          width={1100}
        >
          <Card loading={historyLoading} variant="none">
            {selectedProfile && (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {selectedProfile.release_alerts?.length > 0 && (
                  <Alert type="warning" showIcon title={selectedProfile.release_alerts[0].message} />
                )}
                {selectedProfile.repeat_offender && (
                  <Alert type="info" showIcon title="This person has previous arrest or case history connected to the same profile." />
                )}
                <Row gutter={[16, 16]}>
                  {/* Left Profile Panel */}
                  <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', padding: '12px 0' }}>
                      <div style={{ marginBottom: 16 }}>
                        {(selectedProfile.profile.face_capture_image || selectedProfile.profile.photo_url) ? (
                          <Image
                            width={140}
                            height={140}
                            style={{ objectFit: 'cover', borderRadius: 8, border: '2px solid #cbd5e1' }}
                            src={(() => {
                              const img = selectedProfile.profile.face_capture_image || selectedProfile.profile.photo_url;
                              return (img.startsWith('data:') || img.startsWith('http')) ? img : `${UPLOAD_BASE_URL}${img}`;
                            })()}
                            alt={selectedProfile.profile.full_name}
                          />
                        ) : (
                          <Avatar size={100} icon={<UserOutlined />} />
                        )}
                      </div>
                      <Title level={4} style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{selectedProfile.profile.full_name}</Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{selectedProfile.profile.alias ? `"${selectedProfile.profile.alias}"` : 'No Alias'}</Text>

                      <div style={{ marginBottom: 16 }}>
                        {selectedProfile.profile.arrest_status === 'arrested' ? (
                          <Tag color="red" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 'bold', borderRadius: '4px' }}>
                            🔴 IN CUSTODY (XIRAN)
                          </Tag>
                        ) : selectedProfile.profile.arrest_status === 'wanted' ? (
                          <Tag color="volcano" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 'bold', borderRadius: '4px' }}>
                            ⚠️ WANTED / ESCAPED
                          </Tag>
                        ) : (
                          <Tag color="green" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 'bold', borderRadius: '4px' }}>
                            🟢 RELEASED (XOR)
                          </Tag>
                        )}
                      </div>

                      <Row gutter={8} style={{ width: '100%', marginTop: 8 }}>
                        <Col span={12} style={{ textAlign: 'center' }}>
                          <Statistic title="Total Cases" value={selectedProfile.total_cases ?? 0} styles={{ content: { fontSize: 16 } }} />
                        </Col>
                        <Col span={12} style={{ textAlign: 'center' }}>
                          <Statistic title="Arrests" value={selectedProfile.total_arrests ?? 0} styles={{ content: { fontSize: 16 } }} />
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Right Descriptions Panel */}
                  <Col xs={24} md={18}>
                    <Descriptions bordered size="small" column={2} style={{ height: '100%' }}>
                      <Descriptions.Item label="Mother's Name">{selectedProfile.profile.mother_name || 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Gender">{selectedProfile.profile.gender ? selectedProfile.profile.gender.toUpperCase() : 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Age / DOB">{selectedProfile.profile.age || 'N/A'} yrs {selectedProfile.profile.date_of_birth ? `(${dayjs(selectedProfile.profile.date_of_birth).format('YYYY-MM-DD')})` : ''}</Descriptions.Item>
                      <Descriptions.Item label="Nationality">{selectedProfile.profile.nationality || 'Somali'}</Descriptions.Item>
                      <Descriptions.Item label="ID Number">{selectedProfile.profile.id_type || 'ID'}: {selectedProfile.profile.id_number || 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Phone">{selectedProfile.profile.phone || 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Address" span={2}>{selectedProfile.profile.address || 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Description/Notes" span={2}>{selectedProfile.profile.description || selectedProfile.profile.profile_notes || 'No description notes available.'}</Descriptions.Item>
                      <Descriptions.Item label="First Arrest Date">{selectedProfile.first_arrest_date ? dayjs(selectedProfile.first_arrest_date).format('YYYY-MM-DD') : 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Current Custody Location">
                        {selectedProfile.profile.arrest_status === 'arrested' ? (
                          <Text strong type="danger">
                            {selectedProfile.profile.custody_location || 'Unknown Station'}
                          </Text>
                        ) : (
                          <Text type="secondary">Not in custody</Text>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
                <Tabs
                  items={[
                    {
                      key: 'arrests',
                      label: 'Arrest & Sentence History',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.arrests}
                          pagination={false}
                          scroll={{ x: 1300 }}
                          columns={[
                            { title: 'OB Number', dataIndex: 'ob_number' },
                            { title: 'Station', dataIndex: 'police_station_name', render: (v) => v || 'N/A' },
                            { title: 'Arrest Date', dataIndex: 'arrest_date', render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : 'N/A' },
                            { title: 'Charges', dataIndex: 'charges', ellipsis: true },
                            { title: 'Court', dataIndex: 'court_decision', render: (v) => <Tag>{(v || 'pending').toUpperCase()}</Tag> },
                            { title: 'Sentence', render: (_, row) => row.sentence_period_value ? `${row.sentence_period_value} ${row.sentence_period_unit}` : 'N/A' },
                            { title: 'Release Date', dataIndex: 'expected_release_date', render: (v) => v || 'N/A' },
                            { title: 'Progress', render: (_, row) => <Progress percent={row.sentence_progress_percent || 0} size="small" /> },
                            { title: 'Remaining', render: (_, row) => row.remaining_days === null ? 'N/A' : `${row.remaining_days} day(s)` },
                            { title: 'Status', dataIndex: 'sentence_status', render: (v) => <Tag color={['escaped', 'wanted'].includes(v) ? 'red' : 'blue'}>{(v || 'awaiting_trial').toUpperCase()}</Tag> },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'cases',
                      label: 'Case Records',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.cases}
                          pagination={false}
                          columns={[
                            { title: 'OB Number', dataIndex: 'ob_number' },
                            { title: 'Title', dataIndex: 'title' },
                            { title: 'Station', dataIndex: 'police_station_name' },
                            { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                            { title: 'Role', dataIndex: 'role_in_case' },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'actions',
                      label: 'Actions Taken',
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={selectedProfile.actions}
                          pagination={{ pageSize: 6 }}
                          columns={[
                            { title: 'Date', dataIndex: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                            { title: 'Ficilka', dataIndex: 'action_type' },
                            { title: 'By', dataIndex: 'performed_by' },
                            { title: 'Description', dataIndex: 'description' },
                          ]}
                        />
                      ),
                    },
                    {
                      key: 'custody',
                      label: 'Custody Records',
                      children: (
                        <Space orientation="vertical" style={{ width: '100%' }} size="large">
                          {canManageCustody && (
                            <Space wrap>
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('transfer')}>Prison Transfer</Button>}
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('medical')}>Medical Record</Button>}
                              {['admin', 'jail'].includes(user?.role) && <Button onClick={() => openCustodyAction('visitor')}>Visitor Log</Button>}
                              {['admin', 'jail'].includes(user?.role)
                                && (!selectedProfile.release_approvals?.[0]?.status || selectedProfile.release_approvals[0].status === 'rejected')
                                && <Button type="primary" onClick={() => openCustodyAction('release')}>Request Release</Button>}
                            </Space>
                          )}
                          {(selectedProfile.release_approvals || []).length > 0 && (() => {
                            const latest = selectedProfile.release_approvals[0];
                            return (
                              <Card size="small" title="Release Progress" style={{ marginBottom: 12 }}>
                                {latest.status === 'rejected' ? (
                                  <Alert type="error" showIcon title="Release request rejected" description={latest.review_notes || latest.request_reason} />
                                ) : (
                                  <Steps
                                    size="small"
                                    responsive
                                    current={releaseStepIndex(latest.status)}
                                    status={latest.status === 'released' ? 'finish' : 'process'}
                                    items={releaseStepItems}
                                  />
                                )}
                              </Card>
                            );
                          })()}
                          <Table
                            title={() => 'Prison Transfer History'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.prison_transfers || []}
                            pagination={false}
                            columns={[
                              { title: 'From', dataIndex: 'from_facility' },
                              { title: 'To', dataIndex: 'to_facility' },
                              { title: 'Reason', dataIndex: 'transfer_reason' },
                              { title: 'Date', dataIndex: 'transfer_date', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                              { title: 'Authorized By', dataIndex: 'authorized_by' },
                            ]}
                          />
                          <Table
                            title={() => 'Medical Records'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.medical_records || []}
                            pagination={false}
                            columns={[
                              { title: 'Date', dataIndex: 'record_date', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                              { title: 'Condition', dataIndex: 'condition_summary', ellipsis: true },
                              { title: 'Treatment', dataIndex: 'treatment_given', ellipsis: true },
                              { title: 'Doctor', dataIndex: 'doctor_name' },
                              { title: 'Fitness', dataIndex: 'fitness_status', render: (v) => <Tag>{v}</Tag> },
                            ]}
                          />
                          <Table
                            title={() => 'Visitor Logs'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.visitor_logs || []}
                            pagination={false}
                            columns={[
                              { title: 'Visitor', dataIndex: 'visitor_name' },
                              { title: 'ID Number', dataIndex: 'visitor_id_number' },
                              { title: 'Relationship', dataIndex: 'relationship' },
                              { title: 'Visit Date', dataIndex: 'visit_date', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                              { title: 'Approved By', dataIndex: 'approved_by' },
                            ]}
                          />
                          <Table
                            title={() => 'Release Approval Workflow'}
                            size="small"
                            rowKey="id"
                            dataSource={selectedProfile.release_approvals || []}
                            pagination={false}
                            columns={[
                              { title: 'Requested By', dataIndex: 'requested_by' },
                              { title: 'Reason', dataIndex: 'request_reason' },
                              { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={releaseStatusColor(v)}>{String(v || '').replaceAll('_', ' ')}</Tag> },
                              { title: 'Admin', dataIndex: 'admin_reviewed_by', render: (v, row) => v || (row.status === 'pending_admin_review' ? 'Pending' : 'N/A') },
                              { title: 'Prison Officer', dataIndex: 'prison_confirmed_by', render: (v, row) => v || (row.status === 'admin_reviewed' ? 'Pending' : 'N/A') },
                              { title: 'Court/Authority', dataIndex: 'court_approved_by', render: (v, row) => v || (row.status === 'prison_confirmed' ? 'Pending' : 'N/A') },
                              { title: 'Certificate', dataIndex: 'certificate_number', render: (v) => v || 'N/A' },
                              {
                                title: 'Ficilka',
                                render: (_, row) => (
                                  <Space>
                                    {user?.role === 'admin' && row.status === 'pending_admin_review' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'admin_review')}>Admin Review</Button>
                                    )}
                                    {user?.role === 'jail' && row.status === 'admin_reviewed' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'prison_confirm')}>Prison Confirm</Button>
                                    )}
                                    {['court', 'admin'].includes(user?.role) && row.status === 'prison_confirmed' && (
                                      <Button size="small" type="primary" onClick={() => reviewReleaseApproval(row, 'court_approve')}>Court Approve</Button>
                                    )}
                                    {['admin', 'court', 'jail'].includes(user?.role) && row.status === 'court_approved' && (
                                      <Button size="small" type="primary" onClick={() => generateReleaseCertificate(row)}>Generate Certificate</Button>
                                    )}
                                    {['admin', 'court', 'jail'].includes(user?.role) && row.status === 'certificate_generated' && (
                                      <Button size="small" type="primary" danger onClick={() => generateReleaseCertificate(row)}>Confirm Release</Button>
                                    )}
                                    {user?.role === 'admin' && ['pending_admin_review', 'admin_reviewed', 'prison_confirmed'].includes(row.status) && (
                                      <Button size="small" danger onClick={() => reviewReleaseApproval(row, 'reject')}>Reject</Button>
                                    )}
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              </Space>
            )}
          </Card>
        </Modal>



        <Modal
          title={{
            biometric: 'Add Biometric Identifier',
            document: 'Add Prisoner Document',
            transfer: 'Record Prison Transfer',
            medical: 'Add Medical Record',
            visitor: 'Add Visitor Log',
            release: 'Request Release Approval',
          }[custodyAction] || 'Custody Record'}
          open={custodyOpen}
          zIndex={1100}
          onCancel={() => setCustodyOpen(false)}
          onOk={() => custodyForm.submit()}
          confirmLoading={saving}
          width={760}
          destroyOnHidden
          forceRender
        >
          <Form form={custodyForm} layout="vertical" onFinish={handleCustodySubmit}>
            <Form.Item name="arrest_id" label="Related Arrest">
              <Select
                allowClear
                placeholder="Use latest arrest if left blank"
                options={(selectedProfile?.arrests || []).map((arrest) => ({
                  value: arrest.id,
                  label: `${arrest.ob_number || 'Arrest'} - ${arrest.police_station_name || 'Station N/A'}`,
                }))}
              />
            </Form.Item>

            {custodyAction === 'biometric' && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="biometric_type" label="Biometric Type" rules={[{ required: true }]}>
                    <Select options={[{ value: 'fingerprint', label: 'Fingerprint' }, { value: 'face', label: 'Face' }, { value: 'iris', label: 'Iris' }, { value: 'other', label: 'Other' }]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}><Form.Item name="quality_score" label="Quality Score"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="biometric_hash" label="Biometric Hash / Reference" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'document' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="document_type" label="Document Type" rules={[{ required: true }]}><Input placeholder="Court order, warrant, medical file..." /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="document" label="File" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList || []}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<PlusOutlined />}>Select Document</Button></Upload></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'transfer' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="from_facility" label="From Facility"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="to_facility" label="To Facility" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="transfer_date" label="Transfer Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="status" label="Status" initialValue="completed"><Select options={[{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="transfer_reason" label="Reason" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'medical' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="record_date" label="Record Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="fitness_status" label="Fitness Status" initialValue="fit"><Select options={[{ value: 'fit', label: 'Fit' }, { value: 'needs_treatment', label: 'Needs Treatment' }, { value: 'hospitalized', label: 'Hospitalized' }, { value: 'critical', label: 'Critical' }]} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="doctor_name" label="Doctor / Clinician"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="facility" label="Facility"><Input /></Form.Item></Col>
                <Col xs={24}><Form.Item name="condition_summary" label="Condition Summary" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="treatment_given" label="Treatment Given"><TextArea rows={3} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'visitor' && (
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="visitor_name" label="Visitor Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="visitor_id_number" label="Visitor ID Number"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="relationship" label="Relationship"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="visit_date" label="Visit Date"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="purpose" label="Purpose"><TextArea rows={3} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
              </Row>
            )}

            {custodyAction === 'release' && (
              <Form.Item name="request_reason" label="Release Review Reason" rules={[{ required: true }]}>
                <TextArea rows={4} placeholder="Sentence completed, court order, appeal decision, medical release..." />
              </Form.Item>
            )}
          </Form>
        </Modal>

        <Modal
          title={`Release: ${releasing?.full_name || ''}`}
          open={releaseOpen}
          onCancel={() => {
            setReleaseOpen(false);
            releaseForm.resetFields();
          }}
          confirmLoading={saving}
          destroyOnHidden
          forceRender
          footer={[
            <Button key="cancel" onClick={() => {
              setReleaseOpen(false);
              releaseForm.resetFields();
            }}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={saving} onClick={submitRelease}>
              OK
            </Button>,
          ]}
        >
          <Form form={releaseForm} layout="vertical" onFinish={handleRelease}>
            <Form.Item
              name="release_reason"
              label="Release Reason"
              rules={[{ required: true, message: 'Please enter a release reason.' }, { min: 5, message: 'Reason must be at least 5 characters.' }]}
            >
              <Input placeholder="Example: Court order, bail, or completed investigation" />
            </Form.Item>
            <Form.Item name="release_notes" label="Additional Notes">
              <TextArea rows={4} placeholder="Enter more details if needed." />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
