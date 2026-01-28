import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiCalendar,
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Training = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Obtener semana actual (Lunes a Domingo)
  const getWeekDays = (date) => {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay() + 1; // Lunes
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(curr.setDate(first + i));
      week.push(day);
    }
    return week;
  };

  const weekDays = getWeekDays(currentWeek);
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Datos de ejemplo - después se cargarán desde Supabase
  const trainings = {
    0: { // Lunes
      title: 'Rodaje Suave',
      distance: '10 km',
      pace: '5:00 min/km',
      duration: '50 min',
      notes: 'FC media 140 bpm',
    },
    1: { // Martes
      title: 'Series 8x1000m',
      distance: '12 km (incluye calentamiento)',
      pace: '3:45 min/km en series',
      duration: '60 min',
      notes: 'Recuperación 2 min entre series',
    },
    2: { // Miércoles
      title: 'Descanso',
      type: 'rest',
    },
    3: { // Jueves
      title: 'Fuerza General',
      duration: '45 min',
      notes: 'Sentadillas 4x8, Peso muerto 4x6, Core',
      type: 'gym',
    },
    4: { // Viernes
      title: 'Rodaje Progresivo',
      distance: '15 km',
      pace: '5:30 → 4:30 min/km',
      duration: '70 min',
      notes: 'Últimos 5km a ritmo de competición',
    },
    5: { // Sábado
      title: 'Tirada Larga',
      distance: '25 km',
      pace: '5:15 min/km',
      duration: '2h 11min',
      notes: 'Hidratación cada 5km',
    },
    6: { // Domingo
      title: 'Rodaje Recuperación',
      distance: '8 km',
      pace: '5:45 min/km',
      duration: '46 min',
      notes: 'Muy suave, recuperación activa',
    },
  };

  const nextWeek = () => {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setCurrentWeek(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeek(prev);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(20);
    doc.text('Plan de Entrenamiento Semanal', 14, 20);
    
    // Fecha de la semana
    doc.setFontSize(12);
    const weekStart = weekDays[0].toLocaleDateString('es-ES');
    const weekEnd = weekDays[6].toLocaleDateString('es-ES');
    doc.text(`Semana: ${weekStart} - ${weekEnd}`, 14, 30);
    
    // Tabla de entrenamientos
    const tableData = weekDays.map((day, index) => {
      const training = trainings[index];
      if (!training) return [dayNames[index], '-', '-', '-', '-'];
      
      if (training.type === 'rest') {
        return [dayNames[index], 'Descanso', '-', '-', '-'];
      }
      
      return [
        dayNames[index],
        training.title || '-',
        training.distance || '-',
        training.pace || '-',
        training.notes || '-'
      ];
    });
    
    autoTable(doc, {
      head: [['Día', 'Entrenamiento', 'Distancia', 'Ritmo', 'Notas']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // Azul
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 60 },
      }
    });
    
    // Footer
    doc.setFontSize(10);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-ES')} | TrackPro`,
      14,
      doc.internal.pageSize.height - 10
    );
    
    doc.save(`plan-entrenamiento-${weekStart}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Entrenamientos
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Plan semanal de entrenamiento
          </p>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base"
        >
          <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Descargar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <button
          onClick={prevWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>
        
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          <span className="font-semibold text-xs sm:text-sm lg:text-base text-center">
            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            {' - '}
            {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        
        <button
          onClick={nextWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4">
        {weekDays.map((day, index) => {
          const training = trainings[index];
          const isRest = training?.type === 'rest';
          const isGym = training?.type === 'gym';
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2
                ${isToday 
                  ? 'border-blue-500 dark:border-blue-400' 
                  : 'border-gray-200 dark:border-gray-700'}
                ${isRest ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                min-h-[250px] sm:min-h-[280px] lg:min-h-[300px]
              `}
            >
              {/* Day Header */}
              <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  {dayNames[index]}
                </p>
                <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  {day.getDate()}
                </p>
                {isToday && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                    Hoy
                  </span>
                )}
              </div>

              {/* Training Content */}
              {training ? (
                <div className="space-y-2 sm:space-y-3">
                  <h3 className={`font-bold text-base sm:text-lg ${
                    isRest 
                      ? 'text-gray-500 dark:text-gray-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {training.title}
                  </h3>

                  {!isRest && (
                    <>
                      {training.distance && (
                        <div className="flex items-start space-x-2">
                          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                            📏
                          </span>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {training.distance}
                          </p>
                        </div>
                      )}

                      {training.pace && (
                        <div className="flex items-start space-x-2">
                          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                            ⏱️
                          </span>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {training.pace}
                          </p>
                        </div>
                      )}

                      {training.duration && (
                        <div className="flex items-start space-x-2">
                          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                            ⏰
                          </span>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {training.duration}
                          </p>
                        </div>
                      )}

                      {training.notes && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
                            {training.notes}
                          </p>
                        </div>
                      )}

                      {isGym && (
                        <span className="inline-block text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                          Gimnasio
                        </span>
                      )}
                    </>
                  )}

                  {isRest && (
                    <div className="text-center py-6 sm:py-8">
                      <span className="text-3xl sm:text-4xl">💤</span>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Día de recuperación
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 text-gray-400">
                  <p className="text-xs sm:text-sm">Sin entrenamiento</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Training;
