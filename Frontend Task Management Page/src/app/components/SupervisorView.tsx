import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Mic, MicOff, Plus, Check, Clock, AlertCircle } from 'lucide-react';
import { Task, Project, TaskPriority } from '../types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

interface SupervisorViewProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (task: Omit<Task, 'id' | 'timestamp'>) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onAddProject: (project: Omit<Project, 'id'>) => void;
}

const trades = ['Framing', 'Electrical', 'Plumbing', 'HVAC', 'Drywall', 'Paint', 'Flooring', 'Tile', 'Cabinets', 'Landscaping', 'Other'];
const subcontractors = ['ABC Framing Co', 'Bright Electric', 'Best Plumbing Inc', 'Cool Air Systems', 'Perfect Walls LLC', 'Premier Painting', 'Floor Masters', 'Tile Pro', 'Custom Cabinets Inc'];

export function SupervisorView({ tasks, projects, onAddTask, onUpdateTask, onAddProject }: SupervisorViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [trade, setTrade] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [area, setArea] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [newProjectName, setNewProjectName] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  const handleVoiceToggle = () => {
    if (!isRecording) {
      setIsRecording(true);
      toast.info('Voice recording started');
    } else {
      setIsRecording(false);
      if (voiceInput) {
        setTaskDetails(voiceInput);
        toast.success('Voice input captured');
      }
    }
  };

  const handleQuickCreate = () => {
    if (!selectedProject || !taskTitle || !trade || !assignedTo) {
      toast.error('Please fill in all required fields');
      return;
    }

    const project = projects.find(p => p.id === selectedProject);
    if (!project) return;

    const newTask: Omit<Task, 'id' | 'timestamp'> = {
      project: project.name,
      area: area || '',
      trade,
      taskTitle,
      taskDetails: taskDetails || '',
      assignedTo,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      photoNeeded: false,
      status: 'Open',
      notes: '',
    };

    onAddTask(newTask);
    
    setTaskTitle('');
    setTaskDetails('');
    setVoiceInput('');
    setTrade('');
    setAssignedTo('');
    setPriority('Medium');
    setArea('');
    setDueDate('');

    toast.success('Task created successfully');
  };

  const handleAddProject = () => {
    if (!newProjectName) {
      toast.error('Please fill in project name');
      return;
    }

    onAddProject({
      name: newProjectName,
    });

    setNewProjectName('');
    setShowProjectDialog(false);
    toast.success('Project added successfully');
  };

  const recentTasks = tasks
    .filter(task => task.status !== 'Closed')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Walkthrough Input</CardTitle>
          <CardDescription>
            Speak naturally or type as you walk. No forms, no stopping - just capture what you see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Voice Input (Simulated)</Label>
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleVoiceToggle}
                className="ml-auto"
              >
                {isRecording ? <MicOff className="size-4 mr-2" /> : <Mic className="size-4 mr-2" />}
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
            </div>
            {isRecording && (
              <Textarea
                placeholder="Speak or type: 'West wall in master bedroom, framing studs not plumb, ABC Framing needs to fix before drywall...'"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                className="min-h-24 border-red-300 bg-red-50"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <div className="flex gap-2">
                <Select value={selectedProject || undefined} onValueChange={setSelectedProject}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Plus className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>Create a new project to track tasks against</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project Name *</Label>
                        <Input
                          id="project-name"
                          placeholder="e.g., Grandin"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleAddProject} className="w-full">Add Project</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                placeholder="e.g., Master Bedroom - West Wall"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskTitle">Task Title *</Label>
            <Input
              id="taskTitle"
              placeholder="Brief task description"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskDetails">Issue Description</Label>
            <Textarea
              id="taskDetails"
              placeholder="Describe what needs to be fixed..."
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trade">Trade *</Label>
              <Select value={trade || undefined} onValueChange={setTrade}>
                <SelectTrigger id="trade">
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {trades.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To *</Label>
              <Select value={assignedTo || undefined} onValueChange={setAssignedTo}>
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Select subcontractor" />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority || undefined} onValueChange={(val) => setPriority(val as TaskPriority)}>
                <SelectTrigger id="priority">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleQuickCreate} className="w-full" size="lg">
            <Plus className="size-4 mr-2" />
            Create Task
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
          <CardDescription>Recently created tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No tasks created yet</p>
            ) : (
              recentTasks.map(task => (
                <div key={task.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={
                          task.status === 'Closed' ? 'default' :
                          task.status === 'In Progress' ? 'secondary' :
                          task.status === 'Blocked' ? 'destructive' : 'outline'
                        }>
                          {task.status === 'Closed' && <Check className="size-3 mr-1" />}
                          {task.status === 'In Progress' && <Clock className="size-3 mr-1" />}
                          {task.status === 'Blocked' && <AlertCircle className="size-3 mr-1" />}
                          {task.status}
                        </Badge>
                        <Badge variant={
                          task.priority === 'Urgent' || task.priority === 'High' ? 'destructive' :
                          task.priority === 'Medium' ? 'secondary' : 'outline'
                        }>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-gray-500">{task.project}</span>
                      </div>
                      <p className="text-sm font-medium">{task.taskTitle}</p>
                      {task.taskDetails && <p className="text-sm text-gray-600">{task.taskDetails}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span>{task.trade} • {task.assignedTo}</span>
                        {task.area && <span>📍 {task.area}</span>}
                      </div>
                    </div>
                    {task.status !== 'Closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateTask(task.id, { 
                          status: task.status === 'Open' ? 'In Progress' : 'Closed'
                        })}
                      >
                        {task.status === 'Open' ? 'Start' : 'Complete'}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
