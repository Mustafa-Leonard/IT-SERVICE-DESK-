import { useQuery } from '@tanstack/react-query'
import { fetchApiHealth } from '../../services/health'

export function useApiHealth() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: fetchApiHealth,
    staleTime: 10_000,
  })
}
