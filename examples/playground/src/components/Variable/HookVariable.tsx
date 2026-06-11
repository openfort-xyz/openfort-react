import { useNavigate, useSearch } from '@tanstack/react-router'
import { Braces, CheckIcon, Code2Icon, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { commonVariables, onSettledInputs } from '@/components/Variable/commonVariables'
import { BaseVariable, type HookInput } from '@/components/Variable/Variable'
import { cn } from '@/lib/cn'

const EMPTY_OPTIONS = {} as any

export const HookVariable = <TOptions extends object, TResult extends object>({
  hook,
  name,
  description,
  variables = {},
  defaultExpanded = 0,
  maxDepth = 3,
  defaultOptions = EMPTY_OPTIONS as TOptions,
  optionsVariables,
  importPath = '@openfort/react',
  docsUrl = 'https://www.openfort.io/docs',
}: {
  hook: (opts?: TOptions) => TResult
  name: string
  description?: string
  variables?: Record<string, HookInput> | ((values: TResult) => Record<string, HookInput>)
  defaultExpanded?: number
  maxDepth?: number
  defaultOptions?: TOptions
  optionsVariables?: Record<string, HookInput>
  /** Import path for sample code (default: @openfort/react). Use e.g. @openfort/react/wagmi for wagmi hooks. */
  importPath?: string
  /** Link to this hook's documentation. Defaults to the Openfort docs home. */
  docsUrl?: string
}) => {
  const [opts, setOpts] = useState<TOptions>(defaultOptions)

  const values = hook(opts)
  const resolvedVariables =
    typeof variables === 'function' ? variables(values) : (variables as Record<string, HookInput>)

  const sample = useMemo(() => {
    let base = `${JSON.stringify(Object.keys(defaultOptions), null, 2)}`
    base = base.replace(
      /]/g,
      `  })
  // ...
}`
    )
    base = base.replace(/"/g, '')
    base = base.replace(/,/g, '')
    base = base.replace(
      /\[/g,
      `import { ${name} } from "${importPath}"

function SampleComponent() {
  const {
    --${Object.keys(values).join(`
    --`)}
  } = ${name}({`
    )

    for (const val in values) {
      const replaced = resolvedVariables?.[val]?.description || commonVariables[val as string]?.description
      base = base.replace(`--${val}`, `${val},${replaced ? ` // ${replaced}` : ''}`)
    }

    for (const opt in defaultOptions) {
      const replaced = optionsVariables?.[opt]?.description || onSettledInputs[opt]?.description
      base = base.replace(opt, `  ${opt},${replaced ? ` // ${replaced}` : ''}`)
    }

    base = base.replace('{  }', '')

    return base
  }, [defaultOptions, importPath, name, optionsVariables, values, resolvedVariables])

  const params = useSearch({ strict: false })
  const navigate = useNavigate()
  useEffect(() => {
    if (!params.focus) return
    const id = setTimeout(() => {
      navigate({
        to: '.',
        search: (prev) => {
          const { focus: _focus, ...rest } = prev
          return rest
        },
        replace: true,
      })
    }, 2000)
    return () => clearTimeout(id)
  }, [params.focus, navigate])

  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)

  return (
    <div className="flex flex-col gap-3 text-sm">
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
            <span className="text-muted-foreground">{'›'}</span>
            <span className="font-medium">{name}</span>
            <span className="hidden truncate text-xs text-muted-foreground md:inline">
              import {'{'} {name} {'}'} from '{importPath}'
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                'mr-1 text-xs text-muted-foreground transition-opacity duration-300',
                copied ? 'opacity-100' : 'opacity-0'
              )}
            >
              Copied
            </span>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" className="size-7">
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open documentation">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Docs</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className={cn('size-7', showCode && 'bg-accent text-foreground')}
                  aria-pressed={showCode}
                  onClick={() => setShowCode((v) => !v)}
                >
                  <Braces className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showCode ? 'Hide' : 'Show'} sample code</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative size-7"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sample)
                    setCopied(true)
                    setTimeout(() => {
                      setCopied(false)
                    }, 1500)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      'absolute size-4 transition-opacity duration-300',
                      copied ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Code2Icon
                    className={cn(
                      'absolute size-4 transition-opacity duration-300',
                      copied ? 'opacity-0' : 'opacity-100'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy sample code</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {showCode && (
          <pre className="overflow-x-auto border-b bg-background/60 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {sample}
          </pre>
        )}
        <div className="flex flex-col gap-4 p-4 font-mono text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Options</span>
            {Object.keys(opts).length === 0 ? (
              <span className="text-muted-foreground">No options</span>
            ) : (
              <div className="group flex flex-col gap-2">
                {Object.entries(opts ?? {}).map(([key, value], i) => (
                  <BaseVariable
                    focusedVariable={params.focus}
                    // biome-ignore lint/suspicious/noArrayIndexKey: allowed for simplicity
                    key={key + i}
                    name={key}
                    value={value}
                    depth={0}
                    maxDepth={maxDepth}
                    variables={{
                      [key]: {
                        ...(optionsVariables?.[key] ?? onSettledInputs[key] ?? {}),
                        onEdit: (newValue: Record<string, unknown>) => {
                          setOpts((prev) => ({
                            ...prev,
                            [key]: newValue,
                          }))
                        },
                      },
                    }}
                    defaultExpanded={defaultExpanded}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Values</span>
            {Object.keys(values).length === 0 ? (
              <span className="text-muted-foreground">No values</span>
            ) : (
              <div className="group flex flex-col gap-2">
                {Object.entries(values)
                  .sort()
                  .map(([key, value], i) => (
                    <BaseVariable
                      // biome-ignore lint/suspicious/noArrayIndexKey: allowed for simplicity
                      key={key + i}
                      name={key}
                      value={value}
                      depth={0}
                      maxDepth={maxDepth}
                      variables={resolvedVariables}
                      defaultExpanded={defaultExpanded}
                      focusedVariable={params.focus}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
