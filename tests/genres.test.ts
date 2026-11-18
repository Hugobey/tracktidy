import { describe, expect, it } from 'vitest';
import { inferGenreTags, parseGenreTags, settleGenre } from '../src/constants/genres.ts';

describe('genre tags', () => {
  it('splits delimited TCON values and keeps known phrases intact', () => {
    expect(parseGenreTags('Breaks;Electro;Electronic;House;Tech House')).toEqual([
      'Breaks',
      'Electro',
      'Electronic',
      'House',
      'Tech House',
    ]);
    expect(parseGenreTags('house, House / techno')).toEqual(['House', 'Techno']);
    expect(parseGenreTags('Disco / Nu-Disco')).toEqual(['Disco / Nu-Disco']);
    expect(parseGenreTags('Minimal / Deep Tech; Hip-Hop / R&B')).toEqual(['Minimal / Deep Tech', 'Hip-Hop / R&B']);
  });

  it('infers curated genres from local text and ignores lookalike words', () => {
    expect(inferGenreTags(['my tech house tune.mp3', '', ''])).toEqual(['Tech House']);
    expect(inferGenreTags(['warehouse-session.mp3'])).toEqual([]);
    expect(settleGenre('', { filename: 'late_night.mp3', album: 'Deep House Nights', comment: 'afro house edit' })).toBe(
      'Deep House;Afro House',
    );
    expect(settleGenre('Breaks;Electro', { filename: 'techno.mp3' })).toBe('Breaks;Electro');
  });
});