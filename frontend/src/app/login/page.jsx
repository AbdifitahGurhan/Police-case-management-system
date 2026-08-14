'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Alert, Button, Card, Checkbox, Form, Input, Typography } from 'antd';
import { CheckOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginState, setLoginState] = useState('idle');
  const [welcomeName, setWelcomeName] = useState('');
  const submittingRef = useRef(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !submittingRef.current) {
      const roleRedirects = {
        admin: '/dashboard/operations', sub_admin: '/police-officers', ob_staff: '/ob-register',
        state_admin: '/dashboard/operations', region_admin: '/dashboard/operations', city_admin: '/districts',
        district_admin: '/dashboard/operations', personnel_registry: '/police-officers',
        investigator: '/dashboard/investigator', station_jail: '/dashboard/jail', officer: '/dashboard/officer',
        cid: '/dashboard/cid', cid_director: '/dashboard/cid', cid_supervisor: '/dashboard/cid',
        cid_officer: '/dashboard/cid', court: '/dashboard/court', prosecutor: '/dashboard/court',
        prosecutor_liaison: '/dashboard/cid', jail: '/dashboard/central-jail',
        state_commander: '/dashboard/operations', region_commander: '/dashboard/operations',
        district_commander: '/dashboard/operations', police_station_commander: '/dashboard/operations'
      };
      router.replace(roleRedirects[user.role] || '/police-officers');
    }
  }, [user, router]);

  const onFinish = async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setLoginState('verifying');
    setError('');
    const result = await login(values.identifier, values.password, { deferNavigation: true });
    if (!result.success) {
      setError(result.message);
      setLoading(false);
      setLoginState('idle');
      submittingRef.current = false;
      return;
    }
    const officerName = result.user?.full_name || result.user?.name || result.user?.username || values.identifier;
    setWelcomeName(officerName);
    setLoginState('success');
    window.setTimeout(() => {
      setLoginState('leaving');
      sessionStorage.setItem('spf-dashboard-enter', '1');
      window.setTimeout(() => router.push(result.redirectTo), 700);
    }, 500);
  };

  return (
    <div className={`login-art-page login-state-${loginState}`}>
      <div className="login-grid" aria-hidden="true" />
      <div className="login-circle login-circle-top" aria-hidden="true" />
      <div className="login-circle login-circle-center" aria-hidden="true" />
      <div className="login-circle login-circle-left" aria-hidden="true" />
      <div className="login-shield-outline" aria-hidden="true" />

      <header className="login-topbar">
        <div className="login-identity">
          <div className="login-mini-badge"><Image src="/somali-police-emblem-v2.png" alt="Somali Police Force" width={1200} height={1200} priority /></div>
          <div><strong>CIDANKA BOOLISKA SOOMAALIYEED</strong><small>Somali Police Force</small></div>
        </div>
        <div className="login-secure"><i /> Xiriir ammaan ah</div>
      </header>

      <main className="login-form-panel">
        <div className="login-new-shell">
          <Card className="login-art-card" variant="none">
            <div className="login-new-heading">
              <div className="login-main-badge">
                <span className="login-logo-loader" aria-hidden="true" />
                <Image src="/somali-police-emblem-v2.png" alt="Somali Police Force logo" width={1200} height={1200} priority />
              </div>
              <b>CIDANKA BOOLISKA SOOMAALIYEED</b>
              {welcomeName && <div className="login-welcome">Ku soo dhawoow, {welcomeName}</div>}
              <Title level={1}>Ku soo dhawoow</Title>
              <Typography.Text>Geli xogtaada si aad u gasho nidaamka maamulka kiisaska.</Typography.Text>
            </div>

            {error && <Alert title={error} type="error" showIcon className="login-art-alert" />}

            <Form name="login_form" layout="vertical" onFinish={onFinish} size="large" className="login-art-form">
              <Form.Item label="Force Number ama Email" name="identifier" rules={[{ required: true, message: 'Geli force number-ka ama email-ka.' }]}>
                <Input prefix={<UserOutlined />} placeholder="SPF-1024 ama email-kaaga" />
              </Form.Item>
              <Form.Item label="Furaha sirta" name="password" rules={[{ required: true, message: 'Geli furaha sirta.' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Geli furaha sirta" />
              </Form.Item>
              <div className="login-new-options">
                <Checkbox>I xasuuso</Checkbox>
                <button type="button">Ma illowday furaha?</button>
              </div>
              <Form.Item>
                <Button type="primary" htmlType="submit" disabled={loading} block className="login-art-button">
                  {loginState === 'verifying' && <span className="login-button-emblem"><Image src="/somali-police-emblem-v2.png" alt="" width={1200} height={1200} /></span>}
                  {(loginState === 'success' || loginState === 'leaving') && <CheckOutlined className="login-success-check" />}
                  <span>{loginState === 'verifying' ? 'Xogta waa la hubinayaa...' : loginState === 'success' || loginState === 'leaving' ? 'Gelitaan waa la xaqiijiyey' : 'Gal Nidaamka'}</span>
                </Button>
              </Form.Item>
            </Form>

            <div className="login-new-security">Loogu talagalay shaqaalaha la oggolaaday oo keliya</div>
          </Card>
          <footer>© 2026 Somali Police Force <span>•</span> Case Management System v1.0</footer>
        </div>
      </main>
    </div>
  );
}
