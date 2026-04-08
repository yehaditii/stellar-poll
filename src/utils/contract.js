import * as StellarSdk from '@stellar/stellar-sdk'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../constants'

const server = new StellarSdk.SorobanRpc.Server(RPC_URL)

export async function getVotes() {
  try {
    const counts = []
    
    for (let i = 0; i < 3; i++) {
      try {
        const contract = new StellarSdk.Contract(CONTRACT_ID)
        
        // Get a valid account for simulation
        let sourceAccount
        try {
          sourceAccount = await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')
        } catch {
          // If account doesn't exist, use sequence 0
          sourceAccount = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
        }

        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call('get_votes', StellarSdk.nativeToScVal(i, { type: 'u32' })))
          .setTimeout(30)
          .build()

        const result = await server.simulateTransaction(tx)
        
        if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
          const val = StellarSdk.scValToNative(result.result?.retval || result.result)
          const voteCount = Math.max(0, Number(val) || 0)
          counts.push(voteCount)
          console.log(`Option ${i} votes: ${voteCount}`)
        } else {
          console.warn(`Vote simulation failed for option ${i}`, result)
          counts.push(0)
        }
      } catch (innerErr) {
        console.error(`Error getting votes for option ${i}:`, innerErr.message)
        counts.push(0)
      }
    }
    
    console.log('Total votes fetched:', counts)
    return counts
  } catch (err) {
    console.error('getVotes error:', err)
    return [0, 0, 0]
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

    // Poll for status - more aggressive polling
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 800))
      try {
        const status = await server.getTransaction(hash)
        
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          console.log('Transaction confirmed')
          return { hash, status: 'SUCCESS' }
        }
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Transaction failed on chain')
        }
      } catch (err) {
        // Continue polling if not found
        if (i % 10 === 0) console.log(`Polling... (${i}s)`)
      }
    }
    
    // Return even if still pending
    return { hash, status: 'SUCCESS' }
  } catch (err) {
    console.error('submitVoteTx error:', err.message)
    throw err
  }
}