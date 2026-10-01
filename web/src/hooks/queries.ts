import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  AdminUser,
  AuditEntry,
  Client,
  Comment,
  Platform,
  Post,
  Role,
} from '../lib/types'

// All server data goes through TanStack Query: it caches by key, so other
// pages can refresh the board after a change with
// queryClient.invalidateQueries({ queryKey: ['posts'] }).

export interface PostFilters {
  clientId?: number
  platform?: Platform
}

export function usePosts(filters: PostFilters) {
  return useQuery({
    queryKey: ['posts', filters],
    queryFn: async () => {
      const { data } = await api.get<Post[]>('/posts', { params: filters })
      return data
    },
  })
}

export function usePost(id: number | undefined) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: async () => {
      const { data } = await api.get<Post>(`/posts/${id}`)
      return data
    },
    enabled: id !== undefined,
  })
}

export function useComments(postId: number) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const { data } = await api.get<Comment[]>(`/posts/${postId}/comments`)
      return data
    },
  })
}

export function useAuditLog(postId: number) {
  return useQuery({
    queryKey: ['audit', postId],
    queryFn: async () => {
      const { data } = await api.get<AuditEntry[]>(`/posts/${postId}/audit`)
      return data
    },
  })
}

// Admin only. Pass a role to get e.g. just the reviewers.
export function useUsers(role?: Role) {
  return useQuery({
    queryKey: ['users', role ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<AdminUser[]>('/users', {
        params: role ? { role } : undefined,
      })
      return data
    },
  })
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get<Client[]>('/clients')
      return data
    },
  })
}
