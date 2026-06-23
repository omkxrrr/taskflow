'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import { createNotifications } from '@/lib/notifications';
import AppLoader from '@/components/layout/AppLoader';

type Conversation = {
  id: string;
  type: 'dm' | 'group' | 'department' | 'announcements';
  name: string | null;
  created_by: string | null;
  is_admin_only_post: boolean;
  updated_at: string;
  members?: any[];
  lastMessage?: any;
  unreadCount?: number;
};

const chatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const initials = (name = '') =>
  name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const safeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_');

const missingAttachmentColumns = (message?: string) =>
  !!message && (
    message.includes('attachment_name')
    || message.includes('attachment_url')
    || message.includes('attachment_type')
    || message.includes('attachment_size')
    || message.includes('schema cache')
  );

export default function ChatPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<'group' | 'announcements'>('group');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

  const fetchConversations = useCallback(async (userId: string) => {
    const { data: memberships, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, hidden_at, conversation:conversations(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load chats: ' + error.message);
      return;
    }

    const conversationRows = (memberships || [])
      .map((row: any) => row.conversation)
      .filter(Boolean) as Conversation[];
    const ids = conversationRows.map(c => c.id);

    let membersByConversation: Record<string, any[]> = {};
    let latestByConversation: Record<string, any> = {};
    let unreadByConversation: Record<string, number> = {};

    if (ids.length > 0) {
      const [{ data: allMembers }, recentResult] = await Promise.all([
        supabase
          .from('conversation_members')
          .select('conversation_id, user_id, last_read_at, profile:profiles(full_name, email, role)')
          .in('conversation_id', ids),
        supabase
          .from('chat_messages')
          .select('id, conversation_id, sender_id, content, created_at, attachment_url, attachment_name, attachment_type, attachment_size')
          .in('conversation_id', ids)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(250),
      ]);

      let recentMessages = recentResult.data;
      if (recentResult.error && missingAttachmentColumns(recentResult.error.message)) {
        const { data: fallbackMessages } = await supabase
          .from('chat_messages')
          .select('id, conversation_id, sender_id, content, created_at')
          .in('conversation_id', ids)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(250);
        recentMessages = fallbackMessages;
      }

      (allMembers || []).forEach((member: any) => {
        membersByConversation[member.conversation_id] ||= [];
        membersByConversation[member.conversation_id].push(member);
      });

      const readState = new Map<string, string | null>(
        (memberships || []).map((row: any) => [row.conversation_id, row.last_read_at])
      );
      (recentMessages || []).forEach((msg: any) => {
        latestByConversation[msg.conversation_id] ||= msg;
        const lastReadAt = readState.get(msg.conversation_id);
        if (msg.sender_id !== userId && (!lastReadAt || new Date(msg.created_at) > new Date(lastReadAt))) {
          unreadByConversation[msg.conversation_id] = (unreadByConversation[msg.conversation_id] || 0) + 1;
        }
      });
    }

    const membershipByConversation = new Map(
      (memberships || []).map((row: any) => [row.conversation_id, row])
    );

    const enriched = conversationRows
      .filter(conversation => {
        const membership: any = membershipByConversation.get(conversation.id);
        if (!membership?.hidden_at) return true;
        const latestMessage = latestByConversation[conversation.id];
        return latestMessage && new Date(latestMessage.created_at) > new Date(membership.hidden_at);
      })
      .map(conversation => ({
        ...conversation,
        members: membersByConversation[conversation.id] || [],
        lastMessage: latestByConversation[conversation.id],
        unreadCount: unreadByConversation[conversation.id] || 0,
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage?.created_at || a.updated_at;
        const bTime = b.lastMessage?.created_at || b.updated_at;
        return bTime.localeCompare(aTime);
      });

    setConversations(enriched);
    setSelectedId(current =>
      current && enriched.some(conversation => conversation.id === current)
        ? current
        : enriched[0]?.id || null
    );
  }, [supabase]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/auth/login';
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, department:departments!profiles_department_id_fkey(name)')
      .eq('id', session.user.id)
      .single();

    if (await signOutInactiveUser(supabase, prof)) return;
    setProfile(prof);

    const { data: userRows } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id, department:departments!profiles_department_id_fkey(name)')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    setUsers((userRows || []).filter((user: any) => user.id !== session.user.id));
    await fetchConversations(session.user.id);
    setLoading(false);
  }, [fetchConversations, supabase]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const selectedConversation = useMemo(
    () => conversations.find(conversation => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === 'dm') {
      const other = conversation.members?.find((member: any) => member.user_id !== profile?.id);
      return other?.profile?.full_name || 'Direct Message';
    }
    return conversation.name || (conversation.type === 'announcements' ? 'Announcements' : 'Group Chat');
  };

  const getConversationSub = (conversation: Conversation) => {
    if (conversation.type === 'dm') {
      const other = conversation.members?.find((member: any) => member.user_id !== profile?.id);
      return other?.profile?.role?.replace('_', ' ') || 'DM';
    }
    const count = conversation.members?.length || 0;
    return conversation.type === 'announcements' ? `${count} members - admin posts` : `${count} members`;
  };

  const getMessageStatus = (message: any) => {
    if (message.localStatus === 'sending') return { label: 'Sending', ticks: '✓' };
    if (message.localStatus === 'failed') return { label: 'Failed', ticks: '!' };
    if (!selectedConversation || message.sender_id !== profile?.id) return null;

    const otherMembers = (selectedConversation.members || []).filter((member: any) => member.user_id !== profile.id);
    if (otherMembers.length === 0) return { label: 'Sent', ticks: '✓' };

    const readByAll = otherMembers.every((member: any) =>
      member.last_read_at && new Date(member.last_read_at) >= new Date(message.created_at)
    );

    if (readByAll) return { label: 'Seen', ticks: '✓✓', read: true };
    return { label: 'Unseen', ticks: '✓' };
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!selectedId || !profile) return;

    let active = true;
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles(full_name, email, role)')
        .eq('conversation_id', selectedId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error('Failed to load messages: ' + error.message);
        return;
      }
      if (active) setMessages(data || []);

      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', selectedId)
        .eq('user_id', profile.id);
      fetchConversations(profile.id);
    };

    loadMessages();

    const channel = supabase
      .channel(`chat:${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}` },
        async (payload: any) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, sender:profiles(full_name, email, role)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setMessages(current => current.some(message => message.id === data.id) ? current : [...current, data]);
          }
          await supabase
            .from('conversation_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', selectedId)
            .eq('user_id', profile.id);
          fetchConversations(profile.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${selectedId}` },
        (payload: any) => {
          setConversations(current => current.map(conversation => {
            if (conversation.id !== selectedId) return conversation;
            return {
              ...conversation,
              members: (conversation.members || []).map((member: any) =>
                member.user_id === payload.new.user_id
                  ? { ...member, last_read_at: payload.new.last_read_at }
                  : member
              ),
            };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}` },
        (payload: any) => {
          if (payload.new.deleted_at) {
            setMessages(current => current.filter(message => message.id !== payload.new.id));
          } else {
            setMessages(current => current.map(message =>
              message.id === payload.new.id ? { ...message, ...payload.new } : message
            ));
          }
          fetchConversations(profile.id);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, profile, selectedId, supabase]);

  const startDm = async (targetUserId: string) => {
    const existing = conversations.find(conversation =>
      conversation.type === 'dm'
      && conversation.members?.some((member: any) => member.user_id === targetUserId)
    );

    if (existing) {
      setSelectedId(existing.id);
      return;
    }

    const { data: myMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at, conversation:conversations(*)')
      .eq('user_id', profile.id);

    const hiddenConversationIds = (myMemberships || [])
      .map((row: any) => row.conversation_id)
      .filter(Boolean);

    if (hiddenConversationIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', hiddenConversationIds);

      const hiddenDm = (myMemberships || []).find((row: any) =>
        row.conversation?.type === 'dm'
        && (memberRows || []).some((member: any) =>
          member.conversation_id === row.conversation_id
          && member.user_id === targetUserId
        )
      );

      if (hiddenDm) {
        await supabase
          .from('conversation_members')
          .update({ hidden_at: null })
          .eq('conversation_id', hiddenDm.conversation_id)
          .eq('user_id', profile.id);
        await fetchConversations(profile.id);
        setSelectedId(hiddenDm.conversation_id);
        return;
      }
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({ type: 'dm', created_by: profile.id })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create chat: ' + error.message);
      return;
    }

    const { error: memberError } = await supabase.from('conversation_members').insert([
      { conversation_id: conversation.id, user_id: profile.id },
      { conversation_id: conversation.id, user_id: targetUserId },
    ]);

    if (memberError) {
      toast.error('Failed to add member: ' + memberError.message);
      return;
    }

    await fetchConversations(profile.id);
    setSelectedId(conversation.id);
  };

  const createGroup = async () => {
    if (!isAdmin) return;
    if (!groupName.trim()) {
      toast.error('Group name required');
      return;
    }
    const memberIds = Array.from(new Set([profile.id, ...selectedMembers]));
    if (memberIds.length < 2) {
      toast.error('Select at least one member');
      return;
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        type: groupType,
        name: groupName.trim(),
        created_by: profile.id,
        is_admin_only_post: groupType === 'announcements',
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create group: ' + error.message);
      return;
    }

    const { error: memberError } = await supabase
      .from('conversation_members')
      .insert(memberIds.map(userId => ({ conversation_id: conversation.id, user_id: userId })));

    if (memberError) {
      toast.error('Group created, but members failed: ' + memberError.message);
      return;
    }

    toast.success(groupType === 'announcements' ? 'Announcement channel created' : 'Group created');
    setShowGroupModal(false);
    setGroupName('');
    setSelectedMembers([]);
    setGroupType('group');
    await fetchConversations(profile.id);
    setSelectedId(conversation.id);
  };

  const sendMessage = async () => {
    const content = messageText.trim();
    const fileToUpload = selectedFile;
    if ((!content && !fileToUpload) || !selectedConversation || sending) return;
    if (selectedConversation.is_admin_only_post && !isAdmin) {
      toast.error('Only admin can post in this channel');
      return;
    }
    if (fileToUpload && fileToUpload.size > 10 * 1024 * 1024) {
      toast.error('File size must be 10 MB or less');
      return;
    }

    setSending(true);
    const tempId = `local-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_id: profile.id,
      content: content || fileToUpload?.name || '',
      created_at: new Date().toISOString(),
      attachment_url: fileToUpload ? URL.createObjectURL(fileToUpload) : null,
      attachment_name: fileToUpload?.name || null,
      attachment_type: fileToUpload?.type || null,
      attachment_size: fileToUpload?.size || null,
      sender: {
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      },
      localStatus: 'sending',
    };

    setMessageText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setMessages(current => [...current, optimisticMessage]);
    setConversations(current => current.map(conversation =>
      conversation.id === selectedConversation.id
        ? { ...conversation, lastMessage: optimisticMessage, updated_at: optimisticMessage.created_at }
        : conversation
    ));

    let attachmentUrl: string | null = null;
    if (fileToUpload) {
      const path = `${selectedConversation.id}/${profile.id}/${Date.now()}-${safeFileName(fileToUpload.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type || 'application/octet-stream',
        });

      if (uploadError) {
        setMessages(current => current.map(message =>
          message.id === tempId ? { ...message, localStatus: 'failed' } : message
        ));
        setSelectedFile(fileToUpload);
        toast.error('Failed to upload file: ' + uploadError.message);
        setSending(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      attachmentUrl = publicUrl.publicUrl;
    }

    let { data: savedMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: profile.id,
        content: content || fileToUpload?.name || 'Attachment',
        attachment_url: attachmentUrl,
        attachment_name: fileToUpload?.name || null,
        attachment_type: fileToUpload?.type || null,
        attachment_size: fileToUpload?.size || null,
      })
      .select('*, sender:profiles(full_name, email, role)')
      .single();

    if (error && missingAttachmentColumns(error.message)) {
      const fallbackContent = [
        content || fileToUpload?.name || 'Attachment',
        attachmentUrl ? `File: ${attachmentUrl}` : '',
      ].filter(Boolean).join('\n');

      const fallbackResult = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: profile.id,
          content: fallbackContent,
        })
        .select('*, sender:profiles(full_name, email, role)')
        .single();

      savedMessage = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      setMessages(current => current.map(message =>
        message.id === tempId ? { ...message, localStatus: 'failed' } : message
      ));
      if (fileToUpload) setSelectedFile(fileToUpload);
      toast.error('Failed to send: ' + error.message);
    } else {
      setMessages(current => current.map(message =>
        message.id === tempId ? { ...savedMessage, localStatus: 'sent' } : message
      ));
      setConversations(current => current.map(conversation =>
        conversation.id === selectedConversation.id
          ? { ...conversation, lastMessage: savedMessage, updated_at: savedMessage.created_at }
          : conversation
      ));

      const recipientIds = (selectedConversation.members || [])
        .map((member: any) => member.user_id)
        .filter((userId: string) => userId && userId !== profile.id);

      await createNotifications(supabase, recipientIds.map((userId: string) => ({
        user_id: userId,
        type: 'chat' as const,
        title: 'New chat message',
        message: `${profile.full_name}: ${(content || fileToUpload?.name || 'Sent an attachment').slice(0, 80)}`,
        redirect_url: '/chat',
        entity_type: 'conversation',
        entity_id: selectedConversation.id,
      })));
    }
    setSending(false);
  };

  const canManageMessage = (message: any) =>
    !String(message.id).startsWith('local-')
    && message.sender_id === profile.id;

  const startEditMessage = (message: any) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const saveEditMessage = async (messageId: string) => {
    const content = editingText.trim();
    if (!content) {
      toast.error('Message cannot be empty');
      return;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .select('*, sender:profiles(full_name, email, role)')
      .single();

    if (error) {
      toast.error('Failed to edit message: ' + error.message);
      return;
    }

    setMessages(current => current.map(message => message.id === messageId ? data : message));
    setConversations(current => current.map(conversation =>
      conversation.lastMessage?.id === messageId ? { ...conversation, lastMessage: data } : conversation
    ));
    cancelEditMessage();
  };

  const deleteMessage = async (messageId: string) => {
    if (!window.confirm('Delete this message?')) return;

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      toast.error('Failed to delete message: ' + error.message);
      return;
    }

    setMessages(current => current.filter(message => message.id !== messageId));
    fetchConversations(profile.id);
  };

  const deleteConversation = async () => {
    if (!selectedConversation) return;
    const title = getConversationTitle(selectedConversation);
    if (!window.confirm(`Delete chat "${title}" from your inbox? Other members will still keep this chat.`)) return;

    const { error } = await supabase
      .from('conversation_members')
      .update({ hidden_at: new Date().toISOString() })
      .eq('conversation_id', selectedConversation.id)
      .eq('user_id', profile.id);

    if (error) {
      toast.error('Failed to delete chat: ' + error.message);
      return;
    }

    toast.success('Chat deleted from your inbox');
    setMessages([]);
    setSelectedId(null);
    await fetchConversations(profile.id);
  };

  const filteredConversations = conversations.filter(conversation =>
    getConversationTitle(conversation).toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !profile) {
    return <AppLoader message="Opening chat" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        {showGroupModal && (
          <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Create Chat Group</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowGroupModal(false)}>x</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Group name</label>
                  <input className="form-input" value={groupName} onChange={e => setGroupName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={groupType} onChange={e => setGroupType(e.target.value as any)}>
                    <option value="group">Group chat</option>
                    <option value="announcements">Announcements - admin posts only</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Members</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedMembers(users.map(user => user.id))}>
                      Select All
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedMembers([])}>
                      Clear
                    </button>
                  </div>
                  <div className="chat-member-picker">
                    {users.map(user => (
                      <label key={user.id} className="chat-member-option">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(user.id)}
                          onChange={e => {
                            setSelectedMembers(current =>
                              e.target.checked ? [...current, user.id] : current.filter(id => id !== user.id)
                            );
                          }}
                        />
                        <span>{user.full_name}</span>
                        <em>{user.department?.name || user.role}</em>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createGroup}>Create</button>
              </div>
            </div>
          </div>
        )}

        <div className="page-header">
          <div className="page-title">Chat</div>
          <div className="page-subtitle">Direct messages, groups, and announcement channels</div>
        </div>

        <div className="chat-shell">
          <aside className="chat-sidebar">
            <div className="chat-toolbar">
              <input
                className="form-input"
                placeholder="Search chats..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowGroupModal(true)}>New Group</button>
              )}
            </div>

            <div className="chat-start-list">
              <div className="chat-section-title">Start DM</div>
              <select className="form-select" defaultValue="" onChange={e => e.target.value && startDm(e.target.value)}>
                <option value="">Select user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div className="chat-conversation-list">
              {filteredConversations.length === 0 ? (
                <div className="chat-empty">No chats yet</div>
              ) : (
                filteredConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    className={`chat-conversation ${selectedId === conversation.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(conversation.id)}
                  >
                    <div className="chat-avatar">{initials(getConversationTitle(conversation))}</div>
                    <div className="chat-conversation-main">
                      <div className="chat-conversation-top">
                        <span>{getConversationTitle(conversation)}</span>
                        {conversation.lastMessage?.created_at && <em>{chatTime(conversation.lastMessage.created_at)}</em>}
                      </div>
                      <div className="chat-preview">
                        {conversation.lastMessage?.content || getConversationSub(conversation)}
                      </div>
                    </div>
                    {!!conversation.unreadCount && (
                      <div className="chat-unread">{conversation.unreadCount}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="chat-thread">
            {selectedConversation ? (
              <>
                <div className="chat-thread-header">
                  <div className="chat-thread-info">
                    <div className="chat-avatar">{initials(getConversationTitle(selectedConversation))}</div>
                    <div>
                      <div className="chat-thread-title">{getConversationTitle(selectedConversation)}</div>
                      <div className="chat-thread-sub">{getConversationSub(selectedConversation)}</div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={deleteConversation}>
                    Delete Chat
                  </button>
                </div>

                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="chat-empty">No messages yet</div>
                  ) : (
                    messages.map(message => {
                      const mine = message.sender_id === profile.id;
                      const status = getMessageStatus(message);
                      const fallbackFileUrl = typeof message.content === 'string'
                        ? message.content.match(/https?:\/\/\S+/)?.[0]
                        : null;
                      return (
                        <div key={message.id} className={`chat-message-row ${mine ? 'mine' : ''}`}>
                          {!mine && <div className="chat-avatar small">{initials(message.sender?.full_name)}</div>}
                          <div className="chat-bubble">
                            {!mine && <div className="chat-sender">{message.sender?.full_name}</div>}
                            {editingMessageId === message.id ? (
                              <div className="chat-edit-box">
                                <input
                                  className="form-input"
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEditMessage(message.id);
                                    if (e.key === 'Escape') cancelEditMessage();
                                  }}
                                  autoFocus
                                />
                                <div className="chat-edit-actions">
                                  <button className="btn btn-primary btn-sm" onClick={() => saveEditMessage(message.id)}>Save</button>
                                  <button className="btn btn-ghost btn-sm" onClick={cancelEditMessage}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                                {!message.attachment_url && fallbackFileUrl && (
                                  <a
                                    className="chat-attachment"
                                    href={fallbackFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <div className="chat-file-icon">FILE</div>
                                    <div className="chat-file-info">
                                      <strong>Open attachment</strong>
                                      <span>{fallbackFileUrl}</span>
                                    </div>
                                  </a>
                                )}
                                {message.attachment_url && (
                                  <a
                                    className="chat-attachment"
                                    href={message.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {message.attachment_type?.startsWith('image/') ? (
                                      <img src={message.attachment_url} alt={message.attachment_name || 'Attachment'} />
                                    ) : (
                                      <div className="chat-file-icon">FILE</div>
                                    )}
                                    <div className="chat-file-info">
                                      <strong>{message.attachment_name || 'Attachment'}</strong>
                                      <span>{formatFileSize(message.attachment_size)}</span>
                                    </div>
                                  </a>
                                )}
                                {message.updated_at && message.updated_at !== message.created_at && (
                                  <div className="chat-edited">edited</div>
                                )}
                              </>
                            )}
                            <div className="chat-meta">
                              <span>{chatTime(message.created_at)}</span>
                              {status && (
                                <span className={`chat-status ${status.read ? 'read' : ''}`} title={status.label}>
                                  {status.ticks}
                                </span>
                              )}
                            </div>
                            {canManageMessage(message) && editingMessageId !== message.id && (
                              <div className="chat-actions">
                                <button onClick={() => startEditMessage(message)}>Edit</button>
                                <button onClick={() => deleteMessage(message.id)}>Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {selectedFile && (
                  <div className="chat-file-preview">
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="chat-composer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="chat-file-input"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || (selectedConversation.is_admin_only_post && !isAdmin)}
                  >
                    Attach
                  </button>
                  <input
                    className="form-input"
                    placeholder={selectedConversation.is_admin_only_post && !isAdmin ? 'Only admins can post here' : 'Write a message...'}
                    value={messageText}
                    disabled={selectedConversation.is_admin_only_post && !isAdmin}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <button className="btn btn-primary" onClick={sendMessage} disabled={sending || (!messageText.trim() && !selectedFile)}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="chat-empty chat-empty-center">Select or start a conversation</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
