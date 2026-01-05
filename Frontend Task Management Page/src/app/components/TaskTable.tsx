import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Task, TaskStatus, TaskPriority, FilterState } from '../types';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Calendar, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onAddTask: (task: Omit<Task, 'id' | 'timestamp'>) => void | Promise<void>;
  canAdd?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
}

type SortField = keyof Task;
type SortDirection = 'asc' | 'desc' | null;

const trades = ['Tile', 'Plumbing', 'Landscaping', 'Electrical', 'Drywall', 'Paint', 'HVAC', 'Flooring', 'Cabinets', 'Framing', 'Other'];

export function TaskTable({ tasks, onUpdateTask, onDeleteTask, onAddTask, canAdd = true, canDelete = true, canExport = true }: TaskTableProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    project: 'all',
    area: 'all',
    trade: 'all',
    assignedTo: 'all',
    priority: 'all',
    status: 'all',
    photoNeeded: 'all',
    showOverdueOnly: false,
    showOpenOnly: false,
    showUrgentOnly: false,
  });

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    project: '',
    area: '',
    trade: '',
    taskTitle: '',
    taskDetails: '',
    assignedTo: '',
    priority: 'Medium' as TaskPriority,
    dueDate: '',
    photoNeeded: false,
    status: 'Open' as TaskStatus,
    notes: '',
  });

  // Get unique values for filters
  const projects = useMemo(() => Array.from(new Set(tasks.map(t => t.project).filter(p => p && p.trim()))).sort(), [tasks]);
  const areas = useMemo(() => Array.from(new Set(tasks.map(t => t.area).filter(a => a && a.trim()))).sort(), [tasks]);
  const tradeList = useMemo(() => Array.from(new Set(tasks.map(t => t.trade).filter(t => t && t.trim()))).sort(), [tasks]);
  const assignees = useMemo(() => Array.from(new Set(tasks.map(t => t.assignedTo).filter(a => a && a.trim()))).sort(), [tasks]);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // Text search
      const matchesSearch = filters.search === '' || 
        task.taskTitle.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.taskDetails.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.project.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.area.toLowerCase().includes(filters.search.toLowerCase());
      
      // Dropdown filters
      const matchesProject = filters.project === 'all' || task.project === filters.project;
      const matchesArea = filters.area === 'all' || task.area === filters.area;
      const matchesTrade = filters.trade === 'all' || task.trade === filters.trade;
      const matchesAssignee = filters.assignedTo === 'all' || task.assignedTo === filters.assignedTo;
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
      const matchesStatus = filters.status === 'all' || task.status === filters.status;
      const matchesPhotoNeeded = filters.photoNeeded === 'all' || 
        (filters.photoNeeded === 'yes' && task.photoNeeded) ||
        (filters.photoNeeded === 'no' && !task.photoNeeded);

      // Quick filters
      const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'Closed';
      const matchesOverdue = !filters.showOverdueOnly || isOverdue;
      const matchesOpen = !filters.showOpenOnly || task.status === 'Open';
      const matchesUrgent = !filters.showUrgentOnly || task.priority === 'Urgent';

      return matchesSearch && matchesProject && matchesArea && matchesTrade && 
             matchesAssignee && matchesPriority && matchesStatus && matchesPhotoNeeded &&
             matchesOverdue && matchesOpen && matchesUrgent;
    });

    // Sort
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          comparison = aVal === bVal ? 0 : aVal ? 1 : -1;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [tasks, filters, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      // Set up PDF document
      doc.setFontSize(16);
      doc.text('Task Management Report', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total Tasks: ${filteredAndSortedTasks.length}`, 14, 34);
      
      // Table data
      const pageHeight = doc.internal.pageSize.height;
      const rowHeight = 7;
      const startX = 14;
      const colWidths = [25, 30, 20, 20, 40, 30, 20, 20, 25];
      
      // Headers
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      let yPos = 45;
      let xPos = startX;
      const headers = ['Project', 'Area', 'Trade', 'Task Title', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Photo'];
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += rowHeight;
      
      // Data rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      filteredAndSortedTasks.forEach((task) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        xPos = startX;
        const row = [
          task.project || '-',
          task.area || '-',
          task.trade || '-',
          (task.taskTitle || '-').substring(0, 20),
          (task.assignedTo || '-').substring(0, 15),
          task.priority || '-',
          task.status || '-',
          task.dueDate ? task.dueDate.toLocaleDateString() : '-',
          task.photoNeeded ? 'Yes' : 'No'
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

  const handleAddTask = async () => {
    if (!newTask.project || !newTask.taskTitle || !newTask.assignedTo) {
      toast.error('Please fill in required fields: Project, Task Title, and Assigned To');
      return;
    }

    try {
      await onAddTask({
        ...newTask,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
      });

      setNewTask({
        project: '',
        area: '',
        trade: '',
        taskTitle: '',
        taskDetails: '',
        assignedTo: '',
        priority: 'Medium',
        dueDate: '',
        photoNeeded: false,
        status: 'Open',
        notes: '',
      });
      setShowAddDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add task');
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      project: 'all',
      area: 'all',
      trade: 'all',
      assignedTo: 'all',
      priority: 'all',
      status: 'all',
      photoNeeded: 'all',
      showOverdueOnly: false,
      showOpenOnly: false,
      showUrgentOnly: false,
    });
    toast.info('Filters reset');
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'Open': return <Clock className="size-4 text-orange-600" />;
      case 'In Progress': return <AlertCircle className="size-4 text-blue-600" />;
      case 'Closed': return <CheckCircle2 className="size-4 text-green-600" />;
      case 'Blocked': return <XCircle className="size-4 text-red-600" />;
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'Urgent': return 'destructive';
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
    }
  };

  const isOverdue = (task: Task) => {
    return task.dueDate && task.dueDate < new Date() && task.status !== 'Closed';
  };

  const getDaysOpen = (timestamp: Date) => {
    const days = Math.floor((new Date().getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="size-4 ml-1 text-gray-400" />;
    if (sortDirection === 'asc') return <ArrowUp className="size-4 ml-1 text-blue-600" />;
    return <ArrowDown className="size-4 ml-1 text-blue-600" />;
  };

  const activeFilterCount = Object.values(filters).filter(v => 
    v !== '' && v !== 'all' && v !== false
  ).length;

  return (
    <div className="space-y-4">
      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filters.showOpenOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({ ...filters, showOpenOnly: !filters.showOpenOnly })}
        >
          <Clock className="size-4 mr-2" />
          Open Only
        </Button>
        <Button
          variant={filters.showOverdueOnly ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setFilters({ ...filters, showOverdueOnly: !filters.showOverdueOnly })}
        >
          <AlertCircle className="size-4 mr-2" />
          Overdue Only
        </Button>
        <Button
          variant={filters.showUrgentOnly ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setFilters({ ...filters, showUrgentOnly: !filters.showUrgentOnly })}
        >
          <AlertCircle className="size-4 mr-2" />
          Urgent Only
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear Filters ({activeFilterCount})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Master Task List</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                {canAdd && (
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="size-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Task</DialogTitle>
                    <DialogDescription>Create a new task in the system</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Project *</Label>
                        <Input
                          value={newTask.project}
                          onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
                          placeholder="e.g., Grandin"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Area</Label>
                        <Input
                          value={newTask.area}
                          onChange={(e) => setNewTask({ ...newTask, area: e.target.value })}
                          placeholder="e.g., Kitchen"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trade</Label>
                        <Select value={newTask.trade || undefined} onValueChange={(val) => setNewTask({ ...newTask, trade: val })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                          <SelectContent>
                            {trades.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned To *</Label>
                        <Input
                          value={newTask.assignedTo}
                          onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                          placeholder="e.g., Tim"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Task Title *</Label>
                      <Input
                        value={newTask.taskTitle}
                        onChange={(e) => setNewTask({ ...newTask, taskTitle: e.target.value })}
                        placeholder="Brief title for the task"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Task Details</Label>
                      <Textarea
                        value={newTask.taskDetails}
                        onChange={(e) => setNewTask({ ...newTask, taskDetails: e.target.value })}
                        placeholder="Detailed description of the task"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={newTask.priority || undefined} onValueChange={(val) => setNewTask({ ...newTask, priority: val as TaskPriority })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={newTask.status || undefined} onValueChange={(val) => setNewTask({ ...newTask, status: val as TaskStatus })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newTask.photoNeeded}
                        onCheckedChange={(checked) => setNewTask({ ...newTask, photoNeeded: checked })}
                      />
                      <Label>Photo Needed</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={newTask.notes}
                        onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                        placeholder="Additional notes"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddTask}>Add Task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {canExport && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="size-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
              />
            </div>

            <Select value={filters.project || undefined} onValueChange={(val) => setFilters({ ...filters, project: val })}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.area || undefined} onValueChange={(val) => setFilters({ ...filters, area: val })}>
              <SelectTrigger>
                <SelectValue placeholder="All Areas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.trade || undefined} onValueChange={(val) => setFilters({ ...filters, trade: val })}>
              <SelectTrigger>
                <SelectValue placeholder="All Trades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {tradeList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.assignedTo || undefined} onValueChange={(val) => setFilters({ ...filters, assignedTo: val })}>
              <SelectTrigger>
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.priority || undefined} onValueChange={(val) => setFilters({ ...filters, priority: val })}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status || undefined} onValueChange={(val) => setFilters({ ...filters, status: val })}>
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
          </div>

          <Separator />

          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('timestamp')}>
                    <div className="flex items-center">
                      Timestamp
                      <SortIcon field="timestamp" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('timestamp')}>
                    <div className="flex items-center">
                      Days Old
                      <SortIcon field="timestamp" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('project')}>
                    <div className="flex items-center">
                      Project
                      <SortIcon field="project" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('area')}>
                    <div className="flex items-center">
                      Area
                      <SortIcon field="area" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('trade')}>
                    <div className="flex items-center">
                      Trade
                      <SortIcon field="trade" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('taskTitle')}>
                    <div className="flex items-center">
                      Task Title
                      <SortIcon field="taskTitle" />
                    </div>
                  </TableHead>
                  <TableHead>Task Details</TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('assignedTo')}>
                    <div className="flex items-center">
                      Assigned To
                      <SortIcon field="assignedTo" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('priority')}>
                    <div className="flex items-center">
                      Priority
                      <SortIcon field="priority" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('dueDate')}>
                    <div className="flex items-center">
                      Due Date
                      <SortIcon field="dueDate" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('photoNeeded')}>
                    <div className="flex items-center">
                      Photo
                      <SortIcon field="photoNeeded" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('status')}>
                    <div className="flex items-center">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-gray-500 py-8">
                      No tasks found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedTasks.map(task => (
                    <TableRow key={task.id} className={isOverdue(task) ? 'bg-red-50' : ''}>
                      <TableCell className="text-sm text-gray-600">
                        {task.timestamp.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={getDaysOpen(task.timestamp) > 7 ? 'text-red-600 font-semibold' : ''}>
                          {getDaysOpen(task.timestamp)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{task.project}</TableCell>
                      <TableCell>{task.area || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.trade || '-'}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{task.taskTitle || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={task.taskDetails || ''}>
                          {task.taskDetails || <span className="text-gray-400">-</span>}
                        </p>
                      </TableCell>
                      <TableCell>{task.assignedTo || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3 text-gray-400" />
                            <span className={isOverdue(task) ? 'text-red-600 font-semibold' : ''}>
                              {task.dueDate.toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.photoNeeded ? (
                          <Badge variant="secondary">Yes</Badge>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(val) => onUpdateTask(task.id, { status: val as TaskStatus })}
                        >
                          <SelectTrigger className="w-32">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(task.status)}
                              <SelectValue />
                            </div>
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
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this task?')) {
                                onDeleteTask(task.id);
                                toast.success('Task deleted');
                              }
                            }}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
