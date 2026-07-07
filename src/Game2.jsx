import React from 'react';
import { Link } from 'react-router-dom';

const Game2 = () => {
    return (
        <div className="flex flex-col h-screen items-center justify-center bg-slate-900">
      <Link
        to="/"
        className="font-body flex items-center gap-1 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:text-base"
      >
        ⬅️ Home
      </Link>
      <p className="text-xl font-bold text-gray-300 ">
        Week 2 is in the works! Stay tuned for the upcoming game. 🎮 ✨
      </p>
    </div>
    );
}

export default Game2;
