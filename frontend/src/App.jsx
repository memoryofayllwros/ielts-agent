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
import PracticeHub from "pages/PracticeHub";
import ReadingPracticePage from "pages/ReadingPracticePage";
import ListeningPracticePage from "pages/ListeningPracticePage";
import WritingPracticePage from "pages/WritingPracticePage";
import SpeakingPracticePage from "pages/SpeakingPracticePage";
import ProgressPage from "pages/ProgressPage";
import DiagnosticPage from "pages/DiagnosticPage";
import VocabTestPage from "pages/VocabTestPage";
import SkillMapPage from "pages/SkillMapPage";
import LessonsPage from "pages/LessonsPage";
import ProfilePage from "pages/ProfilePage";

const NAV_ROUTES = [
  { key: "practice", name: "Practice", icon: "school", route: "/practice", end: true },
  { key: "lessons", name: "Lessons", icon: "menu_book", route: "/lessons" },
  { key: "skillmap", name: "Skill map", icon: "hub", route: "/learning/skill-map" },
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
                  <PracticeHub />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/reading"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <ReadingPracticePage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/listening"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <ListeningPracticePage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/writing"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <WritingPracticePage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/speaking"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <SpeakingPracticePage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/diagnostic"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <DiagnosticPage />
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
        <Route
          path="/vocab"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <VocabTestPage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <LessonsPage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning/skill-map"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <SkillMapPage />
                </MainContent>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MainContent>
                  <ProfilePage />
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
