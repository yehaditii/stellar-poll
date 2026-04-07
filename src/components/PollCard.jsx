import React, { useEffect, useState } from 'react'
import { POLL_OPTIONS, POLL_QUESTION } from '../constants'
import { getVotes, checkHasVoted, buildVoteTx, submitVoteTx } from '../utils/contract'

const TX_STATUS = { IDLE: 'idle', PENDING: 'pending', SUCCESS: 'success', ERROR: 'error' }

export default function PollCard({ publicKey, sign }) {
  const [votes, setVotes] = useState([0, 0, 0])
  const [hasVoted, setHasVoted] = useState(false)
  const [selected, setSelected] = useState(null)
  const [txStatus, setTxStatus] = useState(TX_STATUS.IDLE)
  const [txHash, setTxHash] = useState(null)
  const [txError, setTxError] = useState(null)
  const [loading, setLoading] = useState(true)

  const totalVotes = votes.reduce((a, b) => a + b, 0)

  const fetchData = async () => {
    const counts = await getVotes()
    setVotes(counts)
    if (publicKey) {
      const voted = await checkHasVoted(publicKey)
      setHasVoted(voted)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // real-time polling every 5s
    return () => clearInterval(interval)
  }, [publicKey])

  const handleVote = async () => {
    if (selected === null || hasVoted || !publicKey) return
    setTxStatus(TX_STATUS.PENDING)
    setTxError(null)

    try {
      const tx = await buildVoteTx(publicKey, selected)
      const signedXdr = await sign(tx.toXDR())
      const result = await submitVoteTx(signedXdr)
      setTxHash(result.hash)
      setTxStatus(TX_STATUS.SUCCESS)
      setHasVoted(true)
      await fetchData()
    } catch (err) {
      const msg = err.message || ''
      if (msg === 'ALREADY_VOTED') {
        setTxError({ code: 'ALREADY_VOTED', message: 'You have already voted with this wallet.' })
      } else if (msg.includes('reject') || msg.includes('cancel')) {
        setTxError({ code: 'REJECTED', message: 'Transaction rejected. Please approve in your wallet.' })
      } else if (msg.includes('insufficient') || msg.includes('balance')) {
        setTxError({ code: 'INSUFFICIENT_BALANCE', message: 'Insufficient XLM balance for transaction fees.' })
      } else {
        setTxError({ code: 'UNKNOWN', message: msg || 'Transaction failed.' })
      }
      setTxStatus(TX_STATUS.ERROR)
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
      <div style={{ fontSize: 24, marginBottom: 12, fontWeight: 700 }}>Loading</div>
      <p>Loading poll data...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="fade-up">
      {/* Question */}
      <div style={{ background: '#0d0d20', border: '1px solid #2a2a4a', borderRadius: 20, padding: '28px 32px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#22c55e' }}>LIVE ON-CHAIN</span>
          <span style={{ fontSize: 11, color: '#444', marginLeft: 'auto' }} className="mono">{totalVotes} total votes</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{POLL_QUESTION}</h2>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {POLL_OPTIONS.map(opt => {
          const pct = totalVotes > 0 ? Math.round((votes[opt.index] / totalVotes) * 100) : 0
          const isSelected = selected === opt.index
          const isWinner = hasVoted && votes[opt.index] === Math.max(...votes)

          return (
            <button key={opt.index}
              onClick={() => !hasVoted && setSelected(opt.index)}
              disabled={hasVoted}
              style={{
                background: isSelected ? '#13133a' : '#0d0d20',
                border: `1px solid ${isSelected ? '#6366f1' : isWinner ? '#22c55e40' : '#2a2a4a'}`,
                borderRadius: 14,
                padding: '18px 20px',
                cursor: hasVoted ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}>
              {/* Progress bar background */}
              {hasVoted && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: pct + '%',
                  background: isWinner ? '#22c55e15' : '#6366f115',
                  transition: 'width 0.8s ease',
                }} />
              )}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{opt.label}</span>
                </div>
                {hasVoted && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: isWinner ? '#22c55e' : '#e8e8f0', fontFamily: 'DM Mono, monospace' }}>{pct}%</div>
                    <div style={{ fontSize: 11, color: '#555' }}>{votes[opt.index]} votes</div>
                  </div>
                )}
                {!hasVoted && isSelected && (
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 'bold' }}>✓</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Transaction Status */}
      {txStatus === TX_STATUS.PENDING && (
        <div style={{ background: '#0d0d20', border: '1px solid #6366f130', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}></span>
          <span style={{ fontSize: 13, color: '#aaa' }}>Broadcasting vote to Stellar testnet...</span>
        </div>
      )}

      {txStatus === TX_STATUS.SUCCESS && txHash && (
        <div style={{ background: '#0a1a0a', border: '1px solid #22c55e30', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>Vote recorded on-chain</div>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#555', wordBreak: 'break-all', marginBottom: 8 }}>{txHash}</div>
          <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
            View on Explorer
          </a>
        </div>
      )}

      {txStatus === TX_STATUS.ERROR && txError && (
        <div style={{ background: '#1a0808', border: '1px solid #ff444430', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#ff8888', fontWeight: 600 }}>
            {txError.code === 'ALREADY_VOTED' && 'Already Voted: '}
            {txError.code === 'REJECTED' && 'Rejected: '}
            {txError.code === 'INSUFFICIENT_BALANCE' && 'Insufficient Balance: '}
            {txError.code === 'UNKNOWN' && 'Error: '}
            {txError.message}
          </div>
        </div>
      )}

      {/* Vote Button */}
      {!hasVoted && publicKey && (
        <button onClick={handleVote}
          disabled={selected === null || txStatus === TX_STATUS.PENDING}
          style={{
            width: '100%',
            background: selected === null ? '#1a1a30' : '#6366f1',
            color: selected === null ? '#444' : '#fff',
            border: 'none',
            borderRadius: 14,
            padding: '16px',
            cursor: selected === null ? 'not-allowed' : 'pointer',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            transition: 'all 0.2s',
          }}>
          {txStatus === TX_STATUS.PENDING ? 'Submitting...' : 'Cast Vote On-Chain'}
        </button>
      )}

      {hasVoted && (
        <div style={{ textAlign: 'center', padding: '16px', color: '#22c55e', fontWeight: 600, fontSize: 15 }}>
          Your vote has been recorded on the Stellar blockchain
        </div>
      )}

      {!publicKey && (
        <div style={{ textAlign: 'center', padding: '16px', color: '#555', fontSize: 14 }}>
          Connect your wallet to vote
        </div>
      )}
    </div>
  )
}