# Somali Police Force Case Management System
## Core Project Blueprint - Part 3: Frontend Architecture, Routes, Layouts, & Theme Context

This document serves as Part 3 of the comprehensive system blueprint for the Somali Police Force Case Management System, detailing page routing structures, Context API state pipelines, layouts, and custom CSS theme tokens.

---

## 4. Frontend Application Architecture

### 4.1. Router Mapping & Dynamic Directories
The React frontend uses Next.js App Router for nested directory structures:
* `src/app/login/page.jsx`: Handles user authentication inputs.
* `src/app/dashboard/`: Contains dashboard variations loaded by user role:
  * `/admin/page.jsx`: Admin KPIs, user activation tables, stations counts.
  * `/cid/page.jsx`: CID investigator queues, investigation tracks, reports.
  * `/court/page.jsx`: Court hearings tracking list, outcomes, sentences.
  * `/jail/page.jsx`: Jail registrations list, visitor logs, prisoner releases.
  * `/unit/page.jsx`: Performance charts, unit-level stats.
* `src/app/cases/`: Case grids, filters, and new case registration layouts.
* `src/app/offenders/page.jsx`: Lists criminal records and facial capture items.
* `src/app/stations/page.jsx`: Details police stations and hierarchies.
* `src/app/police-officers/page.jsx`: Roster of police officers.
* `src/app/reports/page.jsx`: Statistics, audits, and reports overview.

---

### 4.2. Context Mappings (Context API)

#### 4.2.1. Authentication Context (`AuthContext.js`)
Coordinates login tokens, payload parsing, roles assignments, and local user caching.
```javascript
// Located in /frontend/src/contexts/AuthContext.js
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  ...
};
export const useAuth = () => useContext(AuthContext);
```

#### 4.2.2. Theme Context (`ThemeContext.js`)
Manages system theme states, sets root element data attributes, and supports persistence via local storage.
```javascript
// Located in /frontend/src/contexts/ThemeContext.js
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  ...
};
export const useTheme = () => useContext(ThemeContext);
```

---

### 4.3. Base Layout & Sub-Navigation

#### 4.3.1. Main Layout Shell (`AppLayout.jsx`)
Exposes sidebar and top navbar components, wrapping the core canvas inside `<ConfigProvider>` to toggle Ant Design custom tokens:
```jsx
// Located in /frontend/src/components/layout/AppLayout.jsx
<ConfigProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
  <Layout style={{ minHeight: '100vh' }}>
    <Sidebar collapsed={collapsed} />
    <Layout>
      <TopNavbar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Content className="app-content">{children}</Content>
    </Layout>
  </Layout>
</ConfigProvider>
```

#### 4.3.2. Sidebar Component (`Sidebar.jsx`)
Determines role accessibility arrays, shows local profile badges, and filters navigation menus dynamically based on current user roles.

#### 4.3.3. Top Navbar (`TopNavbar.jsx`)
Holds header actions: notifications bell dropdown panel, profile context menus, and the new dark mode toggle switcher.

---

### 4.4. Design Tokens & Styling Customizations

#### 4.4.1. Ant Design Custom Tokens Configuration (`theme.js`)
Forms light and dark theme configurations mapping primary palettes to Ant Design's `<ConfigProvider>` context:
* **Dark Mode Custom Config**:
  ```javascript
  export const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#A8FF4D',     // Accent Lime Highlight
      colorBgBase: '#0E0E0E',      // Core Main Background
      colorBgLayout: '#171717',    // Layout Background
      colorBgContainer: '#1C1C1C', // Card & Panel Background
      colorBorder: '#2B2B2B',      // Border Lines
      colorText: '#FFFFFF',        // Primary Text
      colorTextSecondary: '#A5A5A5',
      colorTextPlaceholder: '#707070',
    }
  };
  ```

#### 4.4.2. High-Specificity Global Styling Overrides (`globals.css`)
Appends dark mode selectors under `[data-theme='dark']` to resolve CSS specificity leaks:
* **Transitions**: Smooth 200ms ease animations applied globally:
  ```css
  body, .app-content, .ant-card, .ant-table, .ant-input, .ant-btn {
    transition: background 200ms ease, border-color 200ms ease, color 200ms ease !important;
  }
  ```
* **Specific Overrides**:
  * **Card & Panel**: Target `.standard-panel` and `.standard-metric-card` to render `#1C1C1C` background and `#2B2B2B` borders with `!important`.
  * **Hero Container**: Styles `.standard-dashboard-hero` background to a dark gradient with `#171717` and `#0E0E0E` colors.
  * **Top Navbar controls**: Sets `.topbar-toggle` and `.topbar-icon-button` background to `#1C1C1C` and borders to `#2B2B2B`.
  * **Custom Side Lists**: Mapped `.standard-side-list>div` backgrounds to `#171717` and borders to `#2B2B2B`.
  * **Regular Buttons**: Overrode `.ant-btn:not(.ant-btn-primary)` with `#171717` background and `#2B2B2B` borders.
  * **Accents**: Configured `.standard-metric-green` and hover borders to `#A8FF4D` highlights.
