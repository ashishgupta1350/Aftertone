package com.prism.music.data

import android.util.AtomicFile
import androidx.room.withTransaction
import com.prism.music.AppContainer
import com.prism.music.BuildConfig
import com.prism.music.data.db.PlayEventEntity
import com.prism.music.data.db.toEntity
import com.prism.music.data.model.Song
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
internal data class SyncedLike(val song: Song, val at: Long)
@Serializable
internal data class SyncedPlaylist(val id: String, val name: String, val songs: List<Song> = emptyList())
@Serializable
internal data class SyncedPlay(val song: Song, val at: Long, val ms: Long, val excluded: Boolean = false)
@Serializable
internal data class SyncedLibrary(
    val likes: List<SyncedLike> = emptyList(),
    val playlists: List<SyncedPlaylist> = emptyList(),
    val plays: List<SyncedPlay> = emptyList(),
)
@Serializable
private data class RemoteLibrary(val revision: Long, val library: SyncedLibrary)
@Serializable
private data class AccountSession(val uid: String, val token: String, val refresh: String, val id: String? = null)
@Serializable
private data class DeviceSync(val uid: String, val library: SyncedLibrary = SyncedLibrary())

internal data class AftertoneAccess(val allowed: Boolean, val message: String? = null)

internal class AftertoneAccount(private val c: AppContainer) {
    val configured = BuildConfig.AFTERTONE_SERVER.isNotBlank()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val client = OkHttpClient.Builder().callTimeout(22, TimeUnit.SECONDS).followRedirects(false).build()
    private val lock = Mutex()
    private val sessionFile = AtomicFile(File(c.app.noBackupFilesDir, "aftertone-session.json"))
    private val syncFile = AtomicFile(File(c.app.noBackupFilesDir, "aftertone-sync.json"))
    private var session = read(sessionFile, AccountSession.serializer())
    private var baseline = read(syncFile, DeviceSync.serializer())
    private var lastRemote: RemoteLibrary? = null
    private val status = MutableStateFlow(AftertoneAccess(!configured || session != null))
    val access = status.asStateFlow()

    init {
        if (configured) {
            c.network.onReconnect(::syncSoon)
            c.scope.launch(Dispatchers.IO) {
                while (true) {
                    runCatchingSync()
                    delay(20_000)
                }
            }
        }
    }

    suspend fun signIn(id: String, password: String, signup: Boolean) = withContext(Dispatchers.IO) {
        lock.withLock {
            val result = call(if (signup) "signup" else "login", buildJsonObject {
                put("id", id)
                put("password", password)
                put("client", "android")
            })
            val signedIn = json.decodeFromString<AccountSession>(result.body)
            require(baseline == null || baseline?.uid == signedIn.uid) {
                "This installation is linked to another Aftertone account. Use a separate Android profile to keep their libraries private."
            }
            if (baseline == null) setBaseline(DeviceSync(signedIn.uid))
            persist(sessionFile, AccountSession.serializer(), signedIn)
            session = signedIn
            lastRemote = null
            status.value = AftertoneAccess(true)
        }
        syncSoon()
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        lock.withLock { closeSession(null) }
    }

    fun syncSoon() {
        if (configured) c.scope.launch(Dispatchers.IO) { runCatchingSync() }
    }

    private suspend fun runCatchingSync() {
        lock.withLock {
            if (session == null || !c.network.isOnline()) return
            try {
                sync()
                status.value = AftertoneAccess(true)
            } catch (e: CancellationException) {
                throw e
            } catch (e: RequestFailure) {
                if (e.code == 401 || e.code == 403) closeSession(e.message)
                else android.util.Log.w("AftertoneAccount", "Library sync unavailable: " + e.code)
            } catch (e: Exception) {
                android.util.Log.w("AftertoneAccount", "Library sync failed: " + e.javaClass.simpleName)
            }
        }
    }

    private suspend fun closeSession(message: String?) {
        sessionFile.delete()
        session = null
        lastRemote = null
        status.value = AftertoneAccess(false, message = message)
        pause()
    }

