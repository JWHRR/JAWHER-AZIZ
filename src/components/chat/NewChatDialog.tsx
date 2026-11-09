import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNewConversation } from '@/hooks/useNewConversation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageSquare, Users, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationCreated: (conversationId: string) => void;
}

export const NewChatDialog: React.FC<NewChatDialogProps> = ({
  open,
  onOpenChange,
  currentUserId,
  onConversationCreated,
}) => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const { createPrivateConversation, createGroupConversation } = useNewConversation(currentUserId);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedUsers([]);
      setGroupName('');
      return;
    }
    const fetchProfiles = async () => {
      const { data } = await supabase.rpc('get_chat_profiles');
      if (data) {
        setProfiles(
          (data as Profile[]).filter((p) => p.user_id !== currentUserId)
        );
      }
    };
    fetchProfiles();
  }, [open, currentUserId]);

  const filtered = profiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (profile: Profile) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.user_id === profile.user_id)
        ? prev.filter((u) => u.user_id !== profile.user_id)
        : [...prev, profile]
    );
  };

  const handlePrivateChat = async (profile: Profile) => {
    setLoading(true);
    const id = await createPrivateConversation(profile.user_id);
    setLoading(false);
    if (id) {
      onConversationCreated(id);
      onOpenChange(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 1) return;
    setLoading(true);
    const id = await createGroupConversation(groupName.trim(), selectedUsers.map((u) => u.user_id));
    setLoading(false);
    if (id) {
      onConversationCreated(id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl border border-gray-200 shadow-2xl bg-white">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#E4E6EB]">
          <DialogTitle className="text-lg font-bold text-[#050505]">
            Nouveau message
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="private" className="w-full">
          <TabsList className="w-full rounded-none border-b border-[#E4E6EB] bg-transparent h-auto p-0">
            <TabsTrigger
              value="private"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0084FF] data-[state=active]:text-[#0084FF] data-[state=active]:bg-transparent py-3 text-sm font-semibold text-gray-500"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message privé
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0084FF] data-[state=active]:text-[#0084FF] data-[state=active]:bg-transparent py-3 text-sm font-semibold text-gray-500"
            >
              <Users className="h-4 w-4 mr-2" />
              Groupe
            </TabsTrigger>
          </TabsList>

          {/* Private Tab */}
          <TabsContent value="private" className="mt-0">
            <div className="px-4 pt-3.5 pb-2">
              <div className="relative flex items-center bg-[#F0F2F5] rounded-full px-3 py-1.5">
                <span className="text-xs font-semibold text-[#65676B] mr-2">À :</span>
                <Search className="h-4 w-4 text-[#8A8D91] mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Rechercher une personne..."
                  className="bg-transparent border-none outline-none text-sm flex-1 text-[#050505] placeholder:text-[#8A8D91]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="h-72 px-2 pb-3">
              {filtered.map((profile) => (
                <button
                  key={profile.user_id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F2] transition-colors text-left"
                  onClick={() => handlePrivateChat(profile)}
                  disabled={loading}
                >
                  <Avatar className="h-10 w-10 bg-blue-500">
                    <AvatarFallback className="text-white text-xs font-bold bg-blue-500">
                      {profile.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[#050505] truncate">
                      {profile.full_name}
                    </p>
                    <p className="text-xs text-[#65676B] truncate">{profile.email}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-[#8A8D91] py-10">Aucun contact trouvé</p>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Group Tab */}
          <TabsContent value="group" className="mt-0">
            <div className="px-4 pt-3 space-y-2.5">
              <Input
                placeholder="Nom du groupe..."
                className="rounded-full bg-[#F0F2F5] border-none text-sm text-[#050505] placeholder:text-[#8A8D91] h-9"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className="relative flex items-center bg-[#F0F2F5] rounded-full px-3 py-1.5">
                <span className="text-xs font-semibold text-[#65676B] mr-2">À :</span>
                <Search className="h-4 w-4 text-[#8A8D91] mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Ajouter des membres..."
                  className="bg-transparent border-none outline-none text-sm flex-1 text-[#050505] placeholder:text-[#8A8D91]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedUsers.map((u) => (
                    <Badge
                      key={u.user_id}
                      variant="secondary"
                      className="bg-blue-50 text-[#0084FF] hover:bg-blue-100 flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border border-blue-200"
                    >
                      {u.full_name.split(' ')[0]}
                      <button
                        type="button"
                        onClick={() => toggleUser(u)}
                        className="h-4 w-4 rounded-full hover:bg-blue-200 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <ScrollArea className="h-52 px-2 pb-2 mt-2">
              {filtered.map((profile) => {
                const isSelected = selectedUsers.some((u) => u.user_id === profile.user_id);
                return (
                  <button
                    key={profile.user_id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left',
                      isSelected ? 'bg-blue-50' : 'hover:bg-[#F2F2F2]'
                    )}
                    onClick={() => toggleUser(profile)}
                  >
                    <Avatar className="h-9 w-9 bg-blue-500">
                      <AvatarFallback className="text-white text-xs font-bold bg-blue-500">
                        {profile.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-semibold text-[#050505] truncate">
                      {profile.full_name}
                    </span>
                    <div
                      className={cn(
                        'h-5 w-5 rounded-full border flex items-center justify-center transition-all',
                        isSelected
                          ? 'bg-[#0084FF] border-[#0084FF] text-white'
                          : 'border-gray-300'
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </ScrollArea>

            <div className="px-4 pb-4 pt-2.5 border-t border-[#E4E6EB]">
              <Button
                className="w-full rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white font-semibold h-10 shadow-xs"
                disabled={!groupName.trim() || selectedUsers.length < 1 || loading}
                onClick={handleCreateGroup}
              >
                Créer le groupe ({selectedUsers.length} membre{selectedUsers.length > 1 ? 's' : ''})
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
