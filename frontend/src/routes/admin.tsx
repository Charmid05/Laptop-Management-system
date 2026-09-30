import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls, Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";
import { useDB, createRecord, updateRecord, deleteRecord, uid, nowISO } from "@/services/store";
import { api } from "@/services/api";
import { toast } from "sonner";
import { Plus, Trash2, Shield, Users, FileText, Key } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => meta("Administration", "User management and settings — Amani Eye practice manager."),
  component: () => <AppShell module="administration"><Administration /></AppShell>,
});

function Administration() {
  const db = useDB();
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");

  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    username: "",
    phone: "",
    role: "receptionist" as const,
    status: "active" as const,
  });

  const handleCreateUser = async () => {
    if (!newUser.fullName || !newUser.email || !newUser.username || !newUser.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createRecord("users", {
        ...newUser,
        id: uid("us"),
        lastLogin: null,
        createdAt: nowISO(),
      });
      toast.success("User created successfully");
      setShowUserDialog(false);
      setNewUser({ fullName: "", email: "", username: "", phone: "", role: "receptionist", status: "active" });
    } catch (error) {
      toast.error("Failed to create user");
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user ${name}? This action cannot be undone.`)) return;
    try {
      await deleteRecord("users", id);
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user");
      console.error(error);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    try {
      await api(`/users/${selectedUser}/password`, { method: "POST", body: { password: newPassword } });
      toast.success("Password changed successfully");
      setShowPasswordDialog(false);
      setNewPassword("");
      setSelectedUser("");
    } catch (error) {
      toast.error("Failed to change password");
      console.error(error);
    }
  };

  const handleUpdateUserStatus = async (id: string, status: "active" | "disabled") => {
    try {
      await updateRecord("users", id, { status });
      toast.success("User status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Manage users, roles, and system settings"
        actions={
          <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-full"><Plus className="mr-2 size-4" /> Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add new user</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="Full name *">
                  <Input
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="John Doe"
                  />
                </Field>
                <Field label="Email *">
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </Field>
                <Field label="Username *">
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="johndoe"
                  />
                </Field>
                <Field label="Phone *">
                  <Input
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                  />
                </Field>
                <Field label="Role *">
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className={selectCls}
                  >
                    <option value="administrator">Administrator</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="optometrist">Optometrist</option>
                    <option value="cashier">Cashier</option>
                    <option value="store_officer">Store Officer</option>
                  </select>
                </Field>
                <Field label="Status *">
                  <select
                    value={newUser.status}
                    onChange={(e) => setNewUser({ ...newUser, status: e.target.value as any })}
                    className={selectCls}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </Field>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser}>Create user</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Panel title="System users">
            {db.users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db.users.map((user) => {
                      const role = db.roles.find((r) => r.id === user.role);
                      return (
                        <tr key={user.id}>
                          <td className="font-semibold">{user.fullName}</td>
                          <td className="font-mono">{user.username}</td>
                          <td>{user.email}</td>
                          <td>{user.phone}</td>
                          <td>{role?.name || user.role}</td>
                          <td><StatusBadge status={user.status} /></td>
                          <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</td>
                          <td>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedUser(user.id); setShowPasswordDialog(true); }}
                              >
                                <Key className="size-4" />
                              </Button>
                              {user.status === "active" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateUserStatus(user.id, "disabled")}
                                  className="text-warning"
                                >
                                  Disable
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateUserStatus(user.id, "active")}
                                  className="text-success"
                                >
                                  Enable
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.fullName)}
                                className="text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="roles">
          <Panel title="System roles and permissions">
            {db.roles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No roles found</p>
            ) : (
              <div className="space-y-4">
                {db.roles.map((role) => (
                  <div key={role.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{role.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                      </div>
                      <StatusBadge status={role.id === "administrator" ? "active" : "info"} text={role.id} />
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {role.modules.map((module) => (
                          <span key={module} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {module}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="audit">
          <Panel title="Audit log">
            {db.audit.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No audit entries found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Record</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db.audit.slice(0, 50).map((entry) => {
                      const user = db.users.find((u) => u.id === entry.userId);
                      return (
                        <tr key={entry.id}>
                          <td className="text-sm">{new Date(entry.timestamp).toLocaleString()}</td>
                          <td className="font-medium">{user?.fullName || "Unknown"}</td>
                          <td>{entry.action}</td>
                          <td>{entry.module}</td>
                          <td className="font-mono text-sm">{entry.record}</td>
                          <td className="max-w-xs truncate">{entry.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="New password *">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 4 characters)"
              />
            </Field>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
              <Button onClick={handleChangePassword}>Change password</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
