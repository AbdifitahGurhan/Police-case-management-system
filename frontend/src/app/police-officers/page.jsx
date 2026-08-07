'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Typography, Space, Button, Modal, Form, Input, Select, App, Upload, Avatar, Tag, DatePicker, Row, Col, Image } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined, SwapOutlined, EyeOutlined, StarOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import dayjs from 'dayjs';
import {
  disabledFutureDate,
  disabledUnder18DobDate,
  emailRule,
  minimumAge18Rule,
  nameRules,
  noFutureDateRule,
  phoneRules,
  requiredRule,
  textLengthRule,
  validateOfficerImage,
} from '@/utils/validation';

const { Title } = Typography;
const COMMISSIONED_CODES = new Set(['SG', 'SGS', 'SGT', 'GSH-S', 'GSH-DH', 'GSH', 'DHM', 'LXDG', 'XDG']);
const STATE_ADMIN_RANK_CODES = new Set(['AL', 'SA', 'XDH', 'LXDH', 'LA', 'SXD']);
const DISTRICT_USER_ROLES = new Set(['sub_admin', 'personnel_registry', 'ob_staff', 'investigator', 'station_jail']);
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const getImageUrl = (pathStr) => {
  if (!pathStr) return null;
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://') || pathStr.startsWith('data:')) {
    return pathStr;
  }
  const cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  return `${API_ORIGIN}${cleanPath}`;
};

