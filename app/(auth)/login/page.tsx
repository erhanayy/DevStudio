import { LoginForm } from "./login-form";
import { Terminal, Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Arka plan ışık efektleri */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10 space-y-6">
        {/* Logo & Başlık */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/25 mx-auto">
            <Terminal className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>Dev<span className="text-cyan-400">Studio</span></span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> AI
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cebinizdeki Yapay Zeka Baş Mühendis
          </p>
        </div>

        {/* Giriş Kartı */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
