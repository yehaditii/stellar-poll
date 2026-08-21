import { afterEach, describe, expect, it, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { createEventPoller, parseContractEvent } from './events'

function encoded(value) {
  return StellarSdk.nativeToScVal(value).toXDR('base64')
}

describe('contract event listener', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses a VoteEvent', () => {
    const event = parseContractEvent({
      id: 'vote-1',
      ledger: '12',
      topic: [encoded('vote'), encoded(3), encoded('GTESTVOTER')],
      value: encoded(1),
    })

    expect(event).toMatchObject({
      type: 'vote',
      pollId: 3,
      voter: 'GTESTVOTER',
      optionIndex: 1,
    })
  })

  it('parses a PollEvent for a newly created poll', () => {
    const event = parseContractEvent({
      id: 'poll-1',
      ledger: '13',
      topic: [encoded('poll_created'), encoded(4)],
      value: encoded('GTESTCREATOR'),
    })

    expect(event).toMatchObject({
      type: 'poll_created',
      pollId: 4,
      address: 'GTESTCREATOR',
    })
  })

  it('reports loading and listening states during the initial fetch', async () => {
    const statuses = []
    const rpc = {
      getLatestLedger: vi.fn().mockResolvedValue(10),
      getEvents: vi.fn().mockResolvedValue({ latestLedger: 10, events: [] }),
    }

    const stop = createEventPoller({ rpc, onStatus: status => statuses.push(status) })
    await vi.waitFor(() => expect(rpc.getEvents).toHaveBeenCalled())

    expect(statuses).toEqual(['loading', 'listening'])
    stop()
  })

  it('reports errors and retries with backoff', async () => {
    vi.useFakeTimers()
    const statuses = []
    const onError = vi.fn()
    const rpc = {
      getLatestLedger: vi.fn().mockResolvedValue(10),
      getEvents: vi.fn()
        .mockRejectedValueOnce(new Error('RPC offline'))
        .mockResolvedValue({ latestLedger: 10, events: [] }),
    }

    const stop = createEventPoller({ rpc, onError, onStatus: status => statuses.push(status) })
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(statuses).toEqual(['loading', 'retrying'])

    await vi.advanceTimersByTimeAsync(10000)
    expect(rpc.getEvents).toHaveBeenCalledTimes(2)
    stop()
  })

  it('stops polling when cleaned up', async () => {
    vi.useFakeTimers()
    const rpc = {
      getLatestLedger: vi.fn().mockResolvedValue(10),
      getEvents: vi.fn().mockResolvedValue({ latestLedger: 10, events: [] }),
    }

    const stop = createEventPoller({ rpc, intervalMs: 1000 })
    await vi.waitFor(() => expect(rpc.getEvents).toHaveBeenCalledTimes(1))
    stop()
    await vi.advanceTimersByTimeAsync(5000)

    expect(rpc.getEvents).toHaveBeenCalledTimes(1)
  })
})
