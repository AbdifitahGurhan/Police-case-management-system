// src/components/shared/CaseStatusTag.jsx
import React from 'react';
import { Tag } from 'antd';

const statusMap = {
  draft: { tone: 'neutral', label: 'Qabyo' },
  registered: { tone: 'open', label: 'Diiwaangashan' },
  CASE_REGISTERED: { tone: 'open', label: 'Kiis Furay' },
  pending_commander_review: { tone: 'pending', label: 'Dib u Eegis Taliye' },
  returned_for_correction: { tone: 'warning', label: 'U Baahan Sixid' },
  confirmed_by_ward_commander: { tone: 'open', label: 'La Ansixiyey' },
  confirmed_by_commander: { tone: 'open', label: 'La Ansixiyey' },
  CONFIRMED_BY_COMMANDER: { tone: 'open', label: 'La Ansixiyey' },
  under_investigation: { tone: 'pending', label: 'Baaris ku Socota' },
  referred_cid: { tone: 'pending', label: 'Loo Gudbiyey CID' },
  referred_to_cid: { tone: 'pending', label: 'Loo Gudbiyey CID' },
  transferred: { tone: 'neutral', label: 'La Wareejiyey' },
  reassigned: { tone: 'neutral', label: 'Dib loo Qoondeeyay' },
  ready_for_court: { tone: 'open', label: 'Maxkamadda loo Gudbiyey' },
  forwarded_to_court: { tone: 'open', label: 'Maxkamadda loo Gudbiyey' },
  referred_to_court: { tone: 'open', label: 'Maxkamadda loo Gudbiyey' },
  approved_for_court: { tone: 'open', label: 'Maxkamadda loo Gudbiyey' },
  court_decided: { tone: 'closed', label: 'Maxkamaddu Go\'aamisay' },
  remand_investigation: { tone: 'warning', label: 'Baaris Dheeraad ah' },
  remanded_to_investigator: { tone: 'warning', label: 'Baaris Dheeraad ah' },
  returned_from_remand: { tone: 'open', label: 'Baaris Dheeraad Soo Noqotay' },
  returned_evidence: { tone: 'warning', label: 'Caddeymo Dib loo Soo Celiyay' },
  rejected: { tone: 'critical', label: 'La Diiday' },
  closed: { tone: 'closed', label: 'La Soo Gabagabeeyay' },
  dismissed: { tone: 'critical', label: 'La Laalay' },
  archived: { tone: 'neutral', label: 'La Kaydiyey (Archived)' },
};

const CaseStatusTag = ({ status }) => {
  const config = statusMap[status] || {
    tone: 'neutral',
    label: String(status || 'Aan La Aqoon').replace(/_/g, ' '),
  };
  return (
    <Tag className={`status-tag status-tag--${config.tone}`}>
      {config.label}
    </Tag>
  );
};

export default CaseStatusTag;
