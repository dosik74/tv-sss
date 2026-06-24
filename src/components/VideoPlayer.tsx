import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  List,
  X
} from 'lucide-react';
import { fetchPlayUrl, fetchTranslationOptions, KodikTranslationOption, fetchEpisodes } from '../api/kodik';

interface Episode {
  number: number;
  title: string;
  duration?: string;
  watched: boolean;
  progress?: number;
}

interface VideoPlayerProps {
  id: string;
  idType: string;
  title: string;
  initialEpisode?: number;
  episodesTotal?: number;
  onClose?: () => void;
}

interface PlayerSettings {
  quality?: number;
  speed: number;
  selectedTranslation?: string;
  audioTrack?: number;
  subtitles?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  id,
  idType,
  title,
  initialEpisode = 1,
  episodesTotal = 1,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [translations, setTranslations] = useState<KodikTranslationOption[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<string>('0');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    speed: 1,
    selectedTranslation: '0'
  });
  
  const hls = useRef<Hls | null>(null);
  const savedPositions = useRef<Record<number, number>>({});

  // Загрузка озвучек
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const trans = await fetchTranslationOptions({ id, idType });
        setTranslations(trans);
        if (trans.length > 0) {
          setSelectedTranslation(trans[0].id);
          setPlayerSettings(prev => ({ ...prev, selectedTranslation: trans[0].id }));
        }
      } catch (err) {
        console.error('Ошибка загрузки озвучек:', err);
      }
    };
    loadTranslations();
  }, [id, idType]);

  // Загрузка серий
  useEffect(() => {
    const loadEpisodes = async () => {
      try {
        setLoading(true);
        const eps = await fetchEpisodes({ id, idType });
        const processedEpisodes: Episode[] = Array.from({ length: episodesTotal || 1 }, (_, i) => ({
          number: i + 1,
          title: eps[i]?.title || `Серия ${i + 1}`,
          duration: eps[i]?.duration,
          watched: false,
          progress: savedPositions.current[i + 1] || 0
        }));
        setEpisodes(processedEpisodes);
      } catch (err) {
        console.error('Ошибка загрузки серий:', err);
        // Генерируем серии по количеству
        const processedEpisodes: Episode[] = Array.from({ length: episodesTotal || 1 }, (_, i) => ({
          number: i + 1,
          title: `Серия ${i + 1}`,
          watched: false,
          progress: savedPositions.current[i + 1] || 0
        }));
        setEpisodes(processedEpisodes);
      } finally {
        setLoading(false);
      }
    };
    loadEpisodes();
  }, [id, idType, episodesTotal]);

  // Загрузка видео
  const loadEpisodeVideo = useCallback(async (episodeNum: number) => {
    try {
      setError(null);
      setLoading(true);
      
      const playData = await fetchPlayUrl({
        id,
        idType,
        seriaNum: episodeNum - 1,
        translationId: selectedTranslation
      });

      if (!playData.m3u8_url) {
        throw new Error('URL видео не получен');
      }

      if (!videoRef.current) return;

      // Destroy previous HLS instance and reset video source
      if (hls.current) {
        hls.current.destroy();
        hls.current = null;
      }
      videoRef.current.src = '';

      // Load HLS stream
      if (Hls.isSupported()) {
        hls.current = new Hls();

        hls.current.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('HLS media attached');
        });

        hls.current.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed');
          if (videoRef.current) {
            videoRef.current.load();
            if (isPlaying) {
              videoRef.current.play().catch(() => {});
            }
          }
          setLoading(false);
        });

        hls.current.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          if (data.fatal) {
            setError('Ошибка воспроизведения видео');
            setLoading(false);
          }
        });

        hls.current.loadSource(playData.m3u8_url);
        hls.current.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = playData.m3u8_url;
        videoRef.current.load();
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        }
        setLoading(false);
      } else {
        throw new Error('HLS не поддерживается в этом браузере');
      }

      setCurrentEpisode(episodeNum);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при загрузке видео';
      setError(message);
      setLoading(false);
    }
  }, [id, idType, selectedTranslation, isPlaying]);

  // Первая загрузка видео
  useEffect(() => {
    loadEpisodeVideo(currentEpisode);
  }, []);

  // Обработка выбора озвучки
  const handleTranslationChange = (translationId: string) => {
    setSelectedTranslation(translationId);
    setPlayerSettings(prev => ({ ...prev, selectedTranslation: translationId }));
    loadEpisodeVideo(currentEpisode);
  };

  // Обработка выбора серии
  const handleSelectEpisode = (episodeNum: number) => {
    if (currentTime > 10 && videoRef.current) {
      savedPositions.current[currentEpisode] = videoRef.current.currentTime;
    }
    loadEpisodeVideo(episodeNum);
    setShowEpisodes(false);
  };

  // Управление плеером
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => console.error(err));
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setPlayerSettings(prev => ({ ...prev, speed }));
    setShowSettings(false);
  };

  const handlePreviousEpisode = () => {
    if (currentEpisode > 1) {
      handleSelectEpisode(currentEpisode - 1);
    }
  };

  const handleNextEpisode = () => {
    if (currentEpisode < (episodesTotal || 1)) {
      handleSelectEpisode(currentEpisode + 1);
    }
  };

  // Обработчики событий видео
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (currentEpisode < (episodesTotal || 1)) {
      setTimeout(() => handleNextEpisode(), 2000);
    }
  };

  // Управление видимостью контролов
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    const timeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
    setControlsTimeout(timeout);
  }, [controlsTimeout, isPlaying]);

  // Клавиатурные сокращения
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          handleSkip(10);
          break;
        case 'ArrowLeft':
          handleSkip(-10);
          break;
        case 'ArrowUp':
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyN':
          handleNextEpisode();
          break;
        case 'KeyP':
          handlePreviousEpisode();
          break;
        case 'Escape':
          setShowSettings(false);
          setShowEpisodes(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [currentEpisode, isPlaying, isMuted, duration]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}
      onMouseMove={showControlsTemporarily}
    >
      {/* Видео */}
      <video
        ref={videoRef}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={togglePlay}
        crossOrigin="anonymous"
      />

      {/* Загрузка */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75">
          <div className="text-center">
            <p className="text-red-500 text-lg mb-4">{error}</p>
            <button
              onClick={() => loadEpisodeVideo(currentEpisode)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
            >
              Повторить
            </button>
          </div>
        </div>
      )}

      {/* Контролы */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Экран для кликов */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Заголовок */}
        <div className="absolute top-0 left-0 right-0 p-4 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-sm text-gray-300">Серия {currentEpisode}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        {/* Центр плеера */}
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          <button
            onClick={handlePreviousEpisode}
            disabled={currentEpisode <= 1}
            className="p-3 hover:bg-white/20 rounded-full disabled:opacity-30 transition"
          >
            <SkipBack size={32} className="text-white" />
          </button>

          <button
            onClick={togglePlay}
            className="p-4 bg-white/30 hover:bg-white/40 rounded-full transition"
          >
            {isPlaying ? (
              <Pause size={48} className="text-white fill-white" />
            ) : (
              <Play size={48} className="text-white fill-white" />
            )}
          </button>

          <button
            onClick={handleNextEpisode}
            disabled={currentEpisode >= (episodesTotal || 1)}
            className="p-3 hover:bg-white/20 rounded-full disabled:opacity-30 transition"
          >
            <SkipForward size={32} className="text-white" />
          </button>
        </div>

        {/* Прогресс-бар */}
        <div className="absolute bottom-20 left-0 right-0 px-4 group">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/30 rounded cursor-pointer group-hover:h-2 transition-all accent-red-600"
          />
          <div className="flex justify-between text-xs text-white mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Контрольные кнопки */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/20 rounded transition"
            >
              {isPlaying ? (
                <Pause size={20} className="text-white" />
              ) : (
                <Play size={20} className="text-white fill-white" />
              )}
            </button>

            <div className="flex items-center gap-2 group">
              <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded transition">
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} className="text-white" />
                ) : (
                  <Volume2 size={20} className="text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover:w-20 transition-all h-1 bg-white/30 rounded cursor-pointer accent-red-600"
              />
            </div>

            <span className="text-white text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Озвучка */}
            {translations.length > 0 && (
              <div className="relative group">
                <button className="p-2 hover:bg-white/20 rounded transition text-white text-sm">
                  {translations.find(t => t.id === selectedTranslation)?.name || 'Озвучка'}
                </button>
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-gray-900 rounded-lg shadow-lg z-50">
                  {translations.map(trans => (
                    <button
                      key={trans.id}
                      onClick={() => handleTranslationChange(trans.id)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        selectedTranslation === trans.id
                          ? 'bg-red-600 text-white'
                          : 'text-white hover:bg-gray-800'
                      }`}
                    >
                      {trans.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Серии */}
            <button
              onClick={() => setShowEpisodes(!showEpisodes)}
              className="p-2 hover:bg-white/20 rounded transition text-white"
            >
              <List size={20} />
            </button>

            {/* Настройки */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/20 rounded transition text-white"
            >
              <Settings size={20} />
            </button>

            {/* Полноэкран */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded transition text-white"
            >
              {isFullscreen ? (
                <Minimize size={20} />
              ) : (
                <Maximize size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Панель серий */}
      {showEpisodes && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 overflow-y-auto z-40">
          <div className="sticky top-0 p-4 bg-gray-900 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold">Серии</h3>
              <button
                onClick={() => setShowEpisodes(false)}
                className="p-1 hover:bg-gray-800 rounded transition text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {episodes.map(ep => (
              <button
                key={ep.number}
                onClick={() => handleSelectEpisode(ep.number)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  currentEpisode === ep.number
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">Серия {ep.number}</div>
                <div className="text-xs text-gray-400">{ep.title}</div>
                {ep.progress !== undefined && ep.progress > 0 && (
                  <div className="mt-2 w-full bg-gray-600 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(ep.progress / (duration || 1)) * 100}%` }}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Панель настроек */}
      {showSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 overflow-y-auto z-40">
          <div className="sticky top-0 p-4 bg-gray-900 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold">Настройки</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-800 rounded transition text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-white font-medium mb-2">Скорость воспроизведения</h4>
              <div className="space-y-2">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`w-full py-2 rounded transition ${
                      playerSettings.speed === speed
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
