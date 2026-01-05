import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserRole } from '../utils/roles';
import { Shield, UserCheck, HardHat } from 'lucide-react';

interface RoleSelectorProps {
  onRoleSelect: (role: UserRole) => void;
}

export function RoleSelector({ onRoleSelect }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const roles: { value: UserRole; label: string; description: string; icon: any }[] = [
    {
      value: 'admin',
      label: 'Admin',
      description: 'Full access to all features, tasks, projects, and contractors',
      icon: Shield,
    },
    {
      value: 'supervisor',
      label: 'Supervisor',
      description: 'Can add and edit tasks, view all tasks, but cannot delete or manage projects',
      icon: UserCheck,
    },
    {
      value: 'subcontractor',
      label: 'Subcontractor',
      description: 'Can view and update only tasks assigned to you',
      icon: HardHat,
    },
  ];

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          <DialogDescription>
            Choose your role to access the appropriate features. You can change this later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card
                key={role.value}
                className={`cursor-pointer transition-all ${
                  selectedRole === role.value
                    ? 'border-blue-600 border-2 bg-blue-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedRole(role.value)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="size-6 text-blue-600" />
                    <CardTitle className="text-lg">{role.label}</CardTitle>
                  </div>
                  <CardDescription className="text-sm mt-2">
                    {role.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={() => selectedRole && onRoleSelect(selectedRole)}
            disabled={!selectedRole}
            className="min-w-24"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
