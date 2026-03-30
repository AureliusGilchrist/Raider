import React, { useState, useEffect } from 'react';
import { X, Plus, Shield, Trash2 } from 'lucide-react';
import { servers as serversApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: number;
}

interface RoleManagerProps {
  serverId: string;
  onClose: () => void;
}

const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 0x00000001,
  KICK_MEMBERS: 0x00000002,
  BAN_MEMBERS: 0x00000004,
  ADMINISTRATOR: 0x00000008,
  MANAGE_CHANNELS: 0x00000010,
  MANAGE_GUILD: 0x00000020,
  VIEW_AUDIT_LOG: 0x00000080,
  MANAGE_MESSAGES: 0x00002000,
  MANAGE_ROLES: 0x10000000,
  MANAGE_WEBHOOKS: 0x20000000,
};

export function RoleManager({ serverId, onClose }: RoleManagerProps) {
  const { user } = useAuthStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#99AAB5');

  useEffect(() => {
    loadRoles();
  }, [serverId]);

  const loadRoles = async () => {
    try {
      const data = await serversApi.roles(serverId);
      setRoles(data.sort((a: Role, b: Role) => b.position - a.position));
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await serversApi.createRole(serverId, {
        name: newRoleName,
        color: newRoleColor,
        hoist: false,
        mentionable: false,
        permissions: 0,
      });
      setNewRoleName('');
      setIsCreating(false);
      loadRoles();
    } catch (err) {
      console.error('Failed to create role:', err);
    }
  };

  const handleUpdateRole = async (roleId: string, updates: Partial<Role>) => {
    try {
      await serversApi.updateRole(serverId, roleId, updates);
      loadRoles();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Delete this role?')) return;
    try {
      await serversApi.deleteRole(serverId, roleId);
      setSelectedRole(null);
      loadRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
    }
  };

  const hasPermission = (perms: number, perm: number) => (perms & perm) !== 0;

  const togglePermission = (role: Role, perm: number) => {
    const newPerms = hasPermission(role.permissions, perm)
      ? role.permissions & ~perm
      : role.permissions | perm;
    handleUpdateRole(role.id, { permissions: newPerms });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass p-6 rounded-xl w-full max-w-2xl">
          <p className="text-gray-400 text-center">Loading roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass p-6 rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={20} /> Server Roles
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-all-custom">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Role List */}
          <div className="w-48 flex flex-col gap-2">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition-all-custom"
            >
              <Plus size={14} /> Create Role
            </button>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => { setSelectedRole(role); setIsCreating(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all-custom ${
                    selectedRole?.id === role.id ? 'bg-white/15' : 'hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="text-gray-300 truncate">{role.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Role Editor */}
          <div className="flex-1 overflow-y-auto">
            {isCreating ? (
              <div className="space-y-4">
                <h3 className="text-white font-semibold">Create New Role</h3>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Role Name</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="New Role"
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="h-8 w-16 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-400">{newRoleColor}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsCreating(false)} className="btn btn-glass flex-1">Cancel</button>
                  <button onClick={handleCreateRole} className="btn btn-primary flex-1">Create</button>
                </div>
              </div>
            ) : selectedRole ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">{selectedRole.name}</h3>
                  <button
                    onClick={() => handleDeleteRole(selectedRole.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all-custom"
                    title="Delete Role"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase">Role Name</label>
                  <input
                    type="text"
                    value={selectedRole.name}
                    onChange={(e) => handleUpdateRole(selectedRole.id, { name: e.target.value })}
                    className="w-full mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase">Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={selectedRole.color}
                      onChange={(e) => handleUpdateRole(selectedRole.id, { color: e.target.value })}
                      className="h-8 w-16 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-400">{selectedRole.color}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase">Permissions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PERMISSIONS).map(([name, value]) => (
                      <label key={name} className="flex items-center gap-2 p-2 bg-white/5 rounded cursor-pointer hover:bg-white/10">
                        <input
                          type="checkbox"
                          checked={hasPermission(selectedRole.permissions, value)}
                          onChange={() => togglePermission(selectedRole, value)}
                          className="rounded"
                        />
                        <span className="text-xs text-gray-300">{name.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a role to edit or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
