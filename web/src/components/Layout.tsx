import { useEffect, useState, useCallback } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { LayoutDashboard, ListTodo, FolderOpen, FlaskConical, Flag, BarChart2, ChevronRight, Shield, Menu, X, Sun, Moon } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useProject } from "../ProjectContext";
import { useTheme } from "../ThemeContext";
import { api, type Project } from "../api";
import { Dropdown, DropdownItem } from "./ui/Dropdown";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";

const iconSize = 18;

type NavSection = "cases" | "runs" | "milestones";

type ProjectRunSummary = { id: string; isCompleted: boolean };

function SidebarNav({
  location,
  onNavigate,
  projectId,
}: {
  location: ReturnType<typeof useLocation>;
  onNavigate: () => void;
  projectId: string | null;
}) {
  const path = location.pathname;
  const params = useParams();
  const runId = params.runId ?? null;
  const isRunsOverview = path === "/runs/overview" || path === "/runs";
  const isRunDetail = runId != null && path.startsWith("/runs/");
  const [expanded, setExpanded] = useState<NavSection | null>(() => {
    if (path.startsWith("/projects") && !path.includes("/settings")) return "cases";
    if (path.startsWith("/runs")) return "runs";
    if (path.startsWith("/milestones")) return "milestones";
    return null;
  });
  const [projectRuns, setProjectRuns] = useState<ProjectRunSummary[]>([]);
  const [runsSummaryLoading, setRunsSummaryLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("none");
  const [orderBy, setOrderBy] = useState<string>("date");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (path.startsWith("/projects") && !path.includes("/settings") || path.startsWith("/cases/")) setExpanded("cases");
    else if (path.startsWith("/runs")) setExpanded("runs");
    else if (path.startsWith("/milestones")) setExpanded("milestones");
  }, [path]);

  useEffect(() => {
    if (!projectId || !isRunsOverview) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunsSummaryLoading(true);
    api<ProjectRunSummary[]>(`/api/projects/${projectId}/runs?limit=500`)
      .then((list) => setProjectRuns(list))
      .catch(() => setProjectRuns([]))
      .finally(() => setRunsSummaryLoading(false));
  }, [projectId, isRunsOverview]);

  const openCount = projectRuns.filter((r) => !r.isCompleted).length;
  const completedCount = projectRuns.filter((r) => r.isCompleted).length;

  const subLinkClass = (active: boolean) =>
    `block rounded py-1.5 pl-8 pr-3 text-sm no-underline transition-colors duration-150 ${active ? "font-medium text-primary bg-primary/10" : "text-muted hover:bg-surface-raised hover:text-text"}`;

  const toggle = (section: NavSection) => setExpanded((s) => (s === section ? null : section));

  const isProjectOverview = projectId != null && path === `/projects/${projectId}`;

  return (
    <nav className="mt-2 flex flex-col px-0">
      {projectId && (
        <Link
          to={`/projects/${projectId}`}
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm no-underline transition-colors duration-150 ${isProjectOverview ? "font-semibold text-text bg-surface-raised" : "text-muted hover:bg-surface-raised hover:text-text"}`}
        >
          <LayoutDashboard size={iconSize} className="shrink-0" />
          Overview
        </Link>
      )}
      <span className="flex items-center gap-2 rounded px-3 py-2 text-sm text-muted/50 cursor-not-allowed" aria-disabled="true" title="To Do is being refactored">
        <ListTodo size={iconSize} className="shrink-0" />
        To Do
      </span>

      {/* Cases — sub-menu */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("cases")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors duration-150 ${(path.startsWith("/projects") && !path.includes("/settings")) || path.startsWith("/cases/") ? "font-semibold text-text bg-surface-raised" : "text-muted hover:bg-surface-raised hover:text-text"}`}
          aria-expanded={expanded === "cases"}
        >
          <span className="flex items-center gap-2">
            <FolderOpen size={iconSize} className="shrink-0" />
            Cases
          </span>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${expanded === "cases" ? "rotate-90" : ""}`} />
        </button>
        {expanded === "cases" && (
          <div className="mb-1 flex flex-col">
            <Link to="/cases/overview" onClick={onNavigate} className={subLinkClass(path === "/cases/overview")} data-testid="nav-cases-overview">
              Overview
            </Link>
            <Link to={path.startsWith("/cases/details") ? path : "/cases/details"} onClick={onNavigate} className={subLinkClass(path.startsWith("/cases/details"))}>
              Details
            </Link>
            <Link to="/cases/status" onClick={onNavigate} className={subLinkClass(path === "/cases/status")}>
              Status
            </Link>
            <Link to="/cases/defects" onClick={onNavigate} className={subLinkClass(path === "/cases/defects")}>
              Defects
            </Link>
          </div>
        )}
      </div>

      {/* Test Runs & Results — sub-menu */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("runs")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors duration-150 ${path.startsWith("/runs") ? "font-semibold text-text bg-surface-raised" : "text-muted hover:bg-surface-raised hover:text-text"}`}
          aria-expanded={expanded === "runs"}
        >
          <span className="flex items-center gap-2">
            <FlaskConical size={iconSize} className="shrink-0" />
            Test Runs &amp; Results
          </span>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${expanded === "runs" ? "rotate-90" : ""}`} />
        </button>
        {expanded === "runs" && (
          <div className="mb-1 flex flex-col">
            <Link to="/runs/overview" onClick={onNavigate} className={subLinkClass(isRunsOverview)} data-testid="nav-runs-overview">
              Overview
            </Link>
            {isRunDetail && (
              <>
                <Link to={`/runs/${runId}`} onClick={onNavigate} className={subLinkClass(path === `/runs/${runId}` && !path.includes("/activity") && !path.includes("/progress") && !path.includes("/defects"))} data-testid="run-view-tests-tab">
                  Tests &amp; Results
                </Link>
                <Link to={`/runs/${runId}/activity`} onClick={onNavigate} className={subLinkClass(path.includes("/activity"))}>
                  Activity
                </Link>
                <Link to={`/runs/${runId}/progress`} onClick={onNavigate} className={subLinkClass(path.includes("/progress"))}>
                  Progress
                </Link>
                <Link to={`/runs/${runId}/defects`} onClick={onNavigate} className={subLinkClass(path.includes("/defects"))}>
                  Defects
                </Link>
              </>
            )}
            {isRunsOverview && (
              <div className="mt-2 space-y-2 border-t border-border pt-2">
                <div className="flex flex-col gap-1.5">
                  <Link to="/runs/new" onClick={onNavigate}>
                    <Button variant="primary" className="w-full justify-center text-sm">+ Add Test Run</Button>
                  </Link>
                  <Link to={projectId ? `/projects/${projectId}` : "/projects"} onClick={onNavigate}>
                    <Button variant="secondary" className="w-full justify-center text-sm">+ Add Test Plan</Button>
                  </Link>
                </div>
                {!runsSummaryLoading && (openCount > 0 || completedCount > 0) && (
                  <p className="px-2 text-xs text-muted">
                    {openCount} open and {completedCount} completed test run{openCount + completedCount !== 1 ? "s" : ""} in this project.
                  </p>
                )}
                <div className="space-y-1 px-2">
                  <label className="block text-xs text-muted">Group By</label>
                  <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-full text-sm">
                    <option value="none">None</option>
                    <option value="milestone">Milestone</option>
                  </Select>
                </div>
                <div className="space-y-1 px-2">
                  <label className="block text-xs text-muted">Order By</label>
                  <Select value={orderBy} onChange={(e) => setOrderBy(e.target.value)} className="w-full text-sm">
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Milestones — sub-menu */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("milestones")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors duration-150 ${path.startsWith("/milestones") ? "font-semibold text-text bg-surface-raised" : "text-muted hover:bg-surface-raised hover:text-text"}`}
          aria-expanded={expanded === "milestones"}
        >
          <span className="flex items-center gap-2">
            <Flag size={iconSize} className="shrink-0" />
            Milestones
          </span>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${expanded === "milestones" ? "rotate-90" : ""}`} />
        </button>
        {expanded === "milestones" && (
          <div className="mb-1 flex flex-col">
            <Link to="/projects" onClick={onNavigate} className={subLinkClass(false)}>
              Overview
            </Link>
            <Link to="/projects" onClick={onNavigate} className={subLinkClass(false)}>
              Details
            </Link>
            <Link to="/reports" onClick={onNavigate} className={subLinkClass(path === "/reports")}>
              Status
            </Link>
            <Link to="/reports" onClick={onNavigate} className={subLinkClass(false)}>
              Defects
            </Link>
          </div>
        )}
      </div>

      <Link to="/reports" onClick={onNavigate} className={`flex items-center gap-2 rounded px-3 py-2 text-sm no-underline transition-colors duration-150 ${path === "/reports" ? "font-semibold text-text bg-surface-raised" : "text-muted hover:bg-surface-raised hover:text-text"}`}>
        <BarChart2 size={iconSize} className="shrink-0" />
        Reports
      </Link>
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { projectId, setProjectId } = useProject();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeProjectId = params.projectId ?? null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showSidebar = projectId != null;

  useEffect(() => {
    if (routeProjectId) setProjectId(routeProjectId);
  }, [routeProjectId, setProjectId]);

  useEffect(() => {
    const path = location.pathname;
    if (path === "/dashboard" || path === "/projects") setProjectId(null);
  }, [location.pathname, setProjectId]);

  useEffect(() => {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setUserMenuOpen(false);
    setProjectSwitcherOpen(false);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAllDropdowns();
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeAllDropdowns]);

  const currentProject = projectId ? projects.find((p) => p.id === projectId) : null;

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-4">
          {showSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded border border-border bg-surface-raised text-text hover:bg-surface transition-colors duration-150"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          <Link to="/dashboard" className="flex items-center gap-2 font-mono font-bold text-text no-underline hover:text-primary transition-colors duration-150">
            <Shield size={20} className="text-primary" />
            TCMS
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-border bg-surface-raised text-muted hover:text-text hover:bg-surface transition-colors duration-150"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Dropdown
            trigger={<>{user?.name ?? user?.email ?? "User"}</>}
            align="right"
            open={userMenuOpen}
            onOpenChange={(open) => { setUserMenuOpen(open); if (open) { setProjectSwitcherOpen(false); } }}
          >
            <DropdownItem onClick={() => { setUserMenuOpen(false); navigate("/profile"); }}>Profile</DropdownItem>
            <DropdownItem onClick={() => { setUserMenuOpen(false); navigate("/tokens"); }}>API Tokens</DropdownItem>
            <DropdownItem onClick={() => { setUserMenuOpen(false); navigate("/notifications"); }}>Notifications</DropdownItem>
            <DropdownItem onClick={() => { setUserMenuOpen(false); logout(); }}>Log out</DropdownItem>
          </Dropdown>
        </div>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        {showSidebar && (
          <>
            <aside
              className={`fixed left-0 top-12 z-30 flex h-[calc(100vh-3rem)] w-52 flex-col overflow-y-auto border-r border-border bg-surface md:relative md:top-0 md:h-auto md:z-auto md:shrink-0 ${
                sidebarOpen ? "block" : "hidden md:flex"
              }`}
              aria-label="Main navigation"
              data-testid="sidebar-nav"
            >
              {/* Project switcher */}
              <div className="border-b border-border p-3 pb-3" data-testid="project-switcher">
                <div className="mb-1 text-xs font-medium text-muted">Project</div>
                <Dropdown
                  trigger={<>{currentProject ? currentProject.name : projects.length === 0 ? "No projects" : "Select project…"}</>}
                  aria-haspopup="listbox"
                  open={projectSwitcherOpen}
                  onOpenChange={(open) => { setProjectSwitcherOpen(open); if (open) { setUserMenuOpen(false); } }}
                  disabled={projectsLoading}
                  triggerClassName="w-full justify-between"
                  panelClassName="left-0 right-0 min-w-0"
                  panelMaxHeight="max-h-72"
                >
                  <DropdownItem
                    role="option"
                    onClick={() => { setProjectId(null); setProjectSwitcherOpen(false); navigate("/projects"); setSidebarOpen(false); }}
                  >
                    — All projects —
                  </DropdownItem>
                  {projects.map((p) => (
                    <DropdownItem
                      key={p.id}
                      role="option"
                      selected={p.id === projectId}
                      onClick={() => { setProjectId(p.id); setProjectSwitcherOpen(false); navigate(`/projects/${p.id}`); setSidebarOpen(false); }}
                    >
                      {p.name}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>

              <SidebarNav location={location} onNavigate={closeSidebar} projectId={projectId} />
            </aside>
            {sidebarOpen && (
              <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
            )}
          </>
        )}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
