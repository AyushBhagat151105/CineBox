package com.ayushbhagat.cinebox

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File

class PlayerLauncherModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativePlayerLauncher"

    private val CHANNEL_DOWNLOADS = "cinebox_downloads"
    private val CHANNEL_COMPLETED = "cinebox_completed"
    private var wakeLock: PowerManager.WakeLock? = null

    private fun ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            val downloadChannel = NotificationChannel(
                CHANNEL_DOWNLOADS,
                "Downloads in Progress",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows real-time download speed and progress"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }

            val completedChannel = NotificationChannel(
                CHANNEL_COMPLETED,
                "Completed Downloads",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Alerts when movie or episode download completes"
                setShowBadge(true)
            }

            notificationManager.createNotificationChannel(downloadChannel)
            notificationManager.createNotificationChannel(completedChannel)
        }
    }

    private fun getLaunchIntent(): PendingIntent? {
        val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName) ?: return null
        launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(reactContext, 0, launchIntent, flags)
    }

    @ReactMethod
    fun playVideo(
        url: String,
        title: String?,
        subtitleUrl: String?,
        headers: ReadableMap?,
        forceChooser: Boolean,
        promise: Promise
    ) {
        playVideoWithTarget(url, title, subtitleUrl, headers, forceChooser, null, promise)
    }

    @ReactMethod
    fun playVideoWithTarget(
        url: String,
        title: String?,
        subtitleUrl: String?,
        headers: ReadableMap?,
        forceChooser: Boolean,
        targetPlayer: String?,
        promise: Promise
    ) {
        try {
            val uri = Uri.parse(url)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/*")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                if (!title.isNullOrEmpty()) {
                    putExtra("title", title)
                    putExtra("android.intent.extra.TITLE", title)
                }

                if (!subtitleUrl.isNullOrEmpty()) {
                    val subUri = Uri.parse(subtitleUrl)
                    putExtra("subtitles_location", subUri)
                    putExtra("subs", arrayOf(subUri))
                    putExtra("subs.enable", arrayOf(subUri))
                }

                if (headers != null) {
                    val keyIterator = headers.keySetIterator()
                    val headerBundle = Bundle()
                    val headerList = ArrayList<String>()
                    while (keyIterator.hasNextKey()) {
                        val key = keyIterator.nextKey()
                        val value = headers.getString(key)
                        if (value != null) {
                            headerBundle.putString(key, value)
                            headerList.add(key)
                            headerList.add(value)
                            if (key.equals("User-Agent", ignoreCase = true)) {
                                putExtra("User-Agent", value)
                            } else if (key.equals("Referer", ignoreCase = true)) {
                                putExtra("Referer", value)
                            }
                        }
                    }
                    putExtra("android.media.intent.extra.HTTP_HEADERS", headerBundle)
                    putExtra("headers", headerList.toTypedArray())
                    putExtra("headers_bundle", headerBundle)
                }

                if (url.startsWith("content://")) {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            }

            val pm = reactContext.packageManager

            // Package routing based on targetPlayer:
            // "vlc" -> org.videolan.vlc
            // "mx" -> com.mxtech.videoplayer.ad / .pro
            // "just" -> com.brouken.player
            // "mpv" -> is.xyz.mpv
            // "chooser" or "ask" -> Native System Chooser
            var assignedPackage: String? = null
            when (targetPlayer?.lowercase()) {
                "vlc" -> assignedPackage = "org.videolan.vlc"
                "just" -> assignedPackage = "com.brouken.player"
                "mpv" -> assignedPackage = "is.xyz.mpv"
                "mx" -> {
                    val isPro = try {
                        pm.getPackageInfo("com.mxtech.videoplayer.pro", 0) != null
                    } catch (_: Exception) { false }
                    assignedPackage = if (isPro) "com.mxtech.videoplayer.pro" else "com.mxtech.videoplayer.ad"
                }
                "chooser", "ask" -> assignedPackage = null
            }

            if (!assignedPackage.isNullOrEmpty() && !forceChooser) {
                intent.setPackage(assignedPackage)
                try {
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                    return
                } catch (_: ActivityNotFoundException) {
                    // Specified player not installed; fall back to system chooser
                    intent.setPackage(null)
                }
            }

            // Fallback / Default: Prompt Android Native System Chooser
            val chooser = Intent.createChooser(intent, "Play Video With").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LAUNCH_FAILED", e.message, e)
        }
    }

    /**
     * Permanently delete a downloaded video file from device storage,
     * purge its row from Android MediaStore, and trigger MediaScanner refresh
     * so it vanishes immediately from File Managers (Samsung Files, Google Files).
     */
    @ReactMethod
    fun deleteFilePermanently(filePath: String, promise: Promise) {
        try {
            val cleanPath = if (filePath.startsWith("file://")) {
                Uri.parse(filePath).path ?: filePath.removePrefix("file://")
            } else {
                filePath
            }

            val file = File(cleanPath)
            var fileDeleted = false

            // 1. Direct filesystem removal
            if (file.exists()) {
                fileDeleted = file.delete()
                Log.d("PlayerLauncher", "Java File.delete() on $cleanPath: $fileDeleted")
            }

            // 2. Query and delete from Android MediaStore database via ContentResolver
            val contentResolver = reactContext.contentResolver

            // Delete from MediaStore.Video
            try {
                val where = "${MediaStore.Video.Media.DATA} = ?"
                val args = arrayOf(cleanPath)
                val rows = contentResolver.delete(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, where, args)
                if (rows > 0) fileDeleted = true
                Log.d("PlayerLauncher", "MediaStore.Video rows deleted: $rows")
            } catch (e: Exception) {
                Log.w("PlayerLauncher", "MediaStore.Video delete error: ${e.message}")
            }

            // Delete from MediaStore.Downloads (API 29+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    val where = "${MediaStore.MediaColumns.DATA} = ?"
                    val args = arrayOf(cleanPath)
                    val rows = contentResolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI, where, args)
                    if (rows > 0) fileDeleted = true
                    Log.d("PlayerLauncher", "MediaStore.Downloads rows deleted: $rows")
                } catch (e: Exception) {
                    Log.w("PlayerLauncher", "MediaStore.Downloads delete error: ${e.message}")
                }
            }

            // Delete from MediaStore.Files
            try {
                val filesUri = MediaStore.Files.getContentUri("external")
                val where = "${MediaStore.Files.FileColumns.DATA} = ?"
                val args = arrayOf(cleanPath)
                val rows = contentResolver.delete(filesUri, where, args)
                if (rows > 0) fileDeleted = true
                Log.d("PlayerLauncher", "MediaStore.Files rows deleted: $rows")
            } catch (e: Exception) {
                Log.w("PlayerLauncher", "MediaStore.Files delete error: ${e.message}")
            }

            // 3. Immediately notify MediaScanner so File Managers (Samsung Files, Google Files) refresh and remove the entry
            MediaScannerConnection.scanFile(
                reactContext,
                arrayOf(cleanPath),
                arrayOf("video/*")
            ) { path, uri ->
                Log.d("PlayerLauncher", "MediaScanner refreshed post-deletion: $path (URI: $uri)")
            }

            val stillExists = file.exists()
            promise.resolve(!stillExists || fileDeleted)
        } catch (e: Exception) {
            Log.e("PlayerLauncher", "deleteFilePermanently error: ${e.message}", e)
            promise.reject("DELETE_FAILED", e.message, e)
        }
    }

    /**
     * Broadcast new downloaded file to MediaStore and File Manager
     */
    @ReactMethod
    fun scanMediaFile(filePath: String, mimeType: String?, promise: Promise) {
        try {
            val cleanPath = if (filePath.startsWith("file://")) {
                Uri.parse(filePath).path ?: filePath.removePrefix("file://")
            } else {
                filePath
            }

            val mType = mimeType ?: "video/mp4"
            MediaScannerConnection.scanFile(
                reactContext,
                arrayOf(cleanPath),
                arrayOf(mType)
            ) { path, uri ->
                Log.d("PlayerLauncher", "MediaScanner indexed file: $path -> $uri")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCAN_FAILED", e.message, e)
        }
    }

    /**
     * Acquire a CPU Partial WakeLock to prevent the system from throttling or suspending
     * network connections during background downloads.
     */
    @ReactMethod
    fun acquireWakeLock(promise: Promise) {
        try {
            if (wakeLock == null) {
                val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CineBox:DownloadWakeLock")
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(6 * 60 * 60 * 1000L) // 6 hours safety timeout
                Log.d("PlayerLauncher", "🔋 Partial WakeLock acquired for background download")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("PlayerLauncher", "acquireWakeLock warning: ${e.message}")
            promise.resolve(false)
        }
    }

    /**
     * Release the CPU Partial WakeLock when all active downloads complete or are paused.
     */
    @ReactMethod
    fun releaseWakeLock(promise: Promise) {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d("PlayerLauncher", "🔋 Partial WakeLock released")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("PlayerLauncher", "releaseWakeLock warning: ${e.message}")
            promise.resolve(false)
        }
    }

    /**
     * Update live ongoing system notification with real-time download progress and speed.
     */
    @ReactMethod
    fun updateDownloadNotification(
        id: Double,
        title: String,
        content: String,
        progress: Double,
        max: Double,
        indeterminate: Boolean,
        promise: Promise
    ) {
        try {
            ensureNotificationChannels()
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (notificationManager == null) {
                promise.resolve(false)
                return
            }

            val notifId = id.toInt()
            val maxInt = if (max > 0) max.toInt() else 100
            val progressInt = progress.toInt().coerceIn(0, maxInt)

            val builder = NotificationCompat.Builder(reactContext, CHANNEL_DOWNLOADS)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText(content)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setContentIntent(getLaunchIntent())

            if (indeterminate) {
                builder.setProgress(0, 0, true)
            } else {
                builder.setProgress(maxInt, progressInt, false)
            }

            notificationManager.notify(notifId, builder.build())
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("PlayerLauncher", "updateDownloadNotification error: ${e.message}")
            promise.resolve(false)
        }
    }

    /**
     * Post a notification when a download finishes successfully.
     */
    @ReactMethod
    fun showDownloadCompleteNotification(
        id: Double,
        title: String,
        content: String,
        promise: Promise
    ) {
        try {
            ensureNotificationChannels()
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (notificationManager == null) {
                promise.resolve(false)
                return
            }

            val notifId = id.toInt()
            val builder = NotificationCompat.Builder(reactContext, CHANNEL_COMPLETED)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(title)
                .setContentText(content)
                .setOngoing(false)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setContentIntent(getLaunchIntent())

            notificationManager.notify(notifId, builder.build())
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("PlayerLauncher", "showDownloadCompleteNotification error: ${e.message}")
            promise.resolve(false)
        }
    }

    /**
     * Cancel an active notification by ID.
     */
    @ReactMethod
    fun cancelNotification(id: Double, promise: Promise) {
        try {
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(id.toInt())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
