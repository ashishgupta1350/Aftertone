package com.prism.music.data.stream

import com.prism.music.data.imports.ImportKeys
import com.prism.music.data.imports.MatchStatus
import com.prism.music.data.imports.TrackMatcher
import com.prism.music.data.imports.TrackToMatch
import com.prism.music.data.model.ArtistRef
import com.prism.music.data.model.Song
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.parser.Parser
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.exceptions.SignInConfirmNotBotException

/** Resolves publicly playable audio by recording. The listener's library still uses the original song's identity. */
internal class AlternateAudio(http: OkHttpClient) {
    private val client = http.newBuilder().callTimeout(6, TimeUnit.SECONDS).followSslRedirects(false).build()
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    data class Stream(val source: String, val url: HttpUrl, val cacheKey: String)
    private data class Candidate(val song: Song, val stream: Stream)

    suspend fun find(song: Song): Stream? = withContext(Dispatchers.IO) {
        val artist = ImportKeys.mainArtist(song.primaryArtist)
        if (artist.isBlank() || song.title.isBlank()) return@withContext null
        val track = TrackToMatch(song.title, artist, durationMs = song.durationSec * 1000L)
        val query = TrackMatcher.queryFor(track)
        match(track, saavn(query)) ?: match(track, audius(query))
    }

    private fun match(track: TrackToMatch, candidates: List<Candidate>): Stream? {
        val artist = ImportKeys.norm(track.artist)
        return candidates.asSequence()
            .filter { it.song.durationSec > 0 && it.song.artists.any { a -> ImportKeys.norm(a.name) == artist } }
            .filter { TrackMatcher.judge(track, listOf(it.song)).status == MatchStatus.SURE }
            .sortedBy { if (track.durationMs > 0) abs(it.song.durationSec * 1000L - track.durationMs) else 0L }
            .distinctBy { it.stream.url }
            .take(2)
            .firstOrNull { canStream(it.stream.url) }?.stream
    }

    private fun saavn(query: String): List<Candidate> {
        val url = "https://saavn.sumit.co/api/search/songs".toHttpUrl().newBuilder()
            .addQueryParameter("query", query).addQueryParameter("limit", "8").build()
        val results = read<SaavnSearch>(url)?.data?.results.orEmpty()
        return results.mapNotNull { result ->
            if (result.type != "song" || result.id.isBlank() || !result.rights.isNullOrBlank()) return@mapNotNull null
            val audio = result.downloadUrl.firstOrNull { it.quality == "160kbps" }?.url?.toHttpUrlOrNull()
                ?.takeIf { it.isHttps && it.host.endsWith(".saavncdn.com") } ?: return@mapNotNull null
            val artists = result.artists?.primary.orEmpty() + result.artists?.featured.orEmpty()
            val song = Song(
                result.id, Parser.unescapeEntities(result.name, false),
                artists.map { ArtistRef(Parser.unescapeEntities(it.name, false)) },
                durationSec = result.duration, explicit = result.explicitContent,
            )
            Candidate(song, Stream("JioSaavn", audio, "${CACHE_PREFIX}saavn:${result.id}:160"))
        }
    }

    private fun audius(query: String): List<Candidate> {
        val url = "https://api.audius.co/v1/tracks/search".toHttpUrl().newBuilder()
            .addQueryParameter("query", query).addQueryParameter("limit", "8").addQueryParameter("app_name", "Aftertone").build()
        return read<AudiusSearch>(url)?.data.orEmpty().mapNotNull { result ->
            val uploader = result.user?.takeIf { it.verified } ?: return@mapNotNull null
            if (!result.streamable || !result.available || result.gated || !result.coverArtist.isNullOrBlank() ||
                !result.id.matches(AUDIUS_ID)
            ) return@mapNotNull null
            val audio = "https://api.audius.co/v1/tracks".toHttpUrl().newBuilder()
                .addPathSegment(result.id).addPathSegment("stream").addQueryParameter("app_name", "Aftertone").build()
            val song = Song(result.id, result.title, listOf(ArtistRef(uploader.name)), durationSec = result.duration)
            Candidate(song, Stream("Audius", audio, "${CACHE_PREFIX}audius:${result.id}"))
        }
    }

    private inline fun <reified T> read(url: HttpUrl): T? = try {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) null
            else json.decodeFromString<T>(response.peekBody(MAX_SEARCH_BYTES + 1).string().takeIf { it.length <= MAX_SEARCH_BYTES } ?: return null)
        }
    } catch (_: IOException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }

    /** Check for seekable audio, since a catalog result can point to a retired or restricted stream. */
    private fun canStream(url: HttpUrl): Boolean = try {
        client.newCall(Request.Builder().url(url).header("Range", "bytes=0-0").build()).execute().use { response ->
            response.code == 206 && response.header("Content-Type")?.startsWith("audio/", ignoreCase = true) == true
        }
    } catch (_: IOException) {
        false
    }

    @Serializable private data class SaavnSearch(val data: SaavnResults? = null)
    @Serializable private data class SaavnResults(val results: List<SaavnTrack> = emptyList())
    @Serializable private data class SaavnTrack(
        val id: String = "", val name: String = "", val type: String = "", val duration: Int = 0,
        val artists: SaavnArtists? = null, val explicitContent: Boolean = false, val rights: String? = null,
        val downloadUrl: List<SaavnAudio> = emptyList(),
    )
    @Serializable private data class SaavnArtists(val primary: List<SaavnArtist> = emptyList(), val featured: List<SaavnArtist> = emptyList())
    @Serializable private data class SaavnArtist(val name: String = "")
    @Serializable private data class SaavnAudio(val quality: String = "", val url: String = "")

    @Serializable private data class AudiusSearch(val data: List<AudiusTrack> = emptyList())
    @Serializable private data class AudiusTrack(
        val id: String = "", val title: String = "", val duration: Int = 0, val user: AudiusUser? = null,
        @SerialName("is_streamable") val streamable: Boolean = false,
        @SerialName("is_available") val available: Boolean = false,
        @SerialName("is_stream_gated") val gated: Boolean = true,
        @SerialName("cover_original_artist") val coverArtist: String? = null,
    )
    @Serializable private data class AudiusUser(val name: String = "", @SerialName("is_verified") val verified: Boolean = false)

    companion object {
        const val CACHE_PREFIX = "streamed:alternate:"
        private const val MAX_SEARCH_BYTES = 512L * 1024
        private val AUDIUS_ID = Regex("[a-zA-Z0-9]{1,20}")
    }
}

internal fun anonymousYouTubeBlocked(error: Throwable): Boolean =
    generateSequence(error) { it.cause }.any { it is SignInConfirmNotBotException || it is ReCaptchaException }
