// src/app/reports/page.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [securityAudit, setSecurityAudit] = useState(null);
  const [stationStats, setStationStats] = useState([]);
  const [stations, setStations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [custodyAnalytics, setCustodyAnalytics] = useState(null);
  const [offenders, setOffenders] = useState([]);
  const [selectedOffenderId, setSelectedOffenderId] = useState(undefined);
  const [selectedStationId, setSelectedStationId] = useState('all');
  const [selectedReportRegionId, setSelectedReportRegionId] = useState(undefined);
  const [selectedReportStationId, setSelectedReportStationId] = useState(undefined);
  const [selectedReportOfficerId, setSelectedReportOfficerId] = useState(undefined);
  const [selectedDetailTab, setSelectedDetailTab] = useState('arrests');
  const [arrestsData, setArrestsData] = useState([]);
  const [evidenceData, setEvidenceData] = useState([]);
  const [officerActivityData, setOfficerActivityData] = useState([]);
  const [officerActivitySummary, setOfficerActivitySummary] = useState({});
  const [selectedPrintableReport, setSelectedPrintableReport] = useState('station-performance');
  const [reportPreview, setReportPreview] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dateRange, setDateRange] = useState([]);
  const [dateRangeError, setDateRangeError] = useState('');

  const validateDateRange = useCallback((range, options = {}) => {
    const { required = false } = options;
    const [start, end] = range || [];
    const today = dayjs().endOf('day');

    if (!start && !end) {
      return required ? 'Please select a report date range.' : '';
    }
    if (!start || !end) {
      return 'Please select both start and end dates.';
    }
    if (start.isAfter(end, 'day')) {
      return 'Start date cannot be after end date.';
    }
    if (start.isAfter(today, 'day') || end.isAfter(today, 'day')) {
      return 'Future dates are not allowed for reports.';
    }
    return '';
  }, []);

  const handleDateRangeChange = (value) => {
    const nextRange = value || [];
    const error = validateDateRange(nextRange);
    setDateRange(nextRange);
    setDateRangeError(error);
  };

  const disabledReportDate = (current) => {
    return current && current.isAfter(dayjs().endOf('day'));
  };

  const ensureValidDateRange = (options = {}) => {
    const error = validateDateRange(dateRange, options);
    setDateRangeError(error);
    if (error) {
      message.warning(error);
      return false;
    }
    return true;
  };

  const getReportFilters = useCallback(() => {
    const params = {};
    if (dateRange?.[0] && dateRange?.[1]) {
      params.from_date = dateRange[0].format('YYYY-MM-DD');
      params.to_date = dateRange[1].format('YYYY-MM-DD');
    }
    if (selectedReportRegionId) params.region_id = selectedReportRegionId;
    if (selectedReportStationId && selectedReportStationId !== 'all') params.station_id = selectedReportStationId;
    if (selectedReportOfficerId) params.officer_id = selectedReportOfficerId;
    return params;
  }, [dateRange, selectedReportRegionId, selectedReportStationId, selectedReportOfficerId]);

  const fetchDetailedReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = getReportFilters();
      const [arrestsRes, evidenceRes, officerActivityRes] = await Promise.all([
        api.get('/reports/arrests', { params }),
        api.get('/reports/evidence-inventory', { params }),
        api.get('/reports/officer-activity', { params }),
      ]);
      setArrestsData(arrestsRes.data.data || []);
      setEvidenceData(evidenceRes.data.data || []);
      setOfficerActivityData(officerActivityRes.data.data?.actions || []);
      setOfficerActivitySummary(officerActivityRes.data.data?.summary || {});
    } catch (err) {
      console.error(err);
      message.error('Failed to load detailed reports.');
    } finally {
      setReportLoading(false);
    }
  }, [getReportFilters, message]);

  useEffect(() => {
    fetchDetailedReports();
  }, [fetchDetailedReports]);

  const fetchData = useCallback(async () => {
    if (validateDateRange(dateRange)) {
      return;
    }

    setLoading(true);
    try {
      const params = {};
      if (dateRange?.[0] && dateRange?.[1]) {
        params.from_date = dateRange[0].format('YYYY-MM-DD');
        params.to_date = dateRange[1].format('YYYY-MM-DD');
      }

      const [summaryRes, auditRes, stationRes, stationListRes, offenderRes, custodyRes, officerRes, regionRes] = await Promise.all([
        api.get('/reports/summary', { params }),
        api.get('/reports/audit-logs', { params: { ...params, limit: 8 } }),
        api.get('/reports/by-station'),
        api.get('/stations'),
        api.get('/criminals'),
        api.get('/reports/custody-analytics', { params: { year: dayjs().year() } }),
        api.get('/police-officers'),
        api.get('/regions'),
      ]);

      setStats(summaryRes.data.data);
      setAuditLogs(auditRes.data.data);
      setStationStats(stationRes.data.data);
      setStations(stationListRes.data.data || []);
      setOffenders(offenderRes.data.data || []);
      setCustodyAnalytics(custodyRes.data.data);
      setOfficers(officerRes.data.data || []);
      setRegions(regionRes.data.data || []);
      if (!selectedStationId) setSelectedStationId('all');
      if (!selectedOffenderId && offenderRes.data.data?.[0]?.id) {
        setSelectedOffenderId(offenderRes.data.data[0].id);
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, message, selectedOffenderId, selectedStationId, validateDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchSecurityAudit = async () => {
      try {
        const response = await api.get('/reports/security-audit');
        setSecurityAudit(response.data.data);
      } catch (err) {
        console.error('Failed to load security audit dashboard', err);
      }
    };

    fetchSecurityAudit();
  }, [user?.role]);

  const caseStats = stats?.caseStats || {};
  const totalCases = Number(caseStats.total_cases || 0);
  const activeCases = Number(caseStats.confirmed_active || 0) + Number(caseStats.pending_review || 0) + Number(caseStats.draft || 0);
  const closedCases = Number(caseStats.closed || 0);
  const criticalCases = Number(caseStats.critical_priority || 0);
  const evidenceCount = Number(stats?.evidenceStats?.total_evidence || 0);
  const userCount = Number(stats?.userStats?.total_users || 0);
  const closureRate = totalCases ? Math.round((closedCases / totalCases) * 100) : 0;
  const custodySummary = custodyAnalytics?.statusSummary || {};

  const topCaseTypeCount = useMemo(() => {
    return Math.max(...(stats?.byType || []).map((item) => Number(item.count || 0)), 1);
  }, [stats]);

  const printableReportOptions = [
    { value: 'offender-profile', label: 'Offender Profile Report' },
    { value: 'monthly-crime', label: 'Monthly Crime Report' },
    { value: 'repeat-offenders', label: 'Repeat Offenders Report' },
    { value: 'arrested-monthly', label: 'Monthly Arrests' },
    { value: 'wanted-persons', label: 'Wanted Persons' },
    { value: 'released-prisoners', label: 'Released Prisoners' },
    { value: 'sentence-completed', label: 'Completed Sentences' },
    { value: 'still-serving', label: 'Currently Serving' },
    { value: 'station-full', label: 'Station Full Report' },
    { value: 'station-performance', label: 'Station Performance' },
    { value: 'crime-category', label: 'Crime Categories' },
  ];

  const downloadFile = (filename, content, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExportReport = () => {
    if (!ensureValidDateRange()) return;

    const generatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const selectedRange = dateRange?.[0] && dateRange?.[1]
      ? `${dateRange[0].format('YYYY-MM-DD')} to ${dateRange[1].format('YYYY-MM-DD')}`
      : 'All dates';

    const lines = [
      ['Somali Police Force Report Export'],
      ['Generated At', generatedAt],
      ['Date Range', selectedRange],
      [],
      ['Summary'],
      ['Total Cases', totalCases],
      ['Active Cases', activeCases],
      ['Closed Cases', closedCases],
      ['Critical Cases', criticalCases],
      ['Evidence Items', evidenceCount],
      ['System Users', userCount],
      ['Closure Rate', `${closureRate}%`],
      ['Arrested People This Year', custodySummary.total_arrests || 0],
      ['Wanted Persons', custodySummary.wanted_persons || 0],
      ['Released Prisoners', custodySummary.released_prisoners || 0],
      ['Sentence Completed', custodySummary.sentence_completed || 0],
      ['Still Serving Sentence', custodySummary.still_serving || 0],
      [],
      ['Crime Type Distribution'],
      ['Case Type', 'Count'],
      ...(stats?.byType || []).map((item) => [item.case_type || 'Unknown', item.count || 0]),
      [],
      ['Unit Performance'],
      ['Unit', 'Code', 'Total Cases', 'Pending', 'Confirmed', 'Closed'],
      ...stationStats.map((row) => [
        row.station_name || '',
        row.code || '',
        row.total_cases || 0,
        row.pending_cases || 0,
        row.confirmed_cases || 0,
        row.closed_cases || 0,
      ]),
      [],
      ['Arrested People Per Month'],
      ['Month', 'Arrested People'],
      ...(custodyAnalytics?.monthlyArrests || []).map((row) => [
        dayjs().month(Number(row.month) - 1).format('MMMM'),
        row.arrested_people || 0,
      ]),
      [],
      ['Recent Audit Activity'],
      ['Time', 'User', 'Action', 'Entity'],
      ...auditLogs.map((row) => [
        row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
        row.user_email || 'System',
        row.action || '',
        row.entity_type || '',
      ]),
    ];

    const csv = lines.map((line) => line.map(csvEscape).join(',')).join('\n');
    downloadFile(`spf-report-${dayjs().format('YYYYMMDD-HHmm')}.csv`, csv, 'text/csv;charset=utf-8');
    message.success('Report exported.');
  };

  const handleExportCasesCsv = async () => {
    try {
      const response = await api.get('/reports/export/cases.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cases-export.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error('Failed to export cases CSV.');
    }
  };

  const handleIntegrityReport = () => {
    if (!ensureValidDateRange()) return;

    const payload = {
      title: 'Somali Police Force Integrity Report',
      generatedAt: dayjs().toISOString(),
      dateRange: dateRange?.[0] && dateRange?.[1]
        ? {
            from: dateRange[0].format('YYYY-MM-DD'),
            to: dateRange[1].format('YYYY-MM-DD'),
          }
        : null,
      summary: {
        totalCases,
        activeCases,
        closedCases,
        criticalCases,
        evidenceCount,
        userCount,
        closureRate,
      },
      auditSample: auditLogs.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        user: row.user_email || 'System',
        action: row.action,
        entity: row.entity_type,
      })),
      checks: [
        {
          name: 'Audit trail available',
          status: auditLogs.length > 0 ? 'pass' : 'warning',
          value: auditLogs.length,
        },
        {
          name: 'Evidence registry available',
          status: evidenceCount > 0 ? 'pass' : 'warning',
          value: evidenceCount,
        },
        {
          name: 'Case closure rate calculated',
          status: totalCases >= 0 ? 'pass' : 'warning',
          value: `${closureRate}%`,
        },
      ],
    };

    downloadFile(
      `spf-integrity-report-${dayjs().format('YYYYMMDD-HHmm')}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    message.success('Integrity report generated.');
  };

  const tableHtml = (columns, rows = []) => {
    if (!rows.length) {
      return '<p class="empty-note">No records found for this report.</p>';
    }
    return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
  };

  const openPrintableWindow = (title, subtitle, bodyHtml, autoPrint = true) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body{font-family:Arial,sans-serif;color:#111827;padding:32px}
            .header{border-bottom:3px solid #1967d2;margin-bottom:20px;padding-bottom:14px}
            h1{margin:0;font-size:24px} h2{margin:6px 0 0;color:#475467;font-size:15px;font-weight:400}
            table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
            th,td{border:1px solid #d9e2ef;padding:9px;text-align:left}
            th{background:#eef6ff;color:#12263f}
            .meta{margin-top:8px;color:#667085;font-size:12px}
            .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:18px}
            .box{border:1px solid #d9e2ef;padding:12px;border-radius:6px}
            .empty-note{color:#667085;background:#f8fbff;border:1px solid #d9e2ef;padding:12px;border-radius:6px}
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Somali Police Force - ${title}</h1>
            <h2>${subtitle}</h2>
            <div class="meta">Generated ${dayjs().format('YYYY-MM-DD HH:mm')}</div>
          </div>
          ${bodyHtml}
        </body>
      </html>
    `);
    win.document.close();
    if (autoPrint) win.print();
  };

  const showReportPreview = (title, subtitle, bodyHtml) => {
    setReportPreview({ title, subtitle, bodyHtml, generatedAt: dayjs().format('YYYY-MM-DD HH:mm') });
    message.success('Report preview generated.');
  };

  const printReportPreview = () => {
    if (!reportPreview) return;
    openPrintableWindow(reportPreview.title, reportPreview.subtitle, reportPreview.bodyHtml);
  };

  const fetchReportParams = () => {
    if (!ensureValidDateRange()) return null;

    const params = {};
    if (dateRange?.[0] && dateRange?.[1]) {
      params.from_date = dateRange[0].format('YYYY-MM-DD');
      params.to_date = dateRange[1].format('YYYY-MM-DD');
    }
    return params;
  };

  const handlePrintableReport = async (type) => {
    if (!ensureValidDateRange()) return;

    setReportLoading(true);
    try {
      if (type === 'offender-profile') {
        if (!selectedOffenderId) {
          message.warning('Select an offender first.');
          return;
        }
        const res = await api.get('/reports/offender-profile', { params: { offender_id: selectedOffenderId } });
        const { offender, cases } = res.data.data;
        showReportPreview(
          'Offender Profile Report',
          `Profile for ${offender.full_name}`,
          `
            <div class="grid">
              <div class="box"><strong>Name:</strong> ${offender.full_name}</div>
              <div class="box"><strong>Alias:</strong> ${offender.alias || 'N/A'}</div>
              <div class="box"><strong>Mother's Name:</strong> ${offender.mother_name || 'N/A'}</div>
              <div class="box"><strong>Gender:</strong> ${offender.gender || 'N/A'}</div>
              <div class="box"><strong>Age:</strong> ${offender.age || 'N/A'} ${offender.date_of_birth ? `(DOB: ${dayjs(offender.date_of_birth).format('DD/MM/YYYY')})` : ''}</div>
              <div class="box"><strong>Nationality:</strong> ${offender.nationality || 'N/A'}</div>
              <div class="box"><strong>ID Document:</strong> ${offender.id_type || 'N/A'} - ${offender.id_number || 'N/A'}</div>
              <div class="box"><strong>Phone:</strong> ${offender.phone || 'N/A'}</div>
              <div class="box"><strong>Address:</strong> ${offender.address || 'N/A'}</div>
              <div class="box"><strong>Arrest Status:</strong> ${offender.arrest_status?.toUpperCase() || (Number(offender.is_arrested) === 1 ? 'ARRESTED' : 'NOT ARRESTED')}</div>
              <div class="box" style="grid-column: span 2"><strong>Description / Profile Notes:</strong> ${offender.description || offender.profile_notes || 'N/A'}</div>
              <div class="box" style="grid-column: span 2"><strong>Linked Cases Count:</strong> ${offender.case_count || 0}</div>
            </div>
            ${tableHtml(['OB Number', 'Title', 'Category', 'Status', 'Role'], cases.map((row) => [row.ob_number, row.title, row.case_type, row.status, row.role_in_case]))}
          `
        );
      }

      if (type === 'monthly-crime') {
        const res = await api.get('/reports/monthly-crime', { params: { year: dayjs().year() } });
        showReportPreview('Monthly Crime Report', `Year ${res.data.meta.year}`, tableHtml(
          ['Month', 'Total Cases', 'High Risk', 'Closed'],
          res.data.data.map((row) => [dayjs().month(Number(row.month) - 1).format('MMMM'), row.total_cases, row.high_risk_cases, row.closed_cases])
        ));
      }

      if (type === 'repeat-offenders') {
        const res = await api.get('/reports/repeat-offenders');
        showReportPreview('Repeat Offender Report', 'Offenders linked to more than one case', tableHtml(
          ['Name', 'Alias', 'Nationality', 'Phone', 'Cases', 'Last Case'],
          res.data.data.map((row) => [row.full_name, row.alias, row.nationality, row.phone, row.case_count, row.last_case_date ? dayjs(row.last_case_date).format('YYYY-MM-DD') : ''])
        ));
      }

      if (type === 'station-full') {
        if (!selectedStationId) {
          message.warning('Dooro saldhig marka hore.');
          return;
        }

        if (selectedStationId === 'all') {
          if (!stations.length) {
            message.warning('No stations are available for this report.');
            return;
          }

          const stationReports = await Promise.all(
            stations.map((station) => api.get('/reports/station-full', { params: { station_id: station.id } }))
          );
          const reports = stationReports.map((res) => res.data.data);

          showReportPreview(
            'Complete Report for All Stations',
            `${reports.length} stations included`,
            reports.map((report) => {
              const { station, summary } = report;
              return `
                <h2>${station.station_name} (${station.station_code || 'No code'})</h2>
                <div class="grid">
                  <div class="box"><strong>State:</strong> ${station.state_name || 'N/A'}</div>
                  <div class="box"><strong>Region:</strong> ${station.region_name || 'N/A'}</div>
                  <div class="box"><strong>Commander:</strong> ${station.commander_name || 'Unassigned'}</div>
                  <div class="box"><strong>Commander Phone:</strong> ${station.commander_phone || 'N/A'}</div>
                  <div class="box"><strong>Total Cases:</strong> ${summary.total_cases || 0}</div>
                  <div class="box"><strong>Open / Closed:</strong> ${summary.open_cases || 0} / ${summary.closed_cases || 0}</div>
                  <div class="box"><strong>Waax Units:</strong> ${summary.total_waax || 0}</div>
                  <div class="box"><strong>Officers:</strong> ${summary.total_officers || 0}</div>
                  <div class="box"><strong>criminals:</strong> ${summary.total_criminals || 0}</div>
                  <div class="box"><strong>Victims:</strong> ${summary.total_victims || 0}</div>
                  <div class="box"><strong>Arrests:</strong> ${summary.total_arrests || 0}</div>
                </div>
                <h3>Waax Units</h3>
                ${tableHtml(['Waax', 'Code', 'Cases', 'criminals'], report.waaxUnits.map((row) => [row.waax_name, row.waax_code, row.total_cases, row.total_criminals]))}
                <h3>Cases</h3>
                ${tableHtml(['Case', 'OB', 'Title', 'Type', 'Status', 'Priority', 'Waax'], report.cases.map((row) => [row.case_number, row.ob_number, row.title, row.case_type || row.incident_type, row.status, row.priority, row.waax_name]))}
              `;
            }).join('<hr style="margin:28px 0;border:0;border-top:2px solid #d9e2ef" />')
          );
          return;
        }

        const res = await api.get('/reports/station-full', { params: { station_id: selectedStationId } });
        const report = res.data.data;
        const { station, summary } = report;
        showReportPreview(
          'Complete Station Report',
          `${station.station_name} - ${station.region_name || ''}`,
          `
            <div class="grid">
              <div class="box"><strong>Station:</strong> ${station.station_name}</div>
              <div class="box"><strong>Code:</strong> ${station.station_code || 'N/A'}</div>
              <div class="box"><strong>State:</strong> ${station.state_name || 'N/A'}</div>
              <div class="box"><strong>Region:</strong> ${station.region_name || 'N/A'}</div>
              <div class="box"><strong>Commander:</strong> ${station.commander_name || 'Unassigned'}</div>
              <div class="box"><strong>Commander Phone:</strong> ${station.commander_phone || 'N/A'}</div>
              <div class="box"><strong>Total Cases:</strong> ${summary.total_cases || 0}</div>
              <div class="box"><strong>Open / Closed:</strong> ${summary.open_cases || 0} / ${summary.closed_cases || 0}</div>
              <div class="box"><strong>Waax Units:</strong> ${summary.total_waax || 0}</div>
              <div class="box"><strong>Officers:</strong> ${summary.total_officers || 0}</div>
              <div class="box"><strong>criminals:</strong> ${summary.total_criminals || 0}</div>
              <div class="box"><strong>Victims:</strong> ${summary.total_victims || 0}</div>
            </div>
            <h3>Waax Units</h3>
            ${tableHtml(['Waax', 'Code', 'Cases', 'criminals'], report.waaxUnits.map((row) => [row.waax_name, row.waax_code, row.total_cases, row.total_criminals]))}
            <h3>Cases</h3>
            ${tableHtml(['Case', 'OB', 'Title', 'Type', 'Status', 'Priority', 'Waax', 'Original OB Staff'], report.cases.map((row) => [row.case_number, row.ob_number, row.title, row.case_type || row.incident_type, row.status, row.priority, row.waax_name, row.original_ob_staff_name]))}
            <h3>criminals</h3>
            ${tableHtml(['Name', 'Alias', 'Gender', 'Age', 'Phone', 'Status', 'Cases', 'OB Numbers'], report.criminals.map((row) => [row.full_name, row.alias, row.gender, row.age, row.phone, row.arrest_status, row.case_count, row.ob_numbers]))}
            <h3>Victims</h3>
            ${tableHtml(['Name', 'Gender', 'Age', 'Phone', 'OB Numbers'], report.victims.map((row) => [row.full_name, row.gender, row.age, row.phone, row.ob_numbers]))}
            <h3>Arrests</h3>
            ${tableHtml(['Suspect', 'OB', 'Case', 'Date', 'Location', 'Charges', 'Status', 'Bail'], report.arrests.map((row) => [row.suspect_name, row.ob_number, row.case_title, row.arrest_date ? dayjs(row.arrest_date).format('YYYY-MM-DD') : '', row.arrest_location, row.charges, row.sentence_status, row.bail_status]))}
            <h3>Recent Activity</h3>
            ${tableHtml(['Time', 'OB', 'Action', 'By', 'Description'], report.activities.map((row) => [row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : '', row.ob_number, row.action_type, row.performed_by, row.description]))}
          `
        );
      }

      if (type === 'station-performance') {
        const res = await api.get('/reports/station-performance');
        showReportPreview('Station Performance Report', 'Cases by station/unit', tableHtml(
          ['Station', 'Code', 'Total', 'Pending', 'Confirmed', 'Closed'],
          res.data.data.map((row) => [row.station_name, row.code, row.total_cases, row.pending_cases, row.confirmed_cases, row.closed_cases])
        ));
      }

      if (type === 'crime-category') {
        const params = fetchReportParams();
        if (!params) return;
        const res = await api.get('/reports/crime-category', { params });
        showReportPreview('Crime Category Report', 'Case categories and linked offenders', tableHtml(
          ['Category', 'Total Cases', 'Critical Cases', 'Closed Cases', 'Linked Offenders'],
          res.data.data.map((row) => [row.case_type, row.total_cases, row.critical_cases, row.closed_cases, row.linked_offenders])
        ));
      }

      if (type === 'arrested-monthly') {
        const res = await api.get('/reports/custody-analytics', { params: { year: dayjs().year() } });
        showReportPreview('Arrested People Per Month', `Year ${res.data.data.meta.year}`, tableHtml(
          ['Month', 'Arrested People'],
          res.data.data.monthlyArrests.map((row) => [dayjs().month(Number(row.month) - 1).format('MMMM'), row.arrested_people])
        ));
      }

      if (type === 'wanted-persons') {
        const res = await api.get('/reports/custody-analytics', { params: { year: dayjs().year() } });
        showReportPreview('Wanted Persons Report', 'People currently marked wanted', tableHtml(
          ['Name', 'OB Number', 'Station', 'Charges', 'Status'],
          res.data.data.wantedPersons.map((row) => [row.full_name, row.ob_number, row.station_name, row.charges, row.sentence_status])
        ));
      }

      if (type === 'released-prisoners') {
        const res = await api.get('/reports/custody-analytics', { params: { year: dayjs().year() } });
        showReportPreview('Released Prisoners Report', 'Prisoners marked released', tableHtml(
          ['Name', 'OB Number', 'Station', 'Released Date', 'Final Status'],
          res.data.data.releasedPrisoners.map((row) => [row.full_name, row.ob_number, row.station_name, row.actual_release_date || '', row.final_status || ''])
        ));
      }

      if (type === 'sentence-completed') {
        const res = await api.get('/reports/custody-analytics', { params: { year: dayjs().year() } });
        showReportPreview('Completed Sentence Report', 'Prisoners whose sentence period is completed', tableHtml(
          ['Name', 'OB Number', 'Station', 'Expected Release', 'Status'],
          res.data.data.sentenceCompleted.map((row) => [row.full_name, row.ob_number, row.station_name, row.expected_release_date || '', row.sentence_status])
        ));
      }

      if (type === 'still-serving') {
        const res = await api.get('/reports/custody-analytics', { params: { year: dayjs().year() } });
        showReportPreview('Still Serving Sentence Report', 'Prisoners currently serving sentence', tableHtml(
          ['Name', 'OB Number', 'Station', 'Sentence Start', 'Expected Release'],
          res.data.data.stillServing.map((row) => [row.full_name, row.ob_number, row.station_name, row.sentence_start_date || '', row.expected_release_date || ''])
        ));
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to generate printable report.');
    } finally {
      setReportLoading(false);
    }
  };

  const auditColumns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 130,
      render: (date) => dayjs(date).format('DD MMM HH:mm'),
    },
    {
      title: 'User',
      dataIndex: 'user_email',
      ellipsis: true,
      render: (value) => value || 'System',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (action) => <Tag color="blue">{action}</Tag>,
    },
    {
      title: 'Entity',
      dataIndex: 'entity_type',
      render: (entity) => <Text type="secondary">{entity || 'N/A'}</Text>,
    },
  ];

  const stationColumns = [
    {
      title: 'Unit',
      dataIndex: 'station_name',
      render: (name, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.code}</Text>
        </Space>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total_cases',
      align: 'center',
      render: (value) => <Text strong>{value || 0}</Text>,
    },
    {
      title: 'Pending',
      dataIndex: 'pending_cases',
      align: 'center',
      render: (value) => <Tag color={value > 0 ? 'gold' : 'default'}>{value || 0}</Tag>,
    },
    {
      title: 'Confirmed',
      dataIndex: 'confirmed_cases',
      align: 'center',
      render: (value) => <Tag color="blue">{value || 0}</Tag>,
    },
    {
      title: 'Closed',
      dataIndex: 'closed_cases',
      align: 'center',
      render: (value) => <Tag color="green">{value || 0}</Tag>,
    },
  ];

  const arrestsColumns = [
    {
      title: 'Date',
      dataIndex: 'arrest_date',
      render: (value) => value ? dayjs(value).format('YYYY-MM-DD') : 'N/A',
    },
    {
      title: 'Station',
      dataIndex: 'station_name',
    },
    {
      title: 'Suspect',
      dataIndex: 'suspect_name',
    },
    {
      title: 'Case OB',
      dataIndex: 'ob_number',
    },
    {
      title: 'Charges',
      dataIndex: 'charges',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'sentence_status',
      render: (value) => <Tag color="blue">{value || 'N/A'}</Tag>,
    },
    {
      title: 'Arresting Officer',
      dataIndex: 'arresting_officer',
    },
  ];

  const evidenceColumns = [
    {
      title: 'Evidence #',
      dataIndex: 'evidence_number',
      render: (value) => value || 'N/A',
    },
    {
      title: 'Description',
      dataIndex: 'item_description',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'evidence_type',
      render: (value) => <Tag>{value || 'N/A'}</Tag>,
    },
    {
      title: 'Found At',
      dataIndex: 'storage_location',
      ellipsis: true,
    },
    {
      title: 'Collected By',
      dataIndex: 'collected_by',
    },
    {
      title: 'Status',
      dataIndex: 'status',
    },
    {
      title: 'Recorded',
      dataIndex: 'collection_date',
      render: (value) => value ? dayjs(value).format('YYYY-MM-DD') : 'N/A',
    },
  ];

  const activityColumns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : 'N/A',
    },
    {
      title: 'Case OB',
      dataIndex: 'ob_number',
    },
    {
      title: 'Action',
      dataIndex: 'action_type',
    },
    {
      title: 'Officer',
      dataIndex: 'officer_name',
      render: (_, row) => row.officer_name || row.performed_by || 'N/A',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
  ];

  const prisonerColumns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      render: (value, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.ob_number}</Text>
        </Space>
      ),
    },
    { title: 'Station', dataIndex: 'station_name' },
    { title: 'Status', dataIndex: 'sentence_status', render: (value) => <Tag color="blue">{value}</Tag> },
    { title: 'Expected Release', dataIndex: 'expected_release_date', render: (value) => value || 'N/A' },
  ];

  const renderDataTable = ({ columns, dataSource = [], rowKey, loading: tableLoading = loading, ...props }) => {
    if (!tableLoading && dataSource.length === 0) {
      return <Text type="secondary">No records found.</Text>;
    }
    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        pagination={false}
        loading={tableLoading}
        size="middle"
        scroll={{ x: 'max-content' }}
        {...props}
      />
    );
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin', 'officer', 'cid', 'court', 'jail', 'district_admin', 'neighborhood_admin']}>
      <div className="reports-page">
        <div className="reports-hero">
          <div>
            <Text className="dashboard-eyebrow">Analytics Center</Text>
            <Title level={2}>Reports & Monitoring</Title>
            <Text type="secondary">Reports on cases, evidence, stations, and user activity.</Text>
          </div>
          <Space wrap>
            <Space orientation="vertical" size={4}>
              <RangePicker
                value={dateRange}
                status={dateRangeError ? 'error' : undefined}
                disabledDate={disabledReportDate}
                onChange={handleDateRangeChange}
                allowClear
              />
              {dateRangeError && <Text type="danger">{dateRangeError}</Text>}
            </Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportReport} loading={loading}>Export</Button>
            {user?.role === 'admin' && (
              <Button icon={<DownloadOutlined />} onClick={handleExportCasesCsv}>Cases CSV</Button>
            )}
            <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={handleIntegrityReport} loading={loading}>
              Integrity Report
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card variant="none" className="report-panel" title="Printable Reports" extra={<FileTextOutlined />}>
              <Space wrap align="center">
                <Select
                  value={selectedPrintableReport}
                  onChange={setSelectedPrintableReport}
                  style={{ minWidth: 300 }}
                  options={printableReportOptions}
                />
                {selectedPrintableReport === 'offender-profile' && (
                  <Select
                    placeholder="Select offender"
                    value={selectedOffenderId}
                    onChange={setSelectedOffenderId}
                    style={{ minWidth: 260 }}
                    showSearch
                    optionFilterProp="label"
                    options={offenders.map((item) => ({ value: item.id, label: `${item.full_name} (${item.case_count || 0} cases)` }))}
                  />
                )}
                {selectedPrintableReport === 'station-full' && (
                  <Select
                    placeholder="Dooro saldhig"
                    value={selectedStationId}
                    onChange={setSelectedStationId}
                    style={{ minWidth: 260 }}
                    showSearch
                    optionFilterProp="label"
                    options={[
                      { value: 'all', label: 'Dhammaan saldhigyada' },
                      ...stations.map((item) => ({ value: item.id, label: `${item.name} (${item.code || 'No code'})` })),
                    ]}
                  />
                )}
                <Button
                  type="primary"
                  loading={reportLoading}
                  icon={<FileTextOutlined />}
                  onClick={() => handlePrintableReport(selectedPrintableReport)}
                >
                  Show Report
                </Button>
              </Space>
            </Card>
          </Col>

          {reportPreview && (
            <Col xs={24}>
              <Card
                variant="none"
                className="report-panel"
                title={reportPreview.title}
                extra={(
                  <Button type="primary" icon={<PrinterOutlined />} onClick={printReportPreview}>
                    Print Report
                  </Button>
                )}
              >
                <Text type="secondary">{reportPreview.subtitle} - Generated {reportPreview.generatedAt}</Text>
                <div className="print-report-preview" dangerouslySetInnerHTML={{ __html: reportPreview.bodyHtml }} />
              </Card>
            </Col>
          )}

          <Col xs={24}>
            <Card variant="none" className="report-panel" title="Detailed Operational Reports">
              <Space wrap align="center" style={{ width: '100%', marginBottom: 16 }}>
                <Select
                  placeholder="Filter by region"
                  value={selectedReportRegionId}
                  onChange={setSelectedReportRegionId}
                  style={{ minWidth: 220 }}
                  allowClear
                  options={regions.map((item) => ({ value: item.id, label: item.region_name || item.name || item.region }))}
                />
                <Select
                  placeholder="Filter by station"
                  value={selectedReportStationId}
                  onChange={setSelectedReportStationId}
                  style={{ minWidth: 220 }}
                  allowClear
                  options={[
                    { value: 'all', label: 'All Stations' },
                    ...stations.map((item) => ({ value: item.id, label: `${item.name || item.district_name || 'Station'}${item.code ? ` (${item.code})` : ''}` })),
                  ]}
                />
                <Select
                  placeholder="Filter by officer"
                  value={selectedReportOfficerId}
                  onChange={setSelectedReportOfficerId}
                  style={{ minWidth: 220 }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={officers.map((item) => ({ value: item.id, label: `${item.full_name || item.name || item.username}` }))}
                />
                <Button type="primary" onClick={fetchDetailedReports} loading={reportLoading}>Refresh</Button>
              </Space>
              <Tabs
                activeKey={selectedDetailTab}
                onChange={setSelectedDetailTab}
                items={[
                  {
                    key: 'arrests',
                    label: 'Arrests',
                    children: renderDataTable({
                      columns: arrestsColumns,
                      dataSource: arrestsData,
                      rowKey: 'id',
                      loading: reportLoading,
                    }),
                  },
                  {
                    key: 'evidence',
                    label: 'Evidence Inventory',
                    children: renderDataTable({
                      columns: evidenceColumns,
                      dataSource: evidenceData,
                      rowKey: 'id',
                      loading: reportLoading,
                    }),
                  },
                  {
                    key: 'officer-activity',
                    label: 'Officer Activity',
                    children: (
                      <>
                        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                          <Col xs={24} sm={8}>
                            <Card variant="none" className="report-kpi-card">
                              <Statistic title="Total Actions" value={officerActivitySummary.total_actions || 0} loading={reportLoading} />
                            </Card>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Card variant="none" className="report-kpi-card">
                              <Statistic title="Unique Cases" value={officerActivitySummary.unique_cases || 0} loading={reportLoading} />
                            </Card>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Card variant="none" className="report-kpi-card">
                              <Statistic title="Arrests Made" value={officerActivitySummary.arrests_made || 0} loading={reportLoading} />
                            </Card>
                          </Col>
                        </Row>
                        {renderDataTable({
                          columns: activityColumns,
                          dataSource: officerActivityData,
                          rowKey: 'id',
                          loading: reportLoading,
                        })}
                      </>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon blue"><FileSearchOutlined /></div>
              <Statistic title="Total Cases" value={totalCases} loading={loading} />
              <Text type="secondary">{activeCases} active workflows</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon red"><ExclamationCircleOutlined /></div>
              <Statistic title="Critical Cases" value={criticalCases} loading={loading} />
              <Text type="secondary">High attention queue</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon green"><CheckCircleOutlined /></div>
              <Statistic title="Closure Rate" value={closureRate} suffix="%" loading={loading} />
              <Progress percent={closureRate} showInfo={false} size="small" strokeColor="#20b26b" />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon purple"><DatabaseOutlined /></div>
              <Statistic title="Evidence Items" value={evidenceCount} loading={loading} />
              <Text type="secondary">{userCount} active system users</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon blue"><TeamOutlined /></div>
              <Statistic title="Arrested People" value={Number(custodySummary.total_arrests || 0)} loading={loading} />
              <Text type="secondary">Recorded arrest files</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon red"><ExclamationCircleOutlined /></div>
              <Statistic title="Wanted Persons" value={Number(custodySummary.wanted_persons || 0)} loading={loading} />
              <Text type="secondary">Marked wanted</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon green"><CheckCircleOutlined /></div>
              <Statistic title="Released Prisoners" value={Number(custodySummary.released_prisoners || 0)} loading={loading} />
              <Text type="secondary">Released from custody</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="none" className="report-kpi-card">
              <div className="report-kpi-icon purple"><SafetyCertificateOutlined /></div>
              <Statistic title="Still Serving" value={Number(custodySummary.still_serving || 0)} loading={loading} />
              <Text type="secondary">{Number(custodySummary.sentence_completed || 0)} completed sentence</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <Card variant="none" className="report-panel" title="Arrested People Per Month" extra={<BarChartOutlined />}>
              {renderDataTable({
                columns: [
                  { title: 'Month', dataIndex: 'month', render: (value) => dayjs().month(Number(value) - 1).format('MMMM') },
                  { title: 'Arrested People', dataIndex: 'arrested_people', align: 'center', render: (value) => <Text strong>{value || 0}</Text> },
                ],
                dataSource: custodyAnalytics?.monthlyArrests || [],
                rowKey: 'month',
              })}
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card variant="none" className="report-panel" title="Wanted Persons" extra={<ExclamationCircleOutlined />}>
              {renderDataTable({ columns: prisonerColumns, dataSource: custodyAnalytics?.wantedPersons || [], rowKey: 'arrest_id' })}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <Card variant="none" className="report-panel" title="Crime Type Distribution" extra={<BarChartOutlined />}>
              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                {(stats?.byType || []).length === 0 && <Text type="secondary">No case categories found.</Text>}
                {(stats?.byType || []).map((item) => {
                  const value = Number(item.count || 0);
                  const percent = Math.round((value / topCaseTypeCount) * 100);
                  return (
                    <div className="case-type-row" key={item.case_type || 'Unknown'}>
                      <div>
                        <Text strong>{item.case_type || 'Unknown'}</Text>
                        <Text type="secondary">{value} case{value === 1 ? '' : 's'}</Text>
                      </div>
                      <Progress percent={percent} showInfo={false} strokeColor="#1967d2" />
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card variant="none" className="report-panel" title="Unit Performance" extra={<TeamOutlined />}>
              {renderDataTable({ columns: stationColumns, dataSource: stationStats, rowKey: 'station_name' })}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card variant="none" className="report-panel" title="Sentence Completed" extra={<CheckCircleOutlined />}>
              {renderDataTable({ columns: prisonerColumns, dataSource: custodyAnalytics?.sentenceCompleted || [], rowKey: 'arrest_id' })}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card variant="none" className="report-panel" title="Still Serving Sentence" extra={<SafetyCertificateOutlined />}>
              {renderDataTable({ columns: prisonerColumns, dataSource: custodyAnalytics?.stillServing || [], rowKey: 'arrest_id' })}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card variant="none" className="report-panel report-health-card" title="System Health">
              <div className="health-ring">
                <Progress type="circle" percent={closureRate} size={132} strokeColor="#1967d2" />
              </div>
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                <div className="health-row">
                  <span>Closed cases</span>
                  <strong>{closedCases}</strong>
                </div>
                <div className="health-row">
                  <span>Active cases</span>
                  <strong>{activeCases}</strong>
                </div>
                <div className="health-row">
                  <span>Evidence records</span>
                  <strong>{evidenceCount}</strong>
                </div>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card variant="none" className="report-panel" title="Recent Audit Activity" extra={<AuditOutlined />}>
              {renderDataTable({ columns: auditColumns, dataSource: auditLogs, rowKey: (row) => `${row.id}-${row.created_at}` })}
            </Card>
          </Col>
        </Row>

        {user?.role === 'admin' && securityAudit && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={8}>
              <Card variant="none" className="report-panel" title="Security Summary">
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Statistic title="Successful Logins" value={securityAudit.summary?.successful_logins || 0} />
                  <Statistic title="Failed Logins" value={securityAudit.summary?.failed_logins || 0} />
                  <Statistic title="Case Changes" value={securityAudit.summary?.case_changes || 0} />
                  <Statistic title="Evidence Changes" value={securityAudit.summary?.evidence_changes || 0} />
                </Space>
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card variant="none" className="report-panel" title="Login Attempts">
                {renderDataTable({
                  columns: [
                    { title: 'Time', dataIndex: 'created_at', render: (value) => value ? dayjs(value).format('DD MMM YYYY HH:mm') : 'N/A' },
                    { title: 'Username', dataIndex: 'username' },
                    { title: 'Status', dataIndex: 'success', render: (value) => <Tag color={value ? 'green' : 'red'}>{value ? 'SUCCESS' : 'FAILED'}</Tag> },
                    { title: 'Reason', dataIndex: 'failure_reason', render: (value) => value || 'N/A' },
                    { title: 'IP Address', dataIndex: 'ip_address' },
                  ],
                  dataSource: securityAudit.logins || [],
                  rowKey: (row) => `login-${row.id}`,
                })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card variant="none" className="report-panel" title="Case Change Audit">
                {renderDataTable({ columns: auditColumns, dataSource: securityAudit.caseChanges || [], rowKey: (row) => `case-audit-${row.id}` })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card variant="none" className="report-panel" title="Evidence Change Audit">
                {renderDataTable({ columns: auditColumns, dataSource: securityAudit.evidenceChanges || [], rowKey: (row) => `evidence-audit-${row.id}` })}
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </ProtectedRoute>
  );
}
