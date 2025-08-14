import * as styles from "./ResultCard.module.css";

export default function ResultCard({ info }) {
  const open = () =>
    window.open(`https://www.youtube.com/watch?v=${info.id}`, "_blank");

  return (
    <div className={styles.card} onClick={open}>
      <img className={styles.thumb} src={info.thumb} alt={info.title} />
      <div className={styles.title}>{info.title}</div>
      <div className={styles.channel}>{info.channel}</div>
    </div>
  );
}