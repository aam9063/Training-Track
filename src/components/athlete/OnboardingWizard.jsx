import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiArrowLeft, FiArrowRight, FiLoader } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { createAthleteProfile } from '../../services/athleteProfileService';
import { showError } from '../../lib/toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { number: 1, label: 'Identidad' },
  { number: 2, label: 'Físico' },
  { number: 3, label: 'Tu Enfoque' },
  { number: 4, label: 'Disponibilidad' },
  { number: 5, label: 'Tu Motor' },
];

const DAYS = [
  { key: 'L', label: 'L' },
  { key: 'M', label: 'M' },
  { key: 'X', label: 'X' },
  { key: 'J', label: 'J' },
  { key: 'V', label: 'V' },
  { key: 'S', label: 'S' },
  { key: 'D', label: 'D' },
];

const MODALIDADES = [
  { value: '800m', label: '800m', sub: 'Pista' },
  { value: '1500m', label: '1500m', sub: 'Pista' },
  { value: '5K', label: '5K', sub: 'Ruta' },
  { value: '10K', label: '10K', sub: 'Ruta' },
  { value: 'media_maraton', label: 'Media Maratón', sub: '21.1K' },
  { value: 'maraton', label: 'Maratón', sub: '42.2K' },
  { value: 'trail', label: 'Trail', sub: 'Montaña' },
];

const OBJETIVOS = [
  { value: 'empezar', label: 'Empezar a correr', desc: 'Dar los primeros pasos en el running' },
  { value: 'completar', label: 'Completar distancia', desc: 'Cruzar la meta de tu primera carrera' },
  { value: 'mejorar_marca', label: 'Mejorar marca', desc: 'Bajar tu tiempo personal' },
  { value: 'salud', label: 'Salud y forma', desc: 'Mantenerte en forma sin presión competitiva' },
];

const INITIAL_FORM = {
  nombre: '',
  sexo: '',
  fecha_nacimiento: '',
  peso_kg: '',
  altura_cm: '',
  modalidad: '',
  objetivo: '',
  marca_actual: '',
  competicion_objetivo: '',
  competicion_fecha: '',
  dias_disponibles: { L: false, M: false, X: false, J: false, V: false, S: false, D: false },
  horas_por_dia: {},
  acceso_gimnasio: false,
  acceso_pista: false,
  km_semanales: '',
  ritmo_comodo: '',
  no_se_ritmo: false,
  fc_max: '',
  vo2max: '',
  lesiones: '',
};

// ---------------------------------------------------------------------------
// Validation per step
// ---------------------------------------------------------------------------

const validateStep = (step, data) => {
  const errs = {};

  if (step === 1) {
    if (!data.nombre?.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!data.sexo) errs.sexo = 'Selecciona tu sexo biológico';
    if (!data.fecha_nacimiento) errs.fecha_nacimiento = 'La fecha de nacimiento es obligatoria';
  }

  if (step === 2) {
    const peso = parseFloat(data.peso_kg);
    const altura = parseInt(data.altura_cm, 10);
    if (!data.peso_kg || isNaN(peso) || peso <= 0) errs.peso_kg = 'Introduce un peso válido';
    if (!data.altura_cm || isNaN(altura) || altura <= 0) errs.altura_cm = 'Introduce una altura válida';
  }

  if (step === 3) {
    if (!data.modalidad) errs.modalidad = 'Selecciona una modalidad';
    if (!data.objetivo) errs.objetivo = 'Selecciona un objetivo';
  }

  if (step === 4) {
    const selectedDays = Object.values(data.dias_disponibles ?? {}).filter(Boolean).length;
    if (selectedDays < 2) errs.dias_disponibles = 'Selecciona al menos 2 días';
  }

  if (step === 5) {
    const km = data.km_semanales;
    if (km === '' || km === undefined || km === null) {
      errs.km_semanales = 'Indica tus km semanales (puede ser 0)';
    } else if (isNaN(parseFloat(km)) || parseFloat(km) < 0) {
      errs.km_semanales = 'Introduce un valor válido';
    }
  }

  return errs;
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const slideTransition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

const FieldLabel = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300 mb-1.5">
    {children}
  </label>
);

const FieldError = ({ message }) =>
  message ? (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-red-400 mt-1"
    >
      {message}
    </motion.p>
  ) : null;

