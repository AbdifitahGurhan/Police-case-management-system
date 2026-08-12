'use client';

import React from 'react';
import { Button, Card, Col, DatePicker, Form, Input, Row, Select } from 'antd';
import {
  BankOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { disabledFutureDate, noFutureDateTimeRule, phoneRules, requiredRule, textLengthRule } from '@/utils/validation';

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

function Section({ title, children }) {
  return (
    <Card className="ob-card ob-form-section" title={title}>
      <Row gutter={[16, 8]}>{children}</Row>
    </Card>
  );
}

function AccusedFields({ field, remove, form }) {
  const custody = Form.useWatch(['accused', field.name, 'custody_state'], form);
  const { key, name, ...rest } = field;

  return (
    <Card key={key} className="ob-inline-card">
      <Row gutter={[12, 4]}>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'full_name']} label="Magaca">
            <Input placeholder="Geli magaca eedeysanaha" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'phone']} label="Lambarka" rules={phoneRules}>
            <Input placeholder="Geli lambarka telefoonka" />
          </Form.Item>
        </Col>
        <Col xs={20} md={7}>
          <Form.Item {...rest} name={[name, 'custody_state']} label="Xaaladda Qabashada" rules={[{ required: true, message: 'Xaaladda dooro.' }]}>
            <Select options={custodyOptions} />
          </Form.Item>
        </Col>
        <Col xs={4} md={1}>
          <Button danger type="text" aria-label="Ka saar eedeysanaha" icon={<MinusCircleOutlined />} onClick={() => remove(name)} className="ob-remove-btn" />
        </Col>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'gender']} label="Jinsiga">
            <Select options={[{ value: 'Male', label: 'Lab' }, { value: 'Female', label: 'Dhedig' }]} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'address']} label="Cinwaanka">
            <Input placeholder="Geli cinwaanka" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item {...rest} name={[name, 'identifying_information']} label="Astaamaha Lagu Garto">
            <Input placeholder="Geli astaamaha lagu garto" />
          </Form.Item>
        </Col>
        {custody === 'IN_CUSTODY' && (
          <>
            <Col xs={24} md={8}>
              <Form.Item {...rest} name={[name, 'arrest_date']} label="Waqtiga Qabashada" rules={[{ required: true, message: 'Waqtiga qabashada geli.' }]}>
                <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item {...rest} name={[name, 'arrest_location']} label="Goobta Lagu Qabtay" rules={[{ required: true, message: 'Goobta qabashada geli.' }]}>
                <Input placeholder="Geli goobta qabashada" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item {...rest} name={[name, 'arresting_officer']} label="Sarkaalka Qabtay" rules={[{ required: true, message: 'Sarkaalka qabtay geli.' }]}>
                <Input placeholder="Geli sarkaalka qabtay" />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>
    </Card>
  );
}

