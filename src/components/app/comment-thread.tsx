'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'

interface CommentThreadProps {
  entityType: string
  entityId: string
}

export function CommentThread({ entityType, entityId }: CommentThreadProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [newComment, setNewComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => api.getComments(entityType, entityId) as Promise<{ comments: Array<{
      id: string
      content: string
      createdAt: string
      user: { id: string; name: string; email: string; role: string }
    }> }>,
  })

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      api.addComment({ entityType, entityId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
      setNewComment('')
      toast.success('Comment added')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    const trimmed = newComment.trim()
    if (!trimmed) return
    addMutation.mutate(trimmed)
  }

  const comments = data?.comments || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <MessageSquare className="w-4 h-4" />
        Comments ({comments.length})
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No comments yet</p>
      ) : (
        <ScrollArea className="max-h-64 overflow-y-auto">
          <div className="space-y-3 pr-2">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-slate-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold">
                  {comment.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-navy-900">{comment.user.name}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="min-h-[60px] text-sm resize-none"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addMutation.isPending}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
