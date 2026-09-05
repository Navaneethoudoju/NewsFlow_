import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import RequireAuth from "./lib/RequireAuth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ArticlesListPage from "./pages/ArticlesListPage";
import ArticleNewPage from "./pages/ArticleNewPage";
import ArticleDetailPage from "./pages/ArticleDetailPage";
import ArticleEditPage from "./pages/ArticleEditPage";
import ArticleHistoryPage from "./pages/ArticleHistoryPage";
import ArticleRevisionsPage from "./pages/ArticleRevisionsPage";
import SectionsPage from "./pages/SectionsPage";
import AlertsPage from "./pages/AlertsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/articles" element={<ArticlesListPage />} />
            <Route path="/articles/new" element={<ArticleNewPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/articles/:id/edit" element={<ArticleEditPage />} />
            <Route path="/articles/:id/history" element={<ArticleHistoryPage />} />
            <Route path="/articles/:id/revisions" element={<ArticleRevisionsPage />} />

            <Route path="/sections" element={<SectionsPage />} />

            <Route
              path="/alerts"
              element={
                <RequireAuth role="EDITOR">
                  <AlertsPage />
                </RequireAuth>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
