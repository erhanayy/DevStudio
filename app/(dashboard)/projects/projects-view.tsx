"use client";

import { useState } from "react";
import { FolderGit2, Plus, Terminal, Trash2, Globe, Laptop, ArrowRight } from "lucide-react";
import { createProjectAction, deleteProjectAction } from "@/lib/actions/projects";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  slug: string;
  localPath: string;
  repoUrl?: string | null;
  deployCommand?: string | null;
  isDefault: boolean;
}

export function ProjectsView({ projects }: { projects: Project[] }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await createProjectAction(formData);
      toast.success("Proje başarıyla eklendi!");
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Proje eklenirken hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" projesini silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteProjectAction(id);
      toast.success("Proje silindi.");
    } catch (err: any) {
      toast.error(err.message || "Silme başarısız");
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
      {/* Üst Başlık & Ekle Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-cyan-400" />
            <span>{t("projects.title")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t("projects.desc")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t("projects.addProject")}</span>
        </button>
      </div>

      {/* Projeler Listesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black">
                    📁
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{proj.name}</span>
                      {proj.isDefault && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          Varsayılan
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(proj.id, proj.name)}
                  className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer"
                  title="Projeyi Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Dizin & Repo Detayları */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono text-slate-300 truncate" title={proj.localPath}>
                    {proj.localPath}
                  </span>
                </div>
                {proj.repoUrl && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono text-cyan-400 truncate" title={proj.repoUrl}>
                      {proj.repoUrl}
                    </span>
                  </div>
                )}
                {proj.deployCommand && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-mono text-amber-300/80 truncate text-[11px]" title={proj.deployCommand}>
                      {proj.deployCommand}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sohbeti Başlat Butonu */}
            <div className="pt-2 border-t border-slate-800/80">
              <Link
                href="/chat"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 group"
              >
                <span>Geliştirme Sohbetine Git</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Yeni Proje Ekleme Modalı */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-cyan-400" />
              <span>Yeni Proje Tanımla</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Proje Adı
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Örn: AllTripX veya BurstaBugun"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bilgisayarınızdaki Yerel Dizin Yolu
                </label>
                <input
                  name="localPath"
                  type="text"
                  required
                  placeholder="/Users/erhanayyildiz/Desktop/Work/TatildeBugun"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  GitHub Depo URL (İsteğe Bağlı)
                </label>
                <input
                  name="repoUrl"
                  type="url"
                  placeholder="https://github.com/kullanici/proje.git"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Canlı Dağıtım Komutu (Deploy Command)
                </label>
                <input
                  name="deployCommand"
                  type="text"
                  placeholder="gcloud run deploy ... veya vercel --prod"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  {t("projects.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Kaydediliyor..." : t("projects.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
