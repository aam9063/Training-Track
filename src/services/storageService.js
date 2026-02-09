import { supabase } from '../lib/supabase';

/**
 * Upload a profile image for a user.
 * Files are stored in: profile-images/{userId}/avatar.{ext}
 */
export const uploadProfileImage = async (userId, file) => {
  if (!userId || !file) {
    return { data: null, error: new Error('userId and file are required') };
  }

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const filePath = `${userId}/avatar.${ext}`;

    // Upload (upsert to replace existing)
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update user profile_image field
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_image: publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { data: { url: publicUrl }, error: null };
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return { data: null, error };
  }
};

/**
 * Delete the profile image for a user.
 */
export const deleteProfileImage = async (userId) => {
  if (!userId) {
    return { error: new Error('userId is required') };
  }

  try {
    // List files in the user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('profile-images')
      .list(userId);

    if (listError) throw listError;

    if (files && files.length > 0) {
      const filePaths = files.map(f => `${userId}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from('profile-images')
        .remove(filePaths);

      if (deleteError) throw deleteError;
    }

    // Clear profile_image in users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_image: null })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error deleting profile image:', error);
    return { error };
  }
};
