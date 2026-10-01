import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Client, Platform, Post } from '../lib/types'

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

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get<Client[]>('/clients')
      return data
    },
  })
}
