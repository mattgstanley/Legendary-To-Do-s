import { useState, useEffect, useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { TaskTable } from './components/TaskTable';
import { SupervisorView } from './components/SupervisorView';
import { SubcontractorView } from './components/SubcontractorView';
import { Task, Project } from './types';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Copy, Check, Share2, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/button';
import { apiService } from './services/api';
import { UserRole, getRoleFromUrl, getRolePermissions, getAllRoleUrls } from './utils/roles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

type QuickFilter = 'all' | 'open' | 'overdue' | 'urgent';
type TabId = 'table' | 'dashboard' | 'supervisor';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [roleUrls, setRoleUrls] = useState<Array<{ role: UserRole; path: string; url: string }>>([]);
  const [urlsDialogOpen, setUrlsDialogOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [activeTab, setActiveTab] = useState<TabId>('table');
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);

  useEffect(() => {
    const uniqueProjects = Array.from(
      new Set(tasks.map(t => t.project).filter(p => p?.trim()))
    ).map((name, index) => ({ id: `project-${index}`, name }));
    setProjects(uniqueProjects);
  }, [tasks]);

  useEffect(() => {
    const role = getRoleFromUrl();
    if (role) {
      setUserRole(role);
      if (role === 'admin') {
        setRoleUrls(getAllRoleUrls());
      }
      loadTasks();
    } else {
      window.location.href = '/w5x2n6q1';
    }
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTasks();
      if (response.success) {
        const mappedTasks = response.tasks.map((task: any) => {
          const getField = (keys: string[]) => keys.find(k => task[k]) || '';
          const taskTitle = getField(['taskTitle', 'tasktitle', 'task title']);
          const taskDetails = getField(['taskDetails', 'taskdetails', 'task details']);
          const assignedTo = getField(['assignedTo', 'assignedto', 'assigned to']);
          const dueDateStr = getField(['dueDate', 'duedate', 'due date']);
          const photoURL = getField(['photoURL', 'photoUrl', 'photourl', 'photo url']);
          
          const photoNeeded = ['Yes', true].includes(task.photoNeeded) || 
                             ['Yes', true].includes(task.photoneeded) ||
                             task['photo needed'] === 'Yes';

          let timestamp = new Date();
          if (task.timestamp) {
            const parsed = new Date(task.timestamp);
            if (!isNaN(parsed.getTime())) timestamp = parsed;
          }

          let dueDate: Date | null = null;
          if (dueDateStr) {
            const parsed = new Date(dueDateStr);
            if (!isNaN(parsed.getTime())) dueDate = parsed;
          }

          return {
            id: task.timestamp || task.taskId || `${Date.now()}-${Math.random()}`,
            timestamp,
            project: task.project || '',
            area: task.area || '',
            trade: task.trade || '',
            taskTitle,
            taskDetails,
            assignedTo,
            priority: (task.priority || 'Medium') as Task['priority'],
            dueDate,
            photoNeeded,
            status: (task.status || 'Open') as Task['status'],
            photoURL,
            notes: task.notes || '',
          };
        });
        setTasks(mappedTasks);
      } else {
        toast.error(response.error || 'Failed to load tasks');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updateData: Record<string, any> = {
        taskId,
        status: updates.status,
        priority: updates.priority,
        dueDate: updates.dueDate?.toISOString().split('T')[0],
        photoNeeded: updates.photoNeeded,
        notes: updates.notes,
        taskTitle: updates.taskTitle,
        taskDetails: updates.taskDetails,
        assignedTo: updates.assignedTo,
        area: updates.area,
        trade: updates.trade,
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      const response = await apiService.updateTask(taskId, updateData);
      if (response.success) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
        toast.success('Task updated successfully');
      } else {
        toast.error(response.error || 'Failed to update task');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiService.updateTask(taskId, { status: 'Closed' });
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success('Task closed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to close task');
    }
  };

  const handleAddTask = async (task: Omit<Task, 'id' | 'timestamp'>) => {
    try {
      const taskData = {
        project: task.project,
        area: task.area || '',
        trade: task.trade || '',
        taskTitle: task.taskTitle,
        taskDetails: task.taskDetails || '',
        assignedTo: task.assignedTo || '',
        priority: task.priority || 'Medium',
        dueDate: task.dueDate?.toISOString().split('T')[0] || '',
        photoNeeded: task.photoNeeded || false,
      };

      const response = await apiService.addTask(taskData);
      if (response.success && response.task?.taskId) {
        const newTask: Task = {
          ...task,
          id: response.task.taskId,
          timestamp: new Date(),
        };
        setTasks([newTask, ...tasks]);
        toast.success('Task added successfully');
        await loadTasks();
      } else {
        toast.error(response.error || 'Failed to add task');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add task');
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const totalOpen = tasks.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'Closed').length;
    const urgent = tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Closed').length;
    const completedThisWeek = tasks.filter(t => t.status === 'Closed' && t.timestamp >= startOfWeek).length;
    return { totalOpen, overdue, urgent, completedThisWeek };
  }, [tasks]);

  if (!userRole) {
    return (
      <div className="legendary-loading">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p style={{ marginTop: 16, fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="legendary-loading">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p style={{ marginTop: 16, fontSize: 14 }}>Loading tasks...</p>
        </div>
      </div>
    );
  }

  const permissions = getRolePermissions(userRole);

  const copyUrl = (url: string, role: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success(`${role} URL copied!`);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="legendary-app">
      <header className="legendary-header">
        <div className="logo-area">
          <img
            src="/assets/legendary-homes-logo.svg"
            alt="Legendary Homes"
            className="logo-img"
          />
          <div className="logo-text">
            <span className="logo-name">Legendary Homes</span>
            <span className="logo-sub">Cincinnati · Task Command</span>
          </div>
        </div>
        <div className="header-right">
          {userRole === 'admin' && (
            <Dialog open={urlsDialogOpen} onOpenChange={setUrlsDialogOpen}>
              <DialogTrigger asChild>
                <button type="button" className="btn btn-ghost">
                  <Share2 style={{ width: 14, height: 14 }} />
                  Share
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <DialogHeader>
                  <DialogTitle>Share Access URLs</DialogTitle>
                  <DialogDescription>
                    Copy and share these URLs with users to grant them access to specific role views.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {roleUrls.length > 0 ? (
                    roleUrls.map(({ role, url, path }) => (
                      <div key={role} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-900 capitalize">{role}</span>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">/{path}</span>
                            </div>
                            <div className="text-sm text-gray-600 font-mono break-all mb-2">{url}</div>
                            <div className="text-xs text-gray-500">
                              {role === 'admin' && 'Full access: All views, add/edit/delete tasks, export'}
                              {role === 'supervisor' && 'Can add/edit tasks, view all, export. Cannot delete'}
                              {role === 'subcontractor' && 'View assigned tasks, update status. Cannot add/delete/export'}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyUrl(url, role)}
                          >
                            {copiedUrl === url ? (
                              <>
                                <Check className="size-4 mr-2" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-4 mr-2" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Loading URLs...</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <button type="button" className="btn btn-ghost" onClick={loadTasks}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            Refresh
          </button>
          {(userRole === 'admin' || userRole === 'supervisor') && permissions.canAddTasks && (
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => setAddTaskDialogOpen(true)}
            >
              + Add Task
            </button>
          )}
        </div>
      </header>

      <main className="legendary-main">
        <div className="page-header">
          <div className="page-title-block">
            <h1>Task Command <span>Center</span></h1>
            <p>All active jobs · Real-time · Updated just now</p>
          </div>
        {(userRole === 'admin' || userRole === 'supervisor') && (activeTab === 'table' || activeTab === 'supervisor') && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`filter-pill ${quickFilter === 'open' ? 'active' : ''}`}
                onClick={() => setQuickFilter('open')}
              >
                ⏱ Open Only
              </button>
              <button
                type="button"
                className={`filter-pill ${quickFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setQuickFilter('overdue')}
              >
                ⚠ Overdue
              </button>
              <button
                type="button"
                className={`filter-pill ${quickFilter === 'urgent' ? 'active' : ''}`}
                onClick={() => setQuickFilter('urgent')}
              >
                🔴 Urgent
              </button>
              <button
                type="button"
                className={`filter-pill ${quickFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuickFilter('all')}
              >
                All Tasks
              </button>
            </div>
          )}
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Open</div>
            <div className="stat-value">{stats.totalOpen}</div>
            <div className="stat-sub">across all projects</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-label">Overdue</div>
            <div className="stat-value">{stats.overdue}</div>
            <div className="stat-sub">need immediate attention</div>
          </div>
          <div className="stat-card urgent">
            <div className="stat-label">High Priority</div>
            <div className="stat-value">{stats.urgent}</div>
            <div className="stat-sub">urgent tasks</div>
          </div>
          <div className="stat-card done">
            <div className="stat-label">Completed</div>
            <div className="stat-value">{stats.completedThisWeek}</div>
            <div className="stat-sub">this week</div>
          </div>
        </div>

        {userRole === 'admin' && (
          <>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeTab === 'table' ? 'active' : ''}`}
                onClick={() => setActiveTab('table')}
              >
                Task Table
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
            </div>
            {activeTab === 'table' && (
              <TaskTable
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={permissions.canDeleteTasks ? handleDeleteTask : () => {}}
                onAddTask={handleAddTask}
                canAdd={permissions.canAddTasks}
                canDelete={permissions.canDeleteTasks}
                canExport={permissions.canExport}
                quickFilter={quickFilter}
                addDialogOpen={addTaskDialogOpen}
                onAddDialogOpenChange={setAddTaskDialogOpen}
              />
            )}
            {activeTab === 'dashboard' && <Dashboard tasks={tasks} />}
          </>
        )}

        {userRole === 'supervisor' && (
          <>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeTab === 'supervisor' ? 'active' : ''}`}
                onClick={() => setActiveTab('supervisor')}
              >
                Supervisor View
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'table' ? 'active' : ''}`}
                onClick={() => setActiveTab('table')}
              >
                Task Table
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
            </div>
            {activeTab === 'supervisor' && (
              <SupervisorView
                tasks={tasks}
                projects={projects}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onAddProject={(project) => setProjects([...projects, { ...project, id: Date.now().toString() }])}
              />
            )}
            {activeTab === 'table' && (
              <TaskTable
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={() => {}}
                onAddTask={handleAddTask}
                canAdd={permissions.canAddTasks}
                canDelete={false}
                canExport={permissions.canExport}
                quickFilter={quickFilter}
                addDialogOpen={addTaskDialogOpen}
                onAddDialogOpenChange={setAddTaskDialogOpen}
              />
            )}
            {activeTab === 'dashboard' && <Dashboard tasks={tasks} />}
          </>
        )}

        {userRole === 'subcontractor' && (
          <SubcontractorView tasks={tasks} />
        )}
      </main>

      <Toaster />
    </div>
  );
}

export default App;
