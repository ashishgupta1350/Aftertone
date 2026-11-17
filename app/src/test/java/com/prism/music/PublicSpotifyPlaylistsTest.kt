package com.prism.music

import com.prism.music.data.spotify.PublicSpotifyPlaylists
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PublicSpotifyPlaylistsTest {
    private val id = "AbCdEf0123456789GhIjKl"

    @Test fun acceptsOnlySpotifyPlaylistLinks() {
        val canonical = "https://open.spotify.com/playlist/$id"
        assertEquals(canonical, PublicSpotifyPlaylists.linkIn("Shared link: $canonical?si=hello."))
        assertEquals(canonical, PublicSpotifyPlaylists.linkIn("https://open.spotify.com/intl-en/embed/playlist/$id"))
        assertEquals(canonical, PublicSpotifyPlaylists.linkIn("spotify:playlist:$id"))
        assertEquals("https://spotify.link/abcd", PublicSpotifyPlaylists.linkIn("https://spotify.link/abcd"))
        assertNull(PublicSpotifyPlaylists.linkIn("https://open.spotify.com.evil.example/playlist/$id"))
        assertNull(PublicSpotifyPlaylists.linkIn("https://open.spotify.com/album/$id"))
    }

    @Test fun parsesMusicRowsInSourceOrder() {
        val html = """
            <script type="application/json" id="__NEXT_DATA__">
              {"props":{"pageProps":{"state":{"data":{"entity":{
                "type":"playlist","id":"$id","name":"Test playlist","trackList":[
                  {"uri":"spotify:track:0000000000000000000001","title":"Zulu","subtitle":"First artist","duration":192000},
                  {"uri":"spotify:episode:0000000000000000000002","title":"Podcast","subtitle":"Host"},
                  {"uri":"spotify:track:0000000000000000000003","title":"Alpha","subtitle":"Second artist","duration":246000}
                ]
              }}}}}}
            </script>
        """.trimIndent()
        val result = requireNotNull(PublicSpotifyPlaylists.parse(html, id))
        assertEquals("Test playlist", result.title)
        assertEquals(3, result.exposedCount)
        assertEquals(listOf("Zulu", "Alpha"), result.tracks.map { it.title })
        assertEquals(192000L, result.tracks.first().durationMs)
        assertNull(PublicSpotifyPlaylists.parse(html, "wrong"))
    }
}
