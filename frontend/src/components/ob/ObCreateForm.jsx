'use client';

import React from 'react';
import { Button, Card, Col, DatePicker, Form, Input, Row, Select } from 'antd';
import {
  BankOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  disabledFutureDate,
  dynamicIdNumberRule,
  lettersOnlyRule,
  nameOnlyRule,
  noFutureDateTimeRule,
  requiredRule,
  somaliPhoneRule,
  textLengthRule,
  textNotPureNumberRule,
} from '@/utils/validation';

const { TextArea } = Input;

export const idTypes = ['Aqoonsiga Qaranka', 'Baasaboor', 'Laysanka Darawalnimada', 'Aqoonsiga Booliska/Milatariga', 'Kale'];

const custodyOptions = [
  { value: 'IN_CUSTODY', label: 'Gacanta lagu hayo' },
  { value: 'NOT_IN_CUSTODY', label: 'Lama hayo' },
];

export const getObInitialValues = () => ({
  reporter_id_type: idTypes[0],
  incident_datetime: dayjs().subtract(1, 'minute'),
  victims: [],
  accused: [],
});

export const normalizeObPayload = (values) => {
  const victims = (values.victims || []).filter((victim) =>
    Object.values(victim || {}).some((value) => value !== undefined && value !== null && String(value).trim() !== '')
  );
  const accused = (values.accused || [])
    .filter((person) =>
      Object.entries(person || {}).some(([key, value]) =>
        key !== 'custody_state' && key !== 'status' && value !== undefined && value !== null && String(value).trim() !== ''
      )
    )
    .map((person) => ({
      ...person,
      arrest_date: person.arrest_date
        ? (person.arrest_date.format ? person.arrest_date.format('YYYY-MM-DD HH:mm:ss') : String(person.arrest_date).slice(0, 19).replace('T', ' '))
        : null,
    }));

  return {
    ...values,
    incident_datetime: values.incident_datetime.format('YYYY-MM-DD HH:mm:ss'),
    victims,
    accused,
  };
};

function Section({ title, icon, children, className = '' }) {
  return (
    <Card
      className={`ob-card ob-form-section ${className}`}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
          {icon}
          <span>{title}</span>
        </div>
      }
    >
      <Row gutter={[20, 16]}>{children}</Row>
    </Card>
  );
}

