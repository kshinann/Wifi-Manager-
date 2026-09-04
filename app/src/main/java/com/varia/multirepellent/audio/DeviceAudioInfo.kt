package com.varia.multirepellent.audio

import android.content.Context
import android.media.AudioManager

/**
 * Android exposes the device's digital audio sample rate, but not the physical
 * frequency-response curve of its speaker - that's a hardware spec no public API
 * reports. [nativeSampleRate] gives the digital ceiling (Nyquist = sampleRate / 2);
 * whether the speaker can actually reproduce frequencies near that ceiling has to
 * be checked by ear, which is what the in-app sweep test is for.
 */
object DeviceAudioInfo {

    private const val FALLBACK_SAMPLE_RATE = 44_100

    fun nativeSampleRate(context: Context): Int {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val reported = audioManager
            ?.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
            ?.toIntOrNull()
        return reported?.takeIf { it > 0 } ?: FALLBACK_SAMPLE_RATE
    }
}
