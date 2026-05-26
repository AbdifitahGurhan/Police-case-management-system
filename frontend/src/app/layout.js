// src/app/layout.js
import { Inter } from "next/font/google";
import { App as AntdApp } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
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
    <html lang="en">
      <body className={inter.variable}>
        <AntdRegistry>
          <AntdApp>
            <AuthProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </AuthProvider>
          </AntdApp>
        </AntdRegistry>
      </body>
    </html>
  );
}
