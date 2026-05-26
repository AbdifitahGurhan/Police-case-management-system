// src/theme/theme.js
import { theme } from 'antd';

const policeTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563EB',
    colorInfo: '#3B82F6',
    colorSuccess: '#20b26b',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 10,
    colorBgBase: '#F3F8FF',
    colorBgLayout: '#DDEBFF',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorFillSecondary: 'rgba(37, 99, 235, 0.08)',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorBorder: '#D7E3F5',
    colorBorderSecondary: '#E6EEF9',
    boxShadow: '0 14px 34px rgba(15, 36, 69, 0.10)',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      bodyBg: '#DDEBFF',
      siderBg: '#0B1E45',
    },
    Menu: {
      darkItemBg: '#0B1E45',
      darkItemSelectedBg: '#2563EB',
      darkItemColor: '#AFC6E8',
      darkItemHoverColor: '#FFFFFF',
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      primaryShadow: '0 12px 28px rgba(37, 99, 235, 0.34)',
    },
    Card: {
      borderRadiusLG: 10,
      headerFontSize: 14,
      colorBgContainer: '#FFFFFF',
    },
    Table: {
      headerBg: '#EEF6FF',
      headerColor: '#475569',
      rowHoverBg: '#F3F8FF',
      borderColor: '#E6EEF9',
    },
    Input: {
      borderRadius: 10,
      colorBgContainer: '#FFFFFF',
    },
    Select: {
      borderRadius: 10,
      colorBgContainer: '#FFFFFF',
    }
  },
};

export default policeTheme;
