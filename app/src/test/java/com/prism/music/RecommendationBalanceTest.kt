package com.prism.music

import com.prism.music.data.foryou.EnglishSongHints
import com.prism.music.data.foryou.withRegularPicks
import com.prism.music.data.model.ArtistRef
import com.prism.music.data.model.Song
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RecommendationBalanceTest {
    @Test fun englishEvidenceAlsoHelpsWithShortTitlesFromASavedArtist() {
        val hints = EnglishSongHints(listOf(
            song("1", "I Can't Feel My Face", "Saved artist"),
            song("2", "Don't Forget Your Love", "Saved artist"),
            song("3", "Dawn", "Saved artist"),
            song("4", "Tum Se", "Another artist"),
        ))
        assertTrue(hints.matches(song("5", "Breathe", "Saved artist")))
        assertTrue(hints.matches(song("6", "Somewhere Only We Know", "New artist")))
        assertFalse(hints.matches(song("7", "Tum Hi Ho (Love Mix)", "Saved artist")))
        assertFalse(hints.matches(song("8", "तुम से", "Saved artist")))
        assertFalse(hints.matches(song("9", "Sahiba", "Another artist")))
    }

    @Test fun aLowerRankedPoolGetsRegularTurnsWithoutDuplicates() {
        val ranked = listOf("a", "b", "c", "d", "e", "f", "g")
        assertEquals(
            listOf("a", "f", "b", "c", "g", "d", "e"),
            withRegularPicks(ranked, listOf("f", "g"), every = 3, firstAt = 1),
        )
        assertEquals(ranked, withRegularPicks(ranked, emptyList(), every = 3, firstAt = 1))
    }

    private fun song(id: String, title: String, artist: String) = Song(id, title, listOf(ArtistRef(artist)))
}
