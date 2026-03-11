import { useState, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Task, TaskStatus, TaskPriority, FilterState } from '../types';
import {
  Download,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onAddTask: (task: Omit<Task, 'id' | 'timestamp'>) => void | Promise<void>;
  canAdd?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  quickFilter?: 'all' | 'open' | 'overdue' | 'urgent';
  addDialogOpen?: boolean;
  onAddDialogOpenChange?: (open: boolean) => void;
}

type SortField = keyof Task;
type SortDirection = 'asc' | 'desc' | null;

const trades = ['Tile', 'Plumbing', 'Landscaping', 'Electrical', 'Drywall', 'Paint', 'HVAC', 'Flooring', 'Cabinets', 'Framing', 'Other'];

export function TaskTable({ tasks, onUpdateTask, onDeleteTask, onAddTask, canAdd = true, canDelete = true, canExport = true, quickFilter = 'all', addDialogOpen: controlledAddOpen, onAddDialogOpenChange: onControlledAddOpenChange }: TaskTableProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    project: 'all',
    area: 'all',
    trade: 'all',
    assignedTo: 'all',
    priority: 'all',
    status: 'all',
    photoNeeded: 'all',
    showOverdueOnly: quickFilter === 'overdue',
    showOpenOnly: quickFilter === 'open',
    showUrgentOnly: quickFilter === 'urgent',
  });

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const addDialogOpen = controlledAddOpen !== undefined ? controlledAddOpen : internalAddOpen;
  const setAddDialogOpen = onControlledAddOpenChange ?? setInternalAddOpen;

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      showOpenOnly: quickFilter === 'open',
      showOverdueOnly: quickFilter === 'overdue',
      showUrgentOnly: quickFilter === 'urgent',
    }));
  }, [quickFilter]);

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
      setAddDialogOpen(false);
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

  const getPriorityBadgeClass = (priority: TaskPriority) => {
    switch (priority) {
      case 'Urgent': return 'badge-lh badge-high';
      case 'High': return 'badge-lh badge-high';
      case 'Medium': return 'badge-lh badge-medium';
      case 'Low': return 'badge-lh badge-low';
      default: return 'badge-lh badge-medium';
    }
  };

  const getStatusBadgeClass = (status: TaskStatus) => {
    switch (status) {
      case 'Open': return 'badge-lh badge-open';
      case 'In Progress': return 'badge-lh badge-progress';
      case 'Closed': return 'badge-lh badge-done';
      case 'Blocked': return 'badge-lh badge-blocked';
      default: return 'badge-lh badge-open';
    }
  };

  const activeFilterCount = Object.values(filters).filter(v =>
    v !== '' && v !== 'all' && v !== false
  ).length;

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

  return (
    <>
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          className="filter-select"
          value={filters.project}
          onChange={(e) => setFilters({ ...filters, project: e.target.value })}
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="filter-select"
          value={filters.trade}
          onChange={(e) => setFilters({ ...filters, trade: e.target.value })}
        >
          <option value="all">All Trades</option>
          {tradeList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="filter-select"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="all">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="all">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Closed">Closed</option>
          <option value="Blocked">Blocked</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-header-row">
          <div>
            <div className="table-title">Master Task List</div>
            <div className="table-count">Showing {filteredAndSortedTasks.length} of {tasks.length} tasks</div>
          </div>
          <div className="table-actions">
            {canExport && (
              <button type="button" className="btn btn-ghost" onClick={handleExport}>
                ↓ Export
              </button>
            )}
            {canAdd && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="btn btn-gold" onClick={() => setAddDialogOpen(true)}>
                    + Add Task
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddTask}>Save Task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')}>Timestamp <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('timestamp')}>Days Old <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('project')}>Project <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('area')}>Area <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('trade')}>Trade <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('taskTitle')}>Task Title <span className="sort-icon">⇅</span></th>
              <th>Task Details</th>
              <th onClick={() => handleSort('assignedTo')}>Assigned To <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('priority')}>Priority <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('dueDate')}>Due Date <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('photoNeeded')}>Photo <span className="sort-icon">⇅</span></th>
              <th onClick={() => handleSort('status')}>Status <span className="sort-icon">⇅</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTasks.length === 0 ? (
              <tr>
                <td colSpan={13} className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p>No tasks found matching your filters</p>
                </td>
              </tr>
            ) : (
              filteredAndSortedTasks.map(task => {
                const daysOpen = getDaysOpen(task.timestamp);
                const daysClass = daysOpen > 7 ? 'td-days critical' : daysOpen <= 2 ? 'td-days fresh' : 'td-days';
                return (
                  <tr key={task.id} style={isOverdue(task) ? { background: 'rgba(192,57,43,0.06)' } : undefined}>
                    <td className="td-muted">{task.timestamp.toLocaleString()}</td>
                    <td className={daysClass}>{daysOpen}</td>
                    <td className="td-project">{task.project}</td>
                    <td className="td-muted">{task.area || '—'}</td>
                    <td><span className="trade-pill">{task.trade || '—'}</span></td>
                    <td>{task.taskTitle || '—'}</td>
                    <td className="td-muted" style={{ maxWidth: 200 }}><span title={task.taskDetails || ''}>{task.taskDetails ? `${task.taskDetails.slice(0, 40)}${task.taskDetails.length > 40 ? '…' : ''}` : '—'}</span></td>
                    <td>{task.assignedTo || '—'}</td>
                    <td><span className={getPriorityBadgeClass(task.priority)}>{task.priority}</span></td>
                    <td className={isOverdue(task) ? 'td-muted' : ''} style={isOverdue(task) ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
                      {task.dueDate ? task.dueDate.toLocaleDateString() : '—'}
                    </td>
                    <td className={task.photoNeeded ? 'photo-yes' : 'photo-no'}>{task.photoNeeded ? 'Yes' : 'No'}</td>
                    <td>
                      <Select
                        value={task.status}
                        onValueChange={(val) => onUpdateTask(task.id, { status: val as TaskStatus })}
                      >
                        <SelectTrigger className={`status-select-trigger ${task.status === 'Open' ? 'status-open' : ''}`} style={{ minWidth: 90 }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          <SelectItem value="Blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 10 }}
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this task?')) {
                              onDeleteTask(task.id);
                              toast.success('Task deleted');
                            }
                          }}
                        >
                          <Trash2 className="size-4" style={{ color: 'var(--red)' }} />
                        </button>
                      ) : (
                        <span className="td-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
