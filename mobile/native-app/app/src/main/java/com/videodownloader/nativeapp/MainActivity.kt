package com.videodownloader.nativeapp

import android.content.ContentValues
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences

    private lateinit var serverUrlInput: EditText
    private lateinit var videoUrlInput: EditText
    private lateinit var fetchBtn: Button
    private lateinit var fetchProgress: ProgressBar
    private lateinit var statusText: TextView

    private lateinit var resultCard: View
    private lateinit var thumbnailImage: ImageView
    private lateinit var titleText: TextView
    private lateinit var uploaderText: TextView
    private lateinit var durationText: TextView
    private lateinit var formatSpinner: Spinner
    private lateinit var resolutionSpinner: Spinner
    private lateinit var downloadBtn: Button
    private lateinit var downloadProgress: ProgressBar
    private lateinit var downloadStatusText: TextView

    private val activityScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val videoFormats = listOf("mp4", "webm", "mkv", "mov")
    private val audioFormats = listOf("mp3", "m4a", "wav", "aac", "opus", "flac")
    private val allFormats get() = videoFormats + audioFormats

    private var availableHeights: List<Int> = emptyList()
    private var currentVideoUrl: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("video_downloader", MODE_PRIVATE)

        serverUrlInput = findViewById(R.id.server_url_input)
        videoUrlInput = findViewById(R.id.video_url_input)
        fetchBtn = findViewById(R.id.fetch_btn)
        fetchProgress = findViewById(R.id.fetch_progress)
        statusText = findViewById(R.id.status_text)

        resultCard = findViewById(R.id.result_card)
        thumbnailImage = findViewById(R.id.thumbnail_image)
        titleText = findViewById(R.id.title_text)
        uploaderText = findViewById(R.id.uploader_text)
        durationText = findViewById(R.id.duration_text)
        formatSpinner = findViewById(R.id.format_spinner)
        resolutionSpinner = findViewById(R.id.resolution_spinner)
        downloadBtn = findViewById(R.id.download_btn)
        downloadProgress = findViewById(R.id.download_progress)
        downloadStatusText = findViewById(R.id.download_status_text)

        serverUrlInput.setText(prefs.getString("server_url", ""))

        formatSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, allFormats.map { it.uppercase() }
        )

        fetchBtn.setOnClickListener { onFetchClicked() }
        downloadBtn.setOnClickListener { onDownloadClicked() }
    }

    private fun serverUrl(): String {
        val raw = serverUrlInput.text.toString().trim().trimEnd('/')
        return if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "http://$raw"
    }

    private fun onFetchClicked() {
        val videoUrl = videoUrlInput.text.toString().trim()
        if (videoUrl.isEmpty()) {
            statusText.text = "Enter a video URL first."
            return
        }

        prefs.edit().putString("server_url", serverUrlInput.text.toString().trim()).apply()
        currentVideoUrl = videoUrl

        resultCard.visibility = View.GONE
        statusText.text = "Fetching video info..."
        fetchProgress.visibility = View.VISIBLE
        fetchBtn.isEnabled = false

        val baseUrl = serverUrl()

        activityScope.launch {
            try {
                val info = withContext(Dispatchers.IO) { ApiClient.fetchInfo(baseUrl, videoUrl) }

                titleText.text = info.title ?: "Untitled"
                uploaderText.text = info.uploader?.let { "by $it" } ?: ""
                durationText.text = info.duration?.let { formatDuration(it) } ?: ""

                val bitmap = withContext(Dispatchers.IO) { loadThumbnail(info.thumbnail) }
                if (bitmap != null) {
                    thumbnailImage.setImageBitmap(bitmap)
                    thumbnailImage.visibility = View.VISIBLE
                } else {
                    thumbnailImage.visibility = View.GONE
                }

                availableHeights = info.formats
                    .filter { it.hasVideo && it.height != null }
                    .mapNotNull { it.height }
                    .distinct()
                    .sortedDescending()

                val resolutionOptions = listOf("Best available") + availableHeights.map { "${it}p" }
                resolutionSpinner.adapter = ArrayAdapter(
                    this@MainActivity, android.R.layout.simple_spinner_dropdown_item, resolutionOptions
                )

                statusText.text = ""
                resultCard.visibility = View.VISIBLE
            } catch (e: Exception) {
                statusText.text = e.message ?: "Failed to fetch video info"
            } finally {
                fetchProgress.visibility = View.GONE
                fetchBtn.isEnabled = true
            }
        }
    }

    private fun onDownloadClicked() {
        val format = allFormats[formatSpinner.selectedItemPosition]
        val isAudio = audioFormats.contains(format)
        val resIndex = resolutionSpinner.selectedItemPosition
        val height = if (!isAudio && resIndex > 0) availableHeights[resIndex - 1] else null
        val baseUrl = serverUrl()
        val videoUrl = currentVideoUrl

        downloadBtn.isEnabled = false
        downloadProgress.visibility = View.VISIBLE
        downloadStatusText.text = "Downloading and converting... this can take a while."
        downloadStatusText.visibility = View.VISIBLE

        activityScope.launch {
            try {
                val savedName = withContext(Dispatchers.IO) {
                    downloadToDownloads(baseUrl, videoUrl, format, height)
                }
                downloadStatusText.text = "Saved to Downloads as $savedName"
            } catch (e: Exception) {
                downloadStatusText.text = e.message ?: "Download failed"
            } finally {
                downloadProgress.visibility = View.GONE
                downloadBtn.isEnabled = true
            }
        }
    }

    private fun loadThumbnail(url: String?) = runCatching {
        if (url.isNullOrBlank()) return@runCatching null
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.inputStream.use { BitmapFactory.decodeStream(it) }
    }.getOrNull()

    private fun downloadToDownloads(
        baseUrl: String,
        videoUrl: String,
        format: String,
        height: Int?
    ): String {
        val tempFile = File(cacheDir, "pending_download_${System.currentTimeMillis()}.$format")
        val resolvedName: String?
        FileOutputStream(tempFile).use { out ->
            resolvedName = ApiClient.download(baseUrl, videoUrl, format, height) { buffer, len ->
                out.write(buffer, 0, len)
            }
        }

        val filename = resolvedName?.takeIf { it.isNotBlank() } ?: "download.$format"
        writeToDownloads(tempFile, filename, format)
        tempFile.delete()
        return filename
    }

    private fun writeToDownloads(sourceFile: File, filename: String, format: String) {
        val mimeType = mimeTypeFor(format)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw ApiException("Could not create file in Downloads")

            resolver.openOutputStream(uri).use { out: OutputStream? ->
                sourceFile.inputStream().use { input -> input.copyTo(out!!) }
            }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } else {
            @Suppress("DEPRECATION")
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            downloadsDir.mkdirs()
            sourceFile.copyTo(File(downloadsDir, filename), overwrite = true)
        }
    }

    private fun mimeTypeFor(format: String): String = when (format) {
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mkv" -> "video/x-matroska"
        "mov" -> "video/quicktime"
        "mp3" -> "audio/mpeg"
        "m4a" -> "audio/mp4"
        "wav" -> "audio/wav"
        "aac" -> "audio/aac"
        "opus" -> "audio/opus"
        "flac" -> "audio/flac"
        else -> "application/octet-stream"
    }

    private fun formatDuration(totalSeconds: Int): String {
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
    }

    override fun onDestroy() {
        super.onDestroy()
        activityScope.cancel()
    }
}
