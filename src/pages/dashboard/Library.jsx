import { useAuth } from '../../contexts/AuthContext';
import ExerciseLibrary from '../../components/library/ExerciseLibrary';
import { FiBookOpen } from 'react-icons/fi';

const Library = () => {
  const { profile } = useAuth();
  const coachId = profile?.coach_id || profile?.id || null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-5 md:mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FiBookOpen className="w-6 h-6 text-sky-500" />
          Biblioteca de ejercicios
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Explora el banco de ejercicios y deja notas para tus atletas.
        </p>
      </header>
      <ExerciseLibrary mode="coach" coachId={coachId} />
    </div>
  );
};

export default Library;
