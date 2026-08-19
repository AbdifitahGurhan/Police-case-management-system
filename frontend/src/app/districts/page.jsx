'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

import { DISTRICTS_BY_REGION } from '@/utils/somaliDistricts';

export default function DistrictsPage() {
  const columns = [
    { title: 'Magaca Degmada', dataIndex: 'district_name', key: 'district_name' },
    { title: 'Gobolka', dataIndex: 'region_name', key: 'region_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin']}>
      <TierManager
        entityName="Degmo"
        apiEndpoint="/districts"
        columns={columns}
        parentKey="region_id"
        parentEndpoint="/regions"
        parentLabel="Gobolka"
        parentNameKey="region_name"
        autoParentRoles={['region_admin']}
        nameOptionsByParent={DISTRICTS_BY_REGION}
        generatedCode
      />
    </ProtectedRoute>
  );
}
