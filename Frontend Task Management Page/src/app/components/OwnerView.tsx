import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Task, Project } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, Home, Users } from 'lucide-react';
import { Progress } from './ui/progress';

interface OwnerViewProps {
  tasks: Task[];
  projects: Project[];
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export function OwnerView({ tasks, projects }: OwnerViewProps) {
  const projectHealth = useMemo(() => {
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.project === project.name);
      const total = projectTasks.length;
      const completed = projectTasks.filter(t => t.status === 'Closed').length;
      const open = projectTasks.filter(t => t.status === 'Open').length;
      const inProgress = projectTasks.filter(t => t.status === 'In Progress').length;
      const overdue = projectTasks.filter(t => 
        t.dueDate && t.dueDate < new Date() && t.status !== 'Closed'
      ).length;
      const highPriority = projectTasks.filter(t => 
        (t.priority === 'High' || t.priority === 'Urgent') && t.status !== 'Closed'
      ).length;
      const avgAge = projectTasks.length > 0 
        ? projectTasks.reduce((sum, t) => sum + Math.floor((new Date().getTime() - t.timestamp.getTime()) / (1000 * 60 * 60 * 24)), 0) / projectTasks.length 
        : 0;
      
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      let health: 'excellent' | 'good' | 'attention' | 'critical';
      if (overdue > 0 || highPriority > 3) health = 'critical';
      else if (avgAge > 10 || open > 5) health = 'attention';
      else if (completionRate > 70) health = 'excellent';
      else health = 'good';

      return {
        project,
        total,
        completed,
        open,
        inProgress,
        overdue,
        highPriority,
        avgAge: Math.round(avgAge),
        completionRate: Math.round(completionRate),
        health
      };
    });
  }, [tasks, projects]);

  const tasksByTrade = useMemo(() => {
    const tradeMap = new Map<string, number>();
    tasks.filter(t => t.status !== 'Closed').forEach(task => {
      tradeMap.set(task.trade, (tradeMap.get(task.trade) || 0) + 1);
    });
    return Array.from(tradeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const tasksBySubcontractor = useMemo(() => {
    const subMap = new Map<string, { total: number; completed: number; open: number }>();
    tasks.forEach(task => {
      const existing = subMap.get(task.assignedTo) || { total: 0, completed: 0, open: 0 };
      existing.total++;
      if (task.status === 'Closed') existing.completed++;
      else existing.open++;
      subMap.set(task.assignedTo, existing);
    });
    return Array.from(subMap.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        completed: data.completed,
        open: data.open,
        completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.open - a.open);
  }, [tasks]);

  const statusDistribution = useMemo(() => {
    const statusMap = new Map<string, number>();
    tasks.forEach(task => {
      statusMap.set(task.status, (statusMap.get(task.status) || 0) + 1);
    });
    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const overallStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Closed').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'Closed').length;
    const critical = tasks.filter(t => (t.priority === 'Urgent' || t.priority === 'High') && t.status !== 'Closed').length;
    const avgTaskAge = tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + Math.floor((new Date().getTime() - t.timestamp.getTime()) / (1000 * 60 * 60 * 24)), 0) / tasks.length)
      : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, critical, avgTaskAge, completionRate };
  }, [tasks]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-300';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'attention': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle2 className="size-5" />;
      case 'good': return <TrendingUp className="size-5" />;
      case 'attention': return <Clock className="size-5" />;
      case 'critical': return <AlertTriangle className="size-5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900">Executive Dashboard</CardTitle>
          <CardDescription className="text-purple-700">
            High-level visibility across all projects. No surprises, no finding out too late.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Home className="size-6 text-blue-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-blue-600">{projects.length}</div>
              <div className="text-xs text-gray-600 mt-1">Active Projects</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{overallStats.total}</div>
              <div className="text-xs text-gray-600 mt-1">Total Tasks</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{overallStats.completionRate}%</div>
              <div className="text-xs text-gray-600 mt-1">Completion Rate</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{overallStats.overdue}</div>
              <div className="text-xs text-gray-600 mt-1">Overdue Items</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{overallStats.critical}</div>
              <div className="text-xs text-gray-600 mt-1">Critical Priority</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Project Health Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectHealth.map(({ project, total, completed, open, inProgress, overdue, highPriority, avgAge, completionRate, health }) => (
            <Card key={project.id} className={`border-2 ${getHealthColor(health)}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {getHealthIcon(health)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Task Completion</span>
                    <span className="font-semibold">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-600">Total Tasks</div>
                    <div className="text-xl font-bold">{total}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Avg Age</div>
                    <div className="text-xl font-bold">{avgAge}d</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="font-semibold text-orange-600">{open}</div>
                    <div className="text-gray-600">Open</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="font-semibold text-blue-600">{inProgress}</div>
                    <div className="text-gray-600">In Progress</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="font-semibold text-green-600">{completed}</div>
                    <div className="text-gray-600">Done</div>
                  </div>
                </div>

                {(overdue > 0 || highPriority > 0) && (
                  <div className="flex gap-2 pt-2 border-t">
                    {overdue > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {overdue} Overdue
                      </Badge>
                    )}
                    {highPriority > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {highPriority} High Priority
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Open Tasks by Trade</CardTitle>
            <CardDescription>Which trades have the most open items</CardDescription>
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
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Overall task status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Subcontractor Performance
          </CardTitle>
          <CardDescription>Track which trades are closing items vs. accumulating backlog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasksBySubcontractor.map((sub) => (
              <div key={sub.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">{sub.name}</div>
                    <Badge variant={sub.open > 5 ? 'destructive' : sub.open > 2 ? 'secondary' : 'outline'}>
                      {sub.open} open
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {sub.completed} of {sub.total} completed ({sub.completionRate}%)
                  </div>
                </div>
                <Progress value={sub.completionRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Key Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          {overallStats.overdue > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-red-600 mt-0.5" />
              <p><strong>{overallStats.overdue} tasks are overdue</strong> - immediate attention needed</p>
            </div>
          )}
          {projectHealth.filter(p => p.health === 'critical').length > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-red-600 mt-0.5" />
              <p>
                <strong>{projectHealth.filter(p => p.health === 'critical').length} projects need attention:</strong>{' '}
                {projectHealth.filter(p => p.health === 'critical').map(p => p.project.name).join(', ')}
              </p>
            </div>
          )}
          {overallStats.avgTaskAge > 7 && (
            <div className="flex items-start gap-2">
              <Clock className="size-5 text-yellow-600 mt-0.5" />
              <p>Average task age is {overallStats.avgTaskAge} days - consider increasing urgency on older items</p>
            </div>
          )}
          {tasksBySubcontractor.filter(s => s.open > 5).length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="size-5 text-orange-600 mt-0.5" />
              <p>
                <strong>High backlogs with:</strong>{' '}
                {tasksBySubcontractor.filter(s => s.open > 5).map(s => `${s.name} (${s.open})`).join(', ')}
              </p>
            </div>
          )}
          {overallStats.completionRate > 70 && overallStats.overdue === 0 && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
              <p>Projects are on track with {overallStats.completionRate}% completion rate and no overdue items</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
