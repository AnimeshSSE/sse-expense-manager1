'use client'

import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserCircle, Mail, Shield, Building, Hash, Save } from 'lucide-react'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  STOCK_MANAGER: 'Stock Manager',
  DEPARTMENT_HEAD: 'Department Head',
  EMPLOYEE: 'Employee',
}

export function Settings() {
  const { currentUser } = useAppStore()

  if (!currentUser) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal information and account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{currentUser.name}</h3>
              <Badge variant="outline" className="mt-1">
                {roleLabels[currentUser.role] || currentUser.role}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                Full Name
              </Label>
              <Input value={currentUser.name} readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input value={currentUser.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                Role
              </Label>
              <Input value={roleLabels[currentUser.role] || currentUser.role} readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Building className="h-4 w-4" />
                Department
              </Label>
              <Input value={currentUser.department} readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-4 w-4" />
                Employee ID
              </Label>
              <Input value={currentUser.employeeId} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notification Settings</Label>
            <p className="text-sm text-muted-foreground">
              Configure how you receive notifications for expense approvals and updates.
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <span className="text-sm flex-1">Email notifications for pending approvals</span>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
