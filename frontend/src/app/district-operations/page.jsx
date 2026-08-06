'use client';

import { useAuth } from '@/contexts/AuthContext';
import DistrictOperationsDashboard from '@/components/dashboard/DistrictOperationsDashboard';

export default function DistrictOperationsPage() {
  const { user } = useAuth();
  return <DistrictOperationsDashboard user={user} mode="operations" />;
}
