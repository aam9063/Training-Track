import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { uploadProfileImage } from '../../services/storageService';
import { motion } from 'framer-motion';
import {
  FiMail,
  FiPhone,
  FiEdit2,
  FiSave,
  FiX,
  FiCalendar,
  FiActivity,
} from 'react-icons/fi';

const Profile = () => {
  const { user, profile, updateProfile, updateCoachProfile, updateAthleteProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  
  // Usar profile si existe, sino usar user metadata
  const displayProfile = profile || {
    first_name: user?.user_metadata?.first_name || 'Usuario',
    last_name: user?.user_metadata?.last_name || '',
    email: user?.email || '',
    phone: '',
    role: user?.user_metadata?.role || 'coach',
    coach: { bio: '', specialties: [], years_experience: 0 },
    athlete: { date_of_birth: '', weight: '', height: '', race_distances: [] }
  };

  const [formData, setFormData] = useState({
    first_name: displayProfile.first_name,
    last_name: displayProfile.last_name,
    phone: displayProfile.phone || '',
    // Coach fields
    bio: displayProfile.coach?.bio || '',
    specialties: displayProfile.coach?.specialties || [],
    years_experience: displayProfile.coach?.years_experience || 0,
    // Athlete fields
    date_of_birth: displayProfile.athlete?.date_of_birth || '',
    weight: displayProfile.athlete?.weight || '',
    height: displayProfile.athlete?.height || '',
    race_distances: displayProfile.athlete?.race_distances || [],
  });
  const [newDistance, setNewDistance] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync formData when profile loads from DB (useState only initializes once)
  useEffect(() => {
    if (profile && !editing) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        bio: profile.coach?.bio || '',
        specialties: profile.coach?.specialties || [],
        years_experience: profile.coach?.years_experience || 0,
        date_of_birth: profile.athlete?.date_of_birth || '',
        weight: profile.athlete?.weight || '',
        height: profile.athlete?.height || '',
        race_distances: profile.athlete?.race_distances || [],
      });
    }
  }, [profile, editing]);

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

      // Update athlete-specific info
      if (displayProfile.role === 'athlete') {
        await updateAthleteProfile({
          date_of_birth: formData.date_of_birth || null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          race_distances: formData.race_distances,
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
      date_of_birth: displayProfile.athlete?.date_of_birth || '',
      weight: displayProfile.athlete?.weight || '',
      height: displayProfile.athlete?.height || '',
      race_distances: displayProfile.athlete?.race_distances || [],
    });
    setNewDistance('');
    setEditing(false);
  };

  const COMMON_DISTANCES = ['800m', '1500m', '3000m', '5K', '10K', 'Media Maratón', 'Maratón', 'Trail', 'Ultra'];

  const addDistance = (distance) => {
    if (distance && !formData.race_distances.includes(distance)) {
      setFormData({ ...formData, race_distances: [...formData.race_distances, distance] });
    }
    setNewDistance('');
  };

  const removeDistance = (distance) => {
    setFormData({
      ...formData,
      race_distances: formData.race_distances.filter(d => d !== distance),
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const { error } = await uploadProfileImage(user.id, file);
      if (error) throw error;
      await refreshProfile();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            <div className="relative">
              {displayProfile.profile_image ? (
                <img
                  src={displayProfile.profile_image}
                  alt={`${displayProfile.first_name} ${displayProfile.last_name}`}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-3xl">
                    {displayProfile.first_name?.[0]}{displayProfile.last_name?.[0]}
                  </span>
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {displayProfile.first_name} {displayProfile.last_name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 capitalize">
                {displayProfile.role === 'coach' ? 'Entrenador' : 'Atleta'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                {uploadingImage ? 'Subiendo...' : 'Cambiar foto'}
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

            {/* Athlete-specific fields */}
            {displayProfile.role === 'athlete' && (
              <>
                {/* Race Distances */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-blue-600" />
                    Distancias de Competición
                  </h3>
                  <div className="space-y-3">
                    {/* Current distances */}
                    <div className="flex flex-wrap gap-2">
                      {formData.race_distances.length > 0 ? (
                        formData.race_distances.map((dist) => (
                          <span
                            key={dist}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                          >
                            {dist}
                            {editing && (
                              <button
                                onClick={() => removeDistance(dist)}
                                className="ml-1 text-blue-500 hover:text-red-500 transition-colors"
                              >
                                <FiX className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No hay distancias configuradas
                        </p>
                      )}
                    </div>

                    {/* Add distance */}
                    {editing && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {COMMON_DISTANCES.filter(d => !formData.race_distances.includes(d)).map((dist) => (
                            <button
                              key={dist}
                              onClick={() => addDistance(dist)}
                              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              + {dist}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newDistance}
                            onChange={(e) => setNewDistance(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); addDistance(newDistance); }
                            }}
                            placeholder="Otra distancia..."
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => addDistance(newDistance)}
                            disabled={!newDistance.trim()}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal Data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FiCalendar className="w-5 h-5 text-blue-600" />
                    Datos Personales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Nacimiento
                      </label>
                      <input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) =>
                          setFormData({ ...formData, date_of_birth: e.target.value })
                        }
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Peso (kg)
                      </label>
                      <input
                        type="number"
                        value={formData.weight}
                        onChange={(e) =>
                          setFormData({ ...formData, weight: e.target.value })
                        }
                        disabled={!editing}
                        step="0.1"
                        min="0"
                        placeholder="Ej: 70.5"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Estatura (cm)
                      </label>
                      <input
                        type="number"
                        value={formData.height}
                        onChange={(e) =>
                          setFormData({ ...formData, height: e.target.value })
                        }
                        disabled={!editing}
                        step="0.1"
                        min="0"
                        placeholder="Ej: 175"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
