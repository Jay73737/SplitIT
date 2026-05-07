import ResultCard from "./ResultCard.jsx";
import * as styles from "./SearchResults.module.css";

export default function SearchResults({ items, selectedId, onSelect }) {
  if (!items.length) return null;

  return (
    <div className={styles.panel}>
      {items.map((v) => (
        <ResultCard key={v.id} info={v} isSelected={selectedId === v.id} onSelect={onSelect} />
      ))}
    </div>
  );
}