    private suspend fun pause() = withContext(Dispatchers.Main) { c.player.player?.pause() }

    private suspend fun sync() {
        val previous = baseline ?: return
        val before = localLibrary()
        val known = lastRemote
        val response = signedCall(if (known == null) "state" else "state?revision=" + known.revision)
        var remote = if (response.code == 204 && known != null) known else json.decodeFromString<RemoteLibrary>(response.body)
        repeat(4) {
            val merged = mergeLibrary(previous.library, before, remote.library)
            if (merged == remote.library) {
                applyRemote(before, remote.library)
                setBaseline(DeviceSync(previous.uid, remote.library))
                lastRemote = remote
                return
            }
            val result = signedCall("state", json.encodeToJsonElement(RemoteLibrary.serializer(), RemoteLibrary(remote.revision, merged)).jsonObject)
            remote = json.decodeFromString<RemoteLibrary>(result.body)
            if (result.code == 200) {
                applyRemote(before, remote.library)
                setBaseline(DeviceSync(previous.uid, remote.library))
                lastRemote = remote
                return
            }
        }
        throw IOException("Library changed during sync")
    }

    private suspend fun localLibrary() = SyncedLibrary(
        likes = c.db.songs().liked().asSequence().filter { portable(it.id) }.take(10000).map {
            SyncedLike(it.toSong(), it.likedAt)
        }.toList(),
        playlists = c.prismLibrary.lists.value.asSequence().filter { list ->
            list.smart == null && (list.songs.isEmpty() || list.songs.any { portable(it.id) })
        }.take(250).map { list ->
            SyncedPlaylist(list.id, list.title, list.songs.filter { portable(it.id) }.take(3000))
        }.toList(),
        plays = c.db.plays().syncHistory(3000).map {
            SyncedPlay(it.song.toSong(), it.playedAt, it.playedFor, it.excluded)
        },
    )

    private suspend fun applyRemote(before: SyncedLibrary, remote: SyncedLibrary) {
        c.db.withTransaction {
            val currentLikes = c.db.songs().liked().associateBy { it.id }
            val remoteLikes = remote.likes.associateBy { it.song.id }
            val oldLikes = before.likes.associateBy { it.song.id }
            for (id in oldLikes.keys + remoteLikes.keys) {
                val existing = currentLikes[id]
                if (existing?.likedAt != oldLikes[id]?.at) continue
                val desired = remoteLikes[id]
                val dao = c.db.songs()
                if (desired == null) dao.setLiked(id, false, 0)
                else if (existing?.likedAt != desired.at) {
                    if (existing == null) dao.upsert(desired.song.toEntity(dao.get(id)))
                    dao.setLiked(id, true, desired.at)
                }
            }
            val oldPlays = before.plays.associateBy { it.key }
            for (row in remote.plays) {
                if ((oldPlays[row.key]?.ms ?: -1L) >= row.ms) continue
                val dao = c.db.songs()
                val current = dao.get(row.song.id)
                if (current == null) dao.upsert(row.song.toEntity())
                if (row.at > (current?.lastPlayed ?: 0)) dao.touch(row.song.id, row.at)
                val plays = c.db.plays()
                if (plays.extendSynced(row.song.id, row.at, row.ms) == 0 && !plays.hasSynced(row.song.id, row.at)) {
                    plays.insert(PlayEventEntity(songId = row.song.id, timestamp = row.at,
                        playedMs = row.ms, source = "aftertone", excluded = row.excluded))
                }
            }
        }
        c.prismLibrary.applySynced(before.playlists, remote.playlists)
    }

    private fun setBaseline(value: DeviceSync) {
        if (value == baseline) return
        persist(syncFile, DeviceSync.serializer(), value)
        baseline = value
    }

    private fun <T> read(file: AtomicFile, serializer: kotlinx.serialization.KSerializer<T>): T? =
        runCatching { json.decodeFromString(serializer, file.readFully().toString(Charsets.UTF_8)) }.getOrNull()

