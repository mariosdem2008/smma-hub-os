import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface ApprovalHistoryProps {
  history: any[];
}

export default function ApprovalHistory({ history }: ApprovalHistoryProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'changes_requested':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'changes_requested':
        return <Badge variant="destructive">Changes Requested</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No approval history available
        </p>
      ) : (
        history.map((version: any) => (
          <Card key={version.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Version {version.version_number}</h4>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(version.created_at), 'MMM d, yyyy')}
                </span>
              </div>

              {version.approval_tasks && version.approval_tasks.length > 0 ? (
                <div className="space-y-2">
                  {version.approval_tasks.map((task: any) => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                    >
                      <div className="mt-1">
                        {getStatusIcon(task.status)}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {task.profiles?.full_name || task.profiles?.email}
                          </span>
                          {getStatusBadge(task.status)}
                        </div>

                        {task.comments && task.comments.length > 0 && (
                          <div className="space-y-1">
                            {task.comments.map((comment: any, idx: number) => (
                              <div 
                                key={idx}
                                className="flex items-start gap-2 text-sm"
                              >
                                <MessageSquare className="h-3 w-3 mt-1 text-muted-foreground" />
                                <div className="flex-1">
                                  <p>{comment.text}</p>
                                  {comment.action && (
                                    <Badge 
                                      variant="outline" 
                                      className="mt-1 text-xs"
                                    >
                                      {comment.action.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {format(new Date(task.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No approval tasks for this version
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
