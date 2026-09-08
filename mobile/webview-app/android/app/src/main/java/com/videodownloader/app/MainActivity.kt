package com.videodownloader.app

import android.os.Bundle
import android.webkit.WebSettings
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.getcapacitor.BridgeActivity
import java.io.File
import kotlin.concurrent.thread

/**
 * Runs the video-downloader backend (yt-dlp, via Chaquopy) in-process on
 * 127.0.0.1, so the app needs no separate server. See mobile/README.md.
 */
class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The page itself loads from Capacitor's local https:// origin, but it
        // fetches the embedded API over plain http://127.0.0.1 — allow that
        // mixed content explicitly rather than relying on WebView defaults.
        bridge.webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        startEmbeddedServer()
    }

    private fun startEmbeddedServer() {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(this))
        }
        val downloadRoot = File(cacheDir, "downloads").absolutePath
        val appContext = applicationContext

        thread(name = "video-downloader-server") {
            val py = Python.getInstance()
            py.getModule("downloader").callAttr("configure", downloadRoot, appContext)
            py.getModule("local_server").callAttr("start", SERVER_PORT)
        }
    }

    companion object {
        const val SERVER_PORT = 8765
    }
}
