// src/theme/theme.js
import { theme } from 'antd';

export const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563EB',
    colorInfo: '#3B82F6',
    colorSuccess: '#A8FF4D',
    colorWarning: '#EF9F27',
    colorError: '#F0997B',
    borderRadius: 8,
    fontSize: 14,
    fontWeightStrong: 500,
    colorBgBase: '#F3F8FF',
    colorBgLayout: '#DDEBFF',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorFillSecondary: 'rgba(37, 99, 235, 0.08)',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorTextPlaceholder: '#707070',
    colorBorder: '#D7E3F5',
    colorBorderSecondary: '#E6EEF9',
    boxShadow: 'none',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      bodyBg: '#DDEBFF',
      siderBg: '#0B1E45',
      headerHeight: 52,
    },
    Menu: {
      darkItemBg: '#0B1E45',
      darkItemSelectedBg: '#2563EB',
      darkItemColor: '#AFC6E8',
      darkItemHoverColor: '#FFFFFF',
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
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
      borderRadius: 8,
      colorBgContainer: '#FFFFFF',
    },
    Select: {
      borderRadius: 8,
      colorBgContainer: '#FFFFFF',
    },
    Tag: {
      borderRadiusSM: 999,
    },
  },
};

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#A8FF4D',
    colorInfo: '#A8FF4D',
    colorSuccess: '#A8FF4D',
    colorWarning: '#EF9F27',
    colorError: '#F0997B',
    borderRadius: 8,
    fontSize: 14,
    fontWeightStrong: 500,
    colorBgBase: '#0E0E0E',
    colorBgLayout: '#171717',
    colorBgContainer: '#1C1C1C',
    colorBgElevated: '#1C1C1C',
    colorFillSecondary: 'rgba(168, 255, 77, 0.08)',
    colorText: '#FFFFFF',
    colorTextSecondary: '#A5A5A5',
    colorTextTertiary: '#707070',
    colorTextPlaceholder: '#707070',
    colorBorder: '#2B2B2B',
    colorBorderSecondary: '#2B2B2B',
    boxShadow: 'none',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#171717',
      bodyBg: '#0E0E0E',
      siderBg: '#171717',
      headerHeight: 52,
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
      borderRadius: 8,
      controlHeight: 36,
      primaryShadow: 'none',
      colorPrimary: '#A8FF4D',
      colorPrimaryHover: '#b8ff66',
      colorPrimaryActive: '#98ef3c',
      colorTextLightSolid: '#0E0E0E',
    },
    Card: {
      borderRadiusLG: 12,
      headerFontSize: 14,
      colorBgContainer: '#1C1C1C',
    },
    Table: {
      headerBg: '#1C1C1C',
      headerColor: '#A5A5A5',
      rowHoverBg: '#171717',
      borderColor: '#2B2B2B',
      colorBgContainer: '#1C1C1C',
    },
    Input: {
      borderRadius: 8,
      colorBgContainer: '#171717',
      activeBorderColor: '#A8FF4D',
      hoverBorderColor: '#707070',
    },
    Select: {
      borderRadius: 8,
      colorBgContainer: '#171717',
    },
    Tag: {
      borderRadiusSM: 999,
      defaultBg: '#2B2B2B',
      defaultColor: '#A5A5A5',
    },
  },
};

export default darkTheme;
