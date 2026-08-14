// src/app/layout.js
import { App as AntdApp } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import NotificationBridge from '@/components/shared/NotificationBridge';
import "./globals.css";
import "./dashboard-reference.css";

export const metadata = {
  title: "Somali Police Force | Case Management System",
  description: "Secure case management system for the Somali Police Force",
};

export default function RootLayout({ children }) {
  return (
    <html lang="so" data-theme="light">
      <body>
        <AntdRegistry>
          <AntdApp>
            <NotificationBridge />
            <ThemeProvider>
              <AuthProvider>
                <AppLayout>
                  {children}
                </AppLayout>
              </AuthProvider>
            </ThemeProvider>
          </AntdApp>
        </AntdRegistry>
      </body>
    </html>
  );
}
