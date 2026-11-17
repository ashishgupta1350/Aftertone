package com.prism.music

import com.prism.music.data.model.ArtistRef
import com.prism.music.data.model.Song
import com.prism.music.data.stream.AlternateAudio
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AlternateAudioTest {
    private val song = Song("original", "Tum Hi Ho", listOf(ArtistRef("Arijit Singh")), durationSec = 262)

    @Test fun onlyTheMatchingRecordingIsProbed() = runBlocking {
        val requests = mutableListOf<String>()
        val fallback = fixture(
            saavn = listOf(
                saavnTrack("wrong-artist", "Tum Hi Ho", artist = "Arijit Singh Tribute"),
                saavnTrack("short", "Tum Hi Ho", duration = 30),
                saavnTrack("live", "Tum Hi Ho (Live)"),
                saavnTrack("restricted", "Tum Hi Ho", extra = ",\"rights\":\"Pro Only\""),
                saavnTrack("original", "Tum Hi Ho (From &quot;Aashiqui 2&quot;)"),
            ),
            requests = requests,
        )
        val stream = fallback.find(song)
        assertEquals("JioSaavn", stream?.source)
        assertEquals("streamed:alternate:saavn:original:160", stream?.cacheKey)
        assertEquals(listOf("saavn.sumit.co/api/search/songs", "aac.saavncdn.com/original.mp4"), requests)
    }

    @Test fun aRefusedStreamFallsThroughToAudius() = runBlocking {
        val requests = mutableListOf<String>()
        val fallback = fixture(
            saavn = listOf(saavnTrack("unavailable", "Tum Hi Ho")),
            audius = listOf(audiusTrack("gated", gated = true), audiusTrack("unverified", verified = false), audiusTrack("public")),
            requests = requests,
        )
        assertEquals("Audius", fallback.find(song)?.source)
        assertEquals(
            listOf("saavn.sumit.co/api/search/songs", "aac.saavncdn.com/unavailable.mp4",
                "api.audius.co/v1/tracks/search", "api.audius.co/v1/tracks/public/stream"),
            requests,
        )
    }

    @Test fun noMatchLeavesTheSongUnresolved() = runBlocking {
        val fallback = fixture(
            saavn = listOf(saavnTrack("different", "Chahun Main Ya Naa")),
            audius = listOf(audiusTrack("gated", gated = true)),
        )
        assertNull(fallback.find(song))
    }

    private fun fixture(
        saavn: List<String>, audius: List<String> = emptyList(), requests: MutableList<String> = mutableListOf(),
    ): AlternateAudio = AlternateAudio(OkHttpClient.Builder().addInterceptor { chain ->
        val request = chain.request()
        val host = request.url.host
        val path = request.url.encodedPath
        requests += host + path
        val response = Response.Builder().request(request).protocol(Protocol.HTTP_1_1).message("Fixture")
        when {
            host == "saavn.sumit.co" -> response.code(200).body("""{"data":{"results":[${saavn.joinToString(",")}]}}""".toResponseBody())
            path.endsWith("/search") -> response.code(200).body("""{"data":[${audius.joinToString(",")}]}""".toResponseBody())
            path == "/unavailable.mp4" -> response.code(403).body("".toResponseBody())
            else -> {
                assertEquals("bytes=0-0", request.header("Range"))
                response.code(206).header("Content-Type", "audio/mp4").body("".toResponseBody())
            }
        }
        response.build()
    }.build())

    private fun saavnTrack(id: String, title: String, artist: String = "Arijit Singh", duration: Int = 262, extra: String = "") =
        """{"id":"$id","name":"$title","type":"song","duration":$duration,
            "artists":{"primary":[{"name":"$artist"}]},
            "downloadUrl":[{"quality":"160kbps","url":"https://aac.saavncdn.com/$id.mp4"}]$extra}"""

    private fun audiusTrack(id: String, gated: Boolean = false, verified: Boolean = true) =
        """{"id":"$id","title":"Tum Hi Ho","duration":262,"user":{"name":"Arijit Singh","is_verified":$verified},
            "is_streamable":true,"is_available":true,"is_stream_gated":$gated}"""
}
