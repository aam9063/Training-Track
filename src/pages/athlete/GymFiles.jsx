import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  FiArrowLeft,
  FiFileText,
  FiEye,
  FiDownload,
  FiPackage,
} from 'react-icons/fi';
import {
  listGymFilesForAthlete,
  getGymFileSignedUrl,
  formatFileSize,
  daysUntilExpiry,
} from '../../services/gymFilesService';

export default function GymFiles() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const coachId =
    profile?.athlete?.coach_athlete_relationship?.[0]?.coach_id ?? null;

  const loadFiles = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await listGymFilesForAthlete(coachId);
    setFiles(data || []);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const isPwa = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const handleView = async (storagePath) => {
    const { url } = await getGymFileSignedUrl(storagePath);
    if (!url) return;
    // En PWA window.open está bloqueado — navegar en la misma pestaña
    if (isPwa()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownload = async (file) => {
    const { url } = await getGymFileSignedUrl(file.storage_path);
    if (!url) return;
    // En PWA iOS el anchor download no funciona — usar location.href
    if (isPwa()) {
      window.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const daysColor = (days) => {
    if (days <= 3) return 'text-red-500';
    if (days <= 7) return 'text-orange-400';
    return 'text-slate-400 dark:text-slate-500';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Material de Fuerza
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              PDFs subidos por tu entrenador
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FiPackage className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
              Tu entrenador aún no ha subido ningún PDF
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => {
              const days = daysUntilExpiry(file.expires_at);
              return (
                <div
                  key={file.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-4 flex items-center gap-4"
                >
                  {/* icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-orange-500 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[9px] font-black text-white tracking-wider leading-none">PDF</span>
                    <FiFileText className="w-3 h-3 text-white/80 mt-0.5" />
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                      {file.filename}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${daysColor(days)}`}>
                      {formatFileSize(file.file_size)}
                      {file.file_size ? ' · ' : ''}
                      {days} {days === 1 ? 'día restante' : 'días restantes'}
                    </p>
                  </div>

                  {/* actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleView(file.storage_path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-orange-400 to-red-400 rounded-xl hover:from-orange-500 hover:to-red-500 transition-all shadow-sm"
                    >
                      <FiEye className="w-3 h-3" />
                      Ver
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      title="Descargar"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
