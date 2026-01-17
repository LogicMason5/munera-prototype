/**
 * XRPL Configuration
 */

export const XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';

export const XRPL_ENDPOINTS = {
  testnet: 'wss://s.altnet.rippletest.net:51233',
  mainnet: 'wss://xrplcluster.com',
};

export const XRPL_ENDPOINT = XRPL_ENDPOINTS[XRPL_NETWORK as keyof typeof XRPL_ENDPOINTS];

