import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiWatch,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
} from 'react-icons/fi';

const Devices = () => {
  // Estado de conexiones (simulado)
  const [connections, setConnections] = useState({
    garmin: false,
    coros: false,
    suunto: false,
    strava: true,
    polar: false,
  });

  const devices = [
    {
      id: 'garmin',
      name: 'Garmin Connect',
      description: 'Sincroniza automáticamente tus entrenamientos desde tu reloj Garmin',
      logo: '⌚',
      color: 'from-blue-500 to-blue-600',
      connected: connections.garmin,
    },
    {
      id: 'coros',
      name: 'COROS',
      description: 'Importa datos de tus entrenamientos desde COROS',
      logo: '🏃',
      color: 'from-orange-500 to-red-600',
      connected: connections.coros,
    },
    {
      id: 'suunto',
      name: 'Suunto',
      description: 'Conecta con tu Suunto para sincronizar actividades',
      logo: '⌚',
      color: 'from-gray-700 to-gray-900',
      connected: connections.suunto,
    },
    {
      id: 'strava',
      name: 'Strava',
      description: 'Sincroniza actividades y comparte tus entrenamientos',
      logo: '🔶',
      color: 'from-orange-500 to-orange-600',
      connected: connections.strava,
    },
    {
      id: 'polar',
      name: 'Polar Flow',
      description: 'Importa entrenamientos desde Polar Flow',
      logo: '❄️',
      color: 'from-cyan-500 to-blue-600',
      connected: connections.polar,
    },
  ];

  const handleConnect = (deviceId) => {
    // Aquí irá la lógica de OAuth cuando se integren las APIs
    console.log(`Conectando con ${deviceId}...`);
    alert(`Funcionalidad de ${deviceId} próximamente. Aquí irán las claves API.`);
  };

  const handleDisconnect = (deviceId) => {
    setConnections(prev => ({ ...prev, [deviceId]: false }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dispositivos y Conexiones
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Conecta tus dispositivos para sincronizar entrenamientos automáticamente
        </p>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 sm:p-4 mb-6 sm:mb-8"
      >
        <div className="flex items-start space-x-2 sm:space-x-3">
          <FiAlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-blue-900 dark:text-blue-200 mb-1">
              Configuración de APIs
            </h3>
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              Para activar estas integraciones, necesitarás configurar las API keys en el archivo <code className="px-1 sm:px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded text-xs sm:text-sm">.env</code>:
            </p>
            <ul className="mt-2 space-y-1 text-xs sm:text-sm text-blue-700 dark:text-blue-300 ml-4 list-disc">
              <li><code>VITE_GARMIN_CLIENT_ID</code> y <code>VITE_GARMIN_CLIENT_SECRET</code></li>
              <li><code>VITE_COROS_API_KEY</code></li>
              <li><code>VITE_SUUNTO_APP_KEY</code></li>
              <li><code>VITE_STRAVA_CLIENT_ID</code> y <code>VITE_STRAVA_CLIENT_SECRET</code></li>
              <li><code className="text-xs">VITE_POLAR_CLIENT_ID</code> y <code className="text-xs">VITE_POLAR_CLIENT_SECRET</code></li>
            </ul>
            <p className="mt-2 text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              Consulta la documentación de cada servicio para obtener las credenciales OAuth 2.0
            </p>
          </div>
        </div>
      </motion.div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {devices.map((device, index) => (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border-2
              ${device.connected 
                ? 'border-green-500 dark:border-green-600' 
                : 'border-gray-200 dark:border-gray-700'}
            `}
          >
            {/* Header with gradient */}
            <div className={`bg-gradient-to-r ${device.color} p-6 text-white`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl">{device.logo}</span>
                {device.connected ? (
                  <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <FiCheckCircle className="w-4 h-4" />
                    <span className="text-xs font-semibold">Conectado</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <FiAlertCircle className="w-4 h-4" />
                    <span className="text-xs font-semibold">No conectado</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold">{device.name}</h3>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {device.description}
              </p>

              {device.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Última sincronización:</span>
                    <span className="font-medium text-gray-900 dark:text-white">Hace 2 horas</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Actividades sincronizadas:</span>
                    <span className="font-medium text-gray-900 dark:text-white">324</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex space-x-2">
                    <button
                      onClick={() => console.log(`Sincronizando ${device.id}...`)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      <FiRefreshCw className="w-4 h-4" />
                      <span className="text-sm font-medium">Sincronizar</span>
                    </button>
                    <button
                      onClick={() => handleDisconnect(device.id)}
                      className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(device.id)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
                >
                  Conectar {device.name}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Integration Guide */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
          <FiActivity className="w-6 h-6 text-blue-600" />
          <span>Guía de Integración</span>
        </h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Obtén las credenciales OAuth</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visita el portal de desarrolladores de cada servicio y crea una aplicación para obtener tus Client ID y Client Secret.
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. Configura las variables de entorno</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Añade las credenciales al archivo <code className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">.env</code> en la raíz del proyecto Frontend:
            </p>
            <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`# Garmin Connect
VITE_GARMIN_CLIENT_ID=your_client_id
VITE_GARMIN_CLIENT_SECRET=your_client_secret

# COROS
VITE_COROS_API_KEY=your_api_key

# Suunto
VITE_SUUNTO_APP_KEY=your_app_key

# Strava
VITE_STRAVA_CLIENT_ID=your_client_id
VITE_STRAVA_CLIENT_SECRET=your_client_secret

# Polar Flow
VITE_POLAR_CLIENT_ID=your_client_id
VITE_POLAR_CLIENT_SECRET=your_client_secret`}
            </pre>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Implementa el flujo OAuth</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Los servicios están preparados para implementar OAuth 2.0. Cuando conectes las APIs, los entrenamientos se sincronizarán automáticamente.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Devices;
