interface FabProps {
  onClick: () => void
}

const Fab = ({ onClick }: FabProps) => {
  return (
    <button type="button" className="fab" onClick={onClick} aria-label="Create note">
      +
    </button>
  )
}

export default Fab
