'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { Card, Descriptions, Table, Typography, Tag, Space, Button, Modal, Form, Select, Input, App, Avatar, Row, Col, Divider, Image, Alert } from 'antd';
import { SwapOutlined, ArrowLeftOutlined, AuditOutlined, EnvironmentOutlined, StarOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { requiredRule, textLengthRule } from '@/utils/validation';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const COMMISSIONED_CODES = new Set(['SG', 'SGS', 'SGT', 'GSH-S', 'GSH-DH', 'GSH', 'DHM', 'LXDG', 'XDG']);
const STATE_ADMIN_RANK_CODES = new Set(['AL', 'SA', 'XDH', 'LXDH', 'LA', 'SXD']);
const DISTRICT_USER_ROLES = new Set(['sub_admin', 'personnel_registry', 'ob_staff', 'investigator', 'station_jail']);
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const ROLE_DISPLAY_NAMES = {
  ob_staff: 'OB Staff',
  investigator: 'Baare',
  personnel_registry: 'Diiwaanka Ciidanka',
  sub_admin: 'Sub-Admin',
  station_jail: 'Xabsiga Saldhigga'
};

const assignmentTypeLabel = (type) => (
  type === 'District User Link' ? 'Operational Account' : type
);

const formatSubAdminList = (subAdminList) => {
  const roleCounts = {};
  subAdminList.forEach(sa => {
    const roleKey = String(sa.role || '').toLowerCase().replace('-', '_');
    roleCounts[roleKey] = (roleCounts[roleKey] || 0) + 1;
  });

  const roleIndexes = {};
  return subAdminList.map(sa => {
    const roleKey = String(sa.role || '').toLowerCase().replace('-', '_');
    roleIndexes[roleKey] = (roleIndexes[roleKey] || 0) + 1;

    const roleBaseName = ROLE_DISPLAY_NAMES[roleKey] || (sa.role ? String(sa.role).toUpperCase() : 'USER');
    const totalForRole = roleCounts[roleKey] || 0;

    let roleTitle = roleBaseName;
    if (totalForRole > 1) {
      roleTitle = `${roleBaseName} ${roleIndexes[roleKey]}`;
    }

    const statusSuffix = sa.status && sa.status !== 'ACTIVE' ? ` (${sa.status})` : '';
    const assignmentSuffix = sa.police_officer_id ? ' (Sarkaal ku xiran)' : ' (Bannaan)';
    const optionLabel = `${roleTitle}${statusSuffix}${assignmentSuffix}`;

    return {
      ...sa,
      roleTitle,
      optionLabel
    };
  });
};


const getImageUrl = (pathStr) => {
  if (!pathStr) return null;
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://') || pathStr.startsWith('data:')) {
    return pathStr;
  }
  const cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  return `${API_ORIGIN}${cleanPath}`;
};

