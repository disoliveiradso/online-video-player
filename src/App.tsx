import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Maximize, 
  Minimize, 
  PictureInPicture2, 
  Subtitles, 
  Upload, 
  Link as LinkIcon, 
  Info, 
  ArrowLeft, 
  MonitorPlay, 
  ExternalLink,
  CircleHelp
} from 'lucide-react';

// Declarar tipo para a API do YouTube
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function App() {
  // Estados de navegação
  const [isPlayingMode, setIsPlayingMode] = useState(false);
  const [videoSource, setVideoSource] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('Reprodutor de Vídeo');
  const [videoType, setVideoType] = useState<'local' | 'url' | 'youtube' | null>(null);
  
  // Inputs da Tela Inicial
  const [urlInput, setUrlInput] = useState('');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleUrlInput, setSubtitleUrlInput] = useState('');
  
  // Estados do Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMeetHelp, setShowMeetHelp] = useState(false);
  
  // Referências
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerId = 'yt-player-container';
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Detecta se o link é do YouTube e retorna o ID do vídeo
  const getYouTubeId = (url: string): string | null => {
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
  };

  // Helper: Converte links do Google Drive e Dropbox para links diretos de stream
  const resolveDirectVideoLink = (url: string): string => {
    let resolved = url.trim();
    
    // Google Drive
    // De: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // Para: https://docs.google.com/uc?export=download&id=FILE_ID
    if (resolved.includes('drive.google.com')) {
      const match = resolved.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://docs.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    
    // Dropbox
    // De: https://www.dropbox.com/s/FILE_ID/video.mp4?dl=0
    // Para: https://dl.dropboxusercontent.com/s/FILE_ID/video.mp4
    if (resolved.includes('dropbox.com')) {
      resolved = resolved.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      resolved = resolved.replace('?dl=0', '');
      resolved = resolved.replace('&dl=0', '');
      return resolved;
    }

    return resolved;
  };

  // Helper: Converter SRT para VTT (para suporte nativo a legendas)
  const convertSrtToVtt = (srtText: string): string => {
    let vttText = 'WEBVTT\n\n';
    // Substitui vírgulas de milissegundos por pontos no formato de tempo (ex: 00:00:10,230 -> 00:00:10.230)
    let formatted = srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    vttText += formatted;
    return vttText;
  };

  // Carregar script do YouTube dinamicamente
  const initYouTubeAPI = () => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    }
  };

  useEffect(() => {
    initYouTubeAPI();
  }, []);

  // Monitorar inatividade do mouse para esconder controles
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (isPlayingMode) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
    }
  }, [isPlayingMode, isPlaying]);

  // Efeito para carregar as legendas (local ou URL)
  useEffect(() => {
    if (!isPlayingMode) return;

    if (subtitleFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        let vttText = text;
        if (subtitleFile.name.endsWith('.srt')) {
          vttText = convertSrtToVtt(text);
        }
        const blob = new Blob([vttText], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        setSubtitleTrackUrl(url);
      };
      reader.readAsText(subtitleFile);
    } else if (subtitleUrlInput) {
      setSubtitleTrackUrl(subtitleUrlInput);
    }

    return () => {
      if (subtitleTrackUrl && subtitleTrackUrl.startsWith('blob:')) {
        URL.revokeObjectURL(subtitleTrackUrl);
      }
    };
  }, [isPlayingMode, subtitleFile, subtitleUrlInput]);

  // Carregar biblioteca HLS dinamicamente se necessário
  const loadHlsLibrary = (url: string, videoEl: HTMLVideoElement) => {
    if (url.includes('.m3u8')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.async = true;
      script.onload = () => {
        const Hls = (window as any).Hls;
        if (Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(videoEl);
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = url;
        }
      };
      document.body.appendChild(script);
    } else {
      videoEl.src = url;
    }
  };

  // Efeito principal de Inicialização do Player de acordo com o Tipo
  useEffect(() => {
    if (!isPlayingMode) return;

    if (videoType === 'youtube') {
      const ytId = getYouTubeId(videoSource);
      if (!ytId) return;

      const createPlayer = () => {
        ytPlayerRef.current = new window.YT.Player(ytContainerId, {
          videoId: ytId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(volume * 100);
              if (isMuted) event.target.mute();
              setDuration(event.target.getDuration());
              event.target.playVideo();
              setIsPlaying(true);
            },
            onStateChange: (event: any) => {
              // YT.PlayerState: PLAYING (1), PAUSED (2), ENDED (0), BUFFERING (3)
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                if (isLooping) {
                  event.target.playVideo();
                } else {
                  setIsPlaying(false);
                }
              }
            }
          }
        });
      };

      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
      }
    } else if (videoType === 'local' || videoType === 'url') {
      const videoEl = videoRef.current;
      if (videoEl) {
        loadHlsLibrary(videoSource, videoEl);
        videoEl.volume = volume;
        videoEl.muted = isMuted;
        videoEl.loop = isLooping;
        videoEl.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }

    // Intervalo para sincronizar tempo do vídeo
    const interval = setInterval(() => {
      if (videoType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        setCurrentTime(ytPlayerRef.current.getCurrentTime());
        setDuration(ytPlayerRef.current.getDuration() || 0);
      } else if ((videoType === 'local' || videoType === 'url') && videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        setDuration(videoRef.current.duration || 0);
      }
    }, 250);

    return () => {
      clearInterval(interval);
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [isPlayingMode, videoSource, videoType]);

  // Listener para Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingMode) return;
      
      // Evita atalhos se o usuário estiver digitando em algum campo (caso adicionemos inputs posteriores)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSkipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSkipForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(volume + 0.05, 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(volume - 0.05, 0));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyP':
          e.preventDefault();
          togglePictureInPicture();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayingMode, isPlaying, volume, isMuted, videoType, currentTime, duration]);

  // Ações do Player
  const togglePlay = () => {
    if (videoType === 'youtube' && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const handleSkipBackward = () => {
    // Voltar 10 segundos
    const newTime = Math.max(currentTime - 10, 0);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleSkipForward = () => {
    // Avançar 30 segundos
    const newTime = Math.min(currentTime + 30, duration);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handlePrevVideo = () => {
    // Voltar para o início (0s)
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(0, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setCurrentTime(0);
  };

  const handleNextVideo = () => {
    // Avançar para o final do vídeo (duration - 1s)
    const newTime = Math.max(duration - 1, 0);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const changeVolume = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(newVolume * 100);
      if (newVolume > 0) ytPlayerRef.current.unMute();
    } else if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoType === 'youtube' && ytPlayerRef.current) {
      if (nextMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume * 100);
      }
    } else if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const toggleLoop = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (videoRef.current) {
      videoRef.current.loop = nextLoop;
    }
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error(err));
    }
  };

  const togglePictureInPicture = async () => {
    if (videoType === 'youtube') {
      alert('Picture-in-Picture não é suportado pelo player do YouTube.');
      return;
    }
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (e) {
      console.error('Falha ao ativar Picture-in-Picture', e);
    }
  };

  // Formatar tempo em hh:mm:ss
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = Math.floor(timeInSeconds % 60);
    
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;

    if (hrs > 0) {
      const formattedHrs = hrs < 10 ? `0${hrs}` : hrs;
      return `${formattedHrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
  };

  // Ação ao enviar o vídeo na tela inicial
  const handleStartPlay = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setVideoSource(url);
      setVideoTitle(localFile.name);
      setVideoType('local');
      setIsPlayingMode(true);
    } else if (urlInput) {
      const isYt = getYouTubeId(urlInput);
      const resolvedUrl = resolveDirectVideoLink(urlInput);
      setVideoSource(resolvedUrl);
      setVideoTitle(isYt ? 'Vídeo do YouTube' : urlInput.split('/').pop() || 'Vídeo Online');
      setVideoType(isYt ? 'youtube' : 'url');
      setIsPlayingMode(true);
    }
  };

  // Voltar para a tela inicial e limpar estados de reprodução
  const handleBackToHome = () => {
    setIsPlayingMode(false);
    if (videoSource.startsWith('blob:')) {
      URL.revokeObjectURL(videoSource);
    }
    setVideoSource('');
    setVideoTitle('Reprodutor de Vídeo');
    setVideoType(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSubtitleTrackUrl('');
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden">
      
      {/* Elementos de decoração de fundo */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackToHome}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              MeetPlayer
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Premium Video</p>
          </div>
        </div>
        
        {/* Links ou Controles superiores */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowMeetHelp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold glass-input text-zinc-300 hover:text-white hover:border-orange-500/50 cursor-pointer"
          >
            <CircleHelp className="w-4 h-4 text-orange-400" />
            <span>Guia Google Meet</span>
          </button>
          
          <a 
            href="https://github.com/disoliveiradso/online-video-player"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-center z-10">
        {!isPlayingMode ? (
          /* TELA INICIAL */
          <div className="w-full max-w-2xl glass-panel rounded-3xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-3xl pointer-events-none"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                Reproduza qualquer vídeo online
              </h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
                Carregue um arquivo local de qualquer tamanho instantaneamente ou cole links direto no navegador, ideal para compartilhar áudio cristalino no Meet.
              </p>
            </div>

            <form onSubmit={handleStartPlay} className="space-y-6">
              
              {/* SEÇÃO DE ARQUIVO LOCAL */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Arquivo de Vídeo Local</label>
                <div 
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 relative ${
                    localFile 
                      ? 'border-orange-500 bg-orange-950/10' 
                      : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/20'
                  }`}
                  onClick={() => document.getElementById('local-video-file')?.click()}
                >
                  <input 
                    type="file" 
                    id="local-video-file" 
                    accept="video/*" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setLocalFile(e.target.files[0]);
                        setUrlInput(''); // limpa url se escolheu arquivo
                      }
                    }}
                  />
                  <Upload className={`w-8 h-8 mx-auto mb-3 ${localFile ? 'text-orange-500' : 'text-zinc-500'}`} />
                  {localFile ? (
                    <div>
                      <p className="text-sm font-semibold text-white truncate px-4">{localFile.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{(localFile.size / (1024 * 1024)).toFixed(1)} MB (Sem limite de tamanho)</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Escolha ou solte um arquivo de vídeo</p>
                      <p className="text-xs text-zinc-500 mt-1">MP4, WebM, MKV, AVI, etc. (Reprodução local imediata)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DIVISOR */}
              <div className="flex items-center justify-between text-zinc-600 text-xs font-bold uppercase py-2">
                <div className="h-[1px] bg-zinc-800 flex-1"></div>
                <span className="px-4">ou</span>
                <div className="h-[1px] bg-zinc-800 flex-1"></div>
              </div>

              {/* SEÇÃO DE LINK ONLINE */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Link do Vídeo na Web</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 h-5 text-zinc-500" />
                  </div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (e.target.value) setLocalFile(null); // limpa arquivo se colou URL
                    }}
                    placeholder="https://exemplo.com/filme.mp4 ou link do YouTube"
                    className="w-full pl-11 pr-4 py-3.5 text-sm rounded-2xl glass-input text-white font-medium"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Suporta arquivos diretos de nuvem (Google Drive, Dropbox) e links diretos HLS (.m3u8).
                </p>
              </div>

              {/* SEÇÃO DE LEGENDAS (OPCIONAL) */}
              <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Subtitles className="w-4.5 h-4.5 text-zinc-400" />
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Legendas / CC (Opcional)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Arquivo Local (.srt ou .vtt)</label>
                    <input 
                      type="file" 
                      accept=".srt,.vtt" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSubtitleFile(e.target.files[0]);
                          setSubtitleUrlInput('');
                        }
                      }}
                      className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Link da Legenda (.vtt)</label>
                    <input 
                      type="url" 
                      value={subtitleUrlInput}
                      onChange={(e) => {
                        setSubtitleUrlInput(e.target.value);
                        setSubtitleFile(null);
                      }}
                      placeholder="https://exemplo.com/legenda.vtt"
                      className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white"
                    />
                  </div>
                </div>
              </div>

              {/* BOTÃO SUBMIT */}
              <button
                type="submit"
                disabled={!localFile && !urlInput}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-600 hover:to-fuchsia-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-2xl shadow-xl shadow-orange-500/10 cursor-pointer hover:shadow-orange-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
              >
                Abrir Reprodutor
              </button>
            </form>
          </div>
        ) : (
          /* TELA DO VIDEO PLAYER */
          <div 
            ref={playerContainerRef}
            className={`w-full max-w-5xl rounded-3xl overflow-hidden glass-panel relative shadow-2xl flex flex-col group/container ${
              isFullscreen ? 'h-screen w-screen max-w-none rounded-none' : 'aspect-video'
            }`}
          >
            {/* CONTAINER DE REPRODUÇÃO */}
            <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
              
              {/* Caso de vídeo do YouTube */}
              {videoType === 'youtube' && (
                <div className="w-full h-full pointer-events-none select-none">
                  <div id={ytContainerId} className="w-full h-full"></div>
                </div>
              )}

              {/* Caso de vídeo Local ou URL */}
              {(videoType === 'local' || videoType === 'url') && (
                <video
                  ref={videoRef}
                  onClick={togglePlay}
                  className="w-full h-full object-contain"
                  playsInline
                >
                  <source src={videoSource} />
                  {subtitleTrackUrl && (
                    <track 
                      src={subtitleTrackUrl} 
                      kind="subtitles" 
                      srcLang="pt" 
                      label="Português" 
                      default 
                    />
                  )}
                </video>
              )}

              {/* Overlay de carregamento/buffer fictício ou click do mouse */}
              <div 
                className="absolute inset-0 cursor-pointer"
                onClick={togglePlay}
              ></div>

              {/* GUIA DE DICA DO GOOGLE MEET INTEGRADO (Apenas se o vídeo estiver pausado ou no hover) */}
              <div className={`absolute top-6 left-6 transition-all duration-300 z-20 ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMeetHelp(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-950/80 text-orange-400 border border-orange-500/30 hover:bg-zinc-900 cursor-pointer"
                >
                  <CircleHelp className="w-3.5 h-3.5" />
                  <span>Transmitindo no Meet?</span>
                </button>
              </div>

              {/* BOTÃO VOLTAR SUPERIOR */}
              <div className={`absolute top-6 right-6 transition-all duration-300 z-20 ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBackToHome();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-950/80 hover:bg-zinc-900 text-white border border-zinc-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>

              {/* LEGENDA NO YOUTUBE (Renderização customizada se for srt e estiver no youtube) */}
              {videoType === 'youtube' && subtitleTrackUrl && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg text-white text-base md:text-lg text-center max-w-2xl pointer-events-none">
                  {/* Nota: Para o YouTube Iframe no MeetPlayer, as legendas integradas via tracks requerem parser.
                      Indicamos a exibição no console ou via Track nativo. Se for arquivo .srt local com player html5 funciona perfeitamente. */}
                  Legendas disponíveis no painel.
                </div>
              )}
            </div>

            {/* CONTROLES PERSONALIZADOS (Igual ao da imagem, sem os 3 pontinhos) */}
            <div className={`w-full bg-gradient-to-t from-zinc-950/95 via-zinc-950/90 to-zinc-950/0 px-6 pb-6 pt-10 absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 flex flex-col gap-4 select-none ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()} // impede pausar clicando na barra
            >
              
              {/* TIMELINE (Barra de Progresso) */}
              <div className="w-full flex items-center gap-3 timeline-container">
                <span className="text-[11px] font-medium text-zinc-400 font-mono min-w-[50px] text-left">
                  {formatTime(currentTime)}
                </span>
                
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleTimelineChange}
                  className="timeline-range flex-1"
                />
                
                <span className="text-[11px] font-medium text-zinc-400 font-mono min-w-[50px] text-right">
                  {formatTime(duration)}
                </span>
              </div>

              {/* BARRA DE CONTROLES INFERIORES */}
              <div className="w-full flex items-center justify-between">
                
                {/* LADO ESQUERDO: Título do Vídeo */}
                <div className="max-w-[30%] truncate">
                  <h3 className="text-sm font-bold text-white tracking-wide truncate" title={videoTitle}>
                    {videoTitle}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium">MeetPlayer Premium</p>
                </div>

                {/* CENTRO: Controles de Reprodução (Igual à imagem) */}
                <div className="flex items-center gap-4">
                  {/* Botão 1: Alternar Ordem / Modo Aleatório (Setas cruzadas com um traço/slash) */}
                  <button 
                    onClick={toggleShuffle}
                    className={`tooltip relative p-2 rounded-lg transition-colors cursor-pointer ${
                      isShuffle ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    data-tooltip={isShuffle ? "Modo Aleatório Ligado" : "Modo Aleatório Desligado"}
                  >
                    <div className="relative">
                      <Shuffle className="w-4 h-4" />
                      {!isShuffle && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-[18px] h-[1.5px] bg-zinc-500 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Botão 2: Voltar ao início / Anterior (|<) */}
                  <button 
                    onClick={handlePrevVideo}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Voltar ao Início"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  {/* Botão 3: Voltar 10 segundos */}
                  <button 
                    onClick={handleSkipBackward}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer flex flex-col items-center justify-center relative"
                    title="Voltar 10s"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-[7px] font-bold absolute top-[11px] text-zinc-300">10</span>
                  </button>

                  {/* Botão 4: Play/Pause Centralizado (Círculo destacado com gradiente de borda) */}
                  <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full flex items-center justify-center play-btn-gradient-border text-white shadow-xl cursor-pointer"
                    title={isPlaying ? "Pausar" : "Reproduzir"}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white translate-x-[1.5px]" />
                    )}
                  </button>

                  {/* Botão 5: Avançar 30 segundos */}
                  <button 
                    onClick={handleSkipForward}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer flex flex-col items-center justify-center relative"
                    title="Avançar 30s"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span className="text-[7px] font-bold absolute top-[11px] text-zinc-300">30</span>
                  </button>

                  {/* Botão 6: Avançar para o final / Próximo (>|) */}
                  <button 
                    onClick={handleNextVideo}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Avançar para o Final"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  {/* Botão 7: Repetir / Loop (Loop com slash de desativado) */}
                  <button 
                    onClick={toggleLoop}
                    className={`tooltip relative p-2 rounded-lg transition-colors cursor-pointer ${
                      isLooping ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    data-tooltip={isLooping ? "Repetir Vídeo Ligado" : "Repetir Vídeo Desligado"}
                  >
                    <div className="relative">
                      <Repeat className="w-4 h-4" />
                      {!isLooping && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-[18px] h-[1.5px] bg-zinc-500 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* LADO DIREITO: CC, Volume, Fullscreen, PiP (Sem os 3 pontinhos) */}
                <div className="flex items-center gap-3">
                  
                  {/* Botão 8: Legendas / CC */}
                  <button 
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      subtitleTrackUrl ? 'text-orange-400' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Status das Legendas"
                    onClick={() => {
                      if (!subtitleTrackUrl) {
                        alert("Nenhum arquivo de legenda foi carregado. Você pode carregar arquivos SRT ou VTT na página inicial.");
                      } else {
                        // Toggles track
                        if (videoRef.current && videoRef.current.textTracks[0]) {
                          const mode = videoRef.current.textTracks[0].mode;
                          videoRef.current.textTracks[0].mode = mode === 'showing' ? 'hidden' : 'showing';
                          alert(`Legenda alternada para: ${mode === 'showing' ? 'Oculta' : 'Visível'}`);
                        }
                      }
                    }}
                  >
                    <Subtitles className="w-4.5 h-4.5" />
                  </button>

                  {/* Botão 9: Volume com controle deslizante */}
                  <div className="flex items-center gap-2 group/volume">
                    <button 
                      onClick={toggleMute}
                      className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Mudo (M)"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4.5 h-4.5 text-zinc-500" />
                      ) : volume > 0.5 ? (
                        <Volume2 className="w-4.5 h-4.5" />
                      ) : (
                        <Volume1 className="w-4.5 h-4.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="volume-range w-0 group-hover/volume:w-16 focus:w-16 transition-all duration-300 origin-left"
                    />
                  </div>

                  {/* Botão 10: Picture-in-Picture */}
                  <button 
                    onClick={togglePictureInPicture}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Picture-in-Picture (P)"
                  >
                    <PictureInPicture2 className="w-4.5 h-4.5" />
                  </button>

                  {/* Botão 11: Tela Cheia (Fullscreen) */}
                  <button 
                    onClick={toggleFullscreen}
                    className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Tela Cheia (F)"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4.5 h-4.5" />
                    ) : (
                      <Maximize className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DO GUIA DO GOOGLE MEET */}
      {showMeetHelp && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowMeetHelp(false)}
        >
          <div 
            className="w-full max-w-lg glass-panel rounded-3xl p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-500/30 flex items-center justify-center">
                <MonitorPlay className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Transmissão Perfeita no Google Meet</h3>
                <p className="text-xs text-zinc-400">Como compartilhar som e vídeo com alta fluidez</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">1</div>
                <p>No Google Meet, clique no botão de <strong>Apresentar agora</strong> (ícone de tela com seta).</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">2</div>
                <p>Escolha a opção de <strong>Uma guia do Chrome</strong> (esta é a única opção que otimiza vídeo e áudio nativamente).</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">3</div>
                <p>Selecione a guia correspondente ao <strong>MeetPlayer</strong> na lista.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">4</div>
                <p><strong>IMPORTANTE:</strong> Certifique-se de que a caixinha <strong>"Compartilhar áudio da guia"</strong> na parte inferior esquerda esteja marcada.</p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setShowMeetHelp(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-600 hover:to-fuchsia-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-zinc-600 border-t border-zinc-900/50 z-10">
        <p>&copy; {new Date().getFullYear()} MeetPlayer. Desenvolvido com amor pelo Google.</p>
        <p className="mt-1">Pressione <kbd className="bg-zinc-900 px-1 py-0.5 rounded text-[10px]">Espaço</kbd> para Play/Pause e as setas para ajustar tempo e volume.</p>
      </footer>
    </div>
  );
}
