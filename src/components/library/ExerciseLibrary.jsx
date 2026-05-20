import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiBookOpen,
  FiActivity,
  FiX,
  FiTag,
  FiTarget,
  FiVideo,
  FiMessageSquare,
  FiPlus,
} from 'react-icons/fi';
import { searchExercises, getFacets } from '../../services/exerciseLibraryService';
import {
  listCoachNotes,
  listNotesForAthlete,
} from '../../services/coachExerciseNotesService';
import ExerciseDetailModal from './ExerciseDetailModal';
import ExerciseFormModal from './ExerciseFormModal';

const CATEGORY_LABELS = {
  // running
  series_short: 'Series cortas',
  series_medium: 'Series medias',
  series_long: 'Series largas',
  warmup_run: 'Calentamiento',
  easy_run: 'Rodaje suave',
  long_run: 'Tirada larga',
  tempo_run: 'Tempo',
  fartlek_time: 'Fartlek (tiempo)',
  fartlek_distance: 'Fartlek (distancia)',
  hill_repeats: 'Cuestas',
  recovery_run: 'Rodaje recuperación',
  race: 'Competición',
  test: 'Test',
  technical_drill: 'Drill técnico',
  progressive_run: 'Progresivo',
  pace_blocks: 'Ritmos',
  // gym
  max_strength: 'Fuerza máxima',
  general_strength: 'Fuerza general',
  explosive_strength: 'Fuerza explosiva',
  core: 'Core',
  mobility: 'Movilidad',
  plyometrics: 'Pliometría',
  injury_prevention: 'Prevención',
};

const LEVEL_LABELS = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  todos: 'Todos',
};

const LEVEL_DOT_COLOR = {
  principiante: 'bg-emerald-500',
  intermedio: 'bg-amber-500',
  avanzado: 'bg-rose-500',
  todos: 'bg-slate-400',
};

/**
 * Biblioteca de ejercicios compartida coach/atleta.
 *
 * Props:
 *  - mode: 'coach' | 'athlete'
 *  - coachId: requerido si mode='coach' (para incluir sus customs y mostrar notas)
 *  - athleteId: requerido si mode='athlete' (para mostrar notas del coach asignado)
 *  - onPickExercise?: (kind, exercise) => void  (solo coach, opcional)
 */
