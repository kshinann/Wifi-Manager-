package com.varia.multirepellent.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.sin

/**
 * Streams a single sine tone through the device's default output.
 * Frequency and amplitude can be changed live while playing; the change
 * takes effect at the next audio buffer, which can produce a faint click -
 * acceptable for an experimentation tool, not worth the complexity of
 * phase-ramped crossfades.
 */
class ToneEngine(private val sampleRate: Int) {

    @Volatile
    var frequencyHz: Float = 1_000f

    @Volatile
    var amplitude: Float = 0.6f

    @Volatile
    private var isPlaying = false

    private var audioTrack: AudioTrack? = null
    private var playThread: Thread? = null

    fun start() {
        if (isPlaying) return
        isPlaying = true

        val minBufferBytes = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(1024)

        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minBufferBytes)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack = track
        track.play()

        playThread = thread(name = "ToneEngine-writer") {
            var phase = 0.0
            val chunk = ShortArray(1024)
            while (isPlaying) {
                val phaseIncrement = 2.0 * PI * frequencyHz / sampleRate
                val gain = amplitude.coerceIn(0f, 1f)
                for (i in chunk.indices) {
                    chunk[i] = (sin(phase) * gain * Short.MAX_VALUE).toInt().toShort()
                    phase += phaseIncrement
                    if (phase > 2.0 * PI) phase -= 2.0 * PI
                }
                track.write(chunk, 0, chunk.size)
            }
        }
    }

    fun stop() {
        if (!isPlaying) return
        isPlaying = false
        playThread?.join(200)
        playThread = null
        audioTrack?.apply {
            stop()
            release()
        }
        audioTrack = null
    }
}
