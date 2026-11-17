package com.prism.music

import com.prism.music.data.SyncedLibrary
import com.prism.music.data.SyncedLike
import com.prism.music.data.SyncedPlay
import com.prism.music.data.SyncedPlaylist
import com.prism.music.data.mergeLibrary
import com.prism.music.data.model.Song
import org.junit.Assert.assertEquals
import org.junit.Test

class AftertoneSyncTest {
    private val first = Song("aaaaaaaaaaa", "First")
    private val second = Song("bbbbbbbbbbb", "Second")
    private val third = Song("ccccccccccc", "Third")

    @Test fun firstSyncKeepsBothLibrariesAndTheirOrders() {
        val android = SyncedLibrary(likes = listOf(SyncedLike(second, 3), SyncedLike(first, 2)))
        val web = SyncedLibrary(
            likes = listOf(SyncedLike(third, 1)),
            playlists = listOf(SyncedPlaylist("prism:web", "Web playlist", listOf(third, first))),
        )
        val merged = mergeLibrary(SyncedLibrary(), android, web)
        assertEquals(listOf(second, first, third), merged.likes.map { it.song })
        assertEquals(listOf(third, first), merged.playlists.single().songs)
    }

    @Test fun changesFromBothDevicesAreMerged() {
        val original = SyncedLibrary(
            likes = listOf(SyncedLike(first, 3)),
            playlists = listOf(SyncedPlaylist("prism:shared", "Original", listOf(first))),
        )
        val android = original.copy(
            likes = emptyList(),
            playlists = listOf(original.playlists.single().copy(songs = listOf(first, second))),
            plays = listOf(SyncedPlay(first, 10, 25000)),
        )
        val web = original.copy(
            likes = listOf(SyncedLike(first, 3), SyncedLike(third, 6)),
            playlists = listOf(original.playlists.single().copy(name = "Renamed", songs = listOf(first, third))),
            plays = listOf(SyncedPlay(first, 10, 40000), SyncedPlay(third, 12, 30000)),
        )
        val merged = mergeLibrary(original, android, web)
        assertEquals(listOf(third), merged.likes.map { it.song })
        assertEquals("Renamed", merged.playlists.single().name)
        assertEquals(listOf(first, second, third), merged.playlists.single().songs)
        assertEquals(listOf(30000L, 40000L), merged.plays.map { it.ms })
    }
}
