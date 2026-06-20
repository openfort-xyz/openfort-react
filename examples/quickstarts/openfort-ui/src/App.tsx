import { OpenfortButton } from '@openfort/react'
import { Main } from './components/cards/main'

function App() {
  return (
    <>
      {/* Wallet/connect button — opens the modal. When connected it lands on the
          Connected screen, where the Deposit hub button lives. */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }}>
        <OpenfortButton />
      </div>
      <Main />
    </>
  )
}

export default App
