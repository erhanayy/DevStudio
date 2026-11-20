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
      toast.success(t("projects.addedToast"));
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || t("projects.addErrorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" ${t("projects.deleteConfirm")}`)) return;
    try {
      await deleteProjectAction(id);
      toast.success(t("projects.deletedToast"));
    } catch (err: any) {
      toast.error(err.message || t("projects.deleteErrorToast"));
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6 overflow-y-auto overflow-x-hidden">
      {/* Üst Başlık & Ekle Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-cyan-400 shrink-0" />
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
            className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between min-w-0"
          >
            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black shrink-0">
                    📁
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                      <span className="truncate">{proj.name}</span>
                      {proj.isDefault && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                          {t("projects.defaultBadge")}
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(proj.id, proj.name)}
                  className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                  title={t("projects.deleteTitle")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Dizin & Repo Detayları */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-400 min-w-0">
                  <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono text-slate-300 truncate" title={proj.localPath}>
                    {proj.localPath}
                  </span>
                </div>
                {proj.repoUrl && (
                  <div className="flex items-center gap-2 text-slate-400 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono text-cyan-400 truncate" title={proj.repoUrl}>
                      {proj.repoUrl}
                    </span>
                  </div>
                )}
                {proj.deployCommand && (
                  <div className="flex items-center gap-2 text-slate-400 min-w-0">
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
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 group"
              >
                <span>{t("projects.goToChat")}</span>
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
              <span>{t("projects.modalTitle")}</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("projects.name")}
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder={t("projects.namePlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("projects.localPath")}
                </label>
                <input
                  name="localPath"
                  type="text"
                  required
                  placeholder={t("projects.localPathPlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("projects.repoUrl")}
                </label>
                <input
                  name="repoUrl"
                  type="url"
                  placeholder={t("projects.repoUrlPlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("projects.deployCommand")}
                </label>
                <input
                  name="deployCommand"
                  type="text"
                  placeholder={t("projects.deployCommandPlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {t("projects.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? t("projects.saving") : t("projects.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