const ExerciseLibrary = ({ mode = 'coach', coachId = null, athleteId = null, onPickExercise = null }) => {
  const [kind, setKind] = useState('running');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [bodyRegion, setBodyRegion] = useState([]);
  const [tags, setTags] = useState([]);

  const [exercises, setExercises] = useState([]);
  const [facets, setFacets] = useState({ category: [], level: [], tag: [], bodyRegion: [] });
  const [notesMap, setNotesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [formState, setFormState] = useState({ open: false, mode: 'create', exercise: null });

  // Carga datos cuando cambia el banco
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [exRes, facetsRes, notesRes] = await Promise.all([
        searchExercises({
          kind,
          coachId: mode === 'coach' ? coachId : null,
          search,
          category: category || undefined,
          level: level || undefined,
          tags: tags.length ? tags : undefined,
          bodyRegion: bodyRegion.length ? bodyRegion : undefined,
          limit: 200,
        }),
        getFacets({ kind, coachId: mode === 'coach' ? coachId : null }),
        mode === 'coach' && coachId
          ? listCoachNotes(coachId, kind)
          : athleteId
            ? listNotesForAthlete(athleteId, kind)
            : Promise.resolve({ data: new Map(), error: null }),
      ]);
      setExercises(exRes.data || []);
      setFacets(facetsRes.data || { category: [], level: [], tag: [], bodyRegion: [] });
      setNotesMap(notesRes.data || new Map());
    } finally {
      setLoading(false);
    }
  }, [kind, search, category, level, tags, bodyRegion, mode, coachId, athleteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleInArray = (arr, value) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setLevel('');
    setBodyRegion([]);
    setTags([]);
  };

  const hasActiveFilters = useMemo(
    () => !!(search || category || level || bodyRegion.length || tags.length),
    [search, category, level, bodyRegion, tags]
  );

  const handleNoteUpdated = () => {
    // refresca el mapa de notas tras edicion en el modal
    if (mode === 'coach' && coachId) {
      listCoachNotes(coachId, kind).then((res) => setNotesMap(res.data || new Map()));
    }
  };

  const canCreate = mode === 'coach' && !!coachId;
  const isEditable = (ex) => mode === 'coach' && ex?.is_custom && ex?.coach_id === coachId;

  return (
    <div className="space-y-4">
      {/* Tabs + Nuevo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-coach-elevated rounded-xl w-fit">
          <button
            onClick={() => { setKind('running'); resetFilters(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              kind === 'running'
                ? 'bg-white dark:bg-coach-base text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <FiActivity className="w-4 h-4" />
            Carrera
          </button>
          <button
            onClick={() => { setKind('gym'); resetFilters(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              kind === 'gym'
                ? 'bg-white dark:bg-coach-base text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <FiBookOpen className="w-4 h-4" />
            Gym
          </button>
        </div>

        {canCreate && (
          <button
            onClick={() => setFormState({ open: true, mode: 'create', exercise: null })}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5"
          >
            <FiPlus className="w-4 h-4" />
            Nuevo ejercicio
          </button>
        )}
      </div>

      {/* Buscador + filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar en ${kind === 'running' ? 'carrera' : 'gym'}…`}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">Todas las categorías</option>
          {facets.category.map((c) => (
            <option key={c.value} value={c.value}>
              {CATEGORY_LABELS[c.value] || c.value} ({c.count})
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">Cualquier nivel</option>
          {['principiante', 'intermedio', 'avanzado'].map((l) => (
            <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1.5"
          >
            <FiX className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Chips de tags + body_region */}
      {(facets.tag.length > 0 || facets.bodyRegion.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {facets.bodyRegion.slice(0, 8).map((b) => {
            const active = bodyRegion.includes(b.value);
            return (
              <button
                key={`body-${b.value}`}
                onClick={() => setBodyRegion(toggleInArray(bodyRegion, b.value))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                  active
                    ? 'bg-sky-500 border-sky-500 text-white'
                    : 'bg-white dark:bg-coach-elevated border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-sky-400'
                }`}
              >
                <FiTarget className="w-3 h-3" />
                {b.value} <span className="opacity-60">({b.count})</span>
              </button>
            );
          })}
          {facets.tag.slice(0, 10).map((t) => {
            const active = tags.includes(t.value);
            return (
              <button
                key={`tag-${t.value}`}
                onClick={() => setTags(toggleInArray(tags, t.value))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                  active
                    ? 'bg-violet-500 border-violet-500 text-white'
                    : 'bg-white dark:bg-coach-elevated border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                }`}
              >
                <FiTag className="w-3 h-3" />
                {t.value} <span className="opacity-60">({t.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Resultados */}
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {loading ? 'Cargando…' : `${exercises.length} ejercicio${exercises.length === 1 ? '' : 's'}`}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {exercises.map((ex) => {
            const note = notesMap.get(ex.id);
            const hasVideo = kind === 'gym' && !!ex.video_url;
            return (
              <motion.button
                key={ex.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSelected(ex)}
                className="text-left p-3.5 rounded-xl bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/[0.08] hover:border-sky-400 dark:hover:border-sky-500/40 hover:shadow-sm transition-all flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                    {ex.name}
                  </h3>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${LEVEL_DOT_COLOR[ex.level] || 'bg-slate-300'}`} title={LEVEL_LABELS[ex.level] || ex.level} />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {CATEGORY_LABELS[ex.category] || ex.category}
                </div>
                {ex.body_region?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ex.body_region.slice(0, 3).map((b) => (
                      <span key={b} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  {hasVideo && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                      <FiVideo className="w-3 h-3" /> vídeo
                    </span>
                  )}
                  {note && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5" title="Nota del coach">
                      <FiMessageSquare className="w-3 h-3" /> nota
                    </span>
                  )}
                  {ex.is_custom && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400">custom</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {!loading && exercises.length === 0 && (
        <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
          No hay ejercicios que coincidan con los filtros.
        </div>
      )}

      <ExerciseDetailModal
        open={!!selected}
        exercise={selected}
        kind={kind}
        mode={mode}
        coachId={coachId}
        canEdit={isEditable(selected)}
        existingNote={selected ? notesMap.get(selected.id) : null}
        onClose={() => setSelected(null)}
        onPickExercise={onPickExercise}
        onNoteSaved={handleNoteUpdated}
        onEdit={(ex) => {
          setSelected(null);
          setFormState({ open: true, mode: 'edit', exercise: ex });
        }}
      />

      <ExerciseFormModal
        open={formState.open}
        mode={formState.mode}
        kind={kind}
        coachId={coachId}
        exercise={formState.exercise}
        onClose={() => setFormState({ open: false, mode: 'create', exercise: null })}
        onSaved={() => reload()}
        onDeleted={() => reload()}
      />
    </div>
  );
};

export default ExerciseLibrary;
