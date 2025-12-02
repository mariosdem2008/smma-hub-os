import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ExternalLink, MoreVertical, Pencil, Trash2, X, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteMessage, useEditMessage } from '@/hooks/useMessageActions';

interface MessageBubbleProps {
  message: {
    id: string;
    body?: string;
    attachment_url?: string;
    created_at: string;
    related_project_id?: string;
    sender_type: string;
    read_receipts?: any[];
    conversation_id?: string;
    _optimistic?: boolean;
  };
  isOwnMessage: boolean;
  conversationId?: string;
}

export function MessageBubble({ message, isOwnMessage, conversationId }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.body || '');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const { mutate: deleteMessage, isPending: isDeleting } = useDeleteMessage();
  const { mutate: editMessage, isPending: isSaving } = useEditMessage();

  const handleDelete = () => {
    const convId = conversationId || message.conversation_id;
    if (!convId) return;
    
    deleteMessage({ messageId: message.id, conversationId: convId });
    setShowDeleteDialog(false);
  };

  const handleSaveEdit = () => {
    const convId = conversationId || message.conversation_id;
    if (!convId || !editText.trim()) return;
    
    editMessage({ messageId: message.id, conversationId: convId, newText: editText.trim() });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.body || '');
    setIsEditing(false);
  };

  // Don't show edit/delete for optimistic messages
  const canModify = isOwnMessage && !message._optimistic && !message.id.startsWith('temp-');

  return (
    <>
      <div
        className={cn(
          'flex flex-col group',
          isOwnMessage ? 'items-end' : 'items-start'
        )}
      >
        <div className="flex items-start gap-1">
          {isOwnMessage && canModify && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <div
            className={cn(
              'max-w-[70%] rounded-lg p-3 shadow-sm',
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] resize-none bg-background text-foreground"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editText.trim()}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {message.body && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                )}

                {message.attachment_url && (
                  <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm underline mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View attachment
                  </a>
                )}

                {message.related_project_id && (
                  <Link
                    to={`/projects/${message.related_project_id}`}
                    className="inline-block mt-2"
                  >
                    <Badge variant="outline" className="cursor-pointer">
                      Related to Project
                    </Badge>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.created_at), 'p')}
          </span>
          {isOwnMessage && message.read_receipts && message.read_receipts.length > 0 && (
            <span className="text-xs text-muted-foreground">• Read</span>
          )}
          {message._optimistic && (
            <span className="text-xs text-muted-foreground">• Sending...</span>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
