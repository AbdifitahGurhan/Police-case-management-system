// src/app/layout.js
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import "./globals.css";
import "./dashboard-reference.css";

export const metadata = {
  title: "Somali Police Force | Case Management System",
  description: "Secure case management system for the Somali Police Force",
};

const themeInitScript = `
  (function () {
    try {
      var savedTheme = localStorage.getItem('theme');
      var theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light';
      document.documentElement.setAttribute('data-theme', theme);
    } catch (error) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="so" data-theme="light" suppressHydrationWarning>
      <body>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AntdRegistry>
          <ThemeProvider>
            <AuthProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </AuthProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
