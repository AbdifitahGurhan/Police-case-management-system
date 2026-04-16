// src/theme/theme.js
import { theme } from 'antd';

const policeTheme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#001529',
    },
    Menu: {
      darkItemBg: '#001529',
    }
  },
};

export default policeTheme;