    private fun <T> persist(file: AtomicFile, serializer: kotlinx.serialization.KSerializer<T>, value: T) {
        val output = file.startWrite()
        try {
            output.write(json.encodeToString(serializer, value).toByteArray(Charsets.UTF_8))
            file.finishWrite(output)
        } catch (e: Exception) {
            file.failWrite(output)
            throw e
        }
    }

    private data class Answer(val code: Int, val body: String)
    private class RequestFailure(val code: Int, message: String) : IOException(message)

    private fun call(path: String, body: JsonObject? = null, token: String? = null): Answer {
        val request = Request.Builder().url(BuildConfig.AFTERTONE_SERVER.trimEnd('/') + "/api/" + path)
        if (token != null) request.header("Authorization", "Bearer " + token)
        if (body != null) request.post(body.toString().toRequestBody("application/json".toMediaType()))
        return client.newCall(request.build()).execute().use { response ->
            val answer = response.body.string()
            if (!response.isSuccessful && !(path == "state" && response.code == 409)) {
                val message = runCatching {
                    json.parseToJsonElement(answer).jsonObject["error"]?.jsonPrimitive?.content
                }.getOrNull() ?: "Aftertone is temporarily unavailable."
                throw RequestFailure(response.code, message)
            }
            Answer(response.code, answer)
        }
    }

    private fun signedCall(path: String, body: JsonObject? = null): Answer {
        val account = session ?: throw RequestFailure(401, "Sign in to Aftertone.")
        return try { call(path, body, account.token) }
        catch (e: RequestFailure) {
            if (e.code != 401) throw e
            val answer = call("refresh", JsonObject(mapOf("refresh" to JsonPrimitive(account.refresh), "client" to JsonPrimitive("android"))))
            val next = json.decodeFromString<AccountSession>(answer.body)
            if (next.uid != account.uid) throw RequestFailure(401, "Sign in again.")
            persist(sessionFile, AccountSession.serializer(), next)
            session = next
            call(path, body, next.token)
        }
    }
}

private val videoId = Regex("[A-Za-z0-9_-]{11}")
internal fun portable(id: String) = videoId.matches(id)
private val SyncedPlay.key get() = song.id to at

private fun <T, K, V> mergeRows(base: List<T>, local: List<T>, remote: List<T>, key: (T) -> K, value: (T) -> V): List<T> {
    val old = base.associateBy(key)
    val live = local.associateBy(key)
    val result = remote.filterNot { key(it) in old && key(it) !in live }.associateByTo(linkedMapOf(), key)
    for ((id, row) in live) if (old[id]?.let(value) != value(row)) result[id] = row
    return result.values.toList()
}

internal fun SyncedPlaylist.content() = name to songs.map { it.id }

internal fun mergeLibrary(base: SyncedLibrary, local: SyncedLibrary, remote: SyncedLibrary): SyncedLibrary {
    val old = base.playlists.associateBy { it.id }
    val online = remote.playlists.associateBy { it.id }
    val mergedPlaylists = local.playlists.map { updated ->
        val prior = old[updated.id]
        val other = online[updated.id]
        if (prior == null || other == null || prior.content() == updated.content() || prior.content() == other.content()) updated
        else {
            val oldIds = prior.songs.map { it.id }.toSet()
            val otherIds = other.songs.map { it.id }.toSet()
            val updatedIds = updated.songs.map { it.id }.toSet()
            updated.copy(
                name = if (updated.name == prior.name) other.name else updated.name,
                songs = updated.songs.filter { it.id !in oldIds || it.id in otherIds } +
                    other.songs.filter { it.id !in oldIds && it.id !in updatedIds },
            )
        }
    }
    val plays = (remote.plays + local.plays).groupBy { it.key }.values
        .map { options -> options.maxBy { it.ms } }.sortedByDescending { it.at }.take(3000)
    return SyncedLibrary(
        mergeRows(base.likes, local.likes, remote.likes, { it.song.id }, { it.at }).sortedByDescending { it.at },
        mergeRows(base.playlists, mergedPlaylists, remote.playlists, { it.id }, SyncedPlaylist::content),
        plays,
    )
}
