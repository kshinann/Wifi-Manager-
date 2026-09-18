package com.videodownloader.nativeapp

import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class FormatOption(
    val formatId: String?,
    val ext: String?,
    val resolution: String?,
    val height: Int?,
    val hasVideo: Boolean,
    val hasAudio: Boolean
)

data class VideoInfo(
    val title: String?,
    val uploader: String?,
    val duration: Int?,
    val thumbnail: String?,
    val formats: List<FormatOption>
)

class ApiException(message: String) : Exception(message)

/** Thin client for the Video Downloader backend's /api/info and /api/download endpoints. */
object ApiClient {

    fun fetchInfo(baseUrl: String, videoUrl: String): VideoInfo {
        val body = JSONObject().put("url", videoUrl).toString()
        val json = JSONObject(postJson("$baseUrl/api/info", body))

        val formatsJson: JSONArray = json.optJSONArray("formats") ?: JSONArray()
        val formats = mutableListOf<FormatOption>()
        for (i in 0 until formatsJson.length()) {
            val f = formatsJson.getJSONObject(i)
            formats.add(
                FormatOption(
                    formatId = f.optString("format_id", null),
                    ext = f.optString("ext", null),
                    resolution = f.optString("resolution", null),
                    height = if (f.isNull("height")) null else f.optInt("height"),
                    hasVideo = f.optBoolean("has_video", false),
                    hasAudio = f.optBoolean("has_audio", false)
                )
            )
        }

        return VideoInfo(
            title = json.optString("title", null),
            uploader = json.optString("uploader", null),
            duration = if (json.isNull("duration")) null else json.optInt("duration"),
            thumbnail = json.optString("thumbnail", null),
            formats = formats
        )
    }

    /**
     * Streams the converted media from the backend, invoking [onChunk] for each buffer read.
     * Returns the filename suggested by the server's Content-Disposition header, if present.
     */
    fun download(
        baseUrl: String,
        videoUrl: String,
        format: String,
        height: Int?,
        onChunk: (ByteArray, Int) -> Unit
    ): String? {
        val payload = JSONObject().apply {
            put("url", videoUrl)
            put("format", format)
            put("height", height ?: JSONObject.NULL)
        }

        val connection = URL("$baseUrl/api/download").openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true
        connection.connectTimeout = 15_000
        connection.readTimeout = 0

        connection.outputStream.use { os: OutputStream ->
            os.write(payload.toString().toByteArray(StandardCharsets.UTF_8))
        }

        val code = connection.responseCode
        if (code !in 200..299) {
            throw ApiException(readErrorDetail(connection, "Download failed ($code)"))
        }

        val disposition = connection.getHeaderField("Content-Disposition")
        val filename = disposition
            ?.substringAfter("filename=", "")
            ?.trim('"')
            ?.takeIf { it.isNotBlank() }

        val buffer = ByteArray(64 * 1024)
        connection.inputStream.use { input: InputStream ->
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                onChunk(buffer, read)
            }
        }

        return filename
    }

    private fun postJson(urlStr: String, body: String): String {
        val connection = URL(urlStr).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000

        connection.outputStream.use { os: OutputStream ->
            os.write(body.toByteArray(StandardCharsets.UTF_8))
        }

        val code = connection.responseCode
        if (code !in 200..299) {
            throw ApiException(readErrorDetail(connection, "Request failed ($code)"))
        }

        return connection.inputStream.bufferedReader().readText()
    }

    private fun readErrorDetail(connection: HttpURLConnection, fallback: String): String {
        val body = connection.errorStream?.bufferedReader()?.readText().orEmpty()
        val detail = runCatching { JSONObject(body).optString("detail") }.getOrNull()
        return detail?.takeIf { it.isNotBlank() } ?: fallback
    }
}
