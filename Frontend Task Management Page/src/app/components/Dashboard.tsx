import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Task } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, Home, Users, Calendar } from 'lucide-react';
import { Progress } from './ui/progress';

interface DashboardProps {
  tasks: Task[];
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export function Dashboard({ tasks }: DashboardProps) {
  // Overall stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter(t => t.status === 'Open').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const closed = tasks.filter(t => t.status === 'Closed').length;
    const blocked = tasks.filter(t => t.status === 'Blocked').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'Closed').length;
    const urgent = tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Closed').length;
    const photoNeeded = tasks.filter(t => t.photoNeeded && t.status !== 'Closed').length;
    const completionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    return { total, open, inProgress, closed, blocked, overdue, urgent, photoNeeded, completionRate };
  }, [tasks]);

  // Tasks by project
  const tasksByProject = useMemo(() => {
    const projectMap = new Map<string, { total: number; open: number; closed: number }>();
    tasks.forEach(task => {
      const existing = projectMap.get(task.project) || { total: 0, open: 0, closed: 0 };
      existing.total++;
      if (task.status === 'Open') existing.open++;
      if (task.status === 'Closed') existing.closed++;
      projectMap.set(task.project, existing);
    });
    return Array.from(projectMap.entries())
      .map(([name, data]) => ({ 
        name, 
        total: data.total,
        open: data.open,
        closed: data.closed,
        completionRate: data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [tasks]);

  // Tasks by trade
  const tasksByTrade = useMemo(() => {
    const tradeMap = new Map<string, number>();
    tasks.filter(t => t.status !== 'Closed').forEach(task => {
      tradeMap.set(task.trade, (tradeMap.get(task.trade) || 0) + 1);
    });
    return Array.from(tradeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Tasks by assignee
  const tasksByAssignee = useMemo(() => {
    const assigneeMap = new Map<string, { total: number; open: number; closed: number }>();
    tasks.forEach(task => {
      const existing = assigneeMap.get(task.assignedTo) || { total: 0, open: 0, closed: 0 };
      existing.total++;
      if (task.status === 'Open') existing.open++;
      if (task.status === 'Closed') existing.closed++;
      assigneeMap.set(task.assignedTo, existing);
    });
    return Array.from(assigneeMap.entries())
      .map(([name, data]) => ({ 
        name, 
        total: data.total,
        open: data.open,
        closed: data.closed,
        completionRate: data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.open - a.open);
  }, [tasks]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    return [
      { name: 'Open', value: stats.open },
      { name: 'In Progress', value: stats.inProgress },
      { name: 'Closed', value: stats.closed },
      { name: 'Blocked', value: stats.blocked },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Priority distribution
  const priorityDistribution = useMemo(() => {
    const priorityMap = new Map<string, number>();
    tasks.filter(t => t.status !== 'Closed').forEach(task => {
      priorityMap.set(task.priority, (priorityMap.get(task.priority) || 0) + 1);
    });
    return Array.from(priorityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
        return order[a.name as keyof typeof order] - order[b.name as keyof typeof order];
      });
  }, [tasks]);

  // Overdue tasks by project
  const overdueTasks = useMemo(() => 
    tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'Closed')
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)),
    [tasks]
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-gray-600 mt-1">Total Tasks</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.open}</div>
              <div className="text-xs text-gray-600 mt-1">Open</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
              <div className="text-xs text-gray-600 mt-1">In Progress</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.closed}</div>
              <div className="text-xs text-gray-600 mt-1">Closed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-xs text-gray-600 mt-1">Overdue</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.urgent}</div>
              <div className="text-xs text-gray-600 mt-1">Urgent</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600">{stats.blocked}</div>
              <div className="text-xs text-gray-600 mt-1">Blocked</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">{stats.completionRate}%</div>
              <div className="text-xs text-gray-600 mt-1">Complete</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {overdueTasks.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="size-5" />
              {overdueTasks.length} Overdue Tasks - Immediate Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTasks.slice(0, 5).map(task => (
                <div key={task.id} className="p-3 bg-white rounded border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{task.project}</Badge>
                        <Badge variant="destructive">{task.priority}</Badge>
                        <span className="text-xs text-red-600 font-semibold">
                          Due: {task.dueDate?.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium">{task.taskTitle}</p>
                      <p className="text-sm text-gray-600">{task.trade} • {task.assignedTo}</p>
                    </div>
                  </div>
                </div>
              ))}
              {overdueTasks.length > 5 && (
                <p className="text-sm text-red-700 text-center pt-2">
                  +{overdueTasks.length - 5} more overdue tasks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Project</CardTitle>
            <CardDescription>Distribution across active projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasksByProject.map((project, index) => (
                <div key={project.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{project.name}</span>
                      <Badge variant="outline">{project.total} tasks</Badge>
                    </div>
                    <span className="text-sm text-gray-600">{project.completionRate}% done</span>
                  </div>
                  <Progress value={project.completionRate} className="h-2" />
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <span>{project.open} open</span>
                    <span>{project.closed} closed</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current task status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Open Tasks by Trade</CardTitle>
            <CardDescription>Which trades have the most open work</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tasksByTrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" name="Open Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>Open tasks by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assignee Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Performance by Assignee
          </CardTitle>
          <CardDescription>Track workload and completion rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasksByAssignee.map((assignee) => (
              <div key={assignee.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{assignee.name}</div>
                    <Badge variant={assignee.open > 5 ? 'destructive' : assignee.open > 2 ? 'secondary' : 'outline'}>
                      {assignee.open} open
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {assignee.closed} of {assignee.total} completed ({assignee.completionRate}%)
                  </div>
                </div>
                <Progress value={assignee.completionRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Key Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          {stats.overdue > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-red-600 mt-0.5 shrink-0" />
              <p><strong>{stats.overdue} tasks are overdue</strong> - immediate attention needed</p>
            </div>
          )}
          {stats.urgent > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-orange-600 mt-0.5 shrink-0" />
              <p><strong>{stats.urgent} urgent tasks</strong> require priority focus</p>
            </div>
          )}
          {stats.blocked > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-purple-600 mt-0.5 shrink-0" />
              <p><strong>{stats.blocked} tasks are blocked</strong> - investigate blockers</p>
            </div>
          )}
          {stats.photoNeeded > 0 && (
            <div className="flex items-start gap-2">
              <Camera className="size-5 text-indigo-600 mt-0.5 shrink-0" />
              <p><strong>{stats.photoNeeded} tasks need photos</strong> for documentation</p>
            </div>
          )}
          {stats.completionRate > 70 && stats.overdue === 0 && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
              <p>Strong progress with {stats.completionRate}% completion rate and no overdue items</p>
            </div>
          )}
          {tasksByAssignee.filter(a => a.open > 5).length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="size-5 text-yellow-600 mt-0.5 shrink-0" />
              <p>
                <strong>High workload:</strong>{' '}
                {tasksByAssignee.filter(a => a.open > 5).map(a => `${a.name} (${a.open})`).join(', ')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Camera({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
