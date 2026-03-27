import { useState, useCallback, useEffect } from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  XBULL_ID,
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
      await k.setWallet(walletId)
      const { address } = await k.getAddress()
      if (!address) throw new Error('WALLET_NOT_FOUND')
      setPublicKey(address)
      setStatus('connected')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('WALLET_NOT_FOUND') || msg.includes('not found') || msg.includes('install')) {
        setError({ code: 'WALLET_NOT_FOUND', message: 'Wallet not installed. Please install Freighter.' })
      } else if (msg.includes('reject') || msg.includes('cancel') || msg.includes('denied')) {
        setError({ code: 'REJECTED', message: 'Connection rejected. Please approve in your wallet.' })
      } else {
        setError({ code: 'UNKNOWN', message: msg || 'Connection failed.' })
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
    const k = getKit()
    const { signedTxXdr } = await k.signTransaction(xdr, {
      network: WalletNetwork.TESTNET,
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
    return signedTxXdr
  }, [])

  return { publicKey, status, error, connect, disconnect, sign, FREIGHTER_ID, XBULL_ID }
}