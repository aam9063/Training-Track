import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiEdit2,
  FiSave,
  FiX,
} from 'react-icons/fi';

const Profile = () => {
  const { user, profile, updateProfile, updateCoachProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  
  // Usar profile si existe, sino usar user metadata
  const displayProfile = profile || {
    first_name: user?.user_metadata?.first_name || 'Usuario',
    last_name: user?.user_metadata?.last_name || '',
    email: user?.email || '',
    phone: '',
    role: user?.user_metadata?.role || 'coach',
    coach: { bio: '', specialties: [], years_experience: 0 }
  };

  const [formData, setFormData] = useState({
    first_name: displayProfile.first_name,
    last_name: displayProfile.last_name,
    phone: displayProfile.phone || '',
    bio: displayProfile.coach?.bio || '',
    specialties: displayProfile.coach?.specialties || [],
    years_experience: displayProfile.coach?.years_experience || 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update base user info
      await updateProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      });

      // Update coach-specific info
      if (displayProfile.role === 'coach') {
        await updateCoachProfile({
          bio: formData.bio,
          specialties: formData.specialties,
          years_experience: formData.years_experience,
        });
      }

      setEditing(false);
      alert('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: displayProfile.first_name,
      last_name: displayProfile.last_name,
      phone: displayProfile.phone || '',
      bio: displayProfile.coach?.bio || '',
      specialties: displayProfile.coach?.specialties || [],
      years_experience: displayProfile.coach?.years_experience || 0,
    });
    setEditing(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Mi Perfil
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona tu información personal
            </p>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <FiEdit2 className="w-5 h-5" />
              <span>Editar</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
                <span>Cancelar</span>
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                <span>{loading ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="p-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6 mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
            {displayProfile.profile_image ? (
              <img
                src={displayProfile.profile_image}
                alt={`${profile.first_name} ${profile.last_name}`}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-3xl">
                  {displayProfile.first_name[0]}{displayProfile.last_name[0]}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {displayProfile.first_name} {displayProfile.last_name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 capitalize">
                {displayProfile.role === 'coach' ? 'Entrenador' : 'Atleta'}
              </p>
              <button className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Cambiar foto
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Información Personal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Información de Contacto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={displayProfile.email}
                      disabled
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      disabled={!editing}
                      placeholder="Ej: +34 600 000 000"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Coach-specific fields */}
            {displayProfile.role === 'coach' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Información Profesional
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Biografía
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      disabled={!editing}
                      rows={4}
                      placeholder="Cuéntanos sobre tu experiencia como entrenador..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Años de Experiencia
                    </label>
                    <input
                      type="number"
                      value={formData.years_experience}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          years_experience: parseInt(e.target.value) || 0,
                        })
                      }
                      disabled={!editing}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
