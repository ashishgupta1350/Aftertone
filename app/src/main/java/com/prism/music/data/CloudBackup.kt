package com.prism.music.data

import android.net.Uri
import android.util.Base64
import com.prism.music.AppContainer
import com.prism.music.BuildConfig
import com.prism.music.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

internal class CloudBackup(private val app: AppContainer) {
    class Account(val uid: String, internal val token: String)
    class Failure(val reason: Int) : Exception()

    suspend fun signIn(phone: String, password: String): Account = withContext(Dispatchers.IO) {
        val digits = phone.filter { it in '0'..'9' }
        val number = if (digits.length == 12 && digits.startsWith("91")) digits.drop(2) else digits
        ensure(number.length in 8..15 && password.isNotBlank(), R.string.cloud_bad_credentials)
        val digest = MessageDigest.getInstance("SHA-256").digest("aftertone:$number".toByteArray())
        val hash = digest.take(16).joinToString("") { "%02x".format(it.toInt() and 0xff) }
        val alias = "aftertone-$hash@accounts.aftertone.invalid"
        val url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword".toHttpUrl()
            .newBuilder().addQueryParameter("key", BuildConfig.AFTERTONE_CLOUD_API_KEY).build()
        val body = buildJsonObject {
            put("email", alias)
            put("password", password)
            put("returnSecureToken", true)
        }
        val request = Request.Builder().url(url).post(body.toString().toRequestBody(JSON_TYPE)).build()
        http.newCall(request).execute().use { response ->
            if (response.code == 400 || response.code == 401) throw Failure(R.string.cloud_bad_credentials)
            ensure(response.isSuccessful, R.string.cloud_unavailable)
            val answer = Json.parseToJsonElement(response.body.string()) as? JsonObject
                ?: throw Failure(R.string.cloud_unavailable)
            val uid = (answer["localId"] as? JsonPrimitive)?.content ?: throw Failure(R.string.cloud_unavailable)
            val token = (answer["idToken"] as? JsonPrimitive)?.content ?: throw Failure(R.string.cloud_unavailable)
            Account(uid, token)
        }
    }

    suspend fun savedAt(account: Account): Long? = withContext(Dispatchers.IO) {
        (read(account, "savedAt") as? JsonPrimitive)?.longOrNull
    }

    suspend fun save(account: Account): Long = withContext(Dispatchers.IO) {
        val file = File.createTempFile("aftertone-backup-", ".zip", app.app.cacheDir)
        try {
            app.backup.export(Uri.fromFile(file), PARTS, includeCachedArtwork = false)
            ensure(file.length() in 1..MAX_ARCHIVE_BYTES.toLong(), R.string.cloud_backup_too_large)
            val archive = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
            val body = buildJsonObject {
                put("archive", archive)
                put("savedAt", buildJsonObject { put(".sv", "timestamp") })
            }
            val url = endpoint(account).newBuilder().addQueryParameter("print", "silent").build()
            val request = Request.Builder().url(url).put(body.toString().toRequestBody(JSON_TYPE)).build()
            http.newCall(request).execute().use { response ->
                ensure(response.isSuccessful, R.string.cloud_unavailable)
            }
            savedAt(account) ?: throw Failure(R.string.cloud_unavailable)
        } finally {
            file.delete()
        }
    }

    suspend fun restore(account: Account) = withContext(Dispatchers.IO) {
        val value = read(account, "archive")
        val archive = (value as? JsonPrimitive)?.takeUnless { it == JsonNull }?.content
            ?: throw Failure(R.string.cloud_backup_none)
        val bytes = Base64.decode(archive, Base64.DEFAULT)
        ensure(bytes.size in 1..MAX_ARCHIVE_BYTES, R.string.cloud_backup_too_large)
        val file = File(app.app.cacheDir, "aftertone-cloud-restore.zip")
        try {
            file.writeBytes(bytes)
            val uri = Uri.fromFile(file)
            ensure(app.backup.partsOf(uri) == PARTS, R.string.cloud_backup_invalid)
            app.backup.restore(uri)
        } finally {
            file.delete()
        }
    }

    private fun endpoint(account: Account, field: String? = null): HttpUrl =
        BuildConfig.AFTERTONE_CLOUD_DATABASE.toHttpUrl().newBuilder()
            .addPathSegment("backups")
            .apply {
                if (field == null) addPathSegment(account.uid + ".json")
                else addPathSegment(account.uid).addPathSegment("$field.json")
            }
            .addQueryParameter("auth", account.token)
            .build()

    private fun read(account: Account, field: String) =
        http.newCall(Request.Builder().url(endpoint(account, field)).build()).execute().use { response ->
            ensure(response.isSuccessful, R.string.cloud_unavailable)
            val source = response.body.source()
            ensure(!source.request(MAX_RESPONSE_BYTES + 1L), R.string.cloud_backup_too_large)
            Json.parseToJsonElement(source.readUtf8())
        }

    companion object {
        val available: Boolean get() =
            BuildConfig.AFTERTONE_CLOUD_API_KEY.isNotBlank() && BuildConfig.AFTERTONE_CLOUD_DATABASE.isNotBlank()

        private val PARTS = setOf(BackupPart.LIBRARY, BackupPart.HISTORY, BackupPart.SETTINGS)
        private const val MAX_ARCHIVE_BYTES = 7_500_000
        private const val MAX_RESPONSE_BYTES = 10_000_002
        private val JSON_TYPE = "application/json".toMediaType()
        private val http = OkHttpClient.Builder().callTimeout(75, TimeUnit.SECONDS).build()

        private fun ensure(condition: Boolean, reason: Int) {
            if (!condition) throw Failure(reason)
        }
    }
}
