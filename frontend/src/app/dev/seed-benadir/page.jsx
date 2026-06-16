"use client";

import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

export default function SeedBenadir() {
  const router = useRouter();

  useEffect(() => {
    // Sample token (not validated by backend) and user payload for Benadir region admin
    const fakeToken = 'dev-token-benadir';
    const benadirUser = {
      id: 9999,
      username: 'benadir.admin',
      email: 'benadir.admin@example.so',
      role: 'region_admin',
      roleCode: 'region_admin',
      fullName: 'Benadir Regional Admin',
      scopeType: 'region',
      scopeId: 1,
      location: { stateId: null, stateName: 'Benadir', regionId: 1, regionName: 'Mogadishu Region' }
    };

    Cookies.set('token', fakeToken, { expires: 1 });
    Cookies.set('user', JSON.stringify(benadirUser), { expires: 1 });

    // Redirect to regional dashboard
    router.push('/dashboard/unit');
  }, [router]);

  return <div style={{ padding: 24 }}>Seeding Benadir sample user and redirecting...</div>;
}
