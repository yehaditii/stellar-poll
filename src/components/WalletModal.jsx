import React from 'react'

export default function WalletModal({ onConnect, onClose, error }) {
  const wallets = [
    { id: 'freighter', label: 'Freighter', icon: '🚀', desc: 'Most popular Stellar wallet' },
    { id: 'xbull', label: 'xBull', icon: '🐂', desc: 'Feature-rich Stellar wallet' },
    { id: 'albedo', label: 'Albedo', icon: '🌟', desc: 'Web-based, no install needed' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d20', border: '1px solid #2a2a4a', borderRadius: 20, padding: 32, maxWidth: 400, width: '100%', animation: 'fadeUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Connect Wallet</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#1a0808', border: '1px solid #ff444430', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ff8888', lineHeight: 1.5 }}>
            {error.code === 'WALLET_NOT_FOUND' && '🔍 '}
            {error.code === 'REJECTED' && '❌ '}
            {error.code === 'UNKNOWN' && '⚠ '}
            {error.message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wallets.map(w => (
            <button key={w.id} onClick={() => onConnect(w.id)}
              style={{ background: '#13132a', border: '1px solid #2a2a4a', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', transition: 'border-color 0.2s', width: '100%' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a4a'}>
              <span style={{ fontSize: 28 }}>{w.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f0' }}>{w.label}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{w.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: '#333', marginTop: 20, textAlign: 'center', lineHeight: 1.5 }}>
          Make sure your wallet is set to <span style={{ color: '#6366f1' }}>Testnet</span>
        </p>
      </div>
    </div>
  )
}