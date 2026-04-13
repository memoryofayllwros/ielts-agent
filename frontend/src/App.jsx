import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "assets/theme";
import Sidenav from "components/Sidenav";
import DashboardLayout, { MainContent } from "components/LayoutContainers/DashboardLayout";
import { useMaterialUIController, setLayout } from "context";
import { useAuth } from "context/AuthContext";

import AuthPage from "pages/AuthPage";
import PracticePage from "pages/PracticePage";
import ProgressPage from "pages/ProgressPage";

const NAV_ROUTES = [
  { key: "practice", name: "Practice", icon: "school", route: "/practice" },
  { key: "progress", name: "Progress", icon: "bar_chart", route: "/progress" },
];

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function AppLayout() {
  const [, dispatch] = useMaterialUIController();
  const location = useLocation();
  const isAuth = location.pathname === "/login";

  useEffect(() => {
    setLayout(dispatch, isAuth ? "page" : "dashboard");
  }, [isAuth, dispatch]);

  if (isAuth) return null;

  return (
    <>
      <Sidenav routes={NAV_ROUTES} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppLayout />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/practice" replace />} />
        <Route
          path="/practice"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <PracticePage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <ProgressPage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/practice" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
