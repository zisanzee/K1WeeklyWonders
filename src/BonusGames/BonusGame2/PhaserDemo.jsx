// PhaserDemo.jsx — TODO: build Bubble Shooter's real hosting page (side
// rail, decorations, etc., following BonusGame1/PhaserDemo.jsx). This is a
// minimal placeholder wired up to the shared framework so the game boots.
import Game from './Game';
import NameGate from '../../NameGate';
import { usePlayerStore } from '../../playerStore';

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Bonus Game: Bubble Shooter">
      <PhaserDemoInner />
    </NameGate>
  );
}

function PhaserDemoInner() {
  const playerName = usePlayerStore((s) => s.playerName);
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-sky-100">
      <Game playerName={playerName} />
    </div>
  );
}
