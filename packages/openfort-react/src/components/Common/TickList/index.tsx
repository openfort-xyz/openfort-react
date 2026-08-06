import { TickIcon } from '../../../assets/icons.js'
import { TickIconWrapper, TickItem, TickListContainer } from './styles.js'

const TickList = ({ items }: { items: string[] }) => {
  return (
    <TickListContainer>
      {items.map((item) => (
        <TickItem key={item}>
          <TickIconWrapper>
            <TickIcon />
          </TickIconWrapper>
          <span>{item}</span>
        </TickItem>
      ))}
    </TickListContainer>
  )
}
TickList.displayName = 'TickList'

export default TickList