export default function OfficerDetailsPage({ params }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canUpdateEmploymentStatus = ['admin', 'state_admin', 'sub_admin'].includes(String(user?.role || '').toLowerCase());
  const canViewLocations = user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('locations.view');
  const canTransfer = (user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('officers.transfer')) && canViewLocations;
  const router = useRouter();
  const { id } = use(params);
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [employmentStatusDraft, setEmploymentStatusDraft] = useState('active');
  const [ranks, setRanks] = useState([]);
  const [transferForm] = Form.useForm();
  const [rankForm] = Form.useForm();
  
  const [states, setStates] = useState([]);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [allDistricts, setAllDistricts] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);

  const assignmentType = Form.useWatch('to_assignment_type', transferForm);
  const selectedState = Form.useWatch('state_id', transferForm);
  const selectedRegion = Form.useWatch('region_id', transferForm);
  const selectedDistrict = Form.useWatch('district_id', transferForm);
  const selectedSubAdminId = Form.useWatch('sub_admin_id', transferForm);

  const isDistrictAdmin = user?.role === 'district_admin';

  let deploymentTargetOptions = [];
  if (isDistrictAdmin) {
    deploymentTargetOptions = [
      {
        label: 'Maamulka (ADMIN)',
        options: [
          { value: 'Sub-Admin', label: 'Sub-Admin (Maamul Hoose)' },
        ],
      },
      {
        label: 'Hawlgalka (OPERATIONAL)',
        options: [
          { value: 'District Station', label: 'District Station (Saldhigga Degmada)' },
          { value: 'District User Link', label: 'Operational Account (OB / Baare / Station Jail)' },
        ],
      },
    ];
  } else {
    deploymentTargetOptions = [
      {
        label: 'Maamulka (ADMIN)',
        options: [
          { value: 'State Administration', label: 'State Administration (Maamulka Dawlad-Goboleedka)' },
          { value: 'Region', label: 'Region (Maamulka Gobolka)' },
          { value: 'District', label: 'District (Maamulka Degmada / Taliye)' },
          { value: 'Sub-Admin', label: 'Sub-Admin (Maamul Hoose)' },
        ],
      },
      {
        label: 'Hawlgalka (OPERATIONAL)',
        options: [
          { value: 'District Station', label: 'District Station (Saldhigga Degmada)' },
          { value: 'District User Link', label: 'Operational Account (OB / Baare / Station Jail)' },
          { value: 'Region Unit', label: 'Region Unit (Cutubka Gobolka)' },
          { value: 'State Unit', label: 'State Unit (Cutubka Dawlad-Goboleedka)' },
        ],
      },
    ];
  }

  const isOperationalStaffTarget = assignmentType === 'District User Link';
  const isSubAdminTarget = assignmentType === 'Sub-Admin';

  const filteredSubAdmins = (subAdmins || []).filter(item => {
    const role = String(item.role || '').toLowerCase().replace('-', '_');
    if (isSubAdminTarget) {
      return role === 'sub_admin';
    }
    if (isOperationalStaffTarget) {
      const isStaffRole = ['personnel_registry', 'ob_staff', 'investigator', 'station_jail'].includes(role);
      const activeDistrictId = selectedDistrict || (isDistrictAdmin ? (user?.location?.districtId || user?.scopeId) : null);
      const matchesDistrict = !activeDistrictId || Number(item.district_id) === Number(activeDistrictId);
      return isStaffRole && matchesDistrict;
    }
    const sameDistrict = !isDistrictAdmin || Number(item.district_id) === Number(user?.location?.districtId || user?.scopeId);
    return DISTRICT_USER_ROLES.has(role) && sameDistrict;
  });

  const eligibleSubAdmins = formatSubAdminList(filteredSubAdmins);

  const selectedSubAdminUser = eligibleSubAdmins.find(sa => Number(sa.id) === Number(selectedSubAdminId));

  useEffect(() => {
    if (isTransferModalOpen) {
      if (canViewLocations && user?.role !== 'district_admin') {
        api.get('/state-administrations').then(res => setStates(res.data.data)).catch(console.error);
        api.get('/districts').then(res => setAllDistricts(res.data.data || [])).catch(console.error);
      }
      api.get('/users/sub-admins')
        .then(res => setSubAdmins(res.data.data || []))
        .catch(() => api.get('/users').then(res => setSubAdmins((res.data.data || []).filter(u => u.is_active))).catch(() => setSubAdmins([])));
    }
  }, [isTransferModalOpen, canViewLocations, user?.role]);

  useEffect(() => {
    if (canViewLocations && selectedState) {
       api.get(`/regions?state_administration_id=${selectedState}`).then(res => setRegions(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ region_id: undefined, district_id: undefined });
    }
  }, [selectedState, transferForm, canViewLocations]);

  useEffect(() => {
    if (canViewLocations && selectedRegion) {
       api.get(`/districts?region_id=${selectedRegion}`).then(res => setDistricts(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ district_id: undefined });
    }
  }, [selectedRegion, transferForm, canViewLocations]);


  const [groupedAssignments, setGroupedAssignments] = useState({ adminRoles: [], operationalLocations: [] });

  const fetchOfficerDetails = useCallback(async () => {
    setLoading(true);
    try {
      const [res, assignRes] = await Promise.all([
        api.get(`/police-officers/${id}`),
        api.get(`/officer-transfers/${id}/assignments`).catch(() => ({ data: { data: { adminRoles: [], operationalLocations: [] } } })),
      ]);
      setOfficer(res.data.data);
      setEmploymentStatusDraft(String(res.data.data?.employment_status || 'active').toLowerCase());
      setGroupedAssignments(assignRes.data.data || { adminRoles: [], operationalLocations: [] });
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load officer details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    if (id) fetchOfficerDetails();
  }, [fetchOfficerDetails, id]);

  const handleTransfer = async () => {
    try {
      const values = await transferForm.validateFields();
      
      let targetId = null;
      if (values.to_assignment_type === 'State Administration' || values.to_assignment_type === 'State Unit') targetId = values.state_id;
      if (values.to_assignment_type === 'District User Link') targetId = values.sub_admin_id;
      if (values.to_assignment_type === 'District Station') targetId = isDistrictAdmin ? (user?.location?.districtId || user?.scopeId) : values.district_id;
      if (values.to_assignment_type === 'Region' || values.to_assignment_type === 'Region Unit') targetId = values.region_id;
      if (values.to_assignment_type === 'District') targetId = values.district_id;

      if (values.to_assignment_type !== 'Sub-Admin' && !targetId) {
        return message.error("Please complete the unit selection dropdowns.");
      }

      await api.post('/officer-transfers', {
        officer_id: officer.id,
        to_assignment_type: values.to_assignment_type,
        to_assignment_id: targetId,
        remarks: values.remarks
      });
      message.success("Sarkaalka si guul leh ayaa loo qoondeeyay / loo wareejiyay.");
      setIsTransferModalOpen(false);
      transferForm.resetFields();
      fetchOfficerDetails();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Transfer failed.");
    }
  };

  const handleOpenRankModal = () => {
    rankForm.setFieldsValue({ rank_id: officer?.rank_id });
    if (!ranks.length) {
      api.get('/ranks').then((res) => setRanks(res.data.data || [])).catch(() => {});
    }
    setIsRankModalOpen(true);
  };

  const handleSaveRank = async () => {
    try {
      const values = await rankForm.validateFields();
      await api.post(`/police-officers/${officer.id}/rank`, values);
      message.success("Darajada sarkaalka waa la badalay.");
      setIsRankModalOpen(false);
      fetchOfficerDetails();
    } catch (err) {
      if (!err.errorFields) {
        message.error(err.response?.data?.message || "Badalaadda darajada waa ay guuldarraysatay.");
      }
    }
  };

  const handleSaveStatus = async () => {
    try {
      const response = await api.patch(`/police-officers/${officer.id}/employment-status`, {
        employment_status: employmentStatusDraft,
      });
      message.success(response.data?.message || 'Xaaladda shaqada waa la beddelay.');
      fetchOfficerDetails();
    } catch (err) {
      message.error(err.response?.data?.message || 'Xaaladda shaqada lama beddeli karin.');
    }
  };

  if (!officer && !loading) {
    return <Card><h2>Officer not found or you do not have access.</h2><Button onClick={() => router.back()}>Go Back</Button></Card>;
  }

  const assignmentCols = [
    { title: 'Heerka', dataIndex: 'assignment_type', key: 'type', render: t => <Tag color="geekblue">{assignmentTypeLabel(t)}</Tag> },
    { title: 'Goobta Shaqada', dataIndex: 'assignment_name', key: 'name' },
    { title: 'Faallooyinka', dataIndex: 'remarks', key: 'remarks' },
    { title: 'Xaaladda', dataIndex: 'is_current', key: 'is_current', render: c => c === 1 ? <Tag color="green">Hadda</Tag> : <Tag>Hore</Tag> },
    { title: 'Taariikhda Qoondeynta', dataIndex: 'assigned_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  const transferCols = [
    { title: 'Laga soo Wareejiyey', key: 'from', render: (_, record) => record.from_assignment_type ? `${record.from_assignment_name || assignmentTypeLabel(record.from_assignment_type)} · ${assignmentTypeLabel(record.from_assignment_type)}` : 'Diiwaangelin Cusub' },
    { title: 'Loo Wareejiyey', key: 'to', render: (_, record) => `${record.to_assignment_name || assignmentTypeLabel(record.to_assignment_type)} · ${assignmentTypeLabel(record.to_assignment_type)}` },
    { title: 'Taariikhda', dataIndex: 'transferred_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  return (
    <ProtectedRoute requiredPermissions={['officers.view']}>
      <Card loading={loading} variant="none">
        
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Space align="center" size="large">
              <Button icon={<ArrowLeftOutlined />} shape="circle" onClick={() => router.back()} />
              <Image
                src={getImageUrl(officer?.profile_image)}
                alt={officer?.full_name}
                width={84}
                height={84}
                style={{ objectFit: 'cover', borderRadius: '50%', border: '2px solid #1677ff' }}
                fallback={`https://ui-avatars.com/api/?name=${encodeURIComponent(officer?.full_name || 'Officer')}&background=0D8ABC&color=fff&size=128`}
              />
              <div>
                <Title level={2} style={{ margin: 0 }}>{officer?.full_name}</Title>
                <Space wrap style={{ marginTop: 6 }}>
                  <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 600 }}>{officer?.force_number}</Tag>
                  <Tag color="gold" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 600 }}>
                    {officer?.rank_name ? `${officer.rank_name}${officer.rank_code ? ` (${officer.rank_code})` : ''}` : 'Darajo lama siin'}
                  </Tag>
                </Space>
              </div>
            </Space>
            
            <Space>
              {(user?.role === 'admin' || user?.role === 'state_admin') && (
                <Button icon={<StarOutlined />} size="large" onClick={handleOpenRankModal}>
                  Darajo
                </Button>
              )}
              {canTransfer && <Button type="primary" icon={<SwapOutlined />} size="large" onClick={() => setIsTransferModalOpen(true)}>
                Wareeji Askariga
              </Button>}
            </Space>
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Xogta Askariga" variant="borderless" className="shadow-sm">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Magaca oo Buuxa"><Typography.Text strong>{officer?.full_name}</Typography.Text></Descriptions.Item>
                  <Descriptions.Item label="Magaca Hooyada">{officer?.mother_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Darajada"><Tag color="gold" style={{ fontWeight: 600 }}>{officer?.rank_name ? `${officer.rank_name}${officer.rank_code ? ` (${officer.rank_code})` : ''}` : 'Darajo lama siin'}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Lambarka Ciidanka"><Tag color="cyan">{officer?.force_number}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Jinsiga">{String(officer?.gender).toLowerCase() === 'male' || officer?.gender === 'Lab' ? 'Lab' : String(officer?.gender).toLowerCase() === 'female' || officer?.gender === 'Dhedig' ? 'Dhedig' : (officer?.gender || '—')}</Descriptions.Item>
                  <Descriptions.Item label="Taariikhda Dhalashada / Da’da">
                    {officer?.date_of_birth ? `${dayjs(officer.date_of_birth).format('DD MMM YYYY')} (${officer?.age || dayjs().diff(officer.date_of_birth, 'year')} sano)` : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lambarka Telefoonka">{officer?.phone || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="National ID">{officer?.national_id || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Cinwaanka Hoyga" span={2}>{officer?.address || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Xaaladda Shaqada" span={2}>
                    <Space wrap align="center">
                      <Tag color={String(officer?.employment_status).toLowerCase() === 'active' ? 'green' : 'red'}>
                        {officer?.employment_status || 'Active'}
                      </Tag>
                      {canUpdateEmploymentStatus && (
                        <>
                          <Select
                            size="small"
                            value={employmentStatusDraft}
                            onChange={setEmploymentStatusDraft}
                            style={{ width: 150 }}
                            options={[
                              { value: 'active', label: 'Active' },
                              { value: 'suspended', label: 'Suspended' },
                              { value: 'retired', label: 'Retired' },
                              { value: 'inactive', label: 'Inactive' },
                            ]}
                          />
                          <Button
                            size="small"
                            type="primary"
                            onClick={handleSaveStatus}
                            disabled={employmentStatusDraft === String(officer?.employment_status || 'active').toLowerCase()}
                          >
                            Kaydi
                          </Button>
                        </>
                      )}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Goobtii Laga Diiwaangeliyey</Title>
                {String(officer?.created_by).toLowerCase() === 'admin' || !officer?.registration_state_administration_id ? (
                  <Tag color="gold" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600, borderRadius: 6 }}>
                    Dawladda Dhexe (Taliska Guud)
                  </Tag>
                ) : (
                  <Descriptions column={3} size="small" bordered>
                    <Descriptions.Item label="Dawlad-goboleedka">{officer?.registration_state_name || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Gobolka">{officer?.registration_region_name || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Degmada">{officer?.registration_district_name || '—'}</Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                title={<><EnvironmentOutlined /> Qoondeynta Sarkaalka (Officer Assignments)</>} 
                variant="borderless"
                style={{ height: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
                    <AuditOutlined style={{ marginRight: 6, color: '#722ed1' }} /> Doorka Maamulka (Admin Roles)
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    {(!groupedAssignments.adminRoles || groupedAssignments.adminRoles.length === 0) ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>Ma jiro door maamul oo loo qoondeeyay</Text>
                    ) : (
                      groupedAssignments.adminRoles.map(a => (
                        <Tag key={a.id} color="purple" style={{ marginBottom: 6, fontSize: 13, padding: '4px 10px', borderRadius: 4, display: 'inline-block' }}>
                          ☑ {a.display_name || a.assignment_type}
                        </Tag>
                      ))
                    )}
                  </div>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div>
                  <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
                    <EnvironmentOutlined style={{ marginRight: 6, color: '#1677ff' }} /> Goobta Hawlgalka (Operational Locations)
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    {(!groupedAssignments.operationalLocations || groupedAssignments.operationalLocations.length === 0) ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {(groupedAssignments.adminRoles && groupedAssignments.adminRoles.length > 0)
                          ? 'Goobta shaqadu waa Taliska Guud (Doorka Maamulka)'
                          : 'Weli goob shaqo looma qoondeyn (Unassigned)'}
                      </Text>
                    ) : (
                      groupedAssignments.operationalLocations.map(o => (
                        <Tag key={o.id} color="blue" style={{ marginBottom: 6, fontSize: 13, padding: '4px 10px', borderRadius: 4, display: 'inline-block' }}>
                          ☑ {o.display_name || o.assignment_type}
                        </Tag>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title={<><AuditOutlined /> Taariikhda Shaqada</>} variant="borderless">
            <Title level={5}>Taariikhda Wareejinta</Title>
            <Table 
               columns={transferCols} 
               dataSource={officer?.transfers || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
               scroll={{ x: 'max-content' }}
            />
            
            <Divider />

            <Title level={5}>Taariikhda Goobaha Shaqada</Title>
            <Table 
               columns={assignmentCols} 
               dataSource={officer?.assignments || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
               scroll={{ x: 'max-content' }}
            />
          </Card>

        </Space>
      </Card>

      <Modal
          title={`Deploy / Qoondee Sarkaalka: ${officer?.full_name || ''}`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          onOk={handleTransfer}
          width={650}
        >
           <Form form={transferForm} layout="vertical">
              <Alert
                type={
                  officer?.current_assignment_name &&
                  officer.current_assignment_name !== 'Unassigned' &&
                  officer.current_assignment_name !== 'Unknown' &&
                  officer?.current_assignment_type !== 'Unassigned' &&
                  officer?.current_assignment_type
                    ? "info"
                    : "warning"
                }
                showIcon
                style={{ marginBottom: 16 }}
                title={
                  officer?.current_assignment_name &&
                  officer.current_assignment_name !== 'Unassigned' &&
                  officer.current_assignment_name !== 'Unknown' &&
                  officer?.current_assignment_type !== 'Unassigned' &&
                  officer?.current_assignment_type ? (
                    <span>Hadda wuxuu ku qoondeysan yahay: <strong>{officer.current_assignment_name}</strong> ({assignmentTypeLabel(officer.current_assignment_type)})</span>
                  ) : (
                    <span>Sarkaalkan weli goob shaqo looma qoondeyn (Unassigned).</span>
                  )
                }
              />

              <Form.Item name="to_assignment_type" label="Target Level (Heerka Loo Qoondeynayo)" rules={[requiredRule('Target level')]}>
                 <Select
                   placeholder="Dooro heerka qoondeynta"
                   onChange={() => transferForm.setFieldsValue({ state_id: undefined, region_id: undefined, district_id: undefined, sub_admin_id: undefined })}
                   options={deploymentTargetOptions}
                 />
              </Form.Item>

              {assignmentType && assignmentType !== 'Sub-Admin' && user?.role !== 'state_admin' && user?.role !== 'district_admin' && (
                <Form.Item name="state_id" label="State Administration (Maamulka Dawlad-Goboleedka)" rules={[requiredRule('State administration')]}>
                  <Select
                    placeholder="Dooro State Administration"
                    showSearch
                    optionFilterProp="label"
                    options={(states || []).map(s => ({ value: s.id, label: s.state_name }))}
                    onChange={() => transferForm.setFieldsValue({ region_id: undefined, district_id: undefined, sub_admin_id: undefined })}
                  />
                </Form.Item>
              )}

              {assignmentType && ['Region', 'Region Unit', 'District', 'District Station', 'District User Link'].includes(assignmentType) && user?.role !== 'district_admin' && (
                <Form.Item name="region_id" label="Region (Gobolka)" rules={['Region', 'Region Unit', 'District'].includes(assignmentType) ? [requiredRule('Region')] : []}>
                  <Select
                    placeholder="Dooro Gobolka"
                    showSearch
                    optionFilterProp="label"
                    disabled={user?.role !== 'state_admin' && !selectedState}
                    options={(regions || []).map(r => ({ value: r.id, label: r.region_name }))}
                    onChange={() => transferForm.setFieldsValue({ district_id: undefined, sub_admin_id: undefined })}
                  />
                </Form.Item>
              )}

              {assignmentType && ['District', 'District Station', 'District User Link'].includes(assignmentType) && !isDistrictAdmin && (
                <Form.Item name="district_id" label="District (Degmada)" rules={[requiredRule('District')]}>
                  <Select
                    placeholder="Dooro Degmada"
                    showSearch
                    optionFilterProp="label"
                    disabled={selectedState && !selectedRegion && user?.role !== 'state_admin'}
                    options={((selectedRegion ? districts : (allDistricts.length ? allDistricts : districts)) || []).map(d => ({
                      value: d.id,
                      label: d.district_name || d.name
                    }))}
                    onChange={() => transferForm.setFieldsValue({ sub_admin_id: undefined })}
                  />
                </Form.Item>
              )}

              {assignmentType === 'District User Link' && (
                <Form.Item
                  name="sub_admin_id"
                  label="Operational Account (OB / Baare / Station Jail)"
                  rules={[requiredRule('Operational Account')]}
                >
                  <Select
                    placeholder="Dooro account-ka bannaan"
                    showSearch
                    optionFilterProp="label"
                    options={eligibleSubAdmins.map(sa => ({
                      value: sa.id,
                      label: sa.optionLabel
                    }))}
                  />
                </Form.Item>
              )}

              {assignmentType === 'District User Link' && selectedSubAdminUser && (() => {
                const selectedDistrictObj = (allDistricts.length ? allDistricts : districts || []).find(d => Number(d.id) === Number(selectedSubAdminUser?.district_id || selectedDistrict));
                const districtNameDisplay = (selectedSubAdminUser?.district_name && selectedSubAdminUser.district_name !== 'Degmada')
                  ? selectedSubAdminUser.district_name
                  : (selectedDistrictObj?.district_name || selectedDistrictObj?.name || 'Degmada la doortay');

                return (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title="Xaqiijinta Xogta la Doortay (Selection Preview)"
                    description={
                      <span>
                        Waxaad dooratay: <strong>{selectedSubAdminUser.full_name || selectedSubAdminUser.username}</strong>{' '}
                        (<Tag color="blue">{selectedSubAdminUser.roleTitle || (selectedSubAdminUser.role ? String(selectedSubAdminUser.role).toUpperCase() : 'USER')}</Tag>, Degmada:{' '}
                        <strong>{districtNameDisplay}</strong>)
                      </span>
                    }
                  />
                );
              })()}

              <Form.Item name="remarks" label="Faallo / Sababta Qoondeynta (Remarks)" rules={[textLengthRule('Faallooyinka', 3, 1000)]}>
                <Input.TextArea rows={2} placeholder="Qor sababta loo qoondeeyay ama faallo dheeraad ah" />
              </Form.Item>

           </Form>
      </Modal>

      {/* Change Rank Modal */}
      <Modal
        title={`Darajo: ${officer?.full_name}`}
        open={isRankModalOpen}
        onCancel={() => setIsRankModalOpen(false)}
        onOk={handleSaveRank}
        okText="Kaydi Darajada"
        cancelText="Jooji"
      >
        <Form form={rankForm} layout="vertical">
          <Form.Item name="rank_id" label="Dooro Darajada" rules={[{ required: true, message: 'Dooro darajada.' }]}>
            <Select
              placeholder="Dooro darajada"
              options={(ranks || [])
                .filter(r => {
                  const code = String(r.rank_code || '').trim().toUpperCase();
                  const name = String(r.rank_name || '').toLowerCase();
                  const isCommissioned = COMMISSIONED_CODES.has(code) || name.includes('sareeye') || name.includes('gaashaanle') || name.includes('dhamme') || name.includes('xiddigle');
                  if (user?.role === 'admin') {
                    return isCommissioned;
                  }
                  return STATE_ADMIN_RANK_CODES.has(code) || !isCommissioned;
                })
                .map(r => ({ value: r.id, label: `${r.rank_name} (${r.rank_code || ''})` }))
              }
            />
          </Form.Item>
        </Form>
      </Modal>

    </ProtectedRoute>
  );
}
