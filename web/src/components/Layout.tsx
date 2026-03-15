import { useEffect, useState, useCallback } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { LayoutDashboard, ListTodo, FolderOpen, FlaskConical, Flag, BarChart2, ChevronRight, Check, Sun, Moon, Palette } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useProject } from "../ProjectContext";
import { useTheme, type ThemeId } from "../ThemeContext";
import { api, type Project } from "../api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

const iconSize = 18;

type NavSection = "cases" | "runs" | "milestones";

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

  useEffect(() => {
    if (path.startsWith("/projects") && !path.includes("/settings") || path.startsWith("/cases/")) setExpanded("cases");
    else if (path.startsWith("/runs")) setExpanded("runs");
    else if (path.startsWith("/milestones")) setExpanded("milestones");
  }, [path]);

  const subLinkClass = (active: boolean) =>
    `block rounded py-1.5 pl-8 pr-3 text-sm no-underline ${active ? "font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`;

  const toggle = (section: NavSection) => setExpanded((s) => (s === section ? null : section));

  const isProjectOverview = projectId != null && path === `/projects/${projectId}`;

  return (
    <nav className="mt-2 flex flex-col px-0">
      {projectId && (
        <Link
          to={`/projects/${projectId}`}
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm no-underline ${isProjectOverview ? "font-semibold text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
        >
          <LayoutDashboard size={iconSize} className="shrink-0" />
          Overview
        </Link>
      )}
      <span className="flex items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" aria-disabled="true" title="To Do is being refactored">
        <ListTodo size={iconSize} className="shrink-0" />
        To Do
      </span>

      {/* Cases — sub-menu: Overview, Details, Status, Defects (TestRail 9.0) */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("cases")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${(path.startsWith("/projects") && !path.includes("/settings")) || path.startsWith("/cases/") ? "font-semibold text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
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

      {/* Test Runs & Results — sub-menu (TestRail-aligned) */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("runs")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${path.startsWith("/runs") ? "font-semibold text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
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
          </div>
        )}
      </div>

      {/* Milestones — sub-menu */}
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => toggle("milestones")}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${path.startsWith("/milestones") ? "font-semibold text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
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

      <Link to="/reports" onClick={onNavigate} className={`flex items-center gap-2 rounded px-3 py-2 text-sm no-underline ${path === "/reports" ? "font-semibold text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
        <BarChart2 size={iconSize} className="shrink-0" />
        Reports
      </Link>
    </nav>
  );
}

const THEME_OPTIONS: { id: ThemeId; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "slate", label: "Slate", icon: Palette },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { projectId, setProjectId } = useProject();
  const { theme, setTheme } = useTheme();
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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-4">
          {showSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded border border-border bg-surface text-foreground hover:bg-accent"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              <span className="text-lg">{sidebarOpen ? "×" : "☰"}</span>
            </button>
          )}
          <Link to="/dashboard" className="font-bold text-foreground no-underline hover:underline">
            TCMS
          </Link>
        </div>
        <DropdownMenu
          open={userMenuOpen}
          onOpenChange={(open) => {
            setUserMenuOpen(open);
            if (open) setProjectSwitcherOpen(false);
          }}
        >
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-foreground",
              "hover:bg-accent hover:text-accent-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
          >
            <span className="min-w-0 truncate">{user?.name ?? user?.email ?? "User"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <span className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Theme</span>
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onSelect={() => {
                    setTheme(opt.id);
                    setUserMenuOpen(false);
                  }}
                >
                  <Icon className="mr-2 size-4" aria-hidden />
                  <span className="flex-1">{opt.label}</span>
                  {theme === opt.id && <Check className="size-4" aria-hidden />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setUserMenuOpen(false);
                logout();
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        {showSidebar && (
          <>
            <aside
              className={`fixed left-0 top-12 z-30 flex h-[calc(100vh-3rem)] w-52 flex-col overflow-y-auto border-r border-border bg-muted/80 backdrop-blur md:relative md:top-0 md:h-auto md:z-auto md:shrink-0 md:border-r ${
                sidebarOpen ? "block" : "hidden md:flex"
              }`}
              aria-label="Main navigation"
              data-testid="sidebar-nav"
            >
              {/* Project switcher */}
              <div className="border-b border-border p-3 pb-3" data-testid="project-switcher">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Project</div>
                <DropdownMenu
                  open={projectSwitcherOpen}
                  onOpenChange={(open) => {
                    setProjectSwitcherOpen(open);
                    if (open) setUserMenuOpen(false);
                  }}
                >
                  <DropdownMenuTrigger
                    disabled={projectsLoading}
                    className={cn(
                      "inline-flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground",
                      "hover:bg-accent hover:text-accent-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:pointer-events-none disabled:opacity-60"
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {currentProject ? currentProject.name : projects.length === 0 ? "No projects" : "Select project…"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="left-0 right-0 min-w-0 max-h-72 overflow-y-auto" sideOffset={8}>
                    <DropdownMenuItem
                      onSelect={() => {
                        setProjectId(null);
                        setProjectSwitcherOpen(false);
                        navigate("/projects");
                        setSidebarOpen(false);
                      }}
                    >
                      — All projects —
                    </DropdownMenuItem>
                    {projects.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={() => {
                          setProjectId(p.id);
                          setProjectSwitcherOpen(false);
                          navigate(`/projects/${p.id}`);
                          setSidebarOpen(false);
                        }}
                        className={cn(p.id === projectId && "bg-primary/10 font-medium text-primary")}
                      >
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <SidebarNav location={location} onNavigate={closeSidebar} projectId={projectId} />
            </aside>
            {sidebarOpen && (
              <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
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
