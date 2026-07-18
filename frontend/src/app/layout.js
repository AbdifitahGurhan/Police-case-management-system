// src/app/layout.js
import { Inter } from "next/font/google";
import { App as AntdApp } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import NotificationBridge from '@/components/shared/NotificationBridge';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter'
});

export const metadata = {
  title: "Somali Police Force | Case Management System",
  description: "Secure case management system for the Somali Police Force",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={inter.variable}>
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
