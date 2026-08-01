/**

 * Playlist romântica — edite aqui para adicionar músicas.

 * Coloque os arquivos .mp3 em assets/

 */

(function (global) {

  'use strict';



  const TRACKS = [

    {

      id: 'nuestra-cancion',

      title: 'Nuestra canción',

      subtitle: '♪ Nuestra canción',

      src: 'assets/nuestra-cancion.mp3',

      quote: '"Cada vez que esta canción suena, me recuerda a ti." 🍫🍒❤️',

    },

    {

      id: 'espresso',

      title: 'Espresso',

      subtitle: '♪ Espresso',

      src: 'assets/Espresso.mp3',

      quote: '"Contigo, cada momento sabe a espresso: intenso y dulce." ☕💕',

    },

    {

      id: 'el-vino-de-tu-boca',

      title: 'El vino de tu boca',

      subtitle: '♪ El vino de tu boca',

      src: 'assets/El%20vino%20de%20tu%20boca.mp3',

      quote: '"Tu voz es la melodía que más me gusta escuchar." 🍷💋',

    },

    {

      id: 'when-i-was-your-man',

      title: 'When I Was Your Man',

      subtitle: '♪ When I Was Your Man',

      src: 'assets/When%20I%20Was%20Your%20Man.mp3',

      quote: '"Cada nota me recuerda lo afortunado que soy de tenerte ahora." 🎹💕',

    },

    {

      id: 'arena-y-sal',

      title: 'Arena y Sal',

      subtitle: '♪ Arena y Sal',

      src: 'assets/Arena%20y%20Sal.mp3',

      quote: '"Contigo hasta el mar y más allá." 🌊❤️',

    },

    {

      id: 'no-era-amor',

      title: 'No Era Amor',

      subtitle: '♪ No Era Amor',

      src: 'assets/No%20Era%20Amor.mp3',

      quote: '"Lo nuestro es más que una canción: es real." 💫',

    },

    {

      id: 'la-bachata',

      title: 'La Bachata',

      subtitle: '♪ La Bachata',

      src: 'assets/La%20Bachata.mp3',

      quote: '"Bailar contigo es mi lugar favorito del mundo." 💃🕺',

    },

    {

      id: 'eres-mia',

      title: 'Eres Mía',

      subtitle: '♪ Eres Mía',

      src: 'assets/Eres%20M%C3%ADa.mp3',

      quote: '"Eres mía, y yo soy tuyo. Para siempre." 💕',

    },

    {

      id: 'enchanted',

      title: 'Enchanted',

      subtitle: '♪ Enchanted',

      src: 'assets/Enchanted.mp3',

      quote: '"Desde el primer instante, fuiste encantadora." ✨',

    },

    {

      id: 'si-antes-te-hubiera-conocido',

      title: 'Si Antes Te Hubiera Conocido',

      subtitle: '♪ Si Antes Te Hubiera Conocido',

      src: 'assets/Si%20Antes%20Te%20Hubiera%20Conocido.mp3',

      quote: '"Contigo el tiempo siempre fue el momento perfecto." 🍒',

    },

    {

      id: 'sou-favela',

      title: 'Sou Favela',

      subtitle: '♪ Sou Favela',

      src: 'assets/Sou%20Favela.mp3',

      quote: '"Contigo, cada rincón del mundo se siente como hogar." 🎶❤️',

    },

    {

      id: 'no-es-mi-culpa-1',

      title: 'No Es Mi Culpa 1',

      subtitle: '♪ No Es Mi Culpa 1',

      src: 'assets/No%20Es%20Mi%20Culpa%201.mp3',

      quote: '"Contigo no hay culpa, solo ganas de bailar." 💃❤️',

    },

    {

      id: 'no-es-mi-culpa-2',

      title: 'No Es Mi Culpa 2',

      subtitle: '♪ No Es Mi Culpa 2',

      src: 'assets/No%20Es%20Mi%20Culpa%202.mp3',

      quote: '"Otra vez esta canción… y otra vez pienso en ti." 🎶💕',

    },

    {

      id: 'ivonny-bonita',

      title: 'Ivonny Bonita',

      subtitle: '♪ Ivonny Bonita',

      src: 'assets/Ivonny%20Bonita.mp3',

      quote: '"Bonita como tú, mi Ivonny." 🍒✨',

    },

  ];



  const byId = Object.fromEntries(TRACKS.map((t) => [t.id, t]));



  const MusicPlaylist = {

    tracks: TRACKS,

    defaultId: TRACKS[0]?.id || '',



    get(id) {

      return byId[id] || null;

    },



    indexOf(id) {

      for (let i = 0; i < TRACKS.length; i++) {

        if (TRACKS[i].id === id) return i;

      }

      return 0;

    },



    next(id) {

      const i = this.indexOf(id);

      return TRACKS[(i + 1) % TRACKS.length];

    },



    prev(id) {

      const i = this.indexOf(id);

      return TRACKS[(i - 1 + TRACKS.length) % TRACKS.length];

    },

  };



  global.MusicPlaylist = MusicPlaylist;

})(typeof window !== 'undefined' ? window : globalThis);


