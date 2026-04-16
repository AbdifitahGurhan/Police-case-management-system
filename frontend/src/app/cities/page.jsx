'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

export default function CitiesPage() {
  const columns = [
    { title: 'City Name', dataIndex: 'city_name', key: 'city_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin', 'region_admin']}>
      <TierManager
        entityName="City"
        apiEndpoint="/cities"
        columns={columns}
        parentKey="region_id"
        parentEndpoint="/regions"
        parentLabel="Region"
        parentNameKey="region_name"
      />
    </ProtectedRoute>
  );
}
