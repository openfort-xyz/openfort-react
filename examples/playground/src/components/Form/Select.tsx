import { cn } from '@/lib/utils'

type SelectProps = {
  options: (string | { label: string; value: any })[]
} & React.PropsWithChildren<React.HTMLProps<HTMLSelectElement>>

export const Select = ({ options, ...props }: SelectProps) => {
  const opts = options?.length ? options : [{ label: '— No options —', value: '' }]

  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-md border border-input bg-background px-2 py-1 text-sm',
        props.className,
        props.value === 'undefined' && 'text-blue-500'
      )}
    >
      {opts.map((option) =>
        typeof option === 'object' ? (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ) : (
          <option key={option} value={option}>
            {option}
          </option>
        )
      )}
      {props.children}
    </select>
  )
}