const TextInput = ({ id, value, onChange, placeholder, type = 'text', suffix, error, disabled, ...rest }) => (
  <div className="relative">
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      className={`w-full rounded-xl bg-gray-800/80 border ${
        error ? 'border-red-500/60' : 'border-gray-700/60'
      } px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      {...rest}
    />
    {suffix && (
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
        {suffix}
      </span>
    )}
  </div>
);

const ToggleButton = ({ active, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 border ${
      active
        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 ring-1 ring-sky-500/30'
        : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
    } ${className}`}
  >
    {children}
  </button>
);

const SelectableCard = ({ active, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative rounded-xl p-4 text-left transition-all duration-200 border ${
      active
        ? 'bg-sky-500/15 border-sky-500/50 ring-1 ring-sky-500/20'
        : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600 hover:bg-gray-800/70'
    } ${className}`}
  >
    {active && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center"
      >
        <FiCheck className="w-3 h-3 text-white" />
      </motion.div>
    )}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Step 1: Identidad
// ---------------------------------------------------------------------------

const StepIdentidad = ({ data, errors, onChange }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Identidad Básica</h2>
      <p className="text-sm text-gray-400">Cuéntanos quién eres</p>
    </div>

    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="nombre">Nombre completo</FieldLabel>
        <TextInput
          id="nombre"
          value={data.nombre}
          onChange={(e) => onChange('nombre', e.target.value)}
          error={errors.nombre}
          placeholder="Ej. Eliud Kipchoge"
        />
        <FieldError message={errors.nombre} />
      </div>

      <div>
        <FieldLabel>Sexo biológico</FieldLabel>
        <div className="flex gap-3">
          <ToggleButton
            active={data.sexo === 'M'}
            onClick={() => onChange('sexo', 'M')}
            className="flex-1"
          >
            Masculino
          </ToggleButton>
          <ToggleButton
            active={data.sexo === 'F'}
            onClick={() => onChange('sexo', 'F')}
            className="flex-1"
          >
            Femenino
          </ToggleButton>
        </div>
        <FieldError message={errors.sexo} />
      </div>

      <div>
        <FieldLabel htmlFor="fecha_nacimiento">Fecha de nacimiento</FieldLabel>
        <TextInput
          id="fecha_nacimiento"
          type="date"
          value={data.fecha_nacimiento}
          onChange={(e) => onChange('fecha_nacimiento', e.target.value)}
          error={errors.fecha_nacimiento}
        />
        <FieldError message={errors.fecha_nacimiento} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 2: Físico
// ---------------------------------------------------------------------------

const StepFisico = ({ data, errors, onChange }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Tu Físico</h2>
      <p className="text-sm text-gray-400">Datos básicos para personalizar tu plan</p>
    </div>

    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="peso_kg">Peso actual</FieldLabel>
        <TextInput
          id="peso_kg"
          type="number"
          value={data.peso_kg}
          onChange={(e) => onChange('peso_kg', e.target.value)}
          error={errors.peso_kg}
          placeholder="70"
          suffix="KG"
          step="0.1"
          min="30"
          max="200"
        />
        <FieldError message={errors.peso_kg} />
      </div>

      <div>
        <FieldLabel htmlFor="altura_cm">Altura</FieldLabel>
        <TextInput
          id="altura_cm"
          type="number"
          value={data.altura_cm}
          onChange={(e) => onChange('altura_cm', e.target.value)}
          error={errors.altura_cm}
          placeholder="175"
          suffix="CM"
          min="100"
          max="230"
        />
        <FieldError message={errors.altura_cm} />
      </div>
    </div>

    <div className="flex items-start gap-2.5 bg-gray-800/40 rounded-xl px-4 py-3 border border-gray-700/30">
      <span className="text-sky-400 mt-0.5 text-lg" role="img" aria-label="candado">&#128274;</span>
      <p className="text-xs text-gray-400 leading-relaxed">
        Estos datos son privados y nos ayudan a personalizar tu plan de entrenamiento.
        Solo tu entrenador podrá verlos.
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 3: Tu Enfoque
// ---------------------------------------------------------------------------

const StepEnfoque = ({ data, errors, onChange }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Tu Enfoque</h2>
      <p className="text-sm text-gray-400">Modalidad y objetivo principal</p>
    </div>

    {/* Modalidad */}
    <div>
      <FieldLabel>Modalidad principal</FieldLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {MODALIDADES.map((m) => (
          <SelectableCard
            key={m.value}
            active={data.modalidad === m.value}
            onClick={() => onChange('modalidad', m.value)}
          >
            <p className="text-sm font-semibold text-white">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
          </SelectableCard>
        ))}
      </div>
      <FieldError message={errors.modalidad} />
    </div>

    {/* Objetivo */}
    <div>
      <FieldLabel>Objetivo central</FieldLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {OBJETIVOS.map((o) => (
          <SelectableCard
            key={o.value}
            active={data.objetivo === o.value}
            onClick={() => onChange('objetivo', o.value)}
          >
            <p className="text-sm font-semibold text-white">{o.label}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{o.desc}</p>
          </SelectableCard>
        ))}
      </div>
      <FieldError message={errors.objetivo} />
    </div>

    {/* Optional fields */}
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="marca_actual">Marca actual o estimada (opcional)</FieldLabel>
        <TextInput
          id="marca_actual"
          value={data.marca_actual}
          onChange={(e) => onChange('marca_actual', e.target.value)}
          placeholder="Ej. 3:45, 1:32:00"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="competicion_objetivo">Competición objetivo (opcional)</FieldLabel>
          <TextInput
            id="competicion_objetivo"
            value={data.competicion_objetivo}
            onChange={(e) => onChange('competicion_objetivo', e.target.value)}
            placeholder="Ej. Maratón de Valencia"
          />
        </div>
        <div>
          <FieldLabel htmlFor="competicion_fecha">Fecha competición (opcional)</FieldLabel>
          <TextInput
            id="competicion_fecha"
            type="date"
            value={data.competicion_fecha}
            onChange={(e) => onChange('competicion_fecha', e.target.value)}
          />
        </div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 4: Disponibilidad
// ---------------------------------------------------------------------------

const StepDisponibilidad = ({ data, errors, onChange }) => {
  const dias = data.dias_disponibles ?? {};
  const horas = data.horas_por_dia ?? {};

  const toggleDay = (key) => {
    const updated = { ...dias, [key]: !dias[key] };
    onChange('dias_disponibles', updated);

    if (dias[key]) {
      const updatedHoras = { ...horas };
      delete updatedHoras[key];
      onChange('horas_por_dia', updatedHoras);
    } else if (!horas[key]) {
      onChange('horas_por_dia', { ...horas, [key]: 1 });
    }
  };

  const setHours = (key, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onChange('horas_por_dia', { ...horas, [key]: num });
    }
  };

  const activeDays = DAYS.filter((d) => dias[d.key]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Disponibilidad</h2>
        <p className="text-sm text-gray-400">Días y horas que puedes entrenar</p>
      </div>

      {/* Day toggles */}
      <div>
        <FieldLabel>Días disponibles</FieldLabel>
        <div className="flex gap-2 justify-center sm:justify-start">
          {DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`w-11 h-11 rounded-full font-bold text-sm transition-all duration-200 ${
                dias[d.key]
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:border-gray-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <FieldError message={errors.dias_disponibles} />
      </div>

      {/* Hours per selected day */}
      <AnimatePresence mode="popLayout">
        {activeDays.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2.5"
          >
            <FieldLabel>Horas disponibles por día</FieldLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {activeDays.map((d) => (
                <div
                  key={d.key}
                  className="flex items-center gap-2.5 bg-gray-800/50 rounded-xl px-3.5 py-2.5 border border-gray-700/40"
                >
                  <span className="text-sm font-bold text-sky-400 w-5">{d.label}</span>
                  <input
                    type="number"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={horas[d.key] ?? 1}
                    onChange={(e) => setHours(d.key, e.target.value)}
                    className="w-16 bg-transparent border-b border-gray-600 text-white text-center text-sm py-1 focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-xs text-gray-500 font-medium">HRS</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Access toggles */}
      <div className="space-y-3">
        <div
          onClick={() => onChange('acceso_gimnasio', !data.acceso_gimnasio)}
          className={`flex items-center justify-between rounded-xl px-4 py-3.5 border cursor-pointer transition-all duration-200 ${
            data.acceso_gimnasio
              ? 'bg-sky-500/15 border-sky-500/40'
              : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg" role="img" aria-label="gimnasio">&#127947;&#65039;</span>
            <span className="text-sm font-medium text-white">Acceso a gimnasio</span>
          </div>
          <div
            className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
              data.acceso_gimnasio ? 'bg-sky-500' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                data.acceso_gimnasio ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </div>
        </div>

        <div
          onClick={() => onChange('acceso_pista', !data.acceso_pista)}
          className={`flex items-center justify-between rounded-xl px-4 py-3.5 border cursor-pointer transition-all duration-200 ${
            data.acceso_pista
              ? 'bg-sky-500/15 border-sky-500/40'
              : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg" role="img" aria-label="pista de atletismo">&#127967;&#65039;</span>
            <span className="text-sm font-medium text-white">Acceso a pista de atletismo</span>
          </div>
          <div
            className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
              data.acceso_pista ? 'bg-sky-500' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                data.acceso_pista ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 5: Tu Motor
// ---------------------------------------------------------------------------

const StepMotor = ({ data, errors, onChange }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Tu Motor</h2>
      <p className="text-sm text-gray-400">Tu nivel actual de rendimiento</p>
    </div>

    <div className="space-y-4">
      {/* Km semanales */}
      <div>
        <FieldLabel htmlFor="km_semanales">Kilómetros semanales actuales</FieldLabel>
        <div className="space-y-2">
          <TextInput
            id="km_semanales"
            type="number"
            value={data.km_semanales}
            onChange={(e) => onChange('km_semanales', e.target.value)}
            error={errors.km_semanales}
            placeholder="0"
            suffix="KM/SEM"
            min="0"
            max="250"
            step="1"
          />
          {data.km_semanales !== '' && data.km_semanales !== undefined && (
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (Number(data.km_semanales) / 120) * 100)}%` }}
                transition={{ duration: 0.4 }}
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
              />
            </div>
          )}
        </div>
        <FieldError message={errors.km_semanales} />
      </div>

      {/* Ritmo cómodo */}
      <div>
        <FieldLabel htmlFor="ritmo_comodo">Ritmo cómodo por km (opcional)</FieldLabel>
        <div className="space-y-2">
          <TextInput
            id="ritmo_comodo"
            value={data.ritmo_comodo}
            onChange={(e) => onChange('ritmo_comodo', e.target.value)}
            placeholder="Ej. 5:30"
            disabled={data.no_se_ritmo}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.no_se_ritmo ?? false}
              onChange={(e) => {
                onChange('no_se_ritmo', e.target.checked);
                if (e.target.checked) onChange('ritmo_comodo', '');
              }}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500/50"
            />
            <span className="text-xs text-gray-400">No lo sé</span>
          </label>
        </div>
      </div>

      {/* FC max & VO2max */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="fc_max">FC máxima (opcional)</FieldLabel>
          <TextInput
            id="fc_max"
            type="number"
            value={data.fc_max}
            onChange={(e) => onChange('fc_max', e.target.value)}
            placeholder="190"
            suffix="BPM"
            min="120"
            max="220"
          />
        </div>
        <div>
          <FieldLabel htmlFor="vo2max">VO2max (opcional)</FieldLabel>
          <TextInput
            id="vo2max"
            type="number"
            value={data.vo2max}
            onChange={(e) => onChange('vo2max', e.target.value)}
            placeholder="45"
            suffix="ml/kg"
            min="15"
            max="90"
            step="0.1"
          />
        </div>
      </div>

      {/* Lesiones */}
      <div>
        <FieldLabel htmlFor="lesiones">Lesiones o limitaciones (opcional)</FieldLabel>
        <textarea
          id="lesiones"
          value={data.lesiones ?? ''}
          onChange={(e) => onChange('lesiones', e.target.value)}
          rows={3}
          placeholder="Ej. Tendinitis rotuliana recurrente, fascitis plantar recuperada..."
          className="w-full rounded-xl bg-gray-800/80 border border-gray-700/60 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none text-sm"
        />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const Stepper = ({ currentStep, totalSteps }) => (
  <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto">
    {Array.from({ length: totalSteps }, (_, i) => {
      const stepNum = i + 1;
      const isCompleted = stepNum < currentStep;
      const isCurrent = stepNum === currentStep;

      return (
        <div key={stepNum} className="flex items-center flex-1 last:flex-none">
          <div
            className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 flex-shrink-0 ${
              isCompleted
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : isCurrent
                  ? 'bg-sky-500/20 text-sky-400 ring-2 ring-sky-500/60'
                  : 'bg-gray-800 text-gray-600 border border-gray-700'
            }`}
          >
            {isCompleted ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <FiCheck className="w-4 h-4" />
              </motion.div>
            ) : (
              stepNum
            )}
          </div>

          {stepNum < totalSteps && (
            <div className="flex-1 h-0.5 mx-1">
              <div
                className={`h-full rounded-full transition-colors duration-500 ${
                  isCompleted ? 'bg-sky-500' : 'bg-gray-700/60'
                }`}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Main OnboardingWizard
// ---------------------------------------------------------------------------

const OnboardingWizard = ({ onComplete }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field on change
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleNext = useCallback(() => {
    const stepErrors = validateStep(currentStep, formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setDirection(1);
    setCurrentStep((s) => s + 1);
  }, [currentStep, formData]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setErrors({});
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(async () => {
    const stepErrors = validateStep(5, formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        nombre: formData.nombre?.trim(),
        sexo: formData.sexo,
        fecha_nacimiento: formData.fecha_nacimiento,
        peso_kg: parseFloat(formData.peso_kg) || null,
        altura_cm: parseInt(formData.altura_cm, 10) || null,
        modalidad: formData.modalidad,
        objetivo: formData.objetivo,
        marca_actual: formData.marca_actual?.trim() || null,
        competicion_objetivo: formData.competicion_objetivo?.trim() || null,
        competicion_fecha: formData.competicion_fecha || null,
        dias_disponibles: formData.dias_disponibles,
        horas_por_dia: Object.keys(formData.horas_por_dia ?? {}).length > 0 ? formData.horas_por_dia : null,
        acceso_gimnasio: formData.acceso_gimnasio ?? false,
        acceso_pista: formData.acceso_pista ?? false,
        km_semanales: parseFloat(formData.km_semanales) ?? 0,
        ritmo_comodo: formData.no_se_ritmo ? null : (formData.ritmo_comodo?.trim() || null),
        fc_max: formData.fc_max ? parseInt(formData.fc_max, 10) : null,
        vo2max: formData.vo2max ? parseFloat(formData.vo2max) : null,
        lesiones: formData.lesiones?.trim() || null,
      };

      const { error } = await createAthleteProfile(user.id, payload);

      if (error) {
        showError('Error al guardar el perfil. Inténtalo de nuevo.');
        return;
      }

      onComplete?.();
    } catch {
      showError('Error inesperado. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, user?.id, onComplete]);

  const stepProps = { data: formData, errors, onChange: handleChange };

  const stepComponents = {
    1: <StepIdentidad {...stepProps} />,
    2: <StepFisico {...stepProps} />,
    3: <StepEnfoque {...stepProps} />,
    4: <StepDisponibilidad {...stepProps} />,
    5: <StepMotor {...stepProps} />,
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/[0.02] rounded-full blur-3xl" />
      </div>

      {/* Header with stepper */}
      <div className="relative z-10 px-4 pt-6 pb-4 sm:pt-8 sm:pb-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/img/logo.png" alt="TrainingTrack" className="w-7 h-7" />
          <span className="text-lg font-bold text-white">
            Training<span className="text-sky-500">Track</span>
          </span>
        </div>

        <Stepper currentStep={currentStep} totalSteps={5} />

        <p className="text-center text-xs text-gray-500 mt-3 font-medium tracking-wide uppercase">
          Paso {currentStep} de 5 — {STEPS[currentStep - 1].label}
        </p>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-lg mx-auto pb-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              {stepComponents[currentStep]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-4 sm:px-6 py-4 border-t border-gray-800/50 bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-gray-800/50"
            >
              <FiArrowLeft className="w-4 h-4" />
              Volver
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-xl transition-colors shadow-lg shadow-sky-500/20"
            >
              Siguiente Paso
              <FiArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-sky-500/20"
            >
              {submitting ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  Finalizar y Entrar
                  <FiArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
