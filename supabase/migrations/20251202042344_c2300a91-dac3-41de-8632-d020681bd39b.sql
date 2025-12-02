-- ====================================
-- MESSAGING SYSTEM COMPLETE SCHEMA
-- ====================================

-- Drop existing messages table to rebuild with new structure
DROP TABLE IF EXISTS public.messages CASCADE;

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('client_chat', 'direct', 'group')),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create conversation_participants table
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agency_member_id UUID REFERENCES public.agency_members(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES public.client_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agency_member', 'client_user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, agency_member_id),
  UNIQUE(conversation_id, client_user_id)
);

-- Create messages table with new structure
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agency_member', 'client_user')),
  sender_agency_member_id UUID REFERENCES public.agency_members(id) ON DELETE SET NULL,
  sender_client_user_id UUID REFERENCES public.client_users(id) ON DELETE SET NULL,
  body TEXT,
  attachment_url TEXT,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Create message_read_receipts table
CREATE TABLE public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.conversation_participants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, participant_id)
);

-- Create indexes for performance
CREATE INDEX idx_conversations_agency_id ON public.conversations(agency_id);
CREATE INDEX idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX idx_conversations_type ON public.conversations(type);
CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_agency_member_id ON public.conversation_participants(agency_member_id);
CREATE INDEX idx_conversation_participants_client_user_id ON public.conversation_participants(client_user_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_message_read_receipts_message_id ON public.message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_participant_id ON public.message_read_receipts(participant_id);

-- Updated_at trigger for conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================
-- RLS POLICIES
-- ====================================

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- CONVERSATIONS POLICIES
CREATE POLICY "Agency members can view their agency conversations"
  ON public.conversations FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can update their agency conversations"
  ON public.conversations FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client users can view their client chats"
  ON public.conversations FOR SELECT
  USING (
    type = 'client_chat' 
    AND client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  );

-- CONVERSATION_PARTICIPANTS POLICIES
CREATE POLICY "Agency members can view their conversation participants"
  ON public.conversation_participants FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can add conversation participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE c.type = 'client_chat'
        AND c.client_id IN (
          SELECT client_id FROM public.client_users WHERE id = auth.uid()
        )
    )
  );

-- MESSAGES POLICIES
CREATE POLICY "Agency members can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE agency_id IN (
        SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Agency members can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE agency_id IN (
        SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
      )
    )
    AND sender_type = 'agency_member'
  );

CREATE POLICY "Client users can view messages in their client chats"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE c.type = 'client_chat'
        AND c.client_id IN (
          SELECT client_id FROM public.client_users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Client users can send messages in their client chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE c.type = 'client_chat'
        AND c.client_id IN (
          SELECT client_id FROM public.client_users WHERE id = auth.uid()
        )
    )
    AND sender_type = 'client_user'
  );

-- MESSAGE_READ_RECEIPTS POLICIES
CREATE POLICY "Users can view read receipts for their messages"
  ON public.message_read_receipts FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON m.conversation_id = c.id
      WHERE c.agency_id IN (
        SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create read receipts"
  ON public.message_read_receipts FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON m.conversation_id = c.id
      WHERE c.agency_id IN (
        SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Client users can view read receipts in their chats"
  ON public.message_read_receipts FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON m.conversation_id = c.id
      WHERE c.type = 'client_chat'
        AND c.client_id IN (
          SELECT client_id FROM public.client_users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Client users can create read receipts"
  ON public.message_read_receipts FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON m.conversation_id = c.id
      WHERE c.type = 'client_chat'
        AND c.client_id IN (
          SELECT client_id FROM public.client_users WHERE id = auth.uid()
        )
    )
  );