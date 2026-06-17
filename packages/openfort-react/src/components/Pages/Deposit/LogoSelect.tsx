'use client'

import { type SyntheticEvent, useEffect, useRef, useState } from 'react'
import styled from '../../../styles/styled'

export type LogoOption = { value: string; label: string; logo: string | null }

const Wrap = styled.div`
  position: relative;
`

const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  background: var(--ck-body-background-secondary, #fafafa);
  color: var(--ck-body-color, #1a1a2e);
  font-size: 14px;
  cursor: pointer;
`

const TriggerLabel = styled.span`
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Chevron = styled.span`
  color: var(--ck-body-color-muted, #6b7280);
  font-size: 11px;
  flex-shrink: 0;
`

const Menu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  background: var(--ck-body-background, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
`

const Item = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ck-body-color, #1a1a2e);
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--ck-secondary-button-hover-background, #f3f3f5);
  }
`

const logoImg = { width: 20, height: 20, borderRadius: '50%', flexShrink: 0 } as const
const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/** A select-like dropdown that shows a logo next to the trigger and each option. */
export function LogoSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: LogoOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <Wrap ref={ref}>
      <Trigger type="button" onClick={() => setOpen((o) => !o)}>
        {active?.logo && <img src={active.logo} alt="" style={logoImg} onError={hideBrokenLogo} />}
        <TriggerLabel>{active?.label ?? ''}</TriggerLabel>
        <Chevron>{open ? '▴' : '▾'}</Chevron>
      </Trigger>
      {open && (
        <Menu>
          {options.map((o) => (
            <Item
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.logo && <img src={o.logo} alt="" style={logoImg} onError={hideBrokenLogo} />}
              <span>{o.label}</span>
            </Item>
          ))}
        </Menu>
      )}
    </Wrap>
  )
}
