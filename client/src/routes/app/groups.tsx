import React, { useState } from 'react';
import { Users, Plus, ArrowLeft } from 'lucide-react';
import { GroupChatList } from '../../components/GroupChatList';
import { GroupChat } from '../../components/GroupChat';
import { CreateGroupDialog } from '../../components/CreateGroupDialog';

export function GroupsPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 glass-light border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {selectedGroupId ? (
            <button
              onClick={() => setSelectedGroupId(null)}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <ArrowLeft size={18} />
              <span className="font-semibold">Groups</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Users size={20} className="text-indigo-400" />
              <span className="font-semibold text-white">Group Chats</span>
            </div>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-all-custom"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <GroupChatList
            onSelectGroup={setSelectedGroupId}
            selectedGroupId={selectedGroupId || undefined}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {selectedGroupId ? (
          <GroupChat
            groupId={selectedGroupId}
            onBack={() => setSelectedGroupId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Users size={64} className="mb-4 text-gray-600" />
            <p className="text-lg font-medium text-gray-400">Select a group chat</p>
            <p className="text-sm text-gray-600 mt-1">Or create a new one to get started</p>
          </div>
        )}
      </div>

      {/* Create group dialog */}
      {showCreate && (
        <CreateGroupDialog
          onClose={() => setShowCreate(false)}
          onCreated={(groupId: string) => {
            setShowCreate(false);
            setSelectedGroupId(groupId);
          }}
        />
      )}
    </div>
  );
}
