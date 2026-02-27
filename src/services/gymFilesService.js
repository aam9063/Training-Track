import { supabase } from '../lib/supabase';

/**
 * Upload a PDF gym file for a coach.
 * Stored in: gym-files/{coachId}/{uuid}_{sanitizedName}
 */
export const uploadGymFile = async (coachId, file, displayName) => {
  if (!coachId || !file) {
    return { data: null, error: new Error('coachId and file are required') };
  }

  try {
    const uuid = crypto.randomUUID();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${coachId}/${uuid}_${sanitized}`;

    const { error: uploadError } = await supabase.storage
      .from('gym-files')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error: insertError } = await supabase
      .from('gym_files')
      .insert({
        coach_id: coachId,
        filename: displayName || file.name,
        storage_path: storagePath,
        file_size: file.size,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback storage upload if DB insert fails
      await supabase.storage.from('gym-files').remove([storagePath]);
      throw insertError;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error uploading gym file:', error);
    return { data: null, error };
  }
};

/**
 * List all active (non-expired) gym files for a coach.
 */
export const listGymFiles = async (coachId) => {
  if (!coachId) return { data: [], error: new Error('coachId is required') };

  try {
    const { data, error } = await supabase
      .from('gym_files')
      .select('*')
      .eq('coach_id', coachId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error listing gym files:', error);
    return { data: [], error };
  }
};

/**
 * List active gym files for an athlete (reads files from their coach).
 * Uses the same query — RLS SELECT policy allows athletes to read their coach's files.
 */
export const listGymFilesForAthlete = async (coachId) => {
  if (!coachId) return { data: [], error: new Error('coachId is required') };

  try {
    const { data, error } = await supabase
      .from('gym_files')
      .select('*')
      .eq('coach_id', coachId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error listing gym files for athlete:', error);
    return { data: [], error };
  }
};

/**
 * Delete a gym file (Storage + DB row).
 */
export const deleteGymFile = async (fileId, storagePath) => {
  if (!fileId || !storagePath) {
    return { error: new Error('fileId and storagePath are required') };
  }

  try {
    const { error: storageError } = await supabase.storage
      .from('gym-files')
      .remove([storagePath]);

    if (storageError) throw storageError;

    const { error: dbError } = await supabase
      .from('gym_files')
      .delete()
      .eq('id', fileId);

    if (dbError) throw dbError;

    return { error: null };
  } catch (error) {
    console.error('Error deleting gym file:', error);
    return { error };
  }
};

/**
 * Generate a signed URL valid for 1 hour to view/download a gym file.
 */
export const getGymFileSignedUrl = async (storagePath) => {
  if (!storagePath) return { url: null, error: new Error('storagePath is required') };

  try {
    const { data, error } = await supabase.storage
      .from('gym-files')
      .createSignedUrl(storagePath, 3600);

    if (error) throw error;
    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return { url: null, error };
  }
};

/**
 * Format bytes to a human-readable string.
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Calculate days remaining until a file expires.
 */
export const daysUntilExpiry = (expiresAt) => {
  const diff = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
