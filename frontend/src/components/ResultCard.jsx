import * as styles from "./ResultCard.module.css";

export default function ResultCard({ info, isSelected, onSelect }) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(info);
      return;
    }

    window.open(`https://www.youtube.com/watch?v=${info.id}`, "_blank", "noreferrer");
  };

  return (
    <article className={`${styles.card} ${isSelected ? styles.selected : ""}`} onClick={handleClick}>
      <img className={styles.thumb} src={info.thumb} alt={info.title} />
      <div className={styles.metaRow}>
        <div className={styles.channel}>{info.channel}</div>
        {info.duration ? <div className={styles.duration}>{info.duration}</div> : null}
      </div>
      <div className={styles.title}>{info.title}</div>
      <button className={styles.actionButton} type="button">
        {isSelected ? "Selected" : "Split This Track"}
      </button>
    </article>
  );
}