import * as FreighterApi from '@stellar/freighter-api'

/**
 * Check if Freighter wallet is installed
 */
export async function isFreighterInstalled() {
  try {
    return await FreighterApi.isConnected()
  } catch (err) {
    console.error('Error checking Freighter:', err)
    return false
  }
}

/**
 * Request wallet access from user
 */
export async function requestWalletAccess() {
  try {
    await FreighterApi.requestAccess()
    return true
  } catch (err) {
    console.error('Wallet access denied:', err.message)
    if (err.message.includes('Popup closed') || err.message.includes('closed bythe user')) {
      throw new Error('REJECTED')
    }
    throw err
  }
}

/**
 * Get the user's public key
 */
export async function getWalletPublicKey() {
  try {
    const publicKey = await FreighterApi.getPublicKey()
    if (!publicKey) {
      throw new Error('No public key returned')
    }
    return publicKey
  } catch (err) {
    console.error('Error getting public key:', err.message)
    throw err
  }
}

/**
 * Sign a transaction with the wallet
 * @param {string} transactionXdr - The transaction XDR to sign
 */
export async function signTransaction(transactionXdr) {
  try {
    const { signedTxXdr } = await FreighterApi.signTransaction(transactionXdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
    if (!signedTxXdr) {
      throw new Error('No signed transaction returned')
    }
    return signedTxXdr
  } catch (err) {
    console.error('Error signing transaction:', err.message)
    if (err.message.includes('Popup closed') || err.message.includes('closed by the user')) {
      throw new Error('REJECTED')
    }
    throw err
  }
}

/**
 * Connect to Freighter wallet
 */
export async function connectWallet() {
  try {
    // Check if Freighter is installed
    const installed = await isFreighterInstalled()
    if (!installed) {
      throw new Error('WALLET_NOT_FOUND')
    }

    // Request access
    await requestWalletAccess()

    // Get public key
    const publicKey = await getWalletPublicKey()

    return { publicKey }
  } catch (err) {
    const message = err.message || ''

    if (message.includes('WALLET_NOT_FOUND')) {
      throw new Error('WALLET_NOT_FOUND')
    } else if (message.includes('REJECTED')) {
      throw new Error('REJECTED')
    } else if (message.includes('not set') || message.includes('testnet')) {
      throw new Error('NETWORK_MISMATCH')
    }

    throw err
  }
}

/**
 * Disconnect wallet (clears stored key)
 */
export function disconnectWallet() {
  // Freighter doesn't have an explicit disconnect, but we clear local state
  return Promise.resolve()
}
