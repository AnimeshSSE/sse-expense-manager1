'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, Loader2, MessageSquare } from 'lucide-react'

interface CommentThreadProps {
  entityType: 'EXPENSE' | 'ADVANCE' | 'REQUISITION'
  entityId: string
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  ACCOUNTANT: 'bg-cyan-100 text-cyan-800',
  STOCK_MANAGER: 'bg-emerald-100 text-emerald-800',
  USER: 'bg-stone-100 text-stone-800',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  STOCK_MANAGER: 'Stock Mgr',
  USER: 'User',
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function CommentThread({ entityType, entityId }: CommentThreadProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getComments(entityType, entityId)
      setComments(result || [])
    } catch {
      // handled by api
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    if (entityId) {
      loadComments()
    }
  }, [entityId, loadComments])

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const result = await api.addComment(entityType, entityId, newComment.trim())
      setComments((prev) => [...prev, result.comment || result])
      setNewComment('')
    } catch {
      // handled by api
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-stone-500" />
        <h4 className="text-sm font-medium text-stone-700">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h4>
      </div>

      <Separator />

      {/* Comments list */}
      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">No comments yet</p>
        ) : (
          comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="text-[10px] font-semibold bg-stone-100 text-stone-600">
                  {comment.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-stone-800">
                    {comment.user?.name || 'Unknown'}
                  </span>
                  {comment.user?.role && (
                    <Badge className={`text-[9px] px-1 py-0 ${roleColors[comment.user.role] || roleColors.USER}`}>
                      {roleLabels[comment.user.role] || 'User'}
                    </Badge>
                  )}
                  <span className="text-[10px] text-stone-400">
                    {formatTimeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <Separator />

      {/* Add comment input */}
      <div className="flex gap-2">
        <Avatar className="w-7 h-7 flex-shrink-0">
          <AvatarFallback className="text-[10px] font-semibold bg-stone-900 text-white">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            className="min-h-[36px] max-h-[100px] text-xs resize-none px-3 py-2"
            rows={1}
          />
        </div>
        <Button
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
