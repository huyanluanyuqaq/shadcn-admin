import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type EmailProvider,
  type EmailProviderInput,
  emailProviderInputSchema,
} from '@shared/index'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  useCreateEmailProvider,
  useDeleteEmailProvider,
  useEmailProvidersQuery,
} from '../queries'

const providerFormSchema = emailProviderInputSchema.extend({
  domain: z.string().nullable(),
  remark: z.string().nullable(),
})
type ProviderForm = z.infer<typeof providerFormSchema>

type EmailProvidersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailProvidersDialog({
  open,
  onOpenChange,
}: EmailProvidersDialogProps) {
  const [deleting, setDeleting] = useState<EmailProvider | null>(null)
  const providersQuery = useEmailProvidersQuery()
  const createProvider = useCreateEmailProvider()
  const deleteProvider = useDeleteEmailProvider()

  const form = useForm<ProviderForm>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: { name: '', domain: '', remark: '' },
  })

  const onSubmit = (values: ProviderForm) => {
    const payload: EmailProviderInput = {
      name: values.name.trim(),
      domain: values.domain?.trim() ? values.domain : null,
      remark: values.remark?.trim() ? values.remark : null,
    }
    createProvider.mutate(payload, {
      onSuccess: () => {
        toast.success('提供商已创建')
        form.reset()
      },
      onError: (error) => {
        toast.error(error.message || '创建失败')
      },
    })
  }

  const items = providersQuery.data?.items ?? []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader className='text-start'>
            <DialogTitle>邮箱提供商管理</DialogTitle>
            <DialogDescription>
              管理邮箱所属的提供商，创建邮箱账号时可从中选择。
            </DialogDescription>
          </DialogHeader>

          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>域名</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className='w-16 text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providersQuery.isPending ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={`provider-skeleton-${index}`}>
                      <TableCell colSpan={4}>
                        <Skeleton className='h-5 w-full' />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length ? (
                  items.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className='font-medium'>
                        {provider.name}
                      </TableCell>
                      <TableCell>{provider.domain ?? '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>
                        {provider.remark ?? '-'}
                      </TableCell>
                      <TableCell className='text-end'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-8 text-destructive'
                          onClick={() => setDeleting(provider)}
                          aria-label={`删除 ${provider.name}`}
                          title={`删除 ${provider.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className='h-24 text-center'>
                      暂无提供商
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Form {...form}>
            <form
              id='email-provider-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='grid gap-3 sm:grid-cols-[2fr_2fr_2fr_auto]'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='space-y-1'>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder='例如：Gmail' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='domain'
                render={({ field }) => (
                  <FormItem className='space-y-1'>
                    <FormLabel>域名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='gmail.com'
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='remark'
                render={({ field }) => (
                  <FormItem className='space-y-1'>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='可选'
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem className='space-y-1'>
                <FormLabel className='invisible'>&nbsp;</FormLabel>
                <Button
                  type='submit'
                  form='email-provider-form'
                  disabled={createProvider.isPending}
                >
                  {createProvider.isPending ? '添加中...' : '添加'}
                </Button>
              </FormItem>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(state) => setDeleting(state ? deleting : null)}
        handleConfirm={() => {
          if (!deleting) return
          deleteProvider.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('提供商已删除')
              setDeleting(null)
            },
            onError: (error) => {
              toast.error(error.message || '删除失败')
            },
          })
        }}
        isLoading={deleteProvider.isPending}
        title='删除提供商'
        desc={
          <p>
            确定要删除提供商 <span className='font-bold'>{deleting?.name}</span>{' '}
            吗？
            <br />
            该操作不可撤销。
          </p>
        }
        confirmText='删除'
        cancelBtnText='取消'
        destructive
      />
    </>
  )
}
