import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  GraduationCap,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  Volume2,
  Maximize2,
  Minimize2,
  X,
  ExternalLink
} from 'lucide-react';

interface Lesson {
  id: number;
  title: string;
  subtitle: string;
  duration: string;
  embedUrl?: string;
  driveUrl?: string;
  category: string;
  description: string;
  topics: string[];
}

interface MembersAreaViewProps {
  onBack: () => void;
}

const LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'Aula 1: Mentalidade & Visão do Negócio',
    subtitle: 'Desenvolvendo a mentalidade certa para obter resultados consistentes',
    duration: 'Vídeo HD',
    embedUrl: 'https://drive.google.com/file/d/1woOGCGC6--uMlMR-J9GQszkiHCU7rSuu/preview',
    driveUrl: 'https://drive.google.com/file/d/1woOGCGC6--uMlMR-J9GQszkiHCU7rSuu/view',
    category: 'Mentalidade',
    description: 'Nesta aula fundamental você vai aprender sobre a mentalidade necessária para construir um negócio digital sustentável, lidando com foco, constância e visão de longo prazo.',
    topics: [
      'Alinhamento de expectativas e mentalidade empreendedora',
      'Como manter foco nos resultados e evitar distrações',
      'Visão estratégica de posicionamento no mercado',
      'Erros comuns que iniciantes devem evitar'
    ]
  },
  {
    id: 2,
    title: 'Aula 2: Fundamentos e Feeling - Como Encontrar Influenciadoras',
    subtitle: 'Conceitos essenciais, intuição de mercado e garimpo de influenciadoras',
    duration: 'Vídeo HD',
    embedUrl: 'https://drive.google.com/file/d/1xREVHwglK5-rXHfRJbU3YfsK_0qrvmAa/preview',
    driveUrl: 'https://drive.google.com/file/d/1xREVHwglK5-rXHfRJbU3YfsK_0qrvmAa/view',
    category: 'Prospecção',
    description: 'Entenda os fundamentos e desenvolva o feeling prático para encontrar as melhores influenciadoras no Instagram e TikTok com público engajado e perfil ideal para conversão.',
    topics: [
      'Fundamentos para identificar perfis de alto potencial',
      'Como desenvolver o feeling de análise de público e engajamento',
      'Técnicas de garimpo e busca de influenciadoras nas redes sociais',
      'Sinais de alerta: como identificar seguidores falsos e baixo engajamento'
    ]
  },
  {
    id: 3,
    title: 'Aula 3: Qualificando e Abordando Influenciadoras',
    subtitle: 'Como prospectar, abordar e fechar parcerias de alto impacto',
    duration: 'Vídeo HD',
    embedUrl: 'https://drive.google.com/file/d/1LFNajWbU25g28n73Gf4PghIY4uy_7_Cm/preview',
    driveUrl: 'https://drive.google.com/file/d/1LFNajWbU25g28n73Gf4PghIY4uy_7_Cm/view?usp=sharing',
    category: 'Prospecção',
    description: 'Aprenda o método testado para identificar influenciadoras com público engajado, estruturar abordagens profissionais e negociar parcerias altamente lucrativas.',
    topics: [
      'Como analisar métricas reais de influenciadoras (engajamento x seguidores)',
      'Roteiros de abordagem direta por Direct/WhatsApp',
      'Modelos de parceria e negociação de valores/comissões',
      'Como alinhar a divulgação e garantir o máximo retorno'
    ]
  },
  {
    id: 4,
    title: 'Aula 4: Fixo ou Porcentagem?',
    subtitle: 'Como escolher o melhor modelo de negociação e remuneração',
    duration: 'Vídeo HD',
    embedUrl: 'https://drive.google.com/file/d/1xFmlUsVF4sbzFxPkQ-F_Q2Pj1eWfMefS/preview',
    driveUrl: 'https://drive.google.com/file/d/1xFmlUsVF4sbzFxPkQ-F_Q2Pj1eWfMefS/view?usp=drive_link',
    category: 'Negociação',
    description: 'Entenda quando vale a pena pagar um valor fixo, quando utilizar comissão por porcentagem ou combinar ambos os modelos para maximizar a lucratividade das suas parcerias.',
    topics: [
      'Vantagens e desvantagens do pagamento com valor Fixo',
      'Como estruturar acordos por Porcentagem / Comissão',
      'Modelos híbridos de negociação (Fixo + Porcentagem)',
      'Como calcular o retorno esperado sobre o investimento (ROI)'
    ]
  },
  {
    id: 5,
    title: 'Aula 5: Feeling de Fechamento',
    subtitle: 'Técnicas finais para fechar parcerias com segurança e agilidade',
    duration: 'Vídeo HD',
    embedUrl: 'https://drive.google.com/file/d/1FcaWZluhL4j6_F-H2NRB3ucQQb7Y7Mz2/preview',
    driveUrl: 'https://drive.google.com/file/d/1FcaWZluhL4j6_F-H2NRB3ucQQb7Y7Mz2/view?usp=sharing',
    category: 'Fechamento',
    description: 'Desenvolva o feeling necessário para conduzir a conversa até a assinatura do acordo ou confirmação da parceria, tirando dúvidas da influenciadora e garantindo o alinhamento total.',
    topics: [
      'Como identificar os sinais de interesse no momento do fechamento',
      'Quebra de objeções frequentes das influenciadoras',
      'Organização e alinhamento de prazos de postagem e material',
      'Checklist final antes de liberar a campanha'
    ]
  }
];

