import Button from '../Button/index.js'
import { LargeButtonIcon, LargeButtonLabel, LargeButtonStyle } from './styles.js'

export const LargeButton: React.FC<{
  onClick: () => void
  icon?: React.ReactNode
  children?: React.ReactNode
  disabled?: boolean
}> = ({ children, icon, onClick, disabled }) => {
  return (
    <LargeButtonStyle>
      <Button onClick={onClick} disabled={disabled}>
        <LargeButtonLabel>{children}</LargeButtonLabel>
        <LargeButtonIcon>{icon}</LargeButtonIcon>
      </Button>
    </LargeButtonStyle>
  )
}
