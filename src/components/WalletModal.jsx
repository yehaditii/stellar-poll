import React from 'react'

export default function WalletModal({ onConnect, onClose, error, status, walletOptions }) {
  const isConnecting = status === 'connecting'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="wallet-modal"
        style={{
          background: '#0d0d20',
          border: '1px solid #2a2a4a',
          borderRadius: 20,
          padding: 32,
          maxWidth: 420,
          width: '100%',
          animation: 'fadeUp 0.3s ease',
        }}
      >
        <div className="wallet-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Connect Wallet</h2>
          <button
            aria-label="Close wallet dialog"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#1a0808',
              border: '1px solid #ff444430',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: '#ff8888',
              lineHeight: 1.5,
            }}
          >
            <strong>
              {error.code === 'WALLET_NOT_FOUND' && 'Wallet Not Found: '}
              {error.code === 'REJECTED' && 'Connection Rejected: '}
              {error.code === 'NETWORK_MISMATCH' && 'Network Error: '}
            </strong>
            {error.message}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 16 }}>
            Select a wallet to connect and vote on this poll. Freighter is recommended for Stellar.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {walletOptions.map(wallet => (
            <button
              key={wallet.id}
              onClick={() => onConnect(wallet.id)}
              disabled={isConnecting}
              style={{
                background: '#13132a',
                border: '1px solid #2a2a4a',
                borderRadius: 14,
                padding: '16px 20px',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                textAlign: 'left',
                transition: 'all 0.2s',
                width: '100%',
                opacity: isConnecting ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (!isConnecting) {
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.background = '#1a1a35'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#2a2a4a'
                e.currentTarget.style.background = '#13132a'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f0' }}>
                  {wallet.name}
                </div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  {wallet.description}
                </div>
              </div>
              {isConnecting && <span style={{ color: '#6366f1', fontSize: 12 }}>Connecting...</span>}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: '#333', marginTop: 20, textAlign: 'center', lineHeight: 1.5 }}>
          Make sure your wallet is set to <span style={{ color: '#6366f1', fontWeight: 700 }}>Stellar Testnet</span>
        </p>
      </div>
    </div>
  )
}