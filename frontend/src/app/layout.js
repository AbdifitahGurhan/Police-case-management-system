// src/app/layout.js
import { Inter } from "next/font/google";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: '--font-inter' 
});

export const metadata = {
  title: "Police CMS | Criminal Case Management System",
  description: "Secure Case Management System for Somalia Police Stations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AntdRegistry>
          <AuthProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
