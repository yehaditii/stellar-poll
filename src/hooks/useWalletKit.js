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
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const connect = useCallback(async (walletId = FREIGHTER_ID) => {
    setStatus('connecting')
    setError(null)

    try {
      const k = getKit()
      
      // Set the selected wallet
      await k.setWallet(walletId)
      console.log('Wallet set to:', walletId)

      // Try to get the public key
      let key = null
      
      try {
        // Try the standard method first
        if (typeof k.getAddress === 'function') {
          key = await k.getAddress()
          console.log('Got address via getAddress:', key)
        } else if (typeof k.getPublicKey === 'function') {
          const pubKeyObj = await k.getPublicKey()
          key = pubKeyObj?.publicKey || pubKeyObj
          console.log('Got address via getPublicKey:', key)
        } else {
          throw new Error('No address retrieval method available')
        }
      } catch (addressErr) {
        console.warn('Standard method failed:', addressErr.message)
        // Try alternative methods
        try {
          const pubKeyObj = await k.getPublicKey()
          key = pubKeyObj?.publicKey || pubKeyObj
        } catch {
          console.error('All address retrieval methods failed')
        }
      }

      // Validate we got a key
      if (!key || typeof key !== 'string' || key.length === 0) {
        throw new Error('Failed to retrieve valid wallet address')
      }

      // Validate it's a Stellar address
      if (!key.startsWith('G')) {
        throw new Error('Invalid Stellar address format')
      }

      setPublicKey(key)
      setStatus('connected')
      console.log('Successfully connected wallet:', key.slice(0, 6) + '...')
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
          message: 'Wallet not found. Please install Freighter, xBull, or Albedo.',
        })
      } else if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user')) {
        setError({
          code: 'REJECTED',
          message: 'Connection rejected. Please approve the request in your wallet.',
        })
      } else if (msg.includes('network') || msg.includes('testnet')) {
        setError({
          code: 'NETWORK_MISMATCH',
          message: 'Wrong network. Switch your wallet to Stellar Testnet.',
        })
      } else if (msg.includes('address') || msg.includes('public key')) {
        setError({
          code: 'NO_KEY',
          message: 'Could not retrieve wallet address. Try again or switch wallets.',
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
      const k = getKit()
      
      // Sign the transaction
      const signResult = await k.signTx({
        xdr,
        publicKeys: [publicKey],
        network: WalletNetwork.TESTNET,
      })

      // Extract signed XDR from result
      const signedXdr = signResult?.result
      if (typeof signedXdr !== 'string' || signedXdr.length === 0) {
        console.error('Sign result:', signResult)
        throw new Error('Failed to sign transaction')
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