export default function PoliceOfficersPage() {
  const { user } = useAuth();
  const permissions = new Set(user?.permissions || []);
  const allowed = key => user?.role === 'admin' || permissions.has('*') || permissions.has(key);
  const canCreate = allowed('officers.create');
  const canUpdate = allowed('officers.update');
  const canApprove = allowed('officers.approve');
  const canAssignRank = allowed('ranks.assign') || allowed('officers.approve');
  const canViewLocations = allowed('locations.view');
  const canTransfer = allowed('officers.transfer') && canViewLocations;
  const { message } = App.useApp();
  const router = useRouter();
  const [data, setData] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [transferRecord, setTransferRecord] = useState(null);
  const [rankRecord, setRankRecord] = useState(null);
  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [rankForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);

  const [states, setStates] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [allDistricts, setAllDistricts] = useState([]);

  const assignmentType = Form.useWatch('to_assignment_type', transferForm);
  const selectedState = Form.useWatch('state_id', transferForm);
  const selectedRegion = Form.useWatch('region_id', transferForm);
  const selectedCity = Form.useWatch('city_id', transferForm);
  const selectedDistrict = Form.useWatch('district_id', transferForm);
  const officerDob = Form.useWatch('date_of_birth', form);
  const calculatedAge = officerDob ? dayjs().diff(officerDob, 'year') : '';
  const isDistrictAdmin = user?.role === 'district_admin';
  const deploymentTargetOptions = isDistrictAdmin
    ? [{ value: 'Sub-Admin', label: 'User Degmo (Staff / Operational User)' }]
    : [
        { value: 'Sub-Admin', label: 'Sub-Admin / User Degmo (Staff / Operational User)' },
        { value: 'District Station', label: 'District Station (Saldhiga Degmada)' },
        { value: 'District', label: 'District (Degmo)' },
        { value: 'Region', label: 'Region (Gobol)' },
        { value: 'State Administration', label: 'State Administration (Dowlad Goboleed)' },
      ];
  const eligibleSubAdmins = (subAdmins || []).filter(item => {
    const role = String(item.role || '').toLowerCase().replace('-', '_');
    const sameDistrict = !isDistrictAdmin || Number(item.district_id) === Number(user?.location?.districtId || user?.scopeId);
    return DISTRICT_USER_ROLES.has(role) && sameDistrict;
  });

  useEffect(() => {
    if (user?.role === 'ob_staff') {
      router.replace('/ob-register');
    }
  }, [router, user?.role]);

  const fetchSubAdmins = useCallback(async () => {
    try {
      const res = await api.get('/users/sub-admins');
      setSubAdmins(res.data.data || []);
    } catch (error) {
      if (error.response?.status !== 404) {
        message.error(error.response?.data?.message || 'Sub-Admin list-ka lama soo dejin karin.');
        setSubAdmins([]);
        return;
      }
      try {
        const usersRes = await api.get('/users');
        const fallbackSubAdmins = (usersRes.data.data || []).filter(
          item => String(item.role || '').toLowerCase().replace('-', '_') === 'sub_admin' && item.is_active
        );
        setSubAdmins(fallbackSubAdmins);
      } catch (fallbackError) {
        message.error(fallbackError.response?.data?.message || 'Sub-Admin list-ka lama helin.');
        setSubAdmins([]);
      }
    }
  }, [message]);

  useEffect(() => {
    if (isTransferModalOpen) {
       if (canViewLocations) {
         api.get('/state-administrations').then(res => setStates(res.data.data)).catch(console.error);
       }
       fetchSubAdmins();
    }
  }, [isTransferModalOpen, canViewLocations, fetchSubAdmins]);

  useEffect(() => {
    if (canViewLocations && selectedState) {
       api.get(`/regions?state_administration_id=${selectedState}`).then(res => setRegions(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ region_id: undefined, city_id: undefined, district_id: undefined });
    }
  }, [selectedState, transferForm, canViewLocations]);

  useEffect(() => {
    if (canViewLocations && selectedRegion) {
       api.get(`/districts?region_id=${selectedRegion}`).then(res => setDistricts(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ district_id: undefined });
    }
  }, [selectedRegion, transferForm, canViewLocations]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, resRanks] = await Promise.all([
        api.get('/police-officers'),
        api.get('/ranks')
      ]);
      setData(resData.data.data);
      setRanks(resRanks.data.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load police officers.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        date_of_birth: record.date_of_birth ? dayjs(record.date_of_birth) : null,
        national_id: record.national_id || null,
      });
      const imgUrl = getImageUrl(record.profile_image);
      setFileList(imgUrl ? [{ uid: '-1', name: 'photo.png', status: 'done', url: imgUrl, thumbUrl: imgUrl }] : []);
    } else {
      form.resetFields();
      setFileList([]);
    }
    // ensure districts for station selector
    if (!allDistricts.length && canViewLocations) {
      api.get('/districts').then(res => setAllDistricts(res.data.data||[])).catch(() => setAllDistricts([]));
    }
    setIsModalOpen(true);
  };

  const handleOpenTransferModal = (record) => {
    setTransferRecord(record);
    transferForm.resetFields();
    if (isDistrictAdmin) {
      transferForm.setFieldsValue({ to_assignment_type: 'Sub-Admin' });
    }
    setIsTransferModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const formData = new FormData();
      Object.keys(values).forEach(key => {
        if (values[key] !== undefined && values[key] !== null) {
          if (key === 'date_of_birth' || key === 'employment_date') {
            formData.append(key, values[key].format('YYYY-MM-DD'));
          } else {
            formData.append(key, values[key]);
          }
        }
      });

      const selectedFileObj = fileList.length > 0 ? (fileList[0].originFileObj || (fileList[0] instanceof File ? fileList[0] : null)) : null;
      if (!editingRecord && !selectedFileObj) { message.error('Sawirka askariga waa wajib.'); return; }
      if (selectedFileObj) {
        const errorMsg = validateOfficerImage(selectedFileObj);
        if (errorMsg) {
          message.error(errorMsg);
          return;
        }
        formData.append('profile_image', selectedFileObj);
      }

      if (editingRecord) {
        await api.put(`/police-officers/${editingRecord.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        message.success("Officer updated.");
      } else {
        await api.post('/police-officers', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        message.success("Officer created.");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return; // Validation error
      message.error(err.response?.data?.message || "Save failed.");
    }
  };

  const handleTransfer = async () => {
     try {
       const values = await transferForm.validateFields();
       
       let targetId = null;
       if (values.to_assignment_type === 'State Administration') targetId = values.state_id;
       if (values.to_assignment_type === 'Sub-Admin') targetId = values.sub_admin_id;
       if (values.to_assignment_type === 'Region') targetId = values.region_id;
       if (values.to_assignment_type === 'City') targetId = values.city_id;
       if (values.to_assignment_type === 'District') targetId = values.district_id;
       if (values.to_assignment_type === 'District Station') targetId = values.district_id;

       if (!targetId) {
         return message.error("Please complete the unit selection dropdowns.");
       }

       await api.post('/officer-transfers', {
         officer_id: transferRecord.id,
         to_assignment_type: values.to_assignment_type,
         to_assignment_id: targetId,
         transfer_reason: values.transfer_reason
       });
       message.success("Officer transferred successfully.");
       setIsTransferModalOpen(false);
       fetchData();
     } catch (err) {
       if (err.errorFields) return; // Validation error
       message.error(err.response?.data?.message || "Transfer failed.");
     }
  };

  const reviewOfficer = async status => {
    try { const values=await reviewForm.validateFields(status==='APPROVED'?['rank_id','notes']:['notes']); await api.post(`/police-officers/${reviewRecord.id}/review`,{...values,status}); message.success(status==='APPROVED'?'Askariga waa la ansixiyey oo la hawlgeliyey.':'Go’aanka waa la kaydiyey.');setReviewRecord(null);reviewForm.resetFields();fetchData(); }
    catch(error){if(!error.errorFields)message.error(error.response?.data?.message||'Go’aanka lama kaydin karin.');}
  };

  const handleOpenRankModal = (record) => {
    setRankRecord(record);
    rankForm.setFieldsValue({ rank_id: record.rank_id });
    setIsRankModalOpen(true);
  };

  const handleSaveRank = async () => {
    try {
      const values = await rankForm.validateFields();
      const response = await api.post(`/police-officers/${rankRecord.id}/rank`, values);
      message.success(response.data?.message || "Darajada waa la siiyey, askarigana APPROVED ayuu noqday.");
      setIsRankModalOpen(false);
      fetchData();
    } catch (err) {
      if (!err.errorFields) {
        message.error(err.response?.data?.message || "Badalaadda darajada waa ay guuldarraysatay.");
      }
    }
  };

  const uploadProps = {
    accept: 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif',
    fileList,
    maxCount: 1,
    listType: 'picture',
    onRemove: () => setFileList([]),
    beforeUpload: (file) => {
      const errorMsg = validateOfficerImage(file);
      if (errorMsg) {
        message.error(errorMsg);
        return Upload.LIST_IGNORE;
      }
      const previewUrl = URL.createObjectURL(file);
      const fileObj = {
        uid: file.uid || String(Date.now()),
        name: file.name,
        status: 'done',
        url: previewUrl,
        thumbUrl: previewUrl,
        originFileObj: file,
      };
      setFileList([fileObj]);
      return false; // Prevent auto upload
    },
  };

  const columns = [
    {
      title: 'Sawirka',
      dataIndex: 'profile_image',
      key: 'profile_image',
      render: (i, record) => (
        <Image
          src={getImageUrl(i)}
          alt={record.full_name}
          width={44}
          height={44}
          style={{ objectFit: 'cover', borderRadius: '50%', border: '1px solid #e5e7eb' }}
          fallback={`https://ui-avatars.com/api/?name=${encodeURIComponent(record.full_name || 'Officer')}&background=0D8ABC&color=fff`}
        />
      ),
    },
    { title: 'Magaca oo Buuxa', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Lambarka Ciidanka', dataIndex: 'force_number', key: 'force_number', render: f => <Tag color="blue">{f}</Tag> },
    { title: 'Darajada', dataIndex: 'rank_name', key: 'rank_name', render: (rn, r) => <Tag color="gold" style={{ fontWeight: 600 }}>{rn ? `${rn}${r.rank_code ? ` (${r.rank_code})` : ''}` : 'Darajo lama siin'}</Tag> },
    {
      title: 'Goobta Shaqada',
      key: 'current_assignment',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{record.current_assignment_name || 'Taliska Dhexe'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.current_assignment_type || 'Lama qoondeyn'}
          </Typography.Text>
        </Space>
      ),
    },
    { title: 'Ansixinta', dataIndex: 'approval_status', render: s => <Tag color={s==='APPROVED'?'green':s==='PENDING'?'gold':'red'}>{s||'APPROVED'}</Tag> },
    { title: 'Xaaladda Shaqada', dataIndex: 'employment_status', key: 'employment_status', render: s => <Tag color={String(s).toLowerCase() === 'active' ? 'green' : 'red'}>{s}</Tag> },
    {
      title: 'Ficilka',
      key: 'action',
      render: (_, record) => (
        <Space wrap>
          {canUpdate && <Button icon={<EyeOutlined />} type="primary" onClick={() => router.push(`/police-officers/${record.id}`)}>Faahfaahin</Button>}
          {canUpdate && (user?.role === 'admin' || (!record.is_deployed_by_admin && String(record.created_by).toLowerCase() !== 'admin')) && <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>Wax ka beddel</Button>}
          {canAssignRank && (user?.role === 'admin' || user?.role === 'state_admin') && (
            <Button icon={<StarOutlined />} onClick={() => handleOpenRankModal(record)}>Darajo</Button>
          )}
          {canTransfer && (user?.role !== 'state_admin' || STATE_ADMIN_RANK_CODES.has(String(record.rank_code || '').trim().toUpperCase())) &&
            <Button icon={<SwapOutlined />} type="dashed" onClick={() => handleOpenTransferModal(record)}>Wareeji</Button>}
          {canApprove&&user?.role==='state_admin'&&record.approval_status==='PENDING'&&<Button type="primary" onClick={()=>{setReviewRecord(record);reviewForm.resetFields()}}>Dib u Eeg</Button>}
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'sub_admin', 'state_admin', 'personnel_registry', 'region_admin', 'region_commander', 'city_admin']} requiredPermissions={['officers.view', 'officers.create', 'officers.approve']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Saraakiisha Booliska</Title>
            <Typography.Text type="secondary">Maamul xogta askarta, darajooyinka iyo sawirrada.</Typography.Text>
          </div>
          {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Diiwaangeli Askari</Button>}
        </div>

        <Card variant="none">
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={editingRecord ? "Wax ka Beddel Askariga" : "Diiwaangeli Askari"}
          open={isModalOpen}
          width={700}
          onCancel={() => setIsModalOpen(false)}
          onOk={handleSave}
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="full_name" label="Magaca oo Buuxa" rules={nameRules('Magaca askariga')}>
                  <Input placeholder="Qor magaca oo buuxa" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="mother_name" label="Magaca Hooyada" rules={nameRules('Magaca hooyada')}>
                  <Input placeholder="Qor magaca hooyada" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="date_of_birth" label="Taariikhda Dhalashada" rules={[requiredRule('Taariikhda dhalashada'), noFutureDateRule('Taariikhda dhalashada'), minimumAge18Rule('Taariikhda dhalashada')]}><DatePicker style={{ width: '100%' }} disabledDate={disabledUnder18DobDate} /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Da’da"><Input readOnly value={calculatedAge === '' ? '' : `${calculatedAge} sano`} placeholder="Waxaa laga xisaabinayaa dhalashada" /></Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="gender" label="Jinsiga" rules={[requiredRule('Jinsiga')]}><Select options={[{value:'male',label:'Lab'},{value:'female',label:'Dhedig'}]} /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="Lambarka Telefoonka" rules={[requiredRule('Telefoonka'),...phoneRules]}><Input placeholder="tusaale +252615555555" /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="Cinwaanka Deganaanshaha" rules={[textLengthRule('Cinwaanka deganaanshaha', 3, 500)]}>
              <Input.TextArea rows={2} placeholder="Qor cinwaanka uu askarigu degan yahay" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="national_id" label="National ID (ikhtiyaari)">
                  <Input placeholder="National ID" />
                </Form.Item>
              </Col>
            </Row>
            {!editingRecord && (
              <Card size="small" title="Goobtii Laga Diiwaangeliyey" style={{ marginBottom: 16 }}>
                <Row gutter={12}>
                  <Col span={12}><Form.Item label="State" style={{ marginBottom: 0 }}><Input readOnly value={user?.location?.stateName || 'Si otomaatig ah'} /></Form.Item></Col>
                  <Col span={12}><Form.Item label="Gobolka" style={{ marginBottom: 0 }}><Input readOnly value={user?.location?.regionName || '—'} /></Form.Item></Col>
                </Row>
              </Card>
            )}
            <Form.Item label="Sawirka Askariga" required>
              <Upload {...uploadProps} listType="picture" accept=".jpg,.jpeg,.png,.webp,.gif">
                <Button icon={<UploadOutlined />}>Dooro Sawir</Button>
              </Upload>
              <Typography.Text type="secondary">Waxaa la oggol yahay JPG, JPEG, PNG, WEBP ama GIF oo keliya; ugu badnaan 5MB.</Typography.Text>
            </Form.Item>
            <Form.Item label="Force Number"><Input readOnly value={editingRecord?.force_number || 'Si otomaatig ah ayaa loo dhalinayaa'} /></Form.Item>
          </Form>
        </Modal>

        {/* Review Modal */}
        <Modal title={`Ansixinta Askariga · ${reviewRecord?.full_name||''}`} open={!!reviewRecord} onCancel={()=>setReviewRecord(null)} footer={null}>
          <Form form={reviewForm} layout="vertical"><Form.Item name="rank_id" label="Darajada" rules={[{required:true,message:'Darajo dooro.'}]}><Select options={ranks.filter(r=>user?.role!=='state_admin'||STATE_ADMIN_RANK_CODES.has(String(r.rank_code||'').trim().toUpperCase())).map(r=>({value:r.id,label:`${r.rank_name} (${r.rank_code})`}))}/></Form.Item><Form.Item name="notes" label="Faallo"><Input.TextArea rows={3}/></Form.Item><Space><Button danger onClick={()=>reviewOfficer('REJECTED')}>Diid</Button><Button onClick={()=>reviewOfficer('RETURNED')}>Dib ugu Celi Sixid</Button><Button type="primary" onClick={()=>reviewOfficer('APPROVED')}>Ansixi oo Hawlgeli</Button></Space></Form>
        </Modal>

        {/* Deployment / Transfer Modal */}
        <Modal
          title={`Deploy ${transferRecord?.full_name}`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          onOk={handleTransfer}
        >
           <Form form={transferForm} layout="vertical">
              <Form.Item name="to_assignment_type" label="Target Level" rules={[requiredRule('Target level')]}>
                 <Select
                   placeholder="Dooro heerka"
                   onChange={() => transferForm.setFieldsValue({ state_id: undefined, sub_admin_id: undefined, region_id: undefined, district_id: undefined })}
                   options={deploymentTargetOptions}
                 />
              </Form.Item>
              
              {assignmentType === 'Sub-Admin' && (
                <Form.Item name="sub_admin_id" label="User-ka Degmada" rules={[requiredRule('User-ka Degmada')]}>
                  <Select
                    placeholder="Dooro User-ka Degmada"
                    showSearch
                    optionFilterProp="label"
                    options={eligibleSubAdmins.map(sa => ({
                      value: sa.id,
                      label: `${sa.full_name || sa.username}${sa.rank ? ` (${sa.rank})` : ''} · ${sa.username} [${sa.role ? String(sa.role).toUpperCase() : 'USER'}]`
                    }))}
                  />
                </Form.Item>
              )}

              {assignmentType && assignmentType !== 'Sub-Admin' && (
                <Form.Item name="state_id" label="State Administration" rules={[requiredRule('State administration')]}>
                  <Select
                    placeholder="Select State Administration"
                    showSearch
                    optionFilterProp="label"
                    options={(states || []).map(s => ({ value: s.id, label: s.state_name }))}
                  />
                </Form.Item>
              )}

              {assignmentType && ['Region', 'District', 'District Station'].includes(assignmentType) && (
                <Form.Item name="region_id" label="Region" rules={[requiredRule('Region')]}>
                  <Select
                    placeholder="Select Region"
                    showSearch
                    optionFilterProp="label"
                    disabled={!selectedState}
                    options={(regions || []).map(r => ({ value: r.id, label: r.region_name }))}
                  />
                </Form.Item>
              )}

              {assignmentType && ['District', 'District Station'].includes(assignmentType) && (
                <Form.Item name="district_id" label="District Station" rules={[requiredRule('District Station')]}>
                  <Select
                    placeholder="Select District Station"
                    showSearch
                    optionFilterProp="label"
                    disabled={!selectedRegion}
                    options={(districts || []).map(d => ({ value: d.id, label: d.district_name }))}
                  />
                </Form.Item>
              )}

           </Form>
        </Modal>

        {/* Change Rank Modal */}
        <Modal
          title={`Darajo: ${rankRecord?.full_name}`}
          open={isRankModalOpen}
          onCancel={() => setIsRankModalOpen(false)}
          onOk={handleSaveRank}
          okText="Kaydi Darajada"
          cancelText="Jooji"
        >
          <Form form={rankForm} layout="vertical">
            <Form.Item name="rank_id" label="Darajada" rules={[requiredRule('Darajada')]}>
              <Select options={ranks.filter(r => {
                const code = String(r.rank_code || '').trim().toUpperCase();
                const name = String(r.rank_name || '').toLowerCase();
                const isCommissioned = COMMISSIONED_CODES.has(code) || name.includes('sareeye') || name.includes('gaashaanle') || name.includes('dhamme') || name.includes('xiddigle');
                if (user?.role === 'admin') {
                  return isCommissioned;
                }
                return STATE_ADMIN_RANK_CODES.has(code) || !isCommissioned;
              }).map(r => ({ value: r.id, label: `${r.rank_name} (${r.rank_code || ''})` }))} />
            </Form.Item>
          </Form>
        </Modal>

      </Space>
    </ProtectedRoute>
  );
}
