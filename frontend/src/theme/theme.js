// src/theme/theme.js
import { theme } from 'antd';

export const lightTheme = {
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

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#A8FF4D',
    colorInfo: '#A8FF4D',
    colorSuccess: '#A8FF4D',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 10,
    colorBgBase: '#0E0E0E',
    colorBgLayout: '#171717',
    colorBgContainer: '#1C1C1C',
    colorBgElevated: '#1C1C1C',
    colorFillSecondary: 'rgba(168, 255, 77, 0.08)',
    colorText: '#FFFFFF',
    colorTextSecondary: '#A5A5A5',
    colorTextTertiary: '#707070',
    colorBorder: '#2B2B2B',
    colorBorderSecondary: '#2B2B2B',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.65)',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      bodyBg: '#171717',
      siderBg: '#171717',
    },
    Menu: {
      darkItemBg: '#171717',
      darkItemSelectedBg: 'rgba(168, 255, 77, 0.12)',
      darkItemColor: '#A5A5A5',
      darkItemHoverColor: '#FFFFFF',
      darkItemSelectedColor: '#A8FF4D',
      itemActiveBg: 'rgba(168, 255, 77, 0.08)',
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      primaryShadow: '0 12px 28px rgba(168, 255, 77, 0.15)',
      colorPrimary: '#A8FF4D',
      colorPrimaryHover: '#b8ff66',
      colorPrimaryActive: '#98ef3c',
      colorTextLightSolid: '#0E0E0E',
    },
    Card: {
      borderRadiusLG: 10,
      headerFontSize: 14,
      colorBgContainer: '#1C1C1C',
    },
    Table: {
      headerBg: '#171717',
      headerColor: '#A5A5A5',
      rowHoverBg: '#1C1C1C',
      borderColor: '#2B2B2B',
    },
    Input: {
      borderRadius: 10,
      colorBgContainer: '#1C1C1C',
    },
    Select: {
      borderRadius: 10,
      colorBgContainer: '#1C1C1C',
    }
  },
};

export default lightTheme;
