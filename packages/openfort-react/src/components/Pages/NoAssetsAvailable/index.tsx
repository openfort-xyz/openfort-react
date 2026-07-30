import { BuyIcon, DollarIcon } from '../../../assets/icons.js'
import Button from '../../Common/Button/index.js'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles.js'
import { FloatingGraphic } from '../../FloatingGraphic/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ButtonsContainer } from './styles.js'

const NoAssetsAvailable = () => {
  const { setRoute } = useOpenfort()

  return (
    <PageContent>
      <FloatingGraphic
        height="190px"
        logoCenter={{
          logo: <BuyIcon />,
        }}
        logoTopLeft={{
          logo: <BuyIcon />,
        }}
        logoBottomRight={{
          logo: <BuyIcon />,
        }}
        logoTopRight={{
          logo: <DollarIcon />,
        }}
        logoBottomLeft={{
          logo: <DollarIcon />,
        }}
      />
      <ModalContent style={{ paddingBottom: 0 }}>
        <ModalH1 $small>No assets available</ModalH1>
        <ModalBody>
          <div style={{ paddingRight: 12, paddingLeft: 12 }}>
            You currently have no assets available in your wallet.
          </div>
          <ButtonsContainer>
            <Button
              onClick={() => {
                setRoute(routes.DEPOSIT)
              }}
              icon={<DollarIcon />}
            >
              Add funds
            </Button>
          </ButtonsContainer>
        </ModalBody>
      </ModalContent>
    </PageContent>
  )
}

export default NoAssetsAvailable
