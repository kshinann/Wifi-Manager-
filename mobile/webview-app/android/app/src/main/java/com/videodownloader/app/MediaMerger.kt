package com.videodownloader.app

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import androidx.media3.common.MediaItem
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import java.io.File
import java.util.concurrent.CountDownLatch

/**
 * Muxes/transcodes yt-dlp's raw stream(s) into a single output file, using
 * Android's own Media3 Transformer instead of ffmpeg (which isn't bundled —
 * see mobile/README.md). Called from Python (downloader.py) via Chaquopy's
 * Java interop.
 *
 * Note: Android's underlying MediaMuxer only writes MP4 and WEBM containers,
 * and MediaCodec audio *encoders* are only guaranteed to include AAC across
 * all devices — that's why the on-device format list is narrower than the
 * desktop backend's (see downloader.py's VIDEO_CONTAINERS/AUDIO_ONLY_FORMATS).
 */
object MediaMerger {
    private val thread = HandlerThread("media-transformer").apply { start() }
    private val handler = Handler(thread.looper)

    /**
     * Merges [videoPath] and/or [audioPath] (at least one required) into a
     * single file at [outputPath]. Blocks the calling thread until done.
     * Throws on failure.
     */
    @JvmStatic
    fun merge(context: Context, videoPath: String?, audioPath: String?, outputPath: String) {
        require(videoPath != null || audioPath != null) {
            "Need at least one of videoPath/audioPath"
        }

        val latch = CountDownLatch(1)
        var error: Throwable? = null

        handler.post {
            try {
                val sequences = mutableListOf<EditedMediaItemSequence>()
                videoPath?.let { sequences.add(sequenceFor(it)) }
                audioPath?.let { sequences.add(sequenceFor(it)) }

                val transformer = Transformer.Builder(context)
                    .addListener(object : Transformer.Listener {
                        override fun onCompleted(composition: Composition, result: ExportResult) {
                            latch.countDown()
                        }

                        override fun onError(
                            composition: Composition,
                            result: ExportResult,
                            exception: ExportException
                        ) {
                            error = exception
                            latch.countDown()
                        }
                    })
                    .build()

                val composition = Composition.Builder(sequences).build()
                transformer.start(composition, outputPath)
            } catch (e: Throwable) {
                error = e
                latch.countDown()
            }
        }

        latch.await()
        error?.let { throw it }
    }

    private fun sequenceFor(path: String): EditedMediaItemSequence {
        val mediaItem = MediaItem.fromUri(File(path).toURI().toString())
        val editedItem = EditedMediaItem.Builder(mediaItem).build()
        return EditedMediaItemSequence(listOf(editedItem))
    }
}
