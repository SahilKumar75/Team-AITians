interface WalletConnectButtonProps {
  onConnect: () => void;
  loading?: boolean;
  variant?: 'blue' | 'indigo' | 'red';
  className?: string;
}

export function WalletConnectButton({ 
  onConnect, 
  loading = false, 
  variant = 'blue',
  className = ''
}: WalletConnectButtonProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    red: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <button
      onClick={onConnect}
      disabled={loading}
      className={`px-6 py-2 ${colorClasses[variant]} text-white rounded-lg transition disabled:opacity-50 ${className}`}
      aria-label={loading ? "Connecting to wallet" : "Connect wallet to continue"}
    >
      {loading ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
