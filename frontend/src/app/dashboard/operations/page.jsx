'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import OperationsCommandDashboard from '@/components/dashboard/OperationsCommandDashboard';

export default function OperationsDashboardPage() {
  const { user } = useAuth();
  return <OperationsCommandDashboard user={user} />;
}
