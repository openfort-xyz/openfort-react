import { renderHook, act } from '@testing-library/react';
import { AxiosError } from 'axios';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { OpenfortError, OpenfortErrorType } from '../../../types';

const mockQueryClient = {
  invalidateQueries: vi.fn(),
};

const mockDisconnect = vi.fn();
const mockDisconnectAsync = vi.fn();
const mockConnect = vi.fn();

const mockClient = {
  getAccessToken: vi.fn(),
  embeddedWallet: {
    create: vi.fn(),
    exportPrivateKey: vi.fn(),
  },
};

let mockWalletConfig: any = {};
let mockLog = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

vi.mock('../../../components/Openfort/useOpenfort', () => ({
  __esModule: true,
  useOpenfort: () => ({
    walletConfig: mockWalletConfig,
    log: mockLog,
    setOpen: vi.fn(),
    setRoute: vi.fn(),
    setConnector: vi.fn(),
    uiConfig: {},
  }),
}));

vi.mock('../../../openfort/useOpenfort', () => ({
  __esModule: true,
  useOpenfortCore: () => ({
    client: mockClient,
    embeddedAccounts: undefined,
    isLoadingAccounts: false,
  }),
}));

vi.mock('../../../wallets/useWallets', () => ({
  __esModule: true,
  useWallets: () => [],
}));

vi.mock('../useUser', () => ({
  __esModule: true,
  useUser: () => ({ user: undefined }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x123',
    connector: { id: 'test-connector', type: 'embedded' },
    isConnected: false,
  }),
  useChainId: () => 1,
  useConnect: (options: any) => {
    // ensure mutation handlers are preserved to avoid undefined access
    return { connect: mockConnect, ...(options || {}) };
  },
  useDisconnect: () => ({
    disconnect: mockDisconnect,
    disconnectAsync: mockDisconnectAsync,
  }),
}));

import { useWallets } from '../useWallets';

describe('useWallets createWallet error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletConfig = {
      accountType: 'SMART_ACCOUNT',
      getEncryptionSession: vi.fn().mockResolvedValue('session'),
    };
    mockLog = vi.fn();
    mockClient.getAccessToken.mockResolvedValue('token');
  });

  const expectWalletError = async (thrownError: unknown, message: string) => {
    mockClient.embeddedWallet.create.mockRejectedValue(thrownError);

    const { result } = renderHook(() => useWallets());

    let createResult: { error?: OpenfortError } | undefined;
    await act(async () => {
      createResult = await result.current.createWallet();
    });

    expect(mockClient.embeddedWallet.create).toHaveBeenCalled();
    expect(createResult?.error).toBeInstanceOf(OpenfortError);
    expect(createResult?.error?.type).toBe(OpenfortErrorType.WALLET_ERROR);
    expect(createResult?.error?.message).toBe(message);
    expect(result.current.error?.message).toBe(message);
    expect(result.current.isError).toBe(true);
  };

  it('returns a friendly message for Axios network errors', async () => {
    const networkError = new AxiosError('Network Error');
    networkError.code = 'ERR_NETWORK';
    await expectWalletError(
      networkError,
      'Network error: Please check your connection and CORS configuration',
    );
  });

  it('includes the status code when Axios responds with HTTP error', async () => {
    const axiosError = new AxiosError('Request failed with status code 500');
    Object.assign(axiosError, {
      response: { status: 500 },
    });
    await expectWalletError(
      axiosError,
      'Failed to create wallet (500)',
    );
  });

  it('propagates the underlying message for generic errors', async () => {
    const genericError = new Error('Service unavailable');
    await expectWalletError(
      genericError,
      'Failed to create wallet: Service unavailable',
    );
  });
});
