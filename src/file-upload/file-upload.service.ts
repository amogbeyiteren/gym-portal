import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class FileUploadService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL and Service Role Key must be provided');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async uploadFile(
    file: Buffer | Uint8Array,
    fileName: string,
    contentType: string,
    bucketName: string = 'gym-portal',
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  async deleteFile(fileName: string, bucketName: string = 'gym-portal'): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([fileName]);

      if (error) {
        console.error('Supabase delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    } catch (error) {
      console.error('File delete error:', error);
      throw new Error('Failed to delete file from storage');
    }
  }

  async getFileUrl(fileName: string, bucketName: string = 'gym-portal'): Promise<string> {
    const { data } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
}