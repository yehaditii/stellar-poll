import { useState, useCallback, useRef } from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  XBULL_ID,
  ALBEDO_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit'

const kitRef = { current: null }

function initializeKit() {
  if (!kitRef.current) {
    kitRef.current = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    })
  }
  return kitRef.current
}

export function useWalletKit() {
  const [publicKey, setPublicKey] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const connect = useCallback(async (walletId = FREIGHTER_ID) => {
    setStatus('connecting')
    setError(null)

    try {
      const kit = initializeKit()
      await kit.setWallet(walletId)
      
      // Get wallet public key
      let key
      try {
        key = await kit.getAddress()
      } catch (err) {
        console.warn('getAddress not available, trying alternative...')
        const pubKeyObj = await kit.getPublicKey()
        key = pubKeyObj?.publicKey || pubKeyObj
      }

      if (!key) {
        throw new Error('Could not retrieve wallet address')
      }

      setPublicKey(key)
      setStatus('connected')
    } catch (err) {
      const msg = String(err.message || err).toLowerCase()
      console.error('Wallet connection error:', err)

      if (
        msg.includes('not found') ||
        msg.includes('install') ||
        msg.includes('not installed') ||
        msg.includes('extension')
      ) {
        setError({
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found. Please install Freighter or select another wallet.',
        })
      } else if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user')) {
        setError({
          code: 'REJECTED',
          message: 'Connection was rejected. Please try again and approve the request.',
        })
      } else if (msg.includes('network') || msg.includes('testnet')) {
        setError({
          code: 'NETWORK_MISMATCH',
          message: 'Wrong network. Please switch your wallet to Stellar Testnet.',
        })
      } else {
        setError({
          code: 'UNKNOWN',
          message: msg || 'Failed to connect wallet. Please try again.',
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
      const kit = initializeKit()
      const signResult = await kit.signTransaction(xdr, {
        network: WalletNetwork.TESTNET,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })

      const signedXdr = signResult?.signedTxXdr || signResult?.xdr || signResult

      if (!signedXdr) {
        throw new Error('Transaction signing failed')
      }

      return signedXdr
    } catch (err) {
      const msg = String(err.message || err).toLowerCase()
      if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user')) {
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