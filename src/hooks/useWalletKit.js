import { useState, useCallback } from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  XBULL_ID,
  ALBEDO_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit'

let kit = null

function getKit() {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    })
  }
  return kit
}

export function useWalletKit() {
  const [publicKey, setPublicKey] = useState(null)
  const [status, setStatus] = useState('idle') // idle, connecting, connected, error
  const [error, setError] = useState(null)

  const connect = useCallback(async (walletId = FREIGHTER_ID) => {
    setStatus('connecting')
    setError(null)

    try {
      const k = getKit()
      await k.setWallet(walletId)
      const { publicKey: key } = await k.getPublicKey()

      if (!key) {
        throw new Error('No public key returned')
      }

      setPublicKey(key)
      setStatus('connected')
    } catch (err) {
      const msg = err.message || ''
      console.error('Wallet connection error:', msg)

      if (
        msg.includes('not found') ||
        msg.includes('install') ||
        msg.includes('not installed')
      ) {
        setError({
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet extension not found. Please install it.',
        })
      } else if (msg.includes('rejected') || msg.includes('denied')) {
        setError({
          code: 'REJECTED',
          message: 'Connection rejected. Please approve in your wallet.',
        })
      } else if (msg.includes('network') || msg.includes('testnet')) {
        setError({
          code: 'NETWORK_MISMATCH',
          message: 'Please set your wallet to Stellar Testnet.',
        })
      } else {
        setError({
          code: 'UNKNOWN',
          message: msg || 'Connection failed. Please try again.',
        })
      }

      setStatus('error')
    }
  }, [])

  const disconnect = useCallback(() => {
    setPublicKey(null)
    setStatus('idle')
    setError(null)
  }, [])

  const sign = useCallback(async (xdr) => {
    if (!publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      const k = getKit()
      const { signedTxXdr } = await k.signTransaction(xdr, {
        network: WalletNetwork.TESTNET,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })

      if (!signedTxXdr) {
        throw new Error('No signed transaction returned')
      }

      return signedTxXdr
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('rejected') || msg.includes('denied')) {
        throw new Error('REJECTED')
      }
      throw err
    }
  }, [publicKey])

  return {
    publicKey,
    status,
    error,
    connect,
    disconnect,
    sign,
    FREIGHTER_ID,
    XBULL_ID,
    ALBEDO_ID,
  }
}