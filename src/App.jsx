import React, { useState } from 'react'
import { useWalletKit } from './hooks/useWalletKit'
import WalletModal from './components/WalletModal'
import PollCard from './components/PollCard'

export default function App() {
  const { publicKey, status, error, connect, disconnect, sign, FREIGHTER_ID, XBULL_ID, ALBEDO_ID } = useWalletKit()
  const [showModal, setShowModal] = useState(false)

  const walletOptions = [
    { id: FREIGHTER_ID, name: 'Freighter', description: 'Most popular Stellar wallet' },
    { id: XBULL_ID, name: 'xBull', description: 'Feature-rich Stellar wallet' },
    { id: ALBEDO_ID, name: 'Albedo', description: 'Web-based, no install needed' },
  ]

  const short = (k) => k ? k.slice(0, 6) + '...' + k.slice(-4) : ''

  return (
    <div style={{ minHeight: '100vh', background: '#050510' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #1a1a2e', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: '#6366f1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 18 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>StellarPoll</span>
          <span style={{ background: '#6366f115', color: '#6366f1', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99, border: '1px solid #6366f130', fontFamily: 'DM Mono, monospace' }}>TESTNET</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'connected' ? (
            <>
              <div style={{ background: '#0d0d20', border: '1px solid #2a2a4a', borderRadius: 10, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#aaa' }}>
                {short(publicKey)}
              </div>
              <button onClick={disconnect}
                style={{ background: 'transparent', border: '1px solid #2a2a4a', color: '#666', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff5555'; e.currentTarget.style.color = '#ff5555' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a4a'; e.currentTarget.style.color = '#666' }}>
                Disconnect
              </button>
            </>
          ) : (
            <button onClick={() => setShowModal(true)}
              disabled={status === 'connecting'}
              style={{ 
                background: status === 'connecting' ? '#4a4a6a' : '#6366f1', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 10, 
                padding: '10px 22px', 
                cursor: status === 'connecting' ? 'not-allowed' : 'pointer', 
                fontFamily: 'Space Grotesk, sans-serif', 
                fontWeight: 700, 
                fontSize: 14,
                transition: 'all 0.2s'
              }}>
              {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.2, marginBottom: 12 }}>
            Vote On-Chain.<br />
            <span style={{ background: 'linear-gradient(90deg, #6366f1, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Results in Real-Time.
            </span>
          </h1>
          <p style={{ color: '#555', fontSize: 15, lineHeight: 1.6 }}>
            Each vote is a Soroban smart contract call on Stellar testnet.
          </p>
        </div>

        <PollCard publicKey={publicKey} sign={sign} />
      </main>

      {showModal && (
        <WalletModal
          onConnect={async (walletId) => {
            await connect(walletId)
            if (!error) setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
          error={error}
          status={status}
          walletOptions={walletOptions}
        />
      )}
    </div>
  )
}