import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Task, Project, TaskStatus } from '../types';
import { Search, Download, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface OfficeViewProps {
  tasks: Task[];
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
}

export function OfficeView({ tasks, projects, onUpdateTask, onDeleteTask }: OfficeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Get unique values for filters
  const trades = useMemo(() => Array.from(new Set(tasks.map(t => t.trade).filter(t => t && t.trim()))), [tasks]);
  const assignees = useMemo(() => Array.from(new Set(tasks.map(t => t.assignedTo).filter(a => a && a.trim()))), [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = searchQuery === '' || 
        task.taskDetails.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.area?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesProject = filterProject === 'all' || task.project === filterProject;
      const matchesTrade = filterTrade === 'all' || task.trade === filterTrade;
      const matchesStatus = filterStatus === 'all' || task.status.toLowerCase() === filterStatus.toLowerCase();
      const matchesAssignee = filterAssignee === 'all' || task.assignedTo === filterAssignee;

      return matchesSearch && matchesProject && matchesTrade && matchesStatus && matchesAssignee;
    });
  }, [tasks, searchQuery, filterProject, filterTrade, filterStatus, filterAssignee]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter(t => t.status === 'Open').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const completed = tasks.filter(t => t.status === 'Closed').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'Closed').length;
    const highPriority = tasks.filter(t => (t.priority === 'High' || t.priority === 'Urgent') && t.status !== 'Closed').length;

    return { total, open, inProgress, completed, overdue, highPriority };
  }, [tasks]);

  // Get tasks by age
  const oldestOpenTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'Open')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, 5);
  }, [tasks]);

  const handleStatusChange = (taskId: string, newStatus: string) => {
    // Convert lowercase status to proper TaskStatus
    const statusMap: Record<string, TaskStatus> = {
      'open': 'Open',
      'in-progress': 'In Progress',
      'completed': 'Closed',
      'blocked': 'Blocked',
    };
    const properStatus = statusMap[newStatus.toLowerCase()] || newStatus as TaskStatus;
    onUpdateTask(taskId, {
      status: properStatus,
    });
    toast.success('Task status updated');
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      onDeleteTask(taskId);
      toast.success('Task deleted');
    }
  };

  const handleExportTasks = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      // Set up PDF document
      doc.setFontSize(16);
      doc.text('Task Management Report', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total Tasks: ${filteredTasks.length}`, 14, 34);
      
      // Table headers
      const headers = [['Project', 'Task Title', 'Trade', 'Assigned To', 'Status', 'Priority', 'Due Date']];
      
      // Auto table would be better, but using manual table for simplicity
      let yPos = 45;
      const pageHeight = doc.internal.pageSize.height;
      const rowHeight = 7;
      const startX = 14;
      const colWidths = [30, 50, 25, 30, 20, 20, 25];
      
      // Draw headers
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      let xPos = startX;
      headers[0].forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += rowHeight;
      
      // Draw data rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      filteredTasks.forEach((task) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        xPos = startX;
        const row = [
          task.project || '-',
          task.taskTitle || '-',
          task.trade || '-',
          task.assignedTo || '-',
          task.status || '-',
          task.priority || '-',
          task.dueDate ? task.dueDate.toLocaleDateString() : '-'
        ];
        
        row.forEach((cell, i) => {
          const cellText = String(cell).substring(0, Math.floor(colWidths[i] / 2));
          doc.text(cellText, xPos, yPos);
          xPos += colWidths[i];
        });
        yPos += rowHeight;
      });
      
      // Save PDF
      doc.save(`tasks-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Tasks exported to PDF');
    } catch (error) {
      toast.error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getDaysOpen = (timestamp: Date) => {
    const days = Math.floor((new Date().getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
              <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-600 mt-1">Completed</div>
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
              <div className="text-3xl font-bold text-purple-600">{stats.highPriority}</div>
              <div className="text-xs text-gray-600 mt-1">High Priority</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Oldest Open Tasks Alert */}
      {oldestOpenTasks.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <Clock className="size-5" />
              Oldest Open Items - Needs Attention
            </CardTitle>
            <CardDescription className="text-orange-700">
              These tasks have been open the longest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {oldestOpenTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded border border-orange-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{task.project}</Badge>
                      <Badge variant="destructive">{getDaysOpen(task.timestamp)} days old</Badge>
                    </div>
                    <p className="text-sm">{task.taskTitle}</p>
                    <p className="text-xs text-gray-600 mt-1">{task.trade} • {task.assignedTo}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange(task.id, 'In Progress')}
                  >
                    Start
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Master view of all items across projects</CardDescription>
            </div>
            <Button onClick={handleExportTasks} variant="outline">
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterProject || undefined} onValueChange={setFilterProject}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTrade || undefined} onValueChange={setFilterTrade}>
              <SelectTrigger>
                <SelectValue placeholder="All Trades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {trades.map(trade => (
                  <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus || undefined} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAssignee || undefined} onValueChange={setFilterAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map(assignee => (
                  <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tasks Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Select
                          value={task.status || undefined}
                          onValueChange={(value) => handleStatusChange(task.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          task.priority === 'Urgent' || task.priority === 'High' ? 'destructive' :
                          task.priority === 'Medium' ? 'secondary' : 'outline'
                        }>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{task.project}</TableCell>
                      <TableCell className="max-w-md">
                        <div>
                          <p className="text-sm font-medium">{task.taskTitle}</p>
                          <p className="text-xs text-gray-600 mt-1">{task.taskDetails}</p>
                          {task.area && task.area.trim() && (
                            <p className="text-xs text-gray-500 mt-1">📍 {task.area}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.trade}</TableCell>
                      <TableCell>{task.assignedTo}</TableCell>
                      <TableCell>
                        <span className={getDaysOpen(task.timestamp) > 7 ? 'text-red-600 font-semibold' : ''}>
                          {getDaysOpen(task.timestamp)}d
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className={
                            task.dueDate < new Date() && task.status !== 'Closed'
                              ? 'text-red-600 font-semibold'
                              : ''
                          }>
                            {task.dueDate.toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
