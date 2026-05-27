import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Generate a thumbnail from a video file
 * @param videoPath Path to the video file
 * @param outputPath Optional output path for the thumbnail (defaults to temp directory)
 * @param timestamp Time in seconds to capture the thumbnail (default: 1)
 * @param size Size of the thumbnail (default: '640x360')
 * @returns Path to the generated thumbnail
 */
export async function generateVideoThumbnail(
  videoPath: string,
  outputPath?: string,
  timestamp: number = 1,
  size: string = '640x360'
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Generate output path if not provided
      if (!outputPath) {
        const tempDir = os.tmpdir();
        const filename = `thumbnail-${Date.now()}.png`;
        outputPath = path.join(tempDir, filename);
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const finalOutputPath = outputPath!;
      
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(finalOutputPath),
          folder: path.dirname(finalOutputPath),
          size: size,
        })
        .on('end', () => {
          console.log(`✓ Thumbnail generated: ${finalOutputPath}`);
          resolve(finalOutputPath);
        })
        .on('error', (err) => {
          console.error('✗ Error generating thumbnail:', err);
          reject(err);
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clean up temporary file
 * @param filePath Path to the file to delete
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log(`✓ Cleaned up temp file: ${filePath}`);
  } catch (error) {
    console.error(`✗ Error cleaning up temp file ${filePath}:`, error);
  }
}
