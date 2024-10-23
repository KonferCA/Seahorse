import dynamic from 'next/dynamic';
import styles from './app.module.css';

const SeahorseChat = dynamic(
  () => import('@/components/SeahorseChat.tsx').then((mod) => mod.SeahorseChat), 
  { ssr: false }
);

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.center}>
        <SeahorseChat />
      </div>
    </main>
  );
}
