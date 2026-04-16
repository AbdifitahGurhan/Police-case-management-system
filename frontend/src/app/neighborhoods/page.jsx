'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

export default function NeighborhoodsPage() {
  const columns = [
    { title: 'Neighborhood Name', dataIndex: 'neighborhood_name', key: 'neighborhood_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin', 'region_admin', 'city_admin', 'district_admin']}>
      <TierManager
        entityName="Neighborhood"
        apiEndpoint="/neighborhoods"
        columns={columns}
        parentKey="district_id"
        parentEndpoint="/districts"
        parentLabel="District"
        parentNameKey="district_name"
      />
    </ProtectedRoute>
  );
}
