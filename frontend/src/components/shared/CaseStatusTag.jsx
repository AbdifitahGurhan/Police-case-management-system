// src/components/shared/CaseStatusTag.jsx
import { Tag } from 'antd';

const statusMap = {
  draft: { tone: 'neutral', label: 'Draft' },
  registered: { tone: 'open', label: 'Registered' },
  CASE_REGISTERED: { tone: 'open', label: 'Registered' },
  pending_commander_review: { tone: 'pending', label: 'Pending review' },
  returned_for_correction: { tone: 'warning', label: 'Needs revision' },
  confirmed_by_ward_commander: { tone: 'open', label: 'Approved' },
  confirmed_by_commander: { tone: 'open', label: 'Approved' },
  CONFIRMED_BY_COMMANDER: { tone: 'open', label: 'Approved' },
  under_investigation: { tone: 'pending', label: 'Under investigation' },
  referred_cid: { tone: 'open', label: 'Referred to CID' },
  referred_to_cid: { tone: 'open', label: 'Referred to CID' },
  transferred: { tone: 'neutral', label: 'Transferred' },
  reassigned: { tone: 'neutral', label: 'Reassigned' },
  ready_for_court: { tone: 'open', label: 'Ready for court' },
  forwarded_to_court: { tone: 'open', label: 'Forwarded to court' },
  referred_to_court: { tone: 'open', label: 'Referred to court' },
  approved_for_court: { tone: 'open', label: 'Approved for court' },
  court_decided: { tone: 'closed', label: 'Court decided' },
  returned_evidence: { tone: 'warning', label: 'Evidence returned' },
  rejected: { tone: 'critical', label: 'Rejected' },
  closed: { tone: 'closed', label: 'Closed' },
  dismissed: { tone: 'critical', label: 'Dismissed' },
  archived: { tone: 'neutral', label: 'Archived' },
};

const CaseStatusTag = ({ status }) => {
  const config = statusMap[status] || {
    tone: 'neutral',
    label: String(status || 'Unknown').replace(/_/g, ' '),
  };
  return (
    <Tag className={`status-tag status-tag--${config.tone}`}>
      {config.label}
    </Tag>
  );
};

export default CaseStatusTag;
