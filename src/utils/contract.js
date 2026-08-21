import * as StellarSdk from '@stellar/stellar-sdk'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../constants'

export const server = new StellarSdk.SorobanRpc.Server(RPC_URL)

// Fetch votes for a specific option (0, 1, or 2)
export async function getVotes(optionIndex) {
  try {
    console.log(`[getVotes] Fetching votes for option ${optionIndex}`)
    
    const contract = new StellarSdk.Contract(CONTRACT_ID)
    
    // Get a valid account for simulation
    let sourceAccount
    try {
      sourceAccount = await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')
    } catch {
      sourceAccount = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
    }

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_votes', StellarSdk.nativeToScVal(optionIndex, { type: 'u32' })))
      .setTimeout(30)
      .build()

    const result = await server.simulateTransaction(tx)
    
    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
      // Extract the return value
      const retval = result.result?.retval
      console.log(`[getVotes] Raw retval for option ${optionIndex}:`, retval)
      
      if (!retval) {
        console.warn(`[getVotes] No retval for option ${optionIndex}`)
        return 0
      }
      
      // Convert Soroban value to native JavaScript
      const nativeVal = StellarSdk.scValToNative(retval)
      console.log(`[getVotes] Native value for option ${optionIndex}:`, nativeVal, `(type: ${typeof nativeVal})`)
      
      // Handle various types: number, string, BigInt
      let voteCount = 0
      if (typeof nativeVal === 'number') {
        voteCount = Math.max(0, nativeVal)
      } else if (typeof nativeVal === 'string') {
        voteCount = Math.max(0, parseInt(nativeVal, 10) || 0)
      } else if (typeof nativeVal === 'bigint') {
        voteCount = Math.max(0, Number(nativeVal))
      } else if (nativeVal !== null && nativeVal !== undefined) {
        voteCount = Math.max(0, Number(nativeVal) || 0)
      }
      
      console.log(`[getVotes] ✓ Option ${optionIndex}: ${voteCount} votes`)
      return voteCount
    } else {
      console.error(`[getVotes] ✗ Simulation failed for option ${optionIndex}:`, result.error)
      return 0
    }
  } catch (err) {
    console.error(`[getVotes] ERROR for option ${optionIndex}:`, err.message)
    return 0
  }
}

export async function checkHasVoted(publicKey) {
  if (!publicKey) return false
  
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID)
    const voterScVal = new StellarSdk.Address(publicKey).toScVal()
    
    let account
    try {
      account = await server.getAccount(publicKey)
    } catch (err) {
      account = new StellarSdk.Account(publicKey, '0')
    }

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('has_voted', voterScVal))
      .setTimeout(30)
      .build()

    const result = await server.simulateTransaction(tx)
    
    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
      const hasVoted = StellarSdk.scValToNative(result.result?.retval || result.result)
      return Boolean(hasVoted)
    }
    return false
  } catch (err) {
    console.warn('checkHasVoted error:', err.message)
    return false
  }
}

export async function buildVoteTx(publicKey, optionIndex) {
  if (!publicKey) throw new Error('Public key required')
  if (optionIndex === null || optionIndex === undefined) throw new Error('Option index required')
  
  try {
    let account
    try {
      account = await server.getAccount(publicKey)
    } catch (err) {
      throw new Error('Account not found. Ensure wallet has minimum balance and is funded on testnet.')
    }

    const contract = new StellarSdk.Contract(CONTRACT_ID)

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '3000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'vote',
          new StellarSdk.Address(publicKey).toScVal(),
          StellarSdk.nativeToScVal(optionIndex, { type: 'u32' })
        )
      )
      .setTimeout(30)
      .build()

    const simResult = await server.simulateTransaction(tx)
    
    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(simResult)) {
      const errMsg = simResult.error?.message || simResult.error?.toString() || 'Simulation failed'
      const errStr = String(errMsg).toLowerCase()
      
      if (errStr.includes('already') || errStr.includes('voted')) {
        throw new Error('ALREADY_VOTED')
      }
      throw new Error(errMsg)
    }

    const assembledTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build()
    return assembledTx
  } catch (err) {
    console.error('buildVoteTx error:', err.message)
    throw err
  }
}

export async function submitVoteTx(signedXdr) {
  if (!signedXdr) throw new Error('Signed XDR required')
  
  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
    const sendResult = await server.sendTransaction(tx)

    if (sendResult.status === 'ERROR') {
      throw new Error(sendResult.errorResultXdr || sendResult.errorResult || 'Transaction rejected')
    }

    let hash = sendResult.hash
    if (!hash) throw new Error('No transaction hash received')

    console.log('Transaction hash:', hash)
    console.log('Transaction submitted to Soroban RPC')

    // Poll for actual confirmation - ONLY return SUCCESS when truly confirmed
    let confirmed = false
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 800))
      try {
        const status = await server.getTransaction(hash)
        console.log(`Poll ${i + 1}/60: Status = ${status.status}`)
        
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          console.log('Transaction CONFIRMED on-chain')
          confirmed = true
          break
        }
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Transaction failed on chain')
        }
      } catch (err) {
        // Continue polling if not found
        if (i % 10 === 0) console.log(`Polling... (${Math.round(i * 0.8)}s elapsed)`)
      }
    }
    
    // CRITICAL: Only succeed if actually confirmed
    if (!confirmed) {
      console.warn('Transaction not confirmed after 48s - may still succeed')
      throw new Error('Transaction confirmation timeout - please check Stellar Expert')
    }
    
    return { hash, status: 'SUCCESS' }
  } catch (err) {
    console.error('submitVoteTx error:', err.message)
    throw err
  }
}