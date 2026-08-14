package com.wifihealth.manager.data.speedtest

import com.wifihealth.manager.data.model.LatencyResult
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.SpeedTestStage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.abs
import kotlin.random.Random

/**
 * Measures link latency/jitter and effective download/upload throughput.
 *
 * Throughput is measured against Cloudflare's public speed-test endpoints
 * (`speed.cloudflare.com`), the same infrastructure used by many open-source
 * speed test clients; no API key is required. The endpoints are overridable
 * for anyone who wants to point this at a self-hosted test server instead.
 */
class SpeedTestEngine(
    private val client: OkHttpClient = OkHttpClient.Builder().build(),
) {
    suspend fun measureLatency(
        host: String,
        port: Int,
        attempts: Int = 5,
        timeoutMs: Int = 1500,
    ): LatencyResult = withContext(Dispatchers.IO) {
        val samplesMs = mutableListOf<Double>()
        repeat(attempts) {
            val startNanos = System.nanoTime()
            try {
                Socket().use { socket -> socket.connect(InetSocketAddress(host, port), timeoutMs) }
                samplesMs += (System.nanoTime() - startNanos) / 1_000_000.0
            } catch (e: IOException) {
                // Counted as a lost probe below.
            }
            delay(150)
        }
        if (samplesMs.isEmpty()) return@withContext LatencyResult.UNREACHABLE

        val avg = samplesMs.average()
        val jitter = if (samplesMs.size > 1) samplesMs.zipWithNext { a, b -> abs(b - a) }.average() else 0.0
        val lossPercent = (attempts - samplesMs.size) * 100.0 / attempts
        LatencyResult(avgMs = avg, jitterMs = jitter, packetLossPercent = lossPercent)
    }

    suspend fun measureDownloadMbps(
        url: String = DEFAULT_DOWNLOAD_URL,
        maxDurationMs: Long = 8_000,
    ): Double? = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(url).header("Cache-Control", "no-cache").build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val input = (response.body ?: return@withContext null).byteStream()
                val buffer = ByteArray(64 * 1024)
                var totalBytes = 0L
                val startNanos = System.nanoTime()
                while (true) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    totalBytes += read
                    if ((System.nanoTime() - startNanos) / 1_000_000 >= maxDurationMs) break
                }
                val elapsedSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
                mbpsOrNull(totalBytes, elapsedSeconds)
            }
        } catch (e: IOException) {
            null
        }
    }

    suspend fun measureUploadMbps(
        url: String = DEFAULT_UPLOAD_URL,
        totalBytes: Long = 8_000_000,
    ): Double? = withContext(Dispatchers.IO) {
        val body = object : RequestBody() {
            override fun contentType() = OCTET_STREAM
            override fun contentLength() = totalBytes
            override fun writeTo(sink: BufferedSink) {
                val chunk = ByteArray(64 * 1024)
                Random.nextBytes(chunk)
                var remaining = totalBytes
                while (remaining > 0) {
                    val n = minOf(chunk.size.toLong(), remaining).toInt()
                    sink.write(chunk, 0, n)
                    remaining -= n
                }
            }
        }
        val request = Request.Builder().url(url).post(body).build()
        try {
            val startNanos = System.nanoTime()
            val ok = client.newCall(request).execute().use { it.isSuccessful }
            if (!ok) return@withContext null
            val elapsedSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
            mbpsOrNull(totalBytes, elapsedSeconds)
        } catch (e: IOException) {
            null
        }
    }

    /** Runs latency -> download -> upload in sequence, reporting progress via [onStage]. */
    suspend fun runFullTest(
        ssid: String?,
        gatewayIp: String?,
        onStage: (SpeedTestStage) -> Unit = {},
    ): SpeedTestResult {
        onStage(SpeedTestStage.LATENCY)
        val internetLatency = measureLatency(host = PUBLIC_LATENCY_HOST, port = 443)
        val localLatency = gatewayIp?.let {
            measureLatency(host = it, port = 80, attempts = 3, timeoutMs = 800).avgMs
        }

        onStage(SpeedTestStage.DOWNLOAD)
        val download = measureDownloadMbps()

        onStage(SpeedTestStage.UPLOAD)
        val upload = measureUploadMbps()

        onStage(SpeedTestStage.DONE)
        return SpeedTestResult(
            timestampEpochMillis = System.currentTimeMillis(),
            ssid = ssid,
            downloadMbps = download,
            uploadMbps = upload,
            latencyMs = internetLatency.avgMs,
            jitterMs = internetLatency.jitterMs,
            packetLossPercent = internetLatency.packetLossPercent,
            localLatencyMs = localLatency,
        )
    }

    private fun mbpsOrNull(bytes: Long, elapsedSeconds: Double): Double? {
        if (bytes <= 0 || elapsedSeconds <= 0.05) return null
        return (bytes * 8.0 / 1_000_000.0) / elapsedSeconds
    }

    companion object {
        const val DEFAULT_DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=26214400"
        const val DEFAULT_UPLOAD_URL = "https://speed.cloudflare.com/__up"
        const val PUBLIC_LATENCY_HOST = "1.1.1.1"
        private val OCTET_STREAM = "application/octet-stream".toMediaType()
    }
}
