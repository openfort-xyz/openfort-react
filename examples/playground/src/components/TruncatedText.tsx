import { type ComponentType, forwardRef } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

type CustomTruncatedTextContentProps = { displayText: string; className?: string }

type TruncatedTextProps = {
  text: string
  displayText?: string
  startChars?: number
  endChars?: number

  className?: string
  layoutClassName?: string

  CustomContent?: ComponentType<CustomTruncatedTextContentProps>
}

export const TruncatedText = forwardRef<HTMLSpanElement, TruncatedTextProps>(
  (
    {
      text,
      startChars = 9,
      endChars = 4,
      displayText = `${text.slice(0, startChars)}..${text.slice(-endChars)}`,
      layoutClassName,
      className,
      CustomContent,
    }: TruncatedTextProps,
    ref
  ) => {
    return (
      <Tooltip>
        <span
          ref={ref}
          className={cn('inline-flex flex-row gap-1 group items-center overflow-hidden', layoutClassName)}
        >
          <TooltipTrigger asChild>
            <span className={cn('inline-flex items-center overflow-hidden')}>
              {CustomContent ? (
                <CustomContent displayText={displayText} className={className} />
              ) : (
                <span className={cn('pl-0 pr-0 text-sm truncate', className)}>{displayText}</span>
              )}
            </span>
          </TooltipTrigger>
        </span>
        <TooltipContent>
          <span>{text}</span>
        </TooltipContent>
      </Tooltip>
    )
  }
)
