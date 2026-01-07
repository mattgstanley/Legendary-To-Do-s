import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TaskTable } from './components/TaskTable';
import { SupervisorView } from './components/SupervisorView';
import { SubcontractorView } from './components/SubcontractorView';
import { Task, Project } from './types';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Building2, Copy, Check, Share2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { apiService } from './services/api';
import { UserRole, getRoleFromUrl, getRolePermissions, getAllRoleUrls } from './utils/roles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [roleUrls, setRoleUrls] = useState<Array<{ role: UserRole; path: string; url: string }>>([]);
  const [urlsDialogOpen, setUrlsDialogOpen] = useState(false);

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

  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tasks...</p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/assets/legendary-homes-logo.png" 
                alt="Legendary Homes Cincinnati" 
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              {userRole === 'admin' && (
                <Dialog open={urlsDialogOpen} onOpenChange={setUrlsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                      <Share2 className="size-4 mr-2" />
                      Share URLs
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
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
              <Button onClick={loadTasks} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {userRole === 'admin' && (
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="table">Task Table</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <TaskTable 
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={permissions.canDeleteTasks ? handleDeleteTask : () => {}}
                onAddTask={permissions.canAddTasks ? handleAddTask : () => {}}
                canAdd={permissions.canAddTasks}
                canDelete={permissions.canDeleteTasks}
                canExport={permissions.canExport}
              />
            </TabsContent>
            <TabsContent value="dashboard">
              <Dashboard tasks={tasks} />
            </TabsContent>
          </Tabs>
        )}

        {userRole === 'supervisor' && (
          <Tabs defaultValue="supervisor" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="supervisor">Supervisor View</TabsTrigger>
              <TabsTrigger value="table">Task Table</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="supervisor">
              <SupervisorView 
                tasks={tasks}
                projects={projects}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onAddProject={(project) => setProjects([...projects, { ...project, id: Date.now().toString() }])}
              />
            </TabsContent>
            <TabsContent value="table">
              <TaskTable 
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={() => {}}
                onAddTask={handleAddTask}
                canAdd={permissions.canAddTasks}
                canDelete={false}
                canExport={permissions.canExport}
              />
            </TabsContent>
            <TabsContent value="dashboard">
              <Dashboard tasks={tasks} />
            </TabsContent>
          </Tabs>
        )}

        {userRole === 'subcontractor' && (
          <SubcontractorView tasks={tasks} />
        )}
      </div>

      <Toaster />
    </div>
  );
}

export default App;