function AccusedFields({ field, remove, form }) {
  const custody = Form.useWatch(['accused', field.name, 'custody_state'], form);
  const { key, name, ...rest } = field;

  return (
    <Card key={key} className="ob-inline-card" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={24} md={8}>
          <Form.Item
            {...rest}
            name={[name, 'full_name']}
            label="Magaca Eedeysanaha"
            rules={[
              nameOnlyRule('Magaca eedeysanaha'),
              textLengthRule('Magaca eedeysanaha', 2, 120),
            ]}
          >
            <Input placeholder="Tusaale: Maxamed Cali Cilmi" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            {...rest}
            name={[name, 'phone']}
            label="Lambarka Telefoonka"
            rules={[somaliPhoneRule]}
          >
            <Input placeholder="Tusaale: +25261XXXXXXX" />
          </Form.Item>
        </Col>
        <Col xs={20} md={7}>
          <Form.Item
            {...rest}
            name={[name, 'custody_state']}
            label="Xaaladda Qabashada"
            rules={[{ required: true, message: 'Xaaladda dooro.' }]}
          >
            <Select options={custodyOptions} />
          </Form.Item>
        </Col>
        <Col xs={4} md={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Button
            danger
            type="text"
            aria-label="Ka saar eedeysanaha"
            icon={<MinusCircleOutlined style={{ fontSize: 18 }} />}
            onClick={() => remove(name)}
            className="ob-remove-btn"
          />
        </Col>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'gender']} label="Jinsiga">
            <Select
              placeholder="Dooro jinsiga"
              options={[
                { value: 'Male', label: 'Lab' },
                { value: 'Female', label: 'Dhedig' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item
            {...rest}
            name={[name, 'address']}
            label="Cinwaanka Hoyga"
            rules={[textNotPureNumberRule('Cinwaanka')]}
          >
            <Input placeholder="Degmada, Xaafadda, Guriga..." />
          </Form.Item>
        </Col>
        {custody === 'IN_CUSTODY' && (
          <>
            <Col xs={24} md={8}>
              <Form.Item
                {...rest}
                name={[name, 'arrest_date']}
                label="Waqtiga Qabashada"
                rules={[
                  { required: true, message: 'Waqtiga qabashada geli.' },
                  noFutureDateTimeRule('Waqtiga qabashada'),
                ]}
              >
                <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                {...rest}
                name={[name, 'arrest_location']}
                label="Goobta Lagu Qabtay"
                rules={[
                  { required: true, message: 'Goobta qabashada geli.' },
                  textNotPureNumberRule('Goobta qabashada'),
                ]}
              >
                <Input placeholder="Goobta lagu soo qabtay..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                {...rest}
                name={[name, 'arresting_officer']}
                label="Sarkaalka Qabtay"
                rules={[
                  { required: true, message: 'Sarkaalka qabtay geli.' },
                  nameOnlyRule('Sarkaalka qabtay'),
                ]}
              >
                <Input placeholder="Magaca sarkaalka soo qabtay..." />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>
    </Card>
  );
}

export default function ObCreateForm({
  form,
  location = {},
  user,
  onFinish,
  onCancel,
  onDraft,
  submitLabel = 'Dib u Eeg Ka Hor Kaydinta',
  modal = false,
  saving = false,
}) {
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={getObInitialValues()}
      className={`ob-create-form ${modal ? 'ob-create-form--modal' : ''}`}
    >
      <div className="ob-create-spacious-wrapper">
        {/* 1. Xogta Dacwadda */}
        <Section
          title="1. Xogta Dacwadda"
          icon={<FileTextOutlined style={{ color: '#0284c7', fontSize: 18 }} />}
        >
          <Col xs={24} md={8}>
            <Form.Item
              name="case_title"
              label="Cinwaanka Dacwadda"
              rules={[
                requiredRule('Cinwaanka dacwadda'),
                textLengthRule('Cinwaanka', 3, 255),
                textNotPureNumberRule('Cinwaanka dacwadda'),
              ]}
            >
              <Input placeholder="Tusaale: Isku day dil ama Dhac hubeysan" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="incident_type"
              label="Nooca Dhacdada"
              rules={[
                requiredRule('Nooca dhacdada'),
                lettersOnlyRule('Nooca dhacdada'),
                textLengthRule('Nooca dhacdada', 2, 100),
              ]}
            >
              <Input placeholder="Tusaale: Weerar, Dhac, Dhaawac..." />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="incident_location"
              label="Goobta Dhacdada"
              rules={[
                requiredRule('Goobta dhacdada'),
                textNotPureNumberRule('Goobta dhacdada'),
                textLengthRule('Goobta dhacdada', 2, 150),
              ]}
            >
              <Input placeholder="Tusaale: Degmada Yaqshiid / Suuqa Tawfiiq" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="incident_datetime"
              label="Taariikhda & Waqtiga Dhacdada"
              rules={[
                requiredRule('Taariikhda dhacdada'),
                noFutureDateTimeRule('Taariikhda dhacdada'),
              ]}
            >
              <DatePicker showTime disabledDate={disabledFutureDate} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item
              name="description"
              label="Sharaxaadda Dacwadda"
              rules={[
                requiredRule('Sharaxaadda dacwadda'),
                textLengthRule('Sharaxaadda', 10, 5000),
                textNotPureNumberRule('Sharaxaadda dacwadda'),
              ]}
            >
              <TextArea rows={3} placeholder="Faahfaahin kooban oo ku saabsan sida ay dhacdadu u dhacday..." />
            </Form.Item>
          </Col>
        </Section>

        {/* 2. Xogta Soo Dacwoodaha */}
        <Section
          title="2. Xogta Soo Dacwoodaha"
          icon={<UserOutlined style={{ color: '#0d9488', fontSize: 18 }} />}
        >
          <Col xs={24} md={6}>
            <Form.Item
              name="reported_by"
              label="Magaca oo Buuxa"
              rules={[
                requiredRule('Magaca soo dacwoodaha'),
                nameOnlyRule('Magaca soo dacwoodaha'),
                textLengthRule('Magaca', 3, 120),
              ]}
            >
              <Input placeholder="Tusaale: Cabdi Cali Salaad" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              name="reporter_phone"
              label="Lambarka Taleefanka"
              rules={[
                requiredRule('Telefoonka soo dacwoodaha'),
                somaliPhoneRule,
              ]}
            >
              <Input placeholder="Tusaale: +25261XXXXXXX" />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="reporter_gender" label="Jinsiga">
              <Select
                placeholder="Dooro jinsiga"
                options={[
                  { value: 'Male', label: 'Lab' },
                  { value: 'Female', label: 'Dhedig' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item
              name="reporter_id_type"
              label="Nooca Aqoonsiga"
              rules={[requiredRule('Nooca aqoonsiga')]}
            >
              <Select options={idTypes.map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item
              name="reporter_id_number"
              label="Lambarka Aqoonsiga (Ikhtiyaari)"
              rules={[dynamicIdNumberRule('reporter_id_type')]}
            >
              <Input placeholder="Geli lambarka aqoonsiga" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="reporter_address"
              label="Cinwaanka Hoyga (Ikhtiyaari)"
              rules={[textNotPureNumberRule('Cinwaanka')]}
            >
              <Input placeholder="Degmada, Xaafadda, Jidka..." />
            </Form.Item>
          </Col>
        </Section>

        {/* 3 & 4. Xogta Dhibbanayaasha & Eedeysanayaasha */}
        <Row gutter={[20, 20]} className="ob-party-row">
          <Col xs={24} lg={12}>
            <Card
              className="ob-card ob-form-section"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
                  <UsergroupAddOutlined style={{ color: '#ea580c', fontSize: 18 }} />
                  <span>3. Xogta Dhibbanayaasha</span>
                </div>
              }
            >
              <Form.List name="victims">
                {(fields, { add, remove }) => (
                  <>
                    {fields.length === 0 && (
                      <div style={{ padding: '16px 0', textAlign: 'center', color: '#8c8c8c' }}>
                        Weli dhibbane lama darin. Guji batoonka hoose si aad ugu darto.
                      </div>
                    )}
                    {fields.map(({ key, name, ...rest }) => (
                      <Card key={key} className="ob-inline-card" style={{ marginBottom: 14 }}>
                        <Row gutter={[12, 10]}>
                          <Col xs={24} md={9}>
                            <Form.Item
                              {...rest}
                              name={[name, 'full_name']}
                              label="Magaca Dhibbanaha"
                              rules={[
                                requiredRule('Magaca dhibbanaha'),
                                nameOnlyRule('Magaca dhibbanaha'),
                                textLengthRule('Magaca', 2, 120),
                              ]}
                            >
                              <Input placeholder="Magaca dhibbanaha..." />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={7}>
                            <Form.Item
                              {...rest}
                              name={[name, 'phone']}
                              label="Telefoonka"
                              rules={[somaliPhoneRule]}
                            >
                              <Input placeholder="Telefoon..." />
                            </Form.Item>
                          </Col>
                          <Col xs={20} md={7}>
                            <Form.Item
                              {...rest}
                              name={[name, 'details']}
                              label="Faahfaahin / Dhaawac"
                              rules={[
                                requiredRule('Faahfaahinta'),
                                textNotPureNumberRule('Faahfaahinta'),
                              ]}
                            >
                              <Input placeholder="Faahfaahin..." />
                            </Form.Item>
                          </Col>
                          <Col xs={4} md={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Button
                              danger
                              type="text"
                              aria-label="Ka saar dhibbanaha"
                              icon={<MinusCircleOutlined style={{ fontSize: 18 }} />}
                              onClick={() => remove(name)}
                              className="ob-remove-btn"
                            />
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      block
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({})}
                      style={{ height: 42, fontWeight: 600, marginTop: 8 }}
                    >
                      Ku Dar Dhibbane Cusub
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              className="ob-card ob-form-section"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
                  <SafetyCertificateOutlined style={{ color: '#dc2626', fontSize: 18 }} />
                  <span>4. Xogta Eedeysanayaasha</span>
                </div>
              }
            >
              <Form.List name="accused">
                {(fields, { add, remove }) => (
                  <>
                    {fields.length === 0 && (
                      <div style={{ padding: '16px 0', textAlign: 'center', color: '#8c8c8c' }}>
                        Weli eedeysane lama darin. Guji batoonka hoose si aad ugu darto.
                      </div>
                    )}
                    {fields.map((field) => (
                      <AccusedFields key={field.key} field={field} remove={remove} form={form} />
                    ))}
                    <Button
                      block
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({ custody_state: 'NOT_IN_CUSTODY', status: 'WANTED' })}
                      style={{ height: 42, fontWeight: 600, marginTop: 8 }}
                    >
                      Ku Dar Eedeysane Cusub
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>
          </Col>
        </Row>

        {/* 5. Xogta Si Toos ah Loo Diiwaangelinayo */}
        <Card
          className="ob-card ob-form-section ob-auto-section"
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
              <BankOutlined style={{ color: '#2563eb', fontSize: 18 }} />
              <span>5. Xogta Si Toos ah Loo Diiwaangelinayo</span>
            </div>
          }
        >
          <div className="ob-auto-strip">
            <div className="ob-auto-box">
              <span className="ob-auto-icon"><FileTextOutlined /></span>
              <div className="ob-auto-info">
                <p>Lambarka OB</p>
                <strong>Si toos ah ayaa loo sameynayaa</strong>
              </div>
            </div>
            <div className="ob-auto-box">
              <span className="ob-auto-icon"><BankOutlined /></span>
              <div className="ob-auto-info">
                <p>Saldhigga / Degmada</p>
                <strong>{location.districtName || location.stationName || 'Dawladda Dhexe'}</strong>
              </div>
            </div>
            <div className="ob-auto-box">
              <span className="ob-auto-icon"><UserOutlined /></span>
              <div className="ob-auto-info">
                <p>Sarkaalka Diiwaangelinaya</p>
                <strong>{user?.fullName || user?.username || 'Sarkaal'}</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="ob-form-footer">
        <Button onClick={onCancel} size="large" style={{ minWidth: 110, fontWeight: 600 }}>
          Jooji
        </Button>
        <Button icon={<SaveOutlined />} onClick={onDraft} size="large" style={{ minWidth: 140, fontWeight: 600 }}>
          Kaydi Qabyo
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={saving}
          icon={<FileAddOutlined />}
          size="large"
          style={{ minWidth: 200, fontWeight: 700 }}
        >
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}
