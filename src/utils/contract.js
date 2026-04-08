import * as StellarSdk from '@stellar/stellar-sdk'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../constants'

const server = new StellarSdk.SorobanRpc.Server(RPC_URL)

export async function getVotes() {
  try {
    const counts = []
    const sourceAccount = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
    
    for (let i = 0; i < 3; i++) {
      try {
        const contract = new StellarSdk.Contract(CONTRACT_ID)
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call('get_votes', StellarSdk.nativeToScVal(i, { type: 'u32' })))
          .setTimeout(30)
          .build()

        const result = await server.simulateTransaction(tx)
        if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
          const val = StellarSdk.scValToNative(result.result.retval)
          counts.push(Math.max(0, Number(val) || 0))
        } else {
          counts.push(0)
        }
      } catch (innerErr) {
        console.warn(`Error getting votes for option ${i}:`, innerErr)
        counts.push(0)
      }
    }
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
      console.warn('Account not found on chain, using temp account')
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
      const hasVoted = StellarSdk.scValToNative(result.result.retval)
      return Boolean(hasVoted)
    }
    return false
  } catch (err) {
    console.warn('checkHasVoted error:', err)
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
      throw new Error('Could not fetch account details. Make sure this account has trusts the native asset.')
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
      const errMsg = simResult.error?.message || simResult.error || 'Simulation failed'
      if (String(errMsg).toLowerCase().includes('already')) {
        throw new Error('ALREADY_VOTED')
      }
      throw new Error('SIMULATION_FAILED: ' + errMsg)
    }

    const assembledTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build()
    return assembledTx
  } catch (err) {
    console.error('buildVoteTx error:', err)
    throw err
  }
}

export async function submitVoteTx(signedXdr) {
  if (!signedXdr) throw new Error('Signed XDR required')
  
  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
    const sendResult = await server.sendTransaction(tx)

    if (sendResult.status === 'ERROR') {
      throw new Error('Transaction rejected: ' + (sendResult.errorResultXdr || sendResult.errorResult || 'Unknown error'))
    }

    let hash = sendResult.hash
    if (!hash) throw new Error('No transaction hash received')

    // Poll for status
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try {
        const status = await server.getTransaction(hash)
        
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          return { hash, status: 'SUCCESS' }
        }
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Transaction failed on chain')
        }
        if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
          // Still waiting
          continue
        }
      } catch (err) {
        if (!String(err).includes('not found')) {
          console.warn('Status check error:', err)
        }
      }
    }
    
    // After polling completes, return the hash anyway
    return { hash, status: 'PENDING' }
  } catch (err) {
    console.error('submitVoteTx error:', err)
    throw err
  }
}