package com.prism.music.data.spotify

import com.prism.music.data.imports.TrackToMatch
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request

internal object PublicSpotifyPlaylists {
    data class Playlist(val title: String, val tracks: List<TrackToMatch>, val exposedCount: Int)

    private val idPattern = Regex("[A-Za-z0-9]{22}")
    private val shortPattern = Regex("[A-Za-z0-9_-]{1,100}")
    private val linkPattern = Regex("""https?://[^\s<>"]+|spotify:playlist:[A-Za-z0-9]+""")
    private val pageData = Regex(
        """<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>(.*?)</script>""",
        setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE),
    )

    fun linkIn(text: String?): String? = linkPattern.findAll(text.orEmpty()).firstNotNullOfOrNull { match ->
        val raw = match.value.trimEnd('.', ',', ')', '\'')
        playlistId(raw)?.let { "https://open.spotify.com/playlist/$it" }
            ?: raw.toHttpUrlOrNull()?.takeIf {
                it.isHttps && it.host == "spotify.link" && it.pathSegments.size == 1 &&
                    shortPattern.matches(it.pathSegments[0])
            }?.let { "https://spotify.link/${it.pathSegments[0]}" }
    }

    fun playlistId(link: String): String? {
        if (link.startsWith("spotify:playlist:")) return link.substringAfterLast(':').takeIf(idPattern::matches)
        val url = link.toHttpUrlOrNull() ?: return null
        if (url.host != "open.spotify.com" || url.username.isNotEmpty() || url.password.isNotEmpty()) return null
        val path = url.pathSegments.dropWhile { it == "embed" || it.startsWith("intl-") }
        return path.getOrNull(1)?.takeIf { path.size == 2 && path[0] == "playlist" && idPattern.matches(it) }
    }

    suspend fun load(http: OkHttpClient, link: String): Playlist = withContext(Dispatchers.IO) {
        val canonical = linkIn(link) ?: throw IOException()
        val id = playlistId(canonical) ?: resolveShortLink(http, canonical)
        val request = Request.Builder().url("https://open.spotify.com/embed/playlist/$id").build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful || response.request.url.host != "open.spotify.com") throw IOException()
            val source = response.body.source()
            if (source.request(MAX_PAGE_BYTES + 1)) throw IOException()
            parse(source.readUtf8(), id) ?: throw IOException()
        }
    }

    private fun resolveShortLink(http: OkHttpClient, url: String): String {
        // Validate the redirect destination before requesting an embed.
        val client = http.newBuilder().followRedirects(false).build()
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (response.code !in 300..399) throw IOException()
            val destination = response.header("Location") ?: throw IOException()
            return playlistId(destination) ?: throw IOException()
        }
    }

    internal fun parse(html: String, expectedId: String): Playlist? {
        val script = pageData.find(html)?.groupValues?.get(1) ?: return null
        val root = runCatching { Json.parseToJsonElement(script) as? JsonObject }.getOrNull() ?: return null
        val entity = root.obj("props")?.obj("pageProps")?.obj("state")?.obj("data")?.obj("entity") ?: return null
        if (entity.string("type") != "playlist" || entity.string("id") != expectedId) return null
        val title = entity.string("name") ?: entity.string("title") ?: return null
        val rows = entity["trackList"] as? JsonArray ?: return null
        val tracks = rows.mapNotNull { row ->
            val item = row as? JsonObject ?: return@mapNotNull null
            val uri = item.string("uri") ?: return@mapNotNull null
            if (!uri.startsWith("spotify:track:") || !idPattern.matches(uri.substringAfterLast(':'))) return@mapNotNull null
            val name = item.string("title") ?: return@mapNotNull null
            val artist = item.string("subtitle") ?: return@mapNotNull null
            TrackToMatch(name, artist, durationMs = (item["duration"] as? JsonPrimitive)?.longOrNull ?: 0)
        }
        return Playlist(title, tracks, rows.size)
    }

    private fun JsonObject.obj(key: String) = this[key] as? JsonObject
    private fun JsonObject.string(key: String) =
        (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotBlank() }

    private const val MAX_PAGE_BYTES = 3_000_000L
}