export const MembersAreaView: React.FC<MembersAreaViewProps> = ({ onBack }) => {
  const playerContainerRef = React.useRef<HTMLDivElement>(null);
  const [activeLessonId, setActiveLessonId] = useState<number>(1);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false);
  const [completedLessons, setCompletedLessons] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('members_completed_lessons');
      return saved ? JSON.parse(saved) : [1];
    } catch {
      return [1];
    }
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(35);

  const handleFullscreen = async () => {
    setIsFullscreenModalOpen(true);

    if (playerContainerRef.current) {
      try {
        const elem = playerContainerRef.current as any;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }

        if (window.screen && window.screen.orientation && 'lock' in window.screen.orientation) {
          try {
            await (window.screen.orientation as any).lock('landscape');
          } catch {
            // Ignore if device doesn't support orientation lock
          }
        }
      } catch (e) {
        // Fallback to CSS fullscreen modal when API is not supported on mobile
      }
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('members_completed_lessons', JSON.stringify(completedLessons));
    } catch (e) {
      console.error(e);
    }
  }, [completedLessons]);

  const activeLesson = LESSONS.find(l => l.id === activeLessonId) || LESSONS[0];
  const isCurrentCompleted = completedLessons.includes(activeLessonId);

  const toggleCompleteLesson = (id: number) => {
    if (completedLessons.includes(id)) {
      setCompletedLessons(prev => prev.filter(item => item !== id));
    } else {
      setCompletedLessons(prev => [...prev, id]);
    }
  };

  const percentProgress = Math.round((completedLessons.length / LESSONS.length) * 100);

  const handleNextLesson = () => {
    if (activeLessonId < LESSONS.length) {
      setActiveLessonId(prev => prev + 1);
      setIsPlaying(false);
      setVideoProgress(15);
    }
  };

  const handlePrevLesson = () => {
    if (activeLessonId > 1) {
      setActiveLessonId(prev => prev - 1);
      setIsPlaying(false);
      setVideoProgress(15);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 text-[#111111]">
      {/* Mobile Fullscreen Modal Overlay */}
      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800 text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[10px] uppercase shrink-0">
                AULA {activeLesson.id}
              </span>
              <h3 className="font-bold text-xs text-white truncate">
                {activeLesson.title}
              </h3>
            </div>
            <button
              onClick={() => {
                setIsFullscreenModalOpen(false);
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
            >
              <X className="w-4 h-4 text-white" />
              <span>Sair</span>
            </button>
          </div>

          <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center p-0 m-0 overflow-hidden">
            {activeLesson.embedUrl ? (
              <iframe
                src={activeLesson.embedUrl}
                className="w-full h-full border-0 block"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={activeLesson.title}
              />
            ) : (
              <div className="text-white text-xs">Vídeo em tela cheia</div>
            )}
          </div>
        </div>
      )}

      {/* Discreet Clean Header */}
      <div className="bg-white border-b border-[#E5E5E5] pt-4 pb-4 px-4 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[#111111]" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-[#111111] tracking-tight truncate">
              Área de Membros
            </h1>
            <p className="text-[11px] text-[#71717A] truncate">
              Treinamento & Guia do Usuário
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#3F3F46]">
            <BookOpen className="w-3.5 h-3.5 text-[#71717A]" />
            <span>{completedLessons.length}/{LESSONS.length}</span>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mt-3 w-full h-1.5 bg-[#E4E4E7] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#111111] transition-all duration-500 rounded-full"
            style={{ width: `${percentProgress}%` }}
          />
        </div>
      </div>

      <div className="px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4 max-w-xl mx-auto">
        {/* Clean Player Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-2xs">
          {/* Video Player Box */}
          <div
            ref={playerContainerRef}
            className="relative aspect-video min-h-[200px] sm:min-h-[280px] bg-black flex items-center justify-center select-none overflow-hidden group w-full"
          >
            {activeLesson.embedUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                <iframe
                  src={activeLesson.embedUrl}
                  className="w-full h-full border-0 block mx-auto my-auto"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={activeLesson.title}
                />
                <button
                  onClick={handleFullscreen}
                  className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-black text-white font-medium text-[11px] backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-md z-20 cursor-pointer active:scale-95"
                  title="Abrir em Tela Cheia"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                  <span>Tela Cheia</span>
                </button>
              </div>
            ) : (
              <div className="w-full h-full p-4 flex flex-col justify-between items-center text-center">
                {/* Top Minimal Info overlay */}
                <div className="relative z-10 flex items-center justify-between w-full">
                  <span className="px-2.5 py-0.5 rounded-md bg-black/60 text-zinc-300 font-mono text-[10px]">
                    AULA {activeLesson.id} / {LESSONS.length}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-md bg-black/60 text-zinc-300 font-mono text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {activeLesson.duration}
                  </span>
                </div>

                {/* Central Minimal Play Control */}
                <div className="relative z-10 my-auto flex flex-col items-center justify-center">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-14 h-14 rounded-full bg-white text-[#111111] font-bold flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPlaying ? (
                      <div className="flex gap-1">
                        <div className="w-1.5 h-5 bg-[#111111] rounded-xs" />
                        <div className="w-1.5 h-5 bg-[#111111] rounded-xs" />
                      </div>
                    ) : (
                      <Play className="w-6 h-6 text-[#111111] fill-[#111111] ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Bottom Progress Controls */}
                <div className="relative z-10 space-y-1 w-full">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: isPlaying ? '60%' : `${videoProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                    <span>{isPlaying ? '03:40' : '00:00'}</span>
                    <button
                      onClick={handleFullscreen}
                      className="flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Tela Cheia</span>
                    </button>
                    <span>{activeLesson.duration}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lesson Info */}
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 bg-[#F4F4F5] text-[#52525B] text-[10px] font-semibold rounded-md border border-[#E4E4E7]">
                  {activeLesson.category}
                </span>
                {isCurrentCompleted && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Concluída
                  </span>
                )}
              </div>

              <h2 className="font-bold text-sm text-[#111111] leading-snug">
                {activeLesson.title}
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                {activeLesson.subtitle}
              </p>
            </div>

            <p className="text-xs text-[#3F3F46] leading-relaxed bg-[#F8F9FA] p-3 rounded-xl border border-[#E5E5E5]">
              {activeLesson.description}
            </p>

            {/* Topics */}
            <div className="space-y-1.5 pt-1">
              <h4 className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                Conteúdo desta aula:
              </h4>

              <div className="space-y-1">
                {activeLesson.topics.map((topic, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-[#27272A]">
                    <span className="text-[#A1A1AA]">•</span>
                    <span>{topic}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Action Button, Fullscreen & Drive Link */}
            <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFullscreen}
                  className="h-10 px-3.5 rounded-xl font-semibold text-xs bg-[#111111] hover:bg-black text-white flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                  title="Abrir a aula em Tela Cheia"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Tela Cheia</span>
                </button>

                <button
                  onClick={() => toggleCompleteLesson(activeLesson.id)}
                  className={`flex-1 h-10 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isCurrentCompleted
                      ? 'bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#27272A] border border-[#E4E4E7]'
                      : 'bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#111111] border border-[#E4E4E7]'
                  }`}
                >
                  <CheckCircle className={`w-4 h-4 ${isCurrentCompleted ? 'text-emerald-600' : 'text-zinc-500'}`} />
                  <span className="truncate">{isCurrentCompleted ? 'Concluída' : 'Concluir'}</span>
                </button>

                {activeLesson.driveUrl && (
                  <a
                    href={activeLesson.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-3 rounded-xl font-medium text-xs bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#27272A] border border-[#E4E4E7] flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>Drive</span>
                  </a>
                )}
              </div>
            </div>

            {/* Pagination Prev / Next */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handlePrevLesson}
                disabled={activeLessonId === 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#111111] disabled:opacity-30 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>

              <span className="text-[11px] font-mono text-[#A1A1AA]">
                {activeLessonId} / {LESSONS.length}
              </span>

              <button
                onClick={handleNextLesson}
                disabled={activeLessonId === LESSONS.length}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#111111] hover:text-black disabled:opacity-30 flex items-center gap-1 cursor-pointer"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Lessons List Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-xs text-[#71717A] uppercase tracking-wider">
              Aulas ({LESSONS.length})
            </h3>
            <span className="text-[11px] text-[#A1A1AA]">
              {completedLessons.length} concluídas
            </span>
          </div>

          <div className="space-y-2">
            {LESSONS.map((lesson) => {
              const isSelected = lesson.id === activeLessonId;
              const isDone = completedLessons.includes(lesson.id);

              return (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setActiveLessonId(lesson.id);
                    setIsPlaying(false);
                    setVideoProgress(20);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full p-3 rounded-xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#111111] shadow-2xs'
                      : isDone
                      ? 'bg-[#F8F9FA] border-[#E5E5E5] opacity-90'
                      : 'bg-white border-[#E5E5E5] hover:bg-[#F4F4F5]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                        isDone
                          ? 'bg-[#E4E4E7] text-[#27272A]'
                          : isSelected
                          ? 'bg-[#111111] text-white'
                          : 'bg-[#F4F4F5] text-[#71717A]'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle className="w-4 h-4 text-[#111111]" />
                      ) : (
                        `0${lesson.id}`
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-[#71717A]">
                          {lesson.category}
                        </span>
                        <span className="text-[10px] text-[#A1A1AA]">• {lesson.duration}</span>
                      </div>
                      <h4 className={`font-semibold text-xs truncate ${isSelected ? 'text-[#111111]' : 'text-[#27272A]'}`}>
                        {lesson.title}
                      </h4>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-[#111111]' : 'text-[#D4D4D8]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
