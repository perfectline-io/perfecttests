interface PlatformOverrides {
  billing?: Record<string, jest.Mock>
  email?: Record<string, jest.Mock>
  storage?: Record<string, jest.Mock>
  users?: Record<string, jest.Mock>
  referrals?: Record<string, jest.Mock>
}

function defaultBilling() {
  return {
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/test' },
        error: null,
      }),
    createPortalSession: jest
      .fn()
      .mockResolvedValue({
        data: { url: 'https://billing.stripe.com/test' },
        error: null,
      }),
    getSubscription: jest
      .fn()
      .mockResolvedValue({ data: null, error: null }),
  }
}

function defaultEmail() {
  return {
    send: jest
      .fn()
      .mockResolvedValue({ data: { id: 'email_test' }, error: null }),
  }
}

function defaultStorage() {
  return {
    getUploadUrl: jest
      .fn()
      .mockResolvedValue({
        data: { url: 'https://s3.amazonaws.com/test', key: 'test-key' },
        error: null,
      }),
    getDownloadUrl: jest
      .fn()
      .mockResolvedValue({
        data: { url: 'https://s3.amazonaws.com/test-download' },
        error: null,
      }),
  }
}

function defaultUsers() {
  return {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: null, error: null }),
    updateUser: jest
      .fn()
      .mockResolvedValue({ data: null, error: null }),
  }
}

function defaultReferrals() {
  return {
    trackReferral: jest
      .fn()
      .mockResolvedValue({ data: null, error: null }),
    getReferralStats: jest
      .fn()
      .mockResolvedValue({ data: { count: 0, earnings: 0 }, error: null }),
  }
}

export function mockPlatform(overrides?: PlatformOverrides) {
  const mock = {
    billing: { ...defaultBilling(), ...overrides?.billing },
    email: { ...defaultEmail(), ...overrides?.email },
    storage: { ...defaultStorage(), ...overrides?.storage },
    users: { ...defaultUsers(), ...overrides?.users },
    referrals: { ...defaultReferrals(), ...overrides?.referrals },
  }

  jest.mock('@/lib/platform', () => ({
    platform: mock,
  }))

  return mock
}
