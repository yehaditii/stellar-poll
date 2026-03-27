import * as StellarSdk from '@stellar/stellar-sdk'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../constants'

const server = new StellarSdk.SorobanRpc.Server(RPC_URL)

export async function getVotes() {
  try {
    const counts = []
    for (let i = 0; i < 3; i++) {
      const contract = new StellarSdk.Contract(CONTRACT_ID)
      const tx = new StellarSdk.TransactionBuilder(
        await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
        { fee: StellarSdk.BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call('get_votes', StellarSdk.nativeToScVal(i, { type: 'u32' })))
        .setTimeout(30)
        .build()

      const result = await server.simulateTransaction(tx)
      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
        const val = StellarSdk.scValToNative(result.result.retval)
        counts.push(Number(val))
      } else {
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
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID)
    const voterScVal = new StellarSdk.Address(publicKey).toScVal()
    const account = await server.getAccount(publicKey)

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('has_voted', voterScVal))
      .setTimeout(30)
      .build()

    const result = await server.simulateTransaction(tx)
    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
      return StellarSdk.scValToNative(result.result.retval)
    }
    return false
  } catch {
    return false
  }
}

export async function buildVoteTx(publicKey, optionIndex) {
  const account = await server.getAccount(publicKey)
  const contract = new StellarSdk.Contract(CONTRACT_ID)

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
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
    const errMsg = simResult.error || 'Simulation failed'
    if (errMsg.includes('already voted')) throw new Error('ALREADY_VOTED')
    throw new Error('SIMULATION_FAILED: ' + errMsg)
  }

  return StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build()
}

export async function submitVoteTx(signedXdr) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  const sendResult = await server.sendTransaction(tx)

  if (sendResult.status === 'ERROR') {
    throw new Error('Transaction rejected by network')
  }

  // Poll for status
  let hash = sendResult.hash
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const status = await server.getTransaction(hash)
    if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash, status: 'SUCCESS' }
    }
    if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on chain')
    }
  }
  throw new Error('Transaction timed out')
}