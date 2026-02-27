interface EmergencyInfoCardProps {
  title: string;
  items: string[];
  variant: 'critical' | 'warning' | 'info';
  icon?: React.ReactNode;
}

export function EmergencyInfoCard({ title, items, variant, icon }: EmergencyInfoCardProps) {
  const variantStyles = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      heading: 'text-red-900'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      heading: 'text-yellow-900'
    },
    info: {
      bg: 'bg-gray-50',
      border: 'border-gray-300',
      text: 'text-gray-700',
      heading: 'text-gray-900'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div 
      className={`${styles.bg} border-2 ${styles.border} rounded-lg p-4`}
      role="region"
      aria-label={`${title} information`}
    >
      <h3 className={`font-bold ${styles.heading} mb-3 flex items-center gap-2`}>
        {icon}
        {title}
      </h3>
      <ul className="space-y-2" role="list">
        {items.map((item, idx) => (
          <li key={idx} className={`flex items-start gap-2 ${styles.text}`}>
            <span className="mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
