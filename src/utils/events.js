import * as StellarSdk from '@stellar/stellar-sdk'
import { CONTRACT_ID } from '../constants'
import { server } from './contract'

const DEFAULT_INTERVAL = 5000
const MAX_BACKOFF = 60000

function decodeScVal(value) {
  if (!value) return null
  const scVal = typeof value === 'string'
    ? StellarSdk.xdr.ScVal.fromXDR(value, 'base64')
    : value
  return StellarSdk.scValToNative(scVal)
}

function toNumber(value) {
  return typeof value === 'bigint' ? Number(value) : value
}

export function parseContractEvent(event) {
  const topics = (event.topic || []).map(decodeScVal)
  const data = decodeScVal(event.value)
  const name = topics[0]

  if (name === 'vote') {
    return {
      type: 'vote',
      pollId: toNumber(topics[1]),
      voter: topics.length > 2 ? topics[2] : topics[1],
      optionIndex: toNumber(data),
      ledger: Number(event.ledger),
      id: event.id || event.paging_token,
    }
  }

  if (name === 'poll_created' || name === 'poll_closed') {
    return {
      type: name,
      pollId: toNumber(topics[1]),
      address: data,
      ledger: Number(event.ledger),
      id: event.id || event.paging_token,
    }
  }

  return null
}

export function createEventPoller({
  onEvent,
  onError,
  onStatus,
  intervalMs = DEFAULT_INTERVAL,
  rpc = server,
  contractId = CONTRACT_ID,
}) {
  let stopped = false
  let timer = null
  let nextLedger = null
  let delay = intervalMs

  const schedule = () => {
    if (!stopped) timer = setTimeout(poll, delay)
  }

  const poll = async () => {
    if (stopped) return

    try {
      if (nextLedger === null) {
        const latestLedger = await rpc.getLatestLedger()
        nextLedger = Number(latestLedger.sequence || latestLedger) + 1
      }

      const result = await rpc.getEvents({
        startLedger: nextLedger,
        filters: [{ type: 'contract', contractIds: [contractId] }],
      })

      for (const event of result.events || []) {
        const parsed = parseContractEvent(event)
        if (parsed) onEvent(parsed)
        if (Number(event.ledger) >= nextLedger) nextLedger = Number(event.ledger) + 1
      }

      if (Number(result.latestLedger) >= nextLedger) {
        nextLedger = Number(result.latestLedger) + 1
      }

      delay = intervalMs
      onStatus?.('listening')
      schedule()
    } catch (error) {
      onError?.(error)
      onStatus?.('retrying')
      delay = Math.min(delay * 2, MAX_BACKOFF)
      schedule()
    }
  }

  onStatus?.('loading')
  poll()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}