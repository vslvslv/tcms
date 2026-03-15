import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { DialogProvider } from "./components/ui/Dialog";
import { ProjectProvider } from "./ProjectContext";
import { RequireAuth } from "./RequireAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import SuiteView from "./pages/SuiteView";
import CaseEditor from "./pages/CaseEditor";
import SectionCases from "./pages/SectionCases";
import RunView from "./pages/RunView";
import CreateRun from "./pages/CreateRun";
import MilestoneProgress from "./pages/MilestoneProgress";
import ProjectSettings from "./pages/ProjectSettings";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import CasesOverview from "./pages/cases/CasesOverview";
import CasesDetails from "./pages/cases/CasesDetails";
import CasesStatus from "./pages/cases/CasesStatus";
import CasesDefects from "./pages/cases/CasesDefects";
import RunsOverview from "./pages/runs/RunsOverview";
import CreateRunPage from "./pages/runs/CreateRunPage";
import ShareView from "./pages/ShareView";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/shares/:token" element={<ShareView />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="cases/overview" element={<CasesOverview />} />
        <Route path="cases/details" element={<CasesDetails />} />
        <Route path="cases/details/:projectId" element={<CasesDetails />} />
        <Route path="cases/status" element={<CasesStatus />} />
        <Route path="cases/defects" element={<CasesDefects />} />
        <Route path="projects/:projectId/settings" element={<ProjectSettings />} />
        <Route path="milestones/:milestoneId/progress" element={<MilestoneProgress />} />
        <Route path="suites/:suiteId" element={<SuiteView />} />
        <Route path="sections/:sectionId/cases" element={<SectionCases />} />
        <Route path="sections/:sectionId/cases/new" element={<CaseEditor />} />
        <Route path="cases/:caseId/edit" element={<CaseEditor />} />
        <Route path="suites/:suiteId/runs/new" element={<CreateRun />} />
        <Route path="runs" element={<Navigate to="/runs/overview" replace />} />
        <Route path="runs/overview" element={<RunsOverview />} />
        <Route path="runs/new" element={<CreateRunPage />} />
        <Route path="runs/:runId" element={<RunView />} />
        <Route path="runs/:runId/activity" element={<RunView />} />
        <Route path="runs/:runId/progress" element={<RunView />} />
        <Route path="runs/:runId/defects" element={<RunView />} />
        <Route path="reports" element={<Reports />} />
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <DialogProvider>
              <AppRoutes />
            </DialogProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
