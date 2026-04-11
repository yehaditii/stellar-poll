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
  const [copied, setCopied] = useState(false)

  const totalVotes = votes.reduce((a, b) => a + b, 0)

  const fetchData = async () => {
    try {
      console.log('[fetchData] Starting vote fetch...')
      
      // Fetch votes for each option individually
      const v0 = await getVotes(0)
      const v1 = await getVotes(1)
      const v2 = await getVotes(2)
      
      console.log('[fetchData] Raw votes:', v0, v1, v2)
      
      const counts = [v0, v1, v2]
      const total = v0 + v1 + v2
      
      console.log(`[fetchData] 📊 TOTAL: [${counts.join(', ')}] = ${total} votes`)
      
      setVotes(counts)
      
      if (publicKey) {
        const voted = await checkHasVoted(publicKey)
        console.log('[fetchData] Has voted:', voted)
        setHasVoted(voted)
      }
    } catch (err) {
      console.error('[fetchData] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [publicKey])

  const handleVote = async () => {
    if (selected === null || hasVoted || !publicKey) {
      console.log('Vote blocked - selected:', selected, 'hasVoted:', hasVoted, 'publicKey:', publicKey)
      return
    }
    
    console.log('Starting vote for option:', selected, 'user:', publicKey)
    setTxStatus(TX_STATUS.PENDING)
    setTxError(null)
    setTxHash(null)

    try {
      console.log('Building transaction for option', selected)
      const tx = await buildVoteTx(publicKey, selected)
      console.log('Transaction built successfully')
      
      console.log('Requesting wallet signature')
      const signedXdr = await sign(tx.toXDR())
      console.log('Transaction signed, submitting to chain')
      
      const result = await submitVoteTx(signedXdr)
      console.log('Transaction confirmed with hash:', result.hash)
      
      setTxHash(result.hash)
      setTxStatus(TX_STATUS.SUCCESS)
      setHasVoted(true)
      setSelected(null)  // CRITICAL: Reset selected option after successful vote
      
      // Refetch data after a delay to ensure blockchain confirmation
      setTimeout(async () => {
        console.log('[handleVote] Refetching votes 2s after confirmation...')
        try {
          const v0 = await getVotes(0)
          const v1 = await getVotes(1)
          const v2 = await getVotes(2)
          const counts = [v0, v1, v2]
          const total = counts.reduce((a, b) => a + b, 0)
          console.log(`[handleVote] Updated votes: [${counts.join(', ')}] = ${total} total`)
          setVotes(counts)
        } catch(refetchErr) {
          console.error('[handleVote] Error refetching votes:', refetchErr)
        }
      }, 2000)
    } catch (err) {
      const msg = String(err.message || err).toLowerCase()
      console.error('Vote error:', err.message)
      
      if (msg.includes('already')) {
        setTxError({ code: 'ALREADY_VOTED', message: 'You have already voted with this wallet.' })
      } else if (msg.includes('rejected') || msg.includes('user')) {
        setTxError({ code: 'REJECTED', message: 'Transaction rejected. Please approve in your wallet.' })
      } else if (msg.includes('insufficient') || msg.includes('balance')) {
        setTxError({ code: 'INSUFFICIENT_BALANCE', message: 'Insufficient XLM balance for transaction fees.' })
      } else if (msg.includes('confirmation') || msg.includes('timeout')) {
        setTxError({ code: 'TIMEOUT', message: 'Transaction took too long to confirm. Check Stellar Expert for status.' })
      } else {
        setTxError({ code: 'UNKNOWN', message: msg || 'Transaction failed. Please try again.' })
      }
      setTxStatus(TX_STATUS.ERROR)
      setSelected(null)  // Reset on error too
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await fetchData()
  }

  const copyToClipboard = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #2a2a4a',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f0', marginBottom: 8 }}>Loading poll data</div>
      <p style={{ color: '#555', fontSize: 13 }}>Fetching results from blockchain...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="fade-up">
      {/* Question Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0d0d20 0%, #13132a 100%)',
        border: '1px solid #2a2a4a',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#22c55e' }}>LIVE ON-CHAIN</span>
          <span style={{ fontSize: 11, color: '#444', marginLeft: 'auto', fontFamily: 'DM Mono, monospace' }}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{POLL_QUESTION}</h2>
      </div>

      {/* Results Heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f0' }}>Live Results</h3>
        <button onClick={handleRefresh}
          style={{
            background: 'transparent',
            border: '1px solid #2a2a4a',
            color: '#6366f1',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            transition: 'all 0.2s ease',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#6366f10a' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a4a'; e.currentTarget.style.background = 'transparent' }}>
          Refresh
        </button>
      </div>

      {/* Voting Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {POLL_OPTIONS.map((opt, idx) => {
          const pct = totalVotes > 0 ? Math.round((votes[opt.index] / totalVotes) * 100) : 0
          const isSelected = selected === opt.index
          const isWinner = hasVoted && votes[opt.index] === Math.max(...votes)

          return (
            <button
              key={opt.index}
              onClick={() => !hasVoted && setSelected(opt.index)}
              disabled={hasVoted}
              style={{
                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : '#0d0d20',
                border: `2px solid ${isSelected ? '#6366f1' : isWinner ? '#22c55e' : '#2a2a4a'}`,
                borderRadius: 14,
                padding: '18px 22px',
                cursor: hasVoted ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                transform: isSelected ? 'translateX(4px)' : 'translateX(0)',
              }}
              onMouseEnter={e => {
                if (!hasVoted && !isSelected) {
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = isWinner ? '#22c55e' : '#2a2a4a'
                  e.currentTarget.style.background = '#0d0d20'
                }
              }}
            >
              {/* Progress bar */}
              {hasVoted && pct > 0 && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: pct + '%',
                  background: isWinner ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                  transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 0,
                }} />
              )}
              
              {/* Content */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? '#6366f1' : '#2a2a4a'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    background: isSelected ? '#6366f1' : 'transparent',
                  }}>
                    {isSelected && <div style={{ width: 4, height: 4, background: '#fff', borderRadius: '50%' }} />}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{opt.label}</span>
                </div>
                
                {hasVoted && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: isWinner ? '#22c55e' : '#e8e8f0',
                      fontFamily: 'DM Mono, monospace',
                    }}>
                      {pct}%
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {votes[opt.index]} {votes[opt.index] === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Transaction Status Messages */}
      {txStatus === TX_STATUS.PENDING && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#6366f1',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 13, color: '#a7a5d9' }}>Broadcasting transaction to Stellar testnet...</span>
        </div>
      )}

      {txStatus === TX_STATUS.SUCCESS && txHash && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginBottom: 8 }}>Vote confirmed on-chain</div>
          <div onClick={copyToClipboard} style={{
            fontSize: 11,
            fontFamily: 'DM Mono, monospace',
            color: '#22c55e',
            wordBreak: 'break-all',
            marginBottom: 8,
            padding: '8px 12px',
            background: 'rgba(34, 197, 94, 0.05)',
            borderRadius: 6,
            cursor: 'pointer',
            userSelect: 'all',
          }}>
            {txHash}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{
                fontSize: 12,
                color: '#6366f1',
                textDecoration: 'none',
                fontWeight: 600,
                padding: '6px 10px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: 6,
                border: '1px solid rgba(99, 102, 241, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)' }}
            >
              View in Explorer
            </a>
            <button onClick={copyToClipboard} style={{
              fontSize: 12,
              color: copied ? '#22c55e' : '#6366f1',
              background: copied ? 'rgba(34, 197, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              border: `1px solid ${copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}>
              {copied ? 'Copied' : 'Copy Hash'}
            </button>
          </div>
        </div>
      )}

      {txStatus === TX_STATUS.ERROR && txError && (
        <div style={{
          background: 'rgba(255, 68, 68, 0.1)',
          border: '1px solid rgba(255, 68, 68, 0.3)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: '#ff8888', fontWeight: 600 }}>
            {txError.code === 'ALREADY_VOTED' && 'Already Voted'}
            {txError.code === 'REJECTED' && 'Transaction Rejected'}
            {txError.code === 'INSUFFICIENT_BALANCE' && 'Insufficient Balance'}
            {txError.code === 'UNKNOWN' && 'Error'}
          </div>
          <div style={{ fontSize: 12, color: '#ff9999', marginTop: 4 }}>
            {txError.message}
          </div>
        </div>
      )}

      {/* Cast Vote Button */}
      {!hasVoted && publicKey && (
        <button
          onClick={handleVote}
          disabled={selected === null || txStatus === TX_STATUS.PENDING}
          style={{
            width: '100%',
            background: selected === null ? 'rgba(99, 102, 241, 0.3)' : '#6366f1',
            color: selected === null ? '#666' : '#fff',
            border: 'none',
            borderRadius: 14,
            padding: '16px',
            cursor: selected === null ? 'not-allowed' : 'pointer',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            transition: 'all 0.3s ease',
            opacity: selected === null ? 0.6 : 1,
            transform: txStatus === TX_STATUS.PENDING ? 'scale(0.98)' : 'scale(1)',
          }}
          onMouseEnter={e => {
            if (selected !== null && txStatus !== TX_STATUS.PENDING) {
              e.currentTarget.style.background = '#7c7ff1'
            }
          }}
          onMouseLeave={e => {
            if (selected !== null) {
              e.currentTarget.style.background = '#6366f1'
            }
          }}
        >
          {txStatus === TX_STATUS.PENDING ? 'Submitting vote...' : 'Cast Vote'}
        </button>
      )}

      {hasVoted && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#22c55e',
          fontWeight: 600,
          fontSize: 15,
          background: 'rgba(34, 197, 94, 0.05)',
          borderRadius: 12,
          border: '1px solid rgba(34, 197, 94, 0.2)',
        }}>
          Your vote has been recorded
        </div>
      )}

      {!publicKey && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#888',
          fontSize: 14,
          background: 'rgba(99, 102, 241, 0.05)',
          borderRadius: 12,
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          Connect your wallet to participate in voting
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}