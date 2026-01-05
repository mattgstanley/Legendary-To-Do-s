import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Task } from '../types';
import { Mail, CheckCircle2, Clock, AlertCircle, Calendar, MapPin } from 'lucide-react';
import { Separator } from './ui/separator';

interface SubcontractorViewProps {
  tasks: Task[];
}

export function SubcontractorView({ tasks }: SubcontractorViewProps) {
  const subcontractors = useMemo(() => 
    Array.from(new Set(tasks.map(t => t.assignedTo).filter(a => a && a.trim()))),
    [tasks]
  );

  const [selectedCompany, setSelectedCompany] = useState<string>('');

  useEffect(() => {
    if (subcontractors.length > 0 && !selectedCompany) {
      setSelectedCompany(subcontractors[0]);
    }
  }, [subcontractors, selectedCompany]);

  const myTasks = useMemo(() => 
    tasks.filter(t => t.assignedTo === selectedCompany && t.status !== 'Closed'),
    [tasks, selectedCompany]
  );

  const completedTasks = useMemo(() =>
    tasks.filter(t => t.assignedTo === selectedCompany && t.status === 'Closed'),
    [tasks, selectedCompany]
  );

  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    myTasks.forEach(task => {
      const project = task.project || 'Unassigned';
      const existing = grouped.get(project) || [];
      grouped.set(project, [...existing, task]);
    });
    return grouped;
  }, [myTasks]);

  const getTaskDaysUntilDue = (task: Task) => {
    if (!task.dueDate) return null;
    const days = Math.floor((task.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (!selectedCompany) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">No subcontractors found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Mail className="size-6" />
            Weekly Task Summary
          </CardTitle>
          <CardDescription className="text-blue-700">
            Clear list of your items. No noise. No confusion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-blue-900">
              This is what you would receive via email every Monday morning. Simple, clear, actionable.
            </p>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-blue-900">View as:</label>
              <Select value={selectedCompany || undefined} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-64 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{myTasks.length}</div>
              <div className="text-xs text-gray-600 mt-1">Open Items</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {myTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent').length}
              </div>
              <div className="text-xs text-gray-600 mt-1">High Priority</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{completedTasks.length}</div>
              <div className="text-xs text-gray-600 mt-1">Completed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 border-b">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">From: Construction Command Center</div>
            <div className="text-xs text-gray-500">To: {selectedCompany}</div>
            <div className="text-xs text-gray-500">Subject: Your Weekly Tasks - {new Date().toLocaleDateString()}</div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <p className="text-sm">Hi {selectedCompany} team,</p>
              <p className="text-sm mt-2">
                Here are your open items for the week. Please review and let us know if you have any questions.
              </p>
            </div>

            <Separator />

            {myTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="size-12 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-900">All caught up!</p>
                <p className="text-sm text-gray-600 mt-1">No open items for {selectedCompany}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(tasksByProject.entries()).map(([projectName, projectTasks]) => (
                  <div key={projectName}>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <MapPin className="size-5 text-blue-600" />
                      {projectName}
                    </h3>
                    <div className="space-y-3">
                      {projectTasks.map((task, index) => {
                        const daysUntilDue = getTaskDaysUntilDue(task);
                        const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                        const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;

                        return (
                          <div key={task.id} className="border rounded-lg p-4 bg-white">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium text-gray-700">
                                    Item #{index + 1}
                                  </span>
                                  {task.priority === 'High' || task.priority === 'Urgent' ? (
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertCircle className="size-3" />
                                      {task.priority}
                                    </Badge>
                                  ) : null}
                                  {task.status === 'In Progress' && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Clock className="size-3" />
                                      In Progress
                                    </Badge>
                                  )}
                                  {isOverdue && (
                                    <Badge variant="destructive">OVERDUE</Badge>
                                  )}
                                  {isDueSoon && (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                      Due Soon
                                    </Badge>
                                  )}
                                </div>

                                <p className="text-sm font-medium mb-1">{task.taskTitle}</p>
                                {task.taskDetails && (
                                  <p className="text-sm text-gray-600 mb-2">{task.taskDetails}</p>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm text-gray-600">
                                  {task.area && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="size-4" />
                                      <span>Location: {task.area}</span>
                                    </div>
                                  )}
                                  {task.dueDate && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="size-4" />
                                      <span className={isOverdue ? 'text-red-600 font-semibold' : isDueSoon ? 'text-yellow-700 font-semibold' : ''}>
                                        Due: {task.dueDate.toLocaleDateString()}
                                        {daysUntilDue !== null && (
                                          <span className="ml-1">
                                            ({daysUntilDue === 0 ? 'Today' : 
                                              daysUntilDue > 0 ? `${daysUntilDue}d` : 
                                              `${Math.abs(daysUntilDue)}d overdue`})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <span>Created: {task.timestamp.toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>Trade: {task.trade}</span>
                                  </div>
                                </div>

                                {task.notes && (
                                  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                                    <p className="text-xs text-blue-900">
                                      <strong>Notes:</strong> {task.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="text-sm text-gray-600">
              <p>Questions or need clarification? Reply to this email or call the office.</p>
              <p className="mt-2">Thanks for your continued partnership.</p>
              <p className="mt-4 font-medium">The Construction Team</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {completedTasks.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <CheckCircle2 className="size-5" />
              Recently Completed
            </CardTitle>
            <CardDescription className="text-green-700">
              Tasks completed this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map(task => (
                <div key={task.id} className="p-3 bg-white rounded border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{task.project}</Badge>
                    <span className="text-xs text-gray-500">
                      Completed {task.timestamp.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{task.taskTitle}</p>
                  {task.taskDetails && (
                    <p className="text-sm text-gray-600 mt-1">{task.taskDetails}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
