import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`stat-${index}`}>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-20' />
            </CardHeader>
            <CardContent className='space-y-2'>
              <Skeleton className='h-7 w-16' />
              <Skeleton className='h-3 w-24' />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='lg:col-span-4'>
          <CardHeader>
            <Skeleton className='h-4 w-32' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-75 w-full' />
          </CardContent>
        </Card>
        <Card className='lg:col-span-3'>
          <CardHeader>
            <Skeleton className='h-4 w-28' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-75 w-full' />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className='h-4 w-32' />
        </CardHeader>
        <CardContent className='space-y-3'>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`expiring-${index}`} className='h-9 w-full' />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
