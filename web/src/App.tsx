import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { RequireAuth } from "./RequireAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import SuiteView from "./pages/SuiteView";
import CaseEditor from "./pages/CaseEditor";
import SectionCases from "./pages/SectionCases";
import RunView from "./pages/RunView";
import CreateRun from "./pages/CreateRun";
import "./App.css";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <Projects />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <RequireAuth>
            <ProjectDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/suites/:suiteId"
        element={
          <RequireAuth>
            <SuiteView />
          </RequireAuth>
        }
      />
      <Route
        path="/sections/:sectionId/cases"
        element={
          <RequireAuth>
            <SectionCases />
          </RequireAuth>
        }
      />
      <Route
        path="/sections/:sectionId/cases/new"
        element={
          <RequireAuth>
            <CaseEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/cases/:caseId/edit"
        element={
          <RequireAuth>
            <CaseEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/suites/:suiteId/runs/new"
        element={
          <RequireAuth>
            <CreateRun />
          </RequireAuth>
        }
      />
      <Route
        path="/runs/:runId"
        element={
          <RequireAuth>
            <RunView />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
