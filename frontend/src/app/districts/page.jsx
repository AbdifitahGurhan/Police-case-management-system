'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

export default function DistrictsPage() {
  const columns = [
    { title: 'District Name', dataIndex: 'district_name', key: 'district_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <TierManager
        entityName="District"
        apiEndpoint="/districts"
        columns={columns}
        parentKey="city_id"
        parentEndpoint="/cities"
        parentLabel="City"
        parentNameKey="city_name"
      />
    </ProtectedRoute>
  );
}
