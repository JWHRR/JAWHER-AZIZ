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
    p =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (profile: Profile) => {
    setSelectedUsers(prev =>
      prev.find(u => u.user_id === profile.user_id)
        ? prev.filter(u => u.user_id !== profile.user_id)
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
    const id = await createGroupConversation(groupName.trim(), selectedUsers.map(u => u.user_id));
    setLoading(false);
    if (id) {
      onConversationCreated(id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">Nouvelle conversation</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="private" className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger
              value="private"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm font-medium"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message privé
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm font-medium"
            >
              <Users className="h-4 w-4 mr-2" />
              Groupe
            </TabsTrigger>
          </TabsList>

          {/* Private Tab */}
          <TabsContent value="private" className="mt-0">
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  className="pl-9 rounded-full bg-secondary/40 border-none"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="h-64 px-2 pb-4">
              {filtered.map(profile => (
                <button
                  key={profile.user_id}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                  onClick={() => handlePrivateChat(profile)}
                  disabled={loading}
                >
                  <Avatar className="h-10 w-10 bg-primary/10">
                    <AvatarFallback className="text-primary font-medium">
                      {profile.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun utilisateur trouvé</p>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Group Tab */}
          <TabsContent value="group" className="mt-0">
            <div className="px-4 pt-4 space-y-3">
              <Input
                placeholder="Nom du groupe..."
                className="rounded-full bg-secondary/40 border-none"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ajouter des membres..."
                  className="pl-9 rounded-full bg-secondary/40 border-none"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <Badge key={u.user_id} variant="secondary" className="flex items-center gap-1 pr-1.5 rounded-full">
                      {u.full_name.split(' ')[0]}
                      <button onClick={() => toggleUser(u)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ScrollArea className="h-48 px-2 pb-2">
              {filtered.map(profile => {
                const isSelected = selectedUsers.some(u => u.user_id === profile.user_id);
                return (
                  <button
                    key={profile.user_id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-left",
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/60"
                    )}
                    onClick={() => toggleUser(profile)}
                  >
                    <Avatar className="h-9 w-9 bg-primary/10">
                      <AvatarFallback className="text-primary text-xs font-medium">
                        {profile.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium">{profile.full_name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </ScrollArea>
            <div className="px-4 pb-4 pt-2 border-t">
              <Button
                className="w-full rounded-full"
                disabled={!groupName.trim() || selectedUsers.length < 1 || loading}
                onClick={handleCreateGroup}
              >
                Créer le groupe ({selectedUsers.length} membres)
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
