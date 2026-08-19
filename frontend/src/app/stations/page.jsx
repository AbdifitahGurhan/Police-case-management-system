// src/app/stations/page.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { ApartmentOutlined, BankOutlined, CloseOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, RightOutlined, SafetyCertificateOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { codeRules, passwordRules, requiredRule, textLengthRule, usernameRules } from '@/utils/validation';
import CaseDetailsPage from '@/app/cases/[id]/page';

const { Title, Text } = Typography;

const FILTERS = [
  { key: 'all', label: 'Dhammaan' },
  { key: 'operational', label: 'Shaqaynaya' },
  { key: 'inactive', label: 'Aan shaqayn' },
];

export default function StationManagementPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const hasPermission = (key) => user?.role === 'admin' || permissions.includes('*') || permissions.includes(key);
  const canEditStations = hasPermission('stations.manage');
  const [stations, setStations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [overlayView, setOverlayView] = useState('menu');
  const [overlayData, setOverlayData] = useState(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [selectedOverlayItem, setSelectedOverlayItem] = useState(null);
  const [selectedOverlayParent, setSelectedOverlayParent] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [editingStation, setEditingStation] = useState(null);
  const [form] = Form.useForm();

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stations');
      setStations(res.data.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || 'Xarumaha Boliiska lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchGeography = useCallback(async () => {
    try {
      const res = await api.get('/stations/geography');
      setRegions(res.data.data.regions || []);
    } catch (err) {
      if (canEditStations) {
        message.error(err.response?.data?.message || 'Gobollada lama soo qaadi karin.');
      }
    }
  }, [canEditStations, message]);

  useEffect(() => {
    fetchStations();
    if (canEditStations) {
      fetchGeography();
    }
  }, [canEditStations, fetchGeography, fetchStations]);

  const stats = useMemo(() => {
    const active = stations.filter((station) => Boolean(station.is_active)).length;
    const inactive = stations.length - active;
    const assignedCommanders = stations.filter((station) => Boolean(station.commander_name)).length;
    return [
      { label: 'Xarumaha', value: stations.length, icon: <ApartmentOutlined /> },
      { label: 'Shaqaynaya', value: active, icon: <SafetyCertificateOutlined />, tone: 'success' },
      { label: 'Aan shaqayn', value: inactive, icon: <EnvironmentOutlined />, tone: 'warning' },
      { label: 'Taliyeyaal', value: assignedCommanders, icon: <TeamOutlined />, tone: 'info' },
    ];
  }, [stations]);

  const filteredStations = useMemo(() => {
    if (filter === 'operational') return stations.filter((station) => Boolean(station.is_active));
    if (filter === 'inactive') return stations.filter((station) => !station.is_active);
    return stations;
  }, [filter, stations]);

  const handleOpenModal = (station = null) => {
    setEditingStation(station);
    if (station) {
      form.setFieldsValue(station);
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const metric = (value) => Number(value) || 0;

  const openStationOverlay = async (station) => {
    setSelectedStation(station);
    setOverlayView('menu');
    setSelectedOverlayItem(null);
    setSelectedOverlayParent(null);
    setSelectedCaseId(null);
    setOverlayData(null);
    setOverlayLoading(true);
    try {
      const res = await api.get(`/stations/${station.id}/overview`);
      setOverlayData(res.data.data || null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Faahfaahinta xarunta lama soo qaadi karin.');
    } finally {
      setOverlayLoading(false);
    }
  };

  const closeStationOverlay = () => {
    setSelectedStation(null);
    setOverlayView('menu');
    setOverlayData(null);
    setSelectedOverlayItem(null);
    setSelectedOverlayParent(null);
    setSelectedCaseId(null);
    setOverlayLoading(false);
  };

  const openOverlayList = (view) => {
    setSelectedOverlayItem(null);
    setSelectedOverlayParent(null);
    setOverlayView(view);
  };

  const openOverlayDetail = (view, item) => {
    if ((view === 'ob_detail' || view === 'case_detail') && selectedOverlayItem) {
      setSelectedOverlayParent(selectedOverlayItem);
    } else {
      setSelectedOverlayParent(null);
    }
    setSelectedOverlayItem(item);
    setOverlayView(view);
    if (view === 'case_detail' && item?.id) {
      setSelectedCaseId(item.id);
    }
  };

  const goOverlayBack = () => {
    if (overlayView === 'ob_entries') return setOverlayView('ob_staff');
    if (overlayView === 'ob_detail') {
      setSelectedOverlayItem(selectedOverlayParent);
      setSelectedOverlayParent(null);
      return setOverlayView('ob_entries');
    }
    if (overlayView === 'investigator_cases') return setOverlayView('investigators');
    if (overlayView === 'case_detail') {
      setSelectedOverlayItem(selectedOverlayParent);
      setSelectedOverlayParent(null);
      setSelectedCaseId(null);
      return setOverlayView('investigator_cases');
    }
    if (overlayView === 'prisoner_detail') return setOverlayView('jail');
    setSelectedOverlayItem(null);
    setOverlayView('menu');
  };

  const handleSave = async (values) => {
    try {
      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, values);
        message.success('Xarunta waa la cusboonaysiiyey.');
      } else {
        await api.post('/stations', values);
        message.success('Xarun cusub waa la diiwaangeliyey.');
      }
      setIsModalOpen(false);
      fetchStations();
    } catch (err) {
      message.error(err.response?.data?.message || 'Kaydinta xarunta way fashilantay.');
    }
  };

  const handleDelete = async (station) => {
    try {
      await api.delete(`/stations/${station.id}`);
      message.success('Xarunta waa la tirtiray.');
      fetchStations();
    } catch (err) {
      message.error(err.response?.data?.message || 'Tirtiriddu way fashilantay.');
    }
  };

  const renderStationCard = (station) => {
    const active = Boolean(station.is_active);
    const openCases = metric(station.furan_cases);
    const pendingCases = metric(station.sugaya_cases);
    const closingCases = metric(station.xidhitaan_cases);
    const closedCases = metric(station.xiray_cases);
    const officerCount = metric(station.officers_count);
    return (
      <Col xs={24} md={12} xl={6} key={station.id}>
        <Card
          className="station-admin-card"
          variant="borderless"
          onClick={() => openStationOverlay(station)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') openStationOverlay(station);
          }}
        >
          <div className="station-admin-card-top">
            <div>
              <Title level={4}>{station.name || station.district_name || 'Xarun Boliis'}</Title>
              <span className="station-admin-code">{station.code || 'Code laaan'}</span>
            </div>
            <Tag className={active ? 'station-admin-status station-admin-status-success' : 'station-admin-status station-admin-status-error'}>
              {active ? 'Shaqeynaya' : 'Aan Shaqeyn'}
            </Tag>
          </div>

          <div className="station-admin-case-stats">
            <div><strong className="v-blue">{openCases}</strong><span>FURAN</span></div>
            <div><strong className="v-yellow">{pendingCases}</strong><span>SUGAYA</span></div>
            <div><strong className="v-red">{closingCases}</strong><span>XIDHITAAN</span></div>
            <div><strong className="v-green">{closedCases}</strong><span>XIRAY</span></div>
          </div>

          <div className="station-admin-card-bottom">
            <span><TeamOutlined /> {officerCount} sarkaal</span>
            {canEditStations && (
              <Space onClick={(event) => event.stopPropagation()}>
                <Button icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); handleOpenModal(station); }} />
                <Popconfirm
                  title="Ma hubtaa inaad tirtirto saldhiggan?"
                  description="Keliya saldhigyada aan lahayn kiisas furan ama saraakiil ayaa la tirtiri karaa."
                  okText="Tirtir"
                  cancelText="Maya"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(station)}
                >
                  <Button danger icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()} />
                </Popconfirm>
              </Space>
            )}
            {!canEditStations && <Button className="station-admin-round-action" icon={<RightOutlined />} />}
          </div>
        </Card>
      </Col>
    );
  };

  const overlayStation = overlayData?.station || selectedStation;
  const obStaff = overlayData?.ob_staff || [];
  const investigators = overlayData?.investigators || [];
  const investigationCases = overlayData?.investigation_cases || [];
  const stationPrisoners = overlayData?.station_prisoners || [];

  const renderOverlayEmpty = (description) => (
    <div className="station-overlay-empty">{description}</div>
  );

  const renderOverlayList = (items, emptyText, detailView, renderItem) => {
    if (overlayLoading) return <div className="station-overlay-loading"><Spin /></div>;
    if (!items.length) return renderOverlayEmpty(emptyText);
    return (
      <div className="station-overlay-list">
        {items.map((item) => (
          <button key={`${detailView}-${item.id}`} type="button" onClick={() => openOverlayDetail(detailView, item)}>
            {renderItem(item)}
            <RightOutlined />
          </button>
        ))}
      </div>
    );
  };

  const renderDetailRow = (label, value) => (
    <div className="station-overlay-detail-row">
      <span>{label}</span>
      <strong>{value || 'N/A'}</strong>
    </div>
  );

  const renderOverlayBody = () => {
    if (!selectedStation) return null;
    if (overlayView === 'menu') {
      return (
        <div className="station-overlay-actions">
          <button type="button" onClick={() => openOverlayList('ob_staff')}>
            <span className="station-overlay-icon station-overlay-icon-ob"><SafetyCertificateOutlined /></span>
            <span><strong>Ob-le</strong><small>{overlayLoading ? 'Loading...' : `${obStaff.length} user oo diiwaan gashan`}</small></span>
            <RightOutlined />
          </button>
          <button type="button" onClick={() => openOverlayList('investigators')}>
            <span className="station-overlay-icon station-overlay-icon-investigation"><SearchOutlined /></span>
            <span><strong>Baare</strong><small>{overlayLoading ? 'Loading...' : `${investigators.length} baare - ${investigationCases.length} kiis`}</small></span>
            <RightOutlined />
          </button>
          <button type="button" onClick={() => openOverlayList('jail')}>
            <span className="station-overlay-icon station-overlay-icon-jail"><BankOutlined /></span>
            <span><strong>Xabsiga</strong><small>{overlayLoading ? 'Loading...' : `${stationPrisoners.length} maxbuus`}</small></span>
            <RightOutlined />
          </button>
        </div>
      );
    }
    if (overlayView === 'ob_staff') {
      return renderOverlayList(obStaff, 'OB staff degmadan kama abuurna.', 'ob_entries', (item) => (
        <span><strong>{item.full_name || item.username}</strong><small>{item.username} - {(item.ob_entries || []).length} OB</small></span>
      ));
    }
    if (overlayView === 'investigators') {
      return renderOverlayList(investigators, 'Baare degmadan kama abuurna.', 'investigator_cases', (item) => (
        <span><strong>{item.full_name || item.officer_name || item.username}</strong><small>{item.username} - {(item.assigned_cases || []).length} kiis</small></span>
      ));
    }
    if (overlayView === 'ob_entries' && selectedOverlayItem) {
      return renderOverlayList(selectedOverlayItem.ob_entries || [], 'OB staff-kan OB uma diiwaan gashana.', 'ob_detail', (item) => (
        <span><strong>{item.ob_number || 'OB'}</strong><small>{item.case_title || 'Cinwaan laaan'} - {item.status || 'Status N/A'}</small></span>
      ));
    }
    if (overlayView === 'investigator_cases' && selectedOverlayItem) {
      return renderOverlayList(selectedOverlayItem.assigned_cases || [], 'Baarahan kiis looma assigned-gareyn.', 'case_detail', (item) => (
        <span><strong>{item.case_number || item.ob_number || 'Kiis'}</strong><small>{item.title || 'Cinwaan laaan'} - {item.status || 'Status N/A'}</small></span>
      ));
    }
    if (overlayView === 'legacy_ob_staff') {
      return renderOverlayList(obStaff, 'OB staff degmadan kama abuurna.', 'ob_detail', (item) => (
        <span><strong>{item.full_name || item.username}</strong><small>{item.username} · {item.phone || item.email || 'Contact N/A'}</small></span>
      ));
    }
    if (overlayView === 'cases') {
      return renderOverlayList(investigationCases, 'Kiis baaritaan ah degmadan kama furna.', 'case_detail', (item) => (
        <span><strong>{item.case_number || item.ob_number || 'Kiis'}</strong><small>{item.title || 'Cinwaan laaan'} · {item.status || 'Status N/A'}</small></span>
      ));
    }
    if (overlayView === 'jail') {
      return renderOverlayList(stationPrisoners, 'Maxbuus station jail-ka degmadan kuma jiro.', 'prisoner_detail', (item) => (
        <span><strong>{item.full_name || 'Maxbuus'}</strong><small>{item.prison_number || 'Prison number N/A'} · {item.facility || 'Facility N/A'}</small></span>
      ));
    }
    if (overlayView === 'ob_detail' && selectedOverlayItem) {
      return (
        <div className="station-overlay-detail">
          {renderDetailRow('OB number', selectedOverlayItem.ob_number)}
          {renderDetailRow('Title', selectedOverlayItem.case_title)}
          {renderDetailRow('Type', selectedOverlayItem.case_type)}
          {renderDetailRow('Status', selectedOverlayItem.status)}
          {renderDetailRow('Reporter', selectedOverlayItem.reported_by)}
          {renderDetailRow('Phone', selectedOverlayItem.reporter_phone)}
          {renderDetailRow('Location', selectedOverlayItem.incident_location)}
          {renderDetailRow('Linked case', selectedOverlayItem.linked_case_number)}
        </div>
      );
    }
    if (overlayView === 'legacy_ob_detail' && selectedOverlayItem) {
      return (
        <div className="station-overlay-detail">
          {renderDetailRow('Magaca', selectedOverlayItem.full_name || selectedOverlayItem.username)}
          {renderDetailRow('Username', selectedOverlayItem.username)}
          {renderDetailRow('Role', selectedOverlayItem.role)}
          {renderDetailRow('Phone', selectedOverlayItem.phone)}
          {renderDetailRow('Email', selectedOverlayItem.email)}
          {renderDetailRow('Rank', selectedOverlayItem.officer_rank || selectedOverlayItem.rank)}
          {renderDetailRow('Force number', selectedOverlayItem.force_number)}
          {renderDetailRow('Last login', selectedOverlayItem.last_login)}
        </div>
      );
    }
    if (overlayView === 'case_detail' && selectedOverlayItem) {
      return (
        <CaseDetailsPage
          caseId={selectedCaseId || selectedOverlayItem.id}
          mode="overlay"
          onBack={goOverlayBack}
          onClose={closeStationOverlay}
        />
      );
    }
    if (overlayView === 'legacy_case_detail' && selectedOverlayItem) {
      return (
        <div className="station-overlay-detail">
          {renderDetailRow('Case number', selectedOverlayItem.case_number)}
          {renderDetailRow('OB number', selectedOverlayItem.ob_number)}
          {renderDetailRow('Title', selectedOverlayItem.title)}
          {renderDetailRow('Incident type', selectedOverlayItem.incident_type || selectedOverlayItem.case_type)}
          {renderDetailRow('Priority', selectedOverlayItem.priority)}
          {renderDetailRow('Status', selectedOverlayItem.status)}
          {renderDetailRow('Assigned baare', selectedOverlayItem.assigned_investigator)}
          {renderDetailRow('Location', selectedOverlayItem.incident_location)}
        </div>
      );
    }
    if (overlayView === 'prisoner_detail' && selectedOverlayItem) {
      return (
        <div className="station-overlay-detail">
          {renderDetailRow('Maxbuuska', selectedOverlayItem.full_name)}
          {renderDetailRow('Prison number', selectedOverlayItem.prison_number)}
          {renderDetailRow('Case number', selectedOverlayItem.case_number)}
          {renderDetailRow('OB number', selectedOverlayItem.ob_number)}
          {renderDetailRow('Facility', selectedOverlayItem.facility)}
          {renderDetailRow('Cell', selectedOverlayItem.cell_number ? `${selectedOverlayItem.block_name || ''} / ${selectedOverlayItem.cell_number}` : null)}
          {renderDetailRow('Sentence status', selectedOverlayItem.sentence_status)}
          {renderDetailRow('Transfer status', selectedOverlayItem.latest_transfer_status)}
        </div>
      );
    }
    return null;
  };

  return (
    <ProtectedRoute allowedRoles={['admin']} requiredPermissions={['stations.view']}>
      <div className="stations-admin-page">
        <div className="stations-admin-head">
          <div>
            <Text className="stations-admin-breadcrumb">Maamulka / Xarumaha Boliiska</Text>
            <Title level={2}>Xarumaha Boliiska</Title>
            <Text>Maamul district stations, login accounts, iyo command area-kooda.</Text>
          </div>
          {canEditStations && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Station
            </Button>
          )}
        </div>

        <Row gutter={[16, 16]} className="stations-admin-kpis">
          {stats.map((item) => (
            <Col xs={12} lg={6} key={item.label}>
              <Card className={`station-admin-kpi station-admin-kpi-${item.tone || 'default'}`} variant="borderless">
                <div className="station-admin-kpi-icon">{item.icon}</div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Card>
            </Col>
          ))}
        </Row>

        <div className="stations-admin-toolbar">
          <Space wrap>
            {FILTERS.map((item) => (
              <Button
                key={item.key}
                type={filter === item.key ? 'primary' : 'default'}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </Space>
          <Text>{filteredStations.length} xarun ayaa muuqata</Text>
        </div>

        {loading ? (
          <div className="stations-admin-loading"><Spin size="large" /></div>
        ) : filteredStations.length ? (
          <Row gutter={[16, 16]}>{filteredStations.map(renderStationCard)}</Row>
        ) : (
          <Card className="station-admin-empty" variant="borderless">
            <Empty description="Xarun ku jirta filter-kan lama helin." />
          </Card>
        )}

        <Modal
          className="station-admin-modal"
          title={editingStation ? 'Edit Station Details' : 'Register New Station'}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          okText={editingStation ? 'Update Station' : 'Create Station'}
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Station Name" rules={[requiredRule('Station name'), textLengthRule('Station name', 3, 150)]}>
              <Input placeholder="e.g. Hodan Central Station" />
            </Form.Item>
            <Form.Item name="code" label="Station Code (Unique)" rules={codeRules('Station code')}>
              <Input placeholder="e.g. HPS-01" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="region_id" label="Region" rules={[requiredRule('Region')]}>
                  <Select placeholder="Select region" showSearch optionFilterProp="children">
                    {regions.map((region) => <Select.Option key={region.id} value={region.id}>{region.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="username" label="Username-ka Login-ka" rules={usernameRules}>
                  <Input placeholder="e.g. hodan_station" />
                </Form.Item>
              </Col>
            </Row>
            {!editingStation && (
              <Form.Item name="password" label="Login Password" rules={passwordRules}>
                <Input.Password />
              </Form.Item>
            )}
          </Form>
        </Modal>

        <Modal
          className={`station-overlay-modal ${overlayView === 'case_detail' ? 'station-case-detail-modal' : ''}`}
          open={Boolean(selectedStation)}
          onCancel={closeStationOverlay}
          footer={null}
          centered
          width={overlayView === 'case_detail' ? 'calc(100vw - 64px)' : 760}
          closeIcon={<CloseOutlined />}
          styles={{ mask: { backgroundColor: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(14px)' } }}
        >
          {selectedStation && (
            <div className="station-overlay-content">
              {overlayView !== 'menu' && overlayView !== 'case_detail' && <Button className="station-overlay-back" onClick={goOverlayBack}>Back</Button>}
              {overlayView !== 'case_detail' && (
                <>
                  <Text>{overlayStation?.code || 'Station code'}</Text>
                  <Title level={2}>{overlayStation?.name || overlayStation?.district_name || 'Xarun Boliis'}</Title>
                </>
              )}
              {renderOverlayBody()}
            </div>
          )}
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
