package com.wifihealth.manager.data.speedtest

import com.wifihealth.manager.data.model.LatencyResult
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.SpeedTestStage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.random.Random

/**
 * Measures link latency/jitter and effective download/upload throughput.
 *
 * Throughput is measured against Cloudflare's public speed-test endpoints
 * (`speed.cloudflare.com`), the same infrastructure used by many open-source
 * speed test clients; no API key is required. The endpoints are overridable
 * for anyone who wants to point this at a self-hosted test server instead.
 *
 * Download/upload use [PARALLEL_STREAMS] concurrent connections, not one.
 * A single TCP stream rarely saturates a modern link (TCP slow-start plus a
 * single connection's window ceiling), which is why a naive single-stream
 * test reads well below tools like Ookla/speedtest.net that open multiple
 * connections and sum their throughput.
 */
class SpeedTestEngine(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build(),
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
        parallelStreams: Int = PARALLEL_STREAMS,
        maxDurationMs: Long = 10_000,
    ): Double? = withContext(Dispatchers.IO) {
        val totalBytes = AtomicLong(0)
        val startNanos = System.nanoTime()
        coroutineScope {
            (1..parallelStreams).map {
                async { downloadStream(url, startNanos, maxDurationMs, totalBytes) }
            }.awaitAll()
        }
        val elapsedSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
        mbpsOrNull(totalBytes.get(), elapsedSeconds)
    }

    private fun downloadStream(url: String, startNanos: Long, maxDurationMs: Long, counter: AtomicLong) {
        val request = Request.Builder().url(url).header("Cache-Control", "no-cache").build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return
                val input = (response.body ?: return).byteStream()
                val buffer = ByteArray(64 * 1024)
                while ((System.nanoTime() - startNanos) / 1_000_000 < maxDurationMs) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    counter.addAndGet(read.toLong())
                }
            }
        } catch (e: IOException) {
            // This stream failed; the others still contribute to the aggregate.
        }
    }

    suspend fun measureUploadMbps(
        url: String = DEFAULT_UPLOAD_URL,
        parallelStreams: Int = PARALLEL_STREAMS,
        maxDurationMs: Long = 8_000,
    ): Double? = withContext(Dispatchers.IO) {
        val totalBytes = AtomicLong(0)
        val startNanos = System.nanoTime()
        coroutineScope {
            (1..parallelStreams).map {
                async { uploadStream(url, startNanos, maxDurationMs, totalBytes) }
            }.awaitAll()
        }
        val elapsedSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
        mbpsOrNull(totalBytes.get(), elapsedSeconds)
    }

    private fun uploadStream(url: String, startNanos: Long, maxDurationMs: Long, counter: AtomicLong) {
        // Unknown content length (chunked transfer) so writeTo can be time-boxed instead of
        // committing to a fixed byte count up front.
        val body = object : RequestBody() {
            override fun contentType() = OCTET_STREAM
            override fun contentLength() = -1L
            override fun writeTo(sink: BufferedSink) {
                val chunk = ByteArray(64 * 1024)
                Random.nextBytes(chunk)
                while ((System.nanoTime() - startNanos) / 1_000_000 < maxDurationMs) {
                    sink.write(chunk)
                    counter.addAndGet(chunk.size.toLong())
                }
            }
        }
        val request = Request.Builder().url(url).post(body).build()
        try {
            client.newCall(request).execute().use { }
        } catch (e: IOException) {
            // This stream failed; the others still contribute to the aggregate.
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
            measureLatency(host = it, port = 80, attempts = 5, timeoutMs = 800).avgMs
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
        // 26,214,400 (25MB) is a conservative, empirically-working size per stream. A larger
        // value was tried (assuming a higher documented cap) but caused __down to fail outright
        // for every parallel stream on-device, so this stays conservative rather than guessed.
        // With PARALLEL_STREAMS concurrent requests this is still 100MB aggregate available,
        // comfortably enough that maxDurationMs -- not running out of bytes -- is what limits
        // the test on any realistic home/mobile link.
        const val DEFAULT_DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=26214400"
        const val DEFAULT_UPLOAD_URL = "https://speed.cloudflare.com/__up"
        const val PUBLIC_LATENCY_HOST = "1.1.1.1"
        const val PARALLEL_STREAMS = 4
        private val OCTET_STREAM = "application/octet-stream".toMediaType()
    }
}
