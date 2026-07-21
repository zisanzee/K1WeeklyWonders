import PhaserGame from './PhaserGame';

export default function PhaserDemo() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8] p-4">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
      <PhaserGame />
    </div>
  );
}