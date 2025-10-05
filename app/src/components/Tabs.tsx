interface TabsProps {
  active: 'notes' | 'archived'
  onChange: (tab: 'notes' | 'archived') => void
}

const Tabs = ({ active, onChange }: TabsProps) => {
  return (
    <div className="tabs" role="tablist" aria-label="Note buckets">
      {(
        [
          { id: 'notes' as const, label: 'Notes' },
          { id: 'archived' as const, label: 'Archived' },
        ]
      ).map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'tab active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default Tabs
