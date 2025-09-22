import { renderHook, act } from '@testing-library/react';
import { AxiosError } from 'axios';
import { vi, describe, beforeEach, it, expect } from 'vitest';

let mockUser: unknown = null;
const mockUpdateUser = vi.fn();
const mockLog = vi.fn();
const mockClient = {
  auth: {
    initSIWE: vi.fn(),
    authenticateWithSIWE: vi.fn(),
    linkWallet: vi.fn(),
  },
  getAccessToken: vi.fn(),
};

const mockConnector = { type: 'injected', id: 'mock-connector' };

vi.mock('../../../components/Openfort/useOpenfort', () => ({
  __esModule: true,
  useOpenfort: () => ({
    log: mockLog,
  }),
}));

vi.mock('../../../openfort/useOpenfort', () => ({
  __esModule: true,
  useOpenfortCore: () => ({
    client: mockClient,
    user: mockUser,
    updateUser: mockUpdateUser,
  }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x123',
    connector: mockConnector,
  }),
  useChainId: () => 1,
  useConfig: () => ({}),
}));

const signMessageMock = vi.fn();

vi.mock('@wagmi/core', () => ({
  signMessage: (...args: unknown[]) => signMessageMock(...args),
}));

// Import after mocks are set up
import { useConnectWithSiwe } from '../useConnectWithSiwe';

describe('useConnectWithSiwe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
  });

  it('surfaces a network-friendly message when Axios reports a network error', async () => {
    const networkError = new AxiosError('Network Error');
    networkError.code = 'ERR_NETWORK';
    mockClient.auth.initSIWE.mockRejectedValue(networkError);

    const onError = vi.fn();
    const { result } = renderHook(() => useConnectWithSiwe());

    await act(async () => {
      await result.current({ onError });
    });

    expect(onError).toHaveBeenCalledWith(
      'Network error: Please check your connection and CORS configuration',
      undefined,
    );
  });

  it('passes through the HTTP status code for Axios errors', async () => {
    const axiosError = new AxiosError('Request failed');
    Object.assign(axiosError, {
      response: { status: 401 },
    });
    mockClient.auth.initSIWE.mockRejectedValue(axiosError);

    const onError = vi.fn();
    const { result } = renderHook(() => useConnectWithSiwe());

    await act(async () => {
      await result.current({ onError });
    });

    expect(onError).toHaveBeenCalledWith('Failed to connect with SIWE (401)', 401);
  });

  it('falls back to native error messages for non-Axios errors', async () => {
    const plainError = new Error('Unexpected failure');
    mockClient.auth.initSIWE.mockRejectedValue(plainError);

    const onError = vi.fn();
    const { result } = renderHook(() => useConnectWithSiwe());

    await act(async () => {
      await result.current({ onError });
    });

    expect(onError).toHaveBeenCalledWith('Unexpected failure');
  });
});
