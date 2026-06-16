// src/components/shared/CaseStatusTag.jsx
import { Tag } from 'antd';

const statusMap = {
  draft: { color: 'default', label: 'DRAFT' },
  registered: { color: 'processing', label: 'REGISTERED' },
  CASE_REGISTERED: { color: 'processing', label: 'REGISTERED' },
  pending_commander_review: { color: 'processing', label: 'PENDING REVIEW' },
  returned_for_correction: { color: 'warning', label: 'NEEDS REVISION' },
  confirmed_by_ward_commander: { color: 'success', label: 'APPROVED' },
  under_investigation: { color: 'orange', label: 'UNDER INVESTIGATION' },
  referred_cid: { color: 'purple', label: 'REFERRED TO CID' },
  referred_to_cid: { color: 'purple', label: 'REFERRED TO CID' },
  transferred: { color: 'blue', label: 'TRANSFERRED' },
  reassigned: { color: 'geekblue', label: 'REASSIGNED' },
  ready_for_court: { color: 'cyan', label: 'READY FOR COURT' },
  forwarded_to_court: { color: 'cyan', label: 'FORWARDED TO COURT' },
  referred_to_court: { color: 'cyan', label: 'REFERRED TO COURT' },
  approved_for_court: { color: 'cyan', label: 'APPROVED FOR COURT' },
  court_decided: { color: 'gold', label: 'COURT DECIDED' },
  returned_evidence: { color: 'warning', label: 'EVIDENCE RETURNED' },
  rejected: { color: 'volcano', label: 'REJECTED' },
  closed: { color: 'green', label: 'CLOSED' },
  dismissed: { color: 'red', label: 'DISMISSED' },
  archived: { color: 'default', label: 'ARCHIVED' },
};

const CaseStatusTag = ({ status }) => {
  const config = statusMap[status] || { color: 'default', label: status?.toUpperCase() };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default CaseStatusTag;
