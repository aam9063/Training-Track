import { useAuth } from '../../contexts/AuthContext';
import ExerciseLibrary from '../../components/library/ExerciseLibrary';
import { FiBookOpen } from 'react-icons/fi';

const AthleteLibrary = () => {
  const { profile, user } = useAuth();
  const athleteId = profile?.id || user?.id || null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-5 md:mb-6">
        <h1 className="text-2xl font-semibold text-ath-text-primary flex items-center gap-2">
          <FiBookOpen className="w-6 h-6 text-ath-accent" />
          Biblioteca de ejercicios
        </h1>
        <p className="text-sm text-ath-text-secondary mt-1">
          Consulta el catálogo de ejercicios que tu coach o Hermes IA pueden recomendarte.
        </p>
      </header>
      <ExerciseLibrary mode="athlete" athleteId={athleteId} />
    </div>
  );
};

export default AthleteLibrary;