export default function ObCreateForm({ form, location = {}, user, onFinish, onCancel, onDraft, submitLabel = 'Dib u Eeg Ka Hor Kaydinta', modal = false, saving = false }) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish} initialValues={getObInitialValues()} className={`ob-create-form ${modal ? 'ob-create-form--modal' : ''}`}>
      <div className="ob-create-compact">
        <Section title="1. Xogta Dacwadda">
            <Col xs={24} md={8}>
              <Form.Item name="case_title" label="Cinwaanka Dacwadda" rules={[requiredRule('Cinwaanka dacwadda'), textLengthRule('Cinwaanka', 3, 255)]}>
                <Input placeholder="Geli cinwaanka dacwadda" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="case_type" label="Nooca Dacwadda" rules={[requiredRule('Nooca dacwadda'), textLengthRule('Nooca dacwadda', 2, 100)]}>
                <Input placeholder="Dooro nooca dacwadda" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="incident_type" label="Nooca Dhacdada" rules={[requiredRule('Nooca dhacdada')]}>
                <Input placeholder="Geli nooca dhacdada" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="incident_location" label="Goobta Dhacdada" rules={[requiredRule('Goobta dhacdada')]}>
                <Input placeholder="Geli goobta dhacdada" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="incident_datetime" label="Taariikhda Dhacdada" rules={[requiredRule('Taariikhda dhacdada'), noFutureDateTimeRule('Taariikhda dhacdada')]}>
                <DatePicker showTime disabledDate={disabledFutureDate} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Sharaxaadda Dacwadda" rules={[requiredRule('Sharaxaadda'), textLengthRule('Sharaxaadda', 10, 5000)]}>
                <TextArea rows={3} placeholder="Geli sharaxaadda dacwadda" />
              </Form.Item>
            </Col>
        </Section>

        <Section title="2. Xogta Soo Dacwoodaha">
            <Col xs={24} md={6}>
              <Form.Item name="reported_by" label="Magaca oo Buuxa" rules={[requiredRule('Magaca')]}>
                <Input placeholder="Geli magaca oo buuxa" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="reporter_phone" label="Lambarka Taleefanka" rules={[requiredRule('Telefoonka'), ...phoneRules]}>
                <Input placeholder="Geli lambarka taleefanka" />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="reporter_gender" label="Jinsiga">
                <Select placeholder="Dooro jinsiga" options={[{ value: 'Male', label: 'Lab' }, { value: 'Female', label: 'Dhedig' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="reporter_id_type" label="Nooca Aqoonsiga" rules={[requiredRule('Nooca aqoonsiga')]}>
                <Select options={idTypes.map((value) => ({ value, label: value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={3}>
              <Form.Item name="reporter_id_number" label="Lambarka Aqoonsiga (Ikhtiyaari)">
                <Input placeholder="Geli lambarka aqoonsiga" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="reporter_address" label="Cinwaanka (Ikhtiyaari)">
                <Input placeholder="Geli cinwaanka" />
              </Form.Item>
            </Col>
        </Section>

        <Row gutter={[16, 0]} className="ob-party-row">
            <Col xs={24} md={12}>
              <Card className="ob-card ob-form-section" title="3. Xogta Dhibbanayaasha">
                <Form.List name="victims">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Card key={key} className="ob-inline-card">
                          <Row gutter={[12, 4]}>
                            <Col xs={24} md={8}>
                              <Form.Item {...rest} name={[name, 'full_name']} label="Magaca" rules={[{ required: true, message: 'Magaca geli.' }]}>
                                <Input placeholder="Geli magaca dhibbanaha" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={7}>
                              <Form.Item {...rest} name={[name, 'phone']} label="Lambarka" rules={phoneRules}>
                                <Input placeholder="Telefoon" />
                              </Form.Item>
                            </Col>
                            <Col xs={20} md={8}>
                              <Form.Item {...rest} name={[name, 'details']} label="Faahfaahin" rules={[{ required: true, message: 'Faahfaahinta geli.' }]}>
                                <Input placeholder="Faahfaahin" />
                              </Form.Item>
                            </Col>
                            <Col xs={4} md={1}>
                              <Button danger type="text" aria-label="Ka saar dhibbanaha" icon={<MinusCircleOutlined />} onClick={() => remove(name)} className="ob-remove-btn" />
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>Ku Dar Dhibbane Kale</Button>
                    </>
                  )}
                </Form.List>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="ob-card ob-form-section" title="4. Xogta Eedeysanayaasha">
                <Form.List name="accused">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => <AccusedFields key={field.key} field={field} remove={remove} form={form} />)}
                      <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ custody_state: 'NOT_IN_CUSTODY', status: 'WANTED' })}>Ku Dar Eedeysane Kale</Button>
                    </>
                  )}
                </Form.List>
              </Card>
            </Col>
        </Row>

        <Card className="ob-card ob-form-section ob-auto-section" title="5. Xogta Si Toos ah Loo Diiwaangelinayo">
          <div className="ob-auto-strip">
            <div>
              <span><FileTextOutlined /></span>
              <p>Lambarka OB</p>
              <strong>Si toos ah ayaa loo sameynayaa</strong>
            </div>
            <div>
              <span><BankOutlined /></span>
              <p>Saldhigga / Degmada</p>
              <strong>{location.districtName || location.stationName || 'Waxaa laga qaadayaa koontada'}</strong>
            </div>
            <div>
              <span><UserOutlined /></span>
              <p>Sarkaalka Diiwaangelinaya</p>
              <strong>{user?.fullName || user?.username || 'Isticmaale'}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="ob-form-footer">
        <Button onClick={onCancel}>Jooji</Button>
        <Button icon={<SaveOutlined />} onClick={onDraft}>Kaydi Qabyo</Button>
        <Button type="primary" htmlType="submit" loading={saving} icon={<FileAddOutlined />}>{submitLabel}</Button>
      </div>
    </Form>
  );
